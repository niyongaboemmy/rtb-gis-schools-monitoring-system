import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import type { PyramidOverlay } from './overlay-pyramid';

/**
 * Site-map tiles at the drone photos' full resolution, on the standard Web
 * Mercator XYZ grid (the same as the basemap): `{z}/{x}/{y}.webp`, 256 px.
 *
 * Replaces the single-canvas pyramid (overlay-pyramid.ts), which squeezed the
 * whole site into 8192 px and threw away up to 8× of the photos' detail
 * (Nyamirama: photos 0.74 cm/px, map 5.9 cm/px).
 *
 * - The deepest zoom is the first whose pixel is no coarser than the finest
 *   photo (× 1.1): a level is added when the photos hold at least ~10% more
 *   detail than the level above (Nyamirama 0.74 cm → zoom 25, 0.47 cm), not
 *   for a sliver (4× the tiles each level).
 * - Each deepest-level tile is drawn straight from the photos that touch it:
 *   coarse photos first as fill, finer on top, a photo skipped when finer
 *   ones cover the tile. Photos are placed by their GLOBAL pixel edges at
 *   that zoom, so neighbours meet exactly (no seams, no gaps).
 * - A tile is made only where a photo detailed enough for its level lies (or
 *   above a tile of the level below): no deep tiles that merely enlarge an
 *   overview photo.
 * - Upper levels: four tiles below → halved (lanczos3); some → halved over
 *   the photos of that level; none → drawn from the photos of that level.
 * - Memory stays flat: tiles are written one at a time; decoded and resized
 *   photos sit in a byte-capped cache, and tiles are visited row by row so
 *   neighbours reuse them. Photos much coarser than the tile (fill only) are
 *   cropped per tile instead of resized whole (a 94 cm photo at 0.9 cm/px
 *   would be ~52,000 px square).
 */

export interface SiteTiles {
  dir: string;
  minZoom: number;
  maxZoom: number;
  /** Ground cm per pixel at maxZoom (at the site's latitude). */
  groundCmPerPx: number;
  /** Finest photo, ground cm per pixel. */
  sourceCmPerPx: number;
  /** EPSG:3857 [minX, minY, maxX, maxY] of all photos. */
  extent: [number, number, number, number];
  tiles: number;
  bytes: number;
  photos: number;
}

export interface SiteTilesOptions {
  outDir: string;
  /** WebP quality (default 90). */
  quality?: number;
  /** Accept a deepest pixel up to this × the finest photo (default 1.1). */
  slack?: number;
  /** Hard ceiling on the deepest zoom (default 25 ≈ 0.47 cm/px, the map's own limit). */
  zoomCap?: number;
  /** Zoom levels below maxZoom to generate (default down to whole-site ≈ 1 tile). */
  minZoom?: number;
  /** Called after each tile batch: done / total of the deepest level. */
  onProgress?: (done: number, total: number) => void;
  /** Decoded / resized photo cache, bytes (default 256 MB). */
  cacheBytes?: number;
}

const R = 6378137;
const WORLD = 2 * Math.PI * R;
const TILE = 256;
const mercX = (lng: number) => (R * lng * Math.PI) / 180;
const mercY = (lat: number) =>
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
/** Metres (EPSG:3857) per pixel at zoom z. */
export const zoomResolution = (z: number) => WORLD / (TILE * 2 ** z);

/** Deepest zoom: first whose pixel is ≤ finest photo pixel × slack (EPSG:3857 metres). */
export function deepestZoom(finestMercRes: number, slack = 1.1, cap = 25) {
  for (let z = 0; z <= cap; z++)
    if (zoomResolution(z) <= finestMercRes * slack) return z;
  return cap;
}

interface Photo {
  i: number;
  ov: PyramidOverlay;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** EPSG:3857 metres per photo pixel. */
  res: number;
}

/** Global pixel position of an EPSG:3857 coordinate at zoom z (y down). */
const px = (x: number, z: number) => (x + WORLD / 2) / zoomResolution(z);
const py = (y: number, z: number) => (WORLD / 2 - y) / zoomResolution(z);

/** A photo's rectangle in global pixels at zoom z, edges rounded once (shared by neighbours). */
export function photoRect(
  p: Pick<Photo, 'x0' | 'y0' | 'x1' | 'y1'>,
  z: number,
) {
  const left = Math.round(px(p.x0, z));
  const right = Math.round(px(p.x1, z));
  const top = Math.round(py(p.y1, z));
  const bottom = Math.round(py(p.y0, z));
  return { left, top, w: right - left, h: bottom - top };
}

/** Does `finer` fully cover the tile area [l, t, l+256, t+256] (global px)? */
function covers(
  rects: Array<{ left: number; top: number; w: number; h: number }>,
  l: number,
  t: number,
): boolean {
  const N = 8;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = l + ((i + 0.5) * TILE) / N;
      const y = t + ((j + 0.5) * TILE) / N;
      if (
        !rects.some(
          (r) =>
            x >= r.left && x < r.left + r.w && y >= r.top && y < r.top + r.h,
        )
      )
        return false;
    }
  return true;
}

/** Raw RGBA image. */
interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

/** Least-recently-used cache of raw images, capped by bytes. */
class RawCache {
  private map = new Map<string, Promise<Raw | null>>();
  private size = new Map<string, number>();
  private total = 0;
  constructor(private readonly maxBytes: number) {}
  get(key: string, make: () => Promise<Raw | null>): Promise<Raw | null> {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const p = make().catch(() => null);
    this.map.set(key, p);
    void p.then((r) => {
      if (!this.map.has(key)) return;
      const n = r?.data.length ?? 0;
      this.size.set(key, n);
      this.total += n;
      for (const k of this.map.keys()) {
        if (this.total <= this.maxBytes || k === key) break;
        this.total -= this.size.get(k) ?? 0;
        this.size.delete(k);
        this.map.delete(k);
      }
    });
    return p;
  }
}

/** Whole-photo resize only up to this upscale; coarser photos are cropped per tile. */
const MAX_WHOLE_SCALE = 4;

export async function buildSiteTiles(
  overlays: PyramidOverlay[],
  opts: SiteTilesOptions,
): Promise<SiteTiles | null> {
  const quality = opts.quality ?? 90;

  // 1. Measure every photo (header only).
  const photos: Photo[] = [];
  for (const [i, ov] of overlays.entries()) {
    if (
      ![ov.north, ov.south, ov.east, ov.west].every(Number.isFinite) ||
      !(ov.north > ov.south && ov.east > ov.west)
    )
      continue;
    const buf = await ov.load().catch(() => null);
    if (!buf) continue;
    const meta = await sharp(buf)
      .metadata()
      .catch(() => null);
    if (!meta?.width || !meta?.height) continue;
    const x0 = mercX(ov.west);
    const x1 = mercX(ov.east);
    photos.push({
      i,
      ov,
      x0,
      x1,
      y0: mercY(ov.south),
      y1: mercY(ov.north),
      res: (x1 - x0) / meta.width,
    });
  }
  if (!photos.length) return null;

  const finest = Math.min(...photos.map((p) => p.res));
  const maxZoom = deepestZoom(finest, opts.slack ?? 1.1, opts.zoomCap ?? 25);
  const extent: [number, number, number, number] = [
    Math.min(...photos.map((p) => p.x0)),
    Math.min(...photos.map((p) => p.y0)),
    Math.max(...photos.map((p) => p.x1)),
    Math.max(...photos.map((p) => p.y1)),
  ];
  // Coarse first, finer on top.
  photos.sort(
    (a, b) => b.res - a.res || (a.ov.drawOrder ?? 0) - (b.ov.drawOrder ?? 0),
  );
  const siteSpan = Math.max(extent[2] - extent[0], extent[3] - extent[1]);
  const minZoom = Math.max(
    0,
    Math.min(
      maxZoom,
      opts.minZoom ?? Math.floor(Math.log2(WORLD / siteSpan)) - 1,
    ),
  );

  await fs.promises.rm(opts.outDir, { recursive: true, force: true });

  const cache = new RawCache(opts.cacheBytes ?? 256 * 1024 * 1024);
  const toRaw = async (img: sharp.Sharp): Promise<Raw> => {
    const { data, info } = await img
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  };
  const native = (k: number) =>
    cache.get(`n${k}`, async () => {
      const buf = await photos[k].ov.load();
      return buf ? toRaw(sharp(buf)) : null;
    });

  /** Photo rectangles in global pixels at the level being built. */
  let rects: Array<{ left: number; top: number; w: number; h: number }> = [];
  let level = maxZoom;

  /** The photo resized whole to its global-pixel rectangle (shared edges with neighbours). */
  const whole = (k: number) => {
    const r = rects[k];
    return cache.get(`w${level}:${k}`, async () => {
      const n = await native(k);
      if (!n) return null;
      return toRaw(
        sharp(n.data, {
          raw: { width: n.width, height: n.height, channels: 4 },
        }).resize(r.w, r.h, { fit: 'fill', kernel: 'lanczos3' }),
      );
    });
  };

  /** Pixels of photo k inside the global-pixel box [cl, ct, cr, cb). */
  const piece = async (
    k: number,
    cl: number,
    ct: number,
    cr: number,
    cb: number,
  ): Promise<Buffer | null> => {
    const r = rects[k];
    const n = await native(k);
    if (!n) return null;
    const w = cr - cl;
    const h = cb - ct;
    if (r.w <= n.width * MAX_WHOLE_SCALE) {
      const full = await whole(k);
      if (!full) return null;
      return sharp(full.data, {
        raw: { width: full.width, height: full.height, channels: 4 },
      })
        .extract({ left: cl - r.left, top: ct - r.top, width: w, height: h })
        .raw()
        .toBuffer();
    }
    // Coarse fill: crop the source area (1 px margin), scale it, cut the box.
    const sx = n.width / r.w;
    const sy = n.height / r.h;
    const u0 = Math.max(0, Math.floor((cl - r.left) * sx) - 1);
    const v0 = Math.max(0, Math.floor((ct - r.top) * sy) - 1);
    const u1 = Math.min(n.width, Math.ceil((cr - r.left) * sx) + 1);
    const v1 = Math.min(n.height, Math.ceil((cb - r.top) * sy) + 1);
    const tw = Math.max(1, Math.round((u1 - u0) / sx));
    const th = Math.max(1, Math.round((v1 - v0) / sy));
    const ox = Math.min(
      Math.max(0, Math.round(cl - r.left - u0 / sx)),
      Math.max(0, tw - w),
    );
    const oy = Math.min(
      Math.max(0, Math.round(ct - r.top - v0 / sy)),
      Math.max(0, th - h),
    );
    return sharp(n.data, {
      raw: { width: n.width, height: n.height, channels: 4 },
    })
      .extract({ left: u0, top: v0, width: u1 - u0, height: v1 - v0 })
      .resize(Math.max(tw, w + ox), Math.max(th, h + oy), {
        fit: 'fill',
        kernel: 'lanczos3',
      })
      .extract({ left: ox, top: oy, width: w, height: h })
      .raw()
      .toBuffer();
  };

  const blank = (size: number) =>
    sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

  /**
   * Layers of one tile drawn from the photos in `row` that are not much
   * finer than this level (finer detail comes from the tiles below):
   * coarse first, finer on top, a photo skipped when finer ones cover it.
   */
  const photoLayers = async (
    tx: number,
    ty: number,
    row: number[],
    minRes: number,
  ): Promise<sharp.OverlayOptions[]> => {
    const l = tx * TILE;
    const t = ty * TILE;
    const hit = row.filter(
      (k) =>
        photos[k].res >= minRes &&
        rects[k].left < l + TILE &&
        rects[k].left + rects[k].w > l,
    );
    const used = hit.filter((k, n) => {
      const finer = hit
        .slice(n + 1)
        .filter((f) => photos[f].res < photos[k].res * 0.75);
      return (
        !finer.length ||
        !covers(
          finer.map((f) => rects[f]),
          l,
          t,
        )
      );
    });
    const layers: sharp.OverlayOptions[] = [];
    for (const k of used) {
      const r = rects[k];
      const cl = Math.max(l, r.left);
      const ct = Math.max(t, r.top);
      const cr = Math.min(l + TILE, r.left + r.w);
      const cb = Math.min(t + TILE, r.top + r.h);
      if (cr <= cl || cb <= ct) continue;
      const data = await piece(k, cl, ct, cr, cb);
      if (!data) continue;
      layers.push({
        input: data,
        raw: { width: cr - cl, height: cb - ct, channels: 4 },
        left: cl - l,
        top: ct - t,
      });
    }
    return layers;
  };

  /** The tiles of level z+1 under (x, y), halved to one 256 px layer. */
  const halvedChildren = async (z: number, x: number, y: number) => {
    const kids: sharp.OverlayOptions[] = [];
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      if (!present.has(`${2 * x + dx}/${2 * y + dy}`)) continue;
      const f = path.join(
        opts.outDir,
        String(z + 1),
        String(2 * x + dx),
        `${2 * y + dy}.webp`,
      );
      kids.push({
        input: await sharp(f).ensureAlpha().raw().toBuffer(),
        raw: { width: TILE, height: TILE, channels: 4 },
        left: dx * TILE,
        top: dy * TILE,
      });
    }
    const merged = await blank(2 * TILE)
      .composite(kids)
      .raw()
      .toBuffer();
    return sharp(merged, {
      raw: { width: 2 * TILE, height: 2 * TILE, channels: 4 },
    })
      .resize(TILE, TILE, { kernel: 'lanczos3' })
      .raw()
      .toBuffer();
  };

  let tiles = 0;
  let bytes = 0;
  let done = 0;
  let total = 1;
  /** Tiles written at the level below ("x/y"). */
  let present = new Set<string>();
  for (let z = maxZoom; z >= minZoom; z--) {
    level = z;
    rects = photos.map((p) => photoRect(p, z));
    const tileRes = zoomResolution(z);

    // Tiles this level needs: where a photo detailed enough for it lies, and
    // above every tile of the level below.
    const need = new Map<number, Set<number>>();
    const add = (x: number, y: number) => {
      let xs = need.get(y);
      if (!xs) need.set(y, (xs = new Set()));
      xs.add(x);
    };
    rects.forEach((r, k) => {
      if (photos[k].res > tileRes * 2 || r.w <= 0 || r.h <= 0) return;
      for (
        let y = Math.floor(r.top / TILE);
        y <= Math.floor((r.top + r.h - 1) / TILE);
        y++
      )
        for (
          let x = Math.floor(r.left / TILE);
          x <= Math.floor((r.left + r.w - 1) / TILE);
          x++
        )
          add(x, y);
    });
    for (const key of present) {
      const [x, y] = key.split('/').map(Number);
      add(x >> 1, y >> 1);
    }
    if (z === maxZoom) {
      let n = 0;
      for (const xs of need.values()) n += xs.size;
      total = Math.max(1, Math.round((n * 4) / 3));
    }

    const next = new Set<string>();
    for (const ty of [...need.keys()].sort((a, b) => a - b)) {
      const rowTop = ty * TILE;
      const row = rects
        .map((_, k) => k)
        .filter(
          (k) =>
            rects[k].top < rowTop + TILE &&
            rects[k].top + rects[k].h > rowTop &&
            rects[k].w > 0 &&
            rects[k].h > 0,
        );
      for (const tx of [...need.get(ty)!].sort((a, b) => a - b)) {
        done++;
        const kidCount =
          z < maxZoom
            ? [0, 1, 2, 3].filter((i) =>
                present.has(`${2 * tx + (i & 1)}/${2 * ty + (i >> 1)}`),
              ).length
            : 0;
        // Photos no finer than half this level's pixel: finer ones are in the
        // tiles below (at the deepest level, every photo qualifies).
        const minRes = z === maxZoom ? 0 : tileRes / 2;
        const layers =
          kidCount === 4 ? [] : await photoLayers(tx, ty, row, minRes);
        if (kidCount)
          layers.push({
            input: await halvedChildren(z, tx, ty),
            raw: { width: TILE, height: TILE, channels: 4 },
            left: 0,
            top: 0,
          });
        if (!layers.length) continue;
        const out = await blank(TILE)
          .composite(layers)
          .webp({ quality, alphaQuality: 90, smartSubsample: true, effort: 4 })
          .toBuffer();
        const file = path.join(
          opts.outDir,
          String(z),
          String(tx),
          `${ty}.webp`,
        );
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await fs.promises.writeFile(file, out);
        next.add(`${tx}/${ty}`);
        tiles++;
        bytes += out.length;
      }
      opts.onProgress?.(Math.min(done, total), total);
    }
    present = next;
  }
  opts.onProgress?.(total, total);
  if (!tiles) return null;

  const lat =
    (Math.atan(Math.sinh((extent[1] + extent[3]) / 2 / R)) * 180) / Math.PI;
  const cos = Math.cos((lat * Math.PI) / 180);
  return {
    dir: opts.outDir,
    minZoom,
    maxZoom,
    groundCmPerPx: +(zoomResolution(maxZoom) * cos * 100).toFixed(2),
    sourceCmPerPx: +(finest * cos * 100).toFixed(2),
    extent,
    tiles,
    bytes,
    photos: photos.length,
  };
}
