import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/**
 * Turns a site map's ground overlays (drone photos, usually exported as a
 * "super-overlay": the same area at several detail levels) into ONE 256 px
 * WebP tile pyramid, so the map downloads only the tiles on screen instead of
 * every photo at every level.
 *
 * Coarse levels go first and finer photos on top; a coarse photo fully
 * covered by finer ones is skipped. The canvas is at the finest resolution,
 * capped at `maxPx` per side to bound memory.
 *
 * Tile layout (libvips "google"): `{z}/{y}/{x}.webp`, the image pinned to the
 * top-left of a square of `256 · 2^maxZoom` px; zoom `maxZoom` is the canvas'
 * own resolution. Positions are in Web Mercator (EPSG:3857), like the map.
 */

export interface PyramidOverlay {
  north: number;
  south: number;
  east: number;
  west: number;
  drawOrder?: number;
  /** Load the photo's bytes (JPEG / PNG / WebP). Null when unavailable. */
  load: () => Promise<Buffer | null>;
}

export interface OverlayPyramid {
  /** Local folder holding `{z}/{y}/{x}.webp`. */
  dir: string;
  maxZoom: number;
  /** Metres per pixel at maxZoom (EPSG:3857). */
  resolution: number;
  /** Top-left corner of the tile grid, EPSG:3857 metres. */
  origin: [number, number];
  /** Canvas extent in EPSG:3857 [minX, minY, maxX, maxY]. */
  extent: [number, number, number, number];
  width: number;
  height: number;
  /** Photos used / given. */
  used: number;
  total: number;
  tiles: number;
}

const R = 6378137;
const mercX = (lng: number) => (R * lng * Math.PI) / 180;
const mercY = (lat: number) =>
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const plausible = (o: PyramidOverlay) =>
  [o.north, o.south, o.east, o.west].every(Number.isFinite) &&
  o.north > o.south &&
  o.east > o.west &&
  Math.abs(o.north) <= 85 &&
  Math.abs(o.east) <= 180 &&
  !(o.north === 0 && o.east === 0);

interface Placed {
  ov: PyramidOverlay;
  /** EPSG:3857 box */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** metres per pixel of the photo */
  res: number;
}

/** A coarse photo adds nothing when finer photos cover every sample point. */
function coveredByFiner(p: Placed, candidates: Placed[]): boolean {
  // Only finer photos that overlap this one can cover it.
  const finer = candidates.filter(
    (f) => f.x1 > p.x0 && f.x0 < p.x1 && f.y1 > p.y0 && f.y0 < p.y1,
  );
  if (!finer.length) return false;
  const N = 8;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = p.x0 + ((p.x1 - p.x0) * (i + 0.5)) / (N + 1);
      const y = p.y0 + ((p.y1 - p.y0) * (j + 0.5)) / (N + 1);
      if (!finer.some((f) => x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1))
        return false;
    }
  }
  return true;
}

async function countFiles(dir: string): Promise<number> {
  let n = 0;
  for (const e of await fs.promises.readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += await countFiles(path.join(dir, e.name));
    else if (e.name.endsWith('.webp')) n++;
  }
  return n;
}

export async function buildOverlayPyramid(
  overlays: PyramidOverlay[],
  opts: { outDir: string; maxPx?: number; quality?: number },
): Promise<OverlayPyramid | null> {
  const maxPx = opts.maxPx ?? 8192;
  const candidates = overlays.filter(plausible);
  if (!candidates.length) return null;

  // Load + measure every photo.
  const placed: Placed[] = [];
  for (const ov of candidates) {
    const buf = await ov.load().catch(() => null);
    if (!buf) continue;
    const meta = await sharp(buf)
      .metadata()
      .catch(() => null);
    if (!meta?.width || !meta?.height) continue;
    const x0 = mercX(ov.west);
    const x1 = mercX(ov.east);
    const y0 = mercY(ov.south);
    const y1 = mercY(ov.north);
    // Bytes are not kept (thousands of photos in a drone export); the
    // ones used are read again when composited.
    placed.push({ ov, x0, y0, x1, y1, res: (x1 - x0) / meta.width });
  }
  if (!placed.length) return null;

  // Coarse first, finer on top; drop coarse photos the finer ones cover.
  placed.sort(
    (a, b) => b.res - a.res || (a.ov.drawOrder ?? 0) - (b.ov.drawOrder ?? 0),
  );
  const layers = placed.filter(
    (p, i) =>
      !coveredByFiner(
        p,
        placed.slice(i + 1).filter((f) => f.res < p.res * 0.75),
      ),
  );

  const minX = Math.min(...layers.map((p) => p.x0));
  const maxX = Math.max(...layers.map((p) => p.x1));
  const minY = Math.min(...layers.map((p) => p.y0));
  const maxY = Math.max(...layers.map((p) => p.y1));
  const finest = Math.min(...layers.map((p) => p.res));
  const res = Math.max(finest, (maxX - minX) / maxPx, (maxY - minY) / maxPx);
  // Tolerance: float error must not add a pixel (and a whole tile level).
  const width = Math.max(1, Math.ceil((maxX - minX) / res - 1e-6));
  const height = Math.max(1, Math.ceil((maxY - minY) / res - 1e-6));

  // Resize each photo to its place on the canvas.
  const inputs: sharp.OverlayOptions[] = [];
  for (const p of layers) {
    // Round each EDGE once, so neighbouring photos share the same pixel
    // edge (rounding position and size separately left 1 px seams).
    const left = Math.round((p.x0 - minX) / res);
    const right = Math.round((p.x1 - minX) / res);
    const top = Math.round((maxY - p.y1) / res);
    const bottom = Math.round((maxY - p.y0) / res);
    const w = Math.max(1, right - left);
    const h = Math.max(1, bottom - top);
    // Clip to the canvas (rounding can push a pixel over).
    const cw = Math.min(w, width - left);
    const ch = Math.min(h, height - top);
    if (cw <= 0 || ch <= 0 || left < 0 || top < 0) continue;
    const buf = await p.ov.load().catch(() => null);
    if (!buf) continue;
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
      .extract({ left: 0, top: 0, width: cw, height: ch })
      .raw()
      .toBuffer({ resolveWithObject: true });
    inputs.push({
      input: data,
      raw: { width: info.width, height: info.height, channels: 4 },
      left,
      top,
    });
  }
  if (!inputs.length) return null;

  await fs.promises.rm(opts.outDir, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(opts.outDir), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
    limitInputPixels: false,
  })
    .composite(inputs)
    .webp({ quality: opts.quality ?? 80, alphaQuality: 90 })
    .tile({
      size: 256,
      layout: 'google',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toFile(opts.outDir);
  await fs.promises
    .rm(path.join(opts.outDir, 'blank.png'), { force: true })
    .catch(() => null);

  // The deepest level libvips wrote is the canvas' own resolution.
  const levels = (await fs.promises.readdir(opts.outDir))
    .map(Number)
    .filter(Number.isInteger);
  const maxZoom = Math.max(0, ...levels);
  return {
    dir: opts.outDir,
    maxZoom,
    resolution: res,
    origin: [minX, maxY],
    extent: [minX, maxY - height * res, minX + width * res, maxY],
    width,
    height,
    used: inputs.length,
    total: overlays.length,
    tiles: await countFiles(opts.outDir),
  };
}
