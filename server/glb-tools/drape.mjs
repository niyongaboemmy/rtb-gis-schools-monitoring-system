#!/usr/bin/env node
/**
 * Ortho draping: roofs and ground of a school model get their colour from
 * the site map's drone photos (≈ 1 cm/px) instead of the model's own texture
 * (≈ 8 cm/px). Walls keep the model texture.
 *
 * Input: an optimized GLB in the local frame made by optimize.mjs (X = east,
 * Y = up, Z = -north, metres, centred on `origin`), and the site map's
 * full-detail tiles (server overlay-tiles.ts: `{z}/{x}/{y}.webp`, Web
 * Mercator).
 *
 * 1. Alignment check: in the 60 m window with the most roof/ground, the
 *    model's upward faces drawn top-down with their own texture are matched
 *    against the tiles (normalized cross-correlation of edge images, ± 1 m).
 *    Draping only when the best shift is ≤ 8 cm with a clear peak.
 * 2. Pages: 4096 px texture pages cut from the tiles, at `cm` per pixel —
 *    stepped down only if the roofs and ground need more than `max-pages`
 *    pages (default 16: quality first; a whole campus at 2 cm took 11 pages,
 *    a ≈ 108 MB model). Skipped when that detail would be no sharper than the
 *    model's own (`model-cm`).
 * 3. A face is draped when it faces up (≤ 45° from horizontal), is the
 *    topmost surface there (orthophotos only see that), fits inside its
 *    page and lies on photo pixels (not a gap).
 * 4. Output: the model with one extra material per page (WebP, mipmapped),
 *    Meshopt-compressed like optimize.mjs.
 *
 *   node drape.mjs <in.glb> <out.glb> --lat <lat0> --lng <lng0> --tiles <dir>
 *        --tiles-max-zoom <z> [--cm 2] [--page 4096] [--max-pages 16] [--model-cm <cm>]
 *
 * Exit: 0 done or skipped · 2 bad args · 3 read · 4 build · 5 write.
 * Prints one JSON line: {draped, kept, occluded, pages, cm, zoom, alignment, ms}
 * or {skipped: reason, alignment?}. A skip writes no output file.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const R = 6378137;
const WORLD = 2 * Math.PI * R;
const TILE = 256;
const zoomRes = (z) => WORLD / (TILE * 2 ** z);
const mercX = (lng) => (R * lng * Math.PI) / 180;
const mercY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Metres per degree at lat0, as optimize.mjs's reprojection. */
export function metresPerDegree(lat0) {
  const la = (lat0 * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * la) + 1.175 * Math.cos(4 * la),
    lon: 111412.84 * Math.cos(la) - 93.5 * Math.cos(3 * la),
  };
}

/** Local frame (x east, z = -north) → EPSG:3857 metres. */
export function localToMerc(origin) {
  const m = metresPerDegree(origin.lat);
  return (x, z) => [mercX(origin.lng + x / m.lon), mercY(origin.lat - z / m.lat)];
}

/** Normalized cross-correlation over integer shifts (edge images, NaN = no data). */
export function bestShift(a, b, n, radius, step = 2) {
  let best = { dx: 0, dy: 0, ncc: -2 };
  const scores = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, c = 0;
      for (let y = radius + 1; y < n - radius - 1; y += step)
        for (let x = radius + 1; x < n - radius - 1; x += step) {
          const va = a[y * n + x];
          if (Number.isNaN(va)) continue;
          const vb = b[(y + dy) * n + x + dx];
          if (Number.isNaN(vb)) continue;
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; c++;
        }
      if (c < 100) continue;
      const den = Math.sqrt((saa - (sa * sa) / c) * (sbb - (sb * sb) / c));
      const s = den > 0 ? (sab - (sa * sb) / c) / den : -1;
      scores.push(s);
      if (s > best.ncc) best = { dx, dy, ncc: s };
    }
  scores.sort((p, q) => p - q);
  return { ...best, median: scores.length ? scores[Math.floor(scores.length / 2)] : null };
}

/** Gradient magnitude; NaN where any neighbour has no data. */
function edges(img, n) {
  const g = new Float32Array(n * n).fill(NaN);
  for (let y = 1; y < n - 1; y++)
    for (let x = 1; x < n - 1; x++) {
      const l = img[y * n + x - 1], r = img[y * n + x + 1], u = img[(y - 1) * n + x], d = img[(y + 1) * n + x];
      if (Number.isNaN(l) || Number.isNaN(r) || Number.isNaN(u) || Number.isNaN(d)) continue;
      g[y * n + x] = Math.hypot(r - l, d - u);
    }
  return g;
}

/**
 * Rasterize triangles (pixel coords + per-vertex value) with a "keep the
 * highest" depth test. `shade(l1, l2, l3, f)` returns the pixel value.
 */
function rasterize(n, tris, onPixel) {
  for (const t of tris) {
    const [a, b, c] = t.p;
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (!d) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(n - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(n - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const l1 = ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / d;
        const l2 = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-3 || l2 < -1e-3 || l3 < -1e-3) continue;
        onPixel(y * n + x, l1, l2, l3, t);
      }
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [inputPath, outputPath] = args._;
  const origin = { lat: Number(args.lat), lng: Number(args.lng) };
  const tilesDir = args.tiles;
  const tilesMaxZoom = Number(args['tiles-max-zoom']);
  const cmWanted = Number(args.cm || 2);
  const PAGE = Number(args.page || 4096);
  // At most this many texture pages (download size); the detail steps down
  // until the roofs and ground fit.
  const MAX_PAGES = Math.max(1, Number(args['max-pages'] || 16));
  // The model's own detail (cm/px): draping coarser than ~80% of it is pointless.
  const modelCm = Number(args['model-cm']);
  if (!inputPath || !outputPath || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng) || !tilesDir || !Number.isFinite(tilesMaxZoom)) {
    console.error('usage: drape.mjs <in.glb> <out.glb> --lat <lat0> --lng <lng0> --tiles <dir> --tiles-max-zoom <z> [--cm 2] [--page 4096] [--max-pages 4] [--model-cm <cm>]');
    process.exit(2);
  }
  const t0 = Date.now();
  const say = (o) => process.stdout.write(JSON.stringify({ ...o, ms: Date.now() - t0 }) + '\n');

  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS, EXTTextureWebP } = await import('@gltf-transform/extensions');
  const { dequantize, transformMesh, prune, meshopt } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  const { default: sharp } = await import('sharp');
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

  let doc;
  try {
    doc = await io.read(inputPath);
  } catch (err) {
    console.error(`read failed: ${err?.message || err}`);
    process.exit(3);
  }

  try {
    // Real metres, transforms baked (optimize.mjs output is quantized with a node scale).
    await doc.transform(dequantize());
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      transformMesh(mesh, node.getWorldMatrix());
      node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
      let p = node.getParentNode();
      while (p) {
        p.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
        p = p.getParentNode();
      }
    }

    const toMerc = localToMerc(origin);
    const cos = Math.cos((origin.lat * Math.PI) / 180);

    // Faces of every textured triangle primitive, in map coordinates.
    const prims = [];
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const pos = prim.getAttribute('POSITION');
        const uv = prim.getAttribute('TEXCOORD_0');
        const tex = prim.getMaterial()?.getBaseColorTexture();
        if (!pos || !uv || !tex) continue;
        const P = pos.getArray(), U = uv.getArray();
        const I = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
        const nV = pos.getCount();
        const MX = new Float64Array(nV), MY = new Float64Array(nV);
        for (let i = 0; i < nV; i++) [MX[i], MY[i]] = toMerc(P[i * 3], P[i * 3 + 2]);
        prims.push({ prim, mesh, P, U, I, MX, MY, tex });
      }
    if (!prims.length) return say({ skipped: 'no textured mesh' });

    /** Upward faces: [prim index, first index] (≤ 45° from horizontal). */
    const up = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    prims.forEach((pr, k) => {
      const { P, I } = pr;
      for (let f = 0; f + 2 < I.length; f += 3) {
        const a = I[f], b = I[f + 1], c = I[f + 2];
        const e1 = [P[b*3]-P[a*3], P[b*3+1]-P[a*3+1], P[b*3+2]-P[a*3+2]], e2 = [P[c*3]-P[a*3], P[c*3+1]-P[a*3+1], P[c*3+2]-P[a*3+2]];
        const nx = e1[1]*e2[2]-e1[2]*e2[1], ny = e1[2]*e2[0]-e1[0]*e2[2], nz = e1[0]*e2[1]-e1[1]*e2[0];
        const len = Math.hypot(nx, ny, nz);
        if (len > 0 && ny / len >= 0.707) up.push(k, f);
        for (const v of [a, b, c]) {
          if (pr.MX[v] < minX) minX = pr.MX[v];
          if (pr.MX[v] > maxX) maxX = pr.MX[v];
          if (pr.MY[v] < minY) minY = pr.MY[v];
          if (pr.MY[v] > maxY) maxY = pr.MY[v];
        }
      }
    });
    if (!up.length) return say({ skipped: 'no upward faces' });

    // Page detail: the wanted cm/px, stepped down until the upward faces fit
    // in MAX_PAGES pages (a whole campus at 2 cm needed 11 pages, 107 MB).
    const MARGIN = 128; // px each side
    const pagesAt = (c) => {
      const core = (PAGE - 2 * MARGIN) * (c / 100 / cos);
      const cells = new Set();
      for (let i = 0; i < up.length; i += 2) {
        const pr = prims[up[i]], a = pr.I[up[i + 1]];
        cells.add(`${Math.floor((pr.MX[a] - minX) / core)}/${Math.floor((maxY - pr.MY[a]) / core)}`);
      }
      return cells.size;
    };
    let cm = cmWanted;
    while (pagesAt(cm) > MAX_PAGES && cm < 50) cm = +(cm * 1.1).toFixed(2);
    if (Number.isFinite(modelCm) && modelCm > 0 && cm > modelCm * 0.8)
      return say({ skipped: `photos would not be sharper than the model (${cm} vs ${modelCm} cm/px)`, cm });
    const pageRes = cm / 100 / cos; // EPSG:3857 metres per page pixel
    // Tile level to read: the shallowest at least as detailed as the pages.
    let zoom = tilesMaxZoom;
    for (let z = 0; z <= tilesMaxZoom; z++) if (zoomRes(z) <= pageRes) { zoom = z; break; }
    const tileRes = zoomRes(zoom);

    // Tile reader with a small cache of decoded tiles.
    const tileCache = new Map();
    const readTile = async (x, y) => {
      const key = `${x}/${y}`;
      if (tileCache.has(key)) return tileCache.get(key);
      const f = path.join(tilesDir, String(zoom), String(x), `${y}.webp`);
      const v = fs.existsSync(f) ? await sharp(f).ensureAlpha().raw().toBuffer() : null;
      tileCache.set(key, v);
      if (tileCache.size > 2048) tileCache.delete(tileCache.keys().next().value);
      return v;
    };
    /** RGBA image of an EPSG:3857 box [x0, y0top, w, h px] at `res` m/px, from the tiles. */
    const orthoImage = async (x0, yTop, w, h, res) => {
      const gx0 = (x0 + WORLD / 2) / tileRes, gy0 = (WORLD / 2 - yTop) / tileRes;
      const gw = Math.ceil((w * res) / tileRes) + 1, gh = Math.ceil((h * res) / tileRes) + 1;
      const tx0 = Math.floor(gx0 / TILE), ty0 = Math.floor(gy0 / TILE);
      const tx1 = Math.floor((gx0 + gw) / TILE), ty1 = Math.floor((gy0 + gh) / TILE);
      const layers = [];
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const data = await readTile(tx, ty);
          if (data) layers.push({ input: data, raw: { width: TILE, height: TILE, channels: 4 }, left: (tx - tx0) * TILE, top: (ty - ty0) * TILE });
        }
      const W = (tx1 - tx0 + 1) * TILE, H = (ty1 - ty0 + 1) * TILE;
      const mosaic = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false })
        .composite(layers).raw().toBuffer();
      const left = Math.floor(gx0 - tx0 * TILE), top = Math.floor(gy0 - ty0 * TILE);
      const cw = Math.min(W - left, Math.max(1, Math.round((w * res) / tileRes)));
      const ch = Math.min(H - top, Math.max(1, Math.round((h * res) / tileRes)));
      return sharp(mosaic, { raw: { width: W, height: H, channels: 4 }, limitInputPixels: false })
        .extract({ left, top, width: cw, height: ch })
        .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
        .raw()
        .toBuffer();
    };

    // ── 1. Alignment check ────────────────────────────────────────────────
    const AW = 60; // metres
    const AN = 1024;
    const aRes = AW / cos / AN;
    // Window with the most upward faces (30 m cells).
    const cell = 30 / cos;
    const counts = new Map();
    for (let i = 0; i < up.length; i += 2) {
      const pr = prims[up[i]], a = pr.I[up[i + 1]];
      const key = `${Math.floor((pr.MX[a] - minX) / cell)}/${Math.floor((maxY - pr.MY[a]) / cell)}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    /** Is there a photo tile at this EPSG:3857 point? */
    const hasTile = (mx, my) =>
      fs.existsSync(path.join(tilesDir, String(zoom), String(Math.floor((mx + WORLD / 2) / tileRes / TILE)), `${Math.floor((WORLD / 2 - my) / tileRes / TILE)}.webp`));
    // Busiest 60 m window whose centre and corners have photos.
    const windows = [];
    for (const [key] of counts) {
      const [cx, cy] = key.split('/').map(Number);
      let nsum = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) nsum += counts.get(`${cx + dx}/${cy + dy}`) || 0;
      windows.push({ cx, cy, nsum });
    }
    windows.sort((p, q) => q.nsum - p.nsum);
    // Sample points inside the model (a small site is smaller than the window).
    const covered = ({ cx, cy }) => {
      const x = minX + cx * cell, y = maxY - cy * cell, w = 2 * cell;
      return [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].every(([fx, fy]) =>
        hasTile(Math.min(maxX, Math.max(minX, x + fx * w)), Math.min(maxY, Math.max(minY, y - fy * w))),
      );
    };
    const win = windows.find(covered);
    if (!win) return say({ skipped: 'no area with both model and photos' });
    const bestCell = [win.cx, win.cy];
    const wx0 = minX + bestCell[0] * cell, wyTop = maxY - bestCell[1] * cell;
    const modelImg = new Float32Array(AN * AN).fill(NaN), depth = new Float32Array(AN * AN).fill(-Infinity);
    const texCache = new Map();
    const texRaw = async (tex) => {
      if (!texCache.has(tex)) {
        const { data, info } = await sharp(tex.getImage(), { limitInputPixels: false }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        texCache.set(tex, { data, w: info.width, h: info.height });
      }
      return texCache.get(tex);
    };
    for (let i = 0; i < up.length; i += 2) {
      const pr = prims[up[i]], f = up[i + 1];
      const vs = [pr.I[f], pr.I[f + 1], pr.I[f + 2]];
      const p = vs.map((v) => [(pr.MX[v] - wx0) / aRes, (wyTop - pr.MY[v]) / aRes]);
      if (p.every(([x, y]) => x < 0 || y < 0 || x >= AN || y >= AN)) continue;
      const T = await texRaw(pr.tex);
      rasterize(AN, [{ p, vs, pr, T }], (idx, l1, l2, l3, t) => {
        const [a, b, c] = t.vs, P = t.pr.P, U = t.pr.U;
        const h = l1 * P[a * 3 + 1] + l2 * P[b * 3 + 1] + l3 * P[c * 3 + 1];
        if (h < depth[idx]) return;
        depth[idx] = h;
        const u = l1 * U[a * 2] + l2 * U[b * 2] + l3 * U[c * 2], v = l1 * U[a * 2 + 1] + l2 * U[b * 2 + 1] + l3 * U[c * 2 + 1];
        const tx = Math.min(t.T.w - 1, Math.max(0, Math.floor(u * t.T.w))), ty = Math.min(t.T.h - 1, Math.max(0, Math.floor(v * t.T.h)));
        const k = (ty * t.T.w + tx) * 3;
        modelImg[idx] = 0.299 * t.T.data[k] + 0.587 * t.T.data[k + 1] + 0.114 * t.T.data[k + 2];
      });
    }
    const orthoWin = await orthoImage(wx0, wyTop, AN, AN, aRes);
    const orthoGrey = new Float32Array(AN * AN);
    for (let i = 0; i < AN * AN; i++)
      orthoGrey[i] = orthoWin[i * 4 + 3] < 255 ? NaN : 0.299 * orthoWin[i * 4] + 0.587 * orthoWin[i * 4 + 1] + 0.114 * orthoWin[i * 4 + 2];
    const RADIUS = Math.round(1 / (aRes * cos)); // ± 1 m
    const shift = bestShift(edges(modelImg, AN), edges(orthoGrey, AN), AN, RADIUS);
    const pxCm = aRes * cos * 100;
    const alignment = {
      shiftEastCm: +(shift.dx * pxCm).toFixed(1),
      shiftSouthCm: +(shift.dy * pxCm).toFixed(1),
      ncc: +shift.ncc.toFixed(3),
      median: shift.median == null ? null : +shift.median.toFixed(3),
    };
    const aligned =
      Math.hypot(alignment.shiftEastCm, alignment.shiftSouthCm) <= 8 &&
      shift.ncc >= 0.25 &&
      shift.median != null &&
      shift.ncc >= 2 * Math.max(0.05, shift.median);
    if (!aligned) return say({ skipped: 'photos and model do not line up', alignment });

    // ── 2–3. Pages and the faces they take ───────────────────────────────
    const core = (PAGE - 2 * MARGIN) * pageRes; // EPSG:3857 metres
    const pagesX = Math.max(1, Math.ceil((maxX - minX) / core));
    const pageOf = (mx, my) => [Math.floor((mx - minX) / core), Math.floor((maxY - my) / core)];
    const byPage = new Map();
    for (let i = 0; i < up.length; i += 2) {
      const pr = prims[up[i]], f = up[i + 1];
      const vs = [pr.I[f], pr.I[f + 1], pr.I[f + 2]];
      const cx = (pr.MX[vs[0]] + pr.MX[vs[1]] + pr.MX[vs[2]]) / 3, cy = (pr.MY[vs[0]] + pr.MY[vs[1]] + pr.MY[vs[2]]) / 3;
      const [px, py] = pageOf(cx, cy);
      const key = py * pagesX + px;
      if (!byPage.has(key)) byPage.set(key, []);
      byPage.get(key).push(up[i], f);
    }

    const HRES = 0.04 / cos; // height map: 4 cm
    const OCCLUDED_M = 0.15;
    const draped = new Set(); // "prim:faceStart"
    let occluded = 0;
    const pageOut = [];
    for (const [key, list] of byPage) {
      const px = key % pagesX, py = Math.floor(key / pagesX);
      const x0 = minX + px * core - MARGIN * pageRes;
      const yTop = maxY - py * core + MARGIN * pageRes;
      const ext = PAGE * pageRes;
      // Height of the topmost surface over this page (all faces, any direction).
      const HN = Math.ceil(ext / HRES);
      const top = new Float32Array(HN * HN).fill(-Infinity);
      for (const pr of prims) {
        const { I, P, MX, MY } = pr;
        for (let f = 0; f + 2 < I.length; f += 3) {
          const a = I[f], b = I[f + 1], c = I[f + 2];
          if (Math.max(MX[a], MX[b], MX[c]) < x0 || Math.min(MX[a], MX[b], MX[c]) > x0 + ext) continue;
          if (Math.max(MY[a], MY[b], MY[c]) < yTop - ext || Math.min(MY[a], MY[b], MY[c]) > yTop) continue;
          const p = [a, b, c].map((v) => [(MX[v] - x0) / HRES, (yTop - MY[v]) / HRES]);
          rasterize(HN, [{ p, vs: [a, b, c] }], (idx, l1, l2, l3) => {
            const h = l1 * P[a * 3 + 1] + l2 * P[b * 3 + 1] + l3 * P[c * 3 + 1];
            if (h > top[idx]) top[idx] = h;
          });
        }
      }
      const visible = (x, y, z) => {
        const [mx, my] = toMerc(x, z);
        const hx = Math.floor((mx - x0) / HRES), hy = Math.floor((yTop - my) / HRES);
        if (hx < 0 || hy < 0 || hx >= HN || hy >= HN) return false;
        return y >= top[hy * HN + hx] - OCCLUDED_M;
      };
      const img = await orthoImage(x0, yTop, PAGE, PAGE, pageRes);
      const solid = (mx, my) => {
        const ix = Math.floor((mx - x0) / pageRes), iy = Math.floor((yTop - my) / pageRes);
        return ix >= 0 && iy >= 0 && ix < PAGE && iy < PAGE && img[(iy * PAGE + ix) * 4 + 3] === 255;
      };
      const faces = [];
      for (let i = 0; i < list.length; i += 2) {
        const pr = prims[list[i]], f = list[i + 1];
        const vs = [pr.I[f], pr.I[f + 1], pr.I[f + 2]];
        const P = pr.P;
        const pts = [...vs.map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]), [0, 1, 2].map((k) => (P[vs[0] * 3 + k] + P[vs[1] * 3 + k] + P[vs[2] * 3 + k]) / 3)];
        if (!pts.every(([x, y, z]) => visible(x, y, z))) { occluded++; continue; }
        // Inside the page (margin included) and on photo pixels.
        if (!vs.every((v) => pr.MX[v] >= x0 && pr.MX[v] <= x0 + ext && pr.MY[v] <= yTop && pr.MY[v] >= yTop - ext)) continue;
        const [cx, cy] = toMerc(pts[3][0], pts[3][2]);
        if (!solid(cx, cy) || !vs.every((v) => solid(pr.MX[v], pr.MY[v]))) continue;
        faces.push(list[i], f);
        draped.add(`${list[i]}:${f}`);
      }
      if (!faces.length) continue;
      const webp = await sharp(img, { raw: { width: PAGE, height: PAGE, channels: 4 } })
        .flatten({ background: '#808080' })
        .webp({ quality: 90, effort: 4, smartSubsample: true })
        .toBuffer();
      pageOut.push({ x0, yTop, ext, faces, webp });
    }
    if (!draped.size) return say({ skipped: 'no visible upward faces on photo pixels', alignment });

    // ── 4. Rebuild the mesh: kept faces + one primitive per page ─────────
    const webpExt = doc.createExtension(EXTTextureWebP).setRequired(true);
    void webpExt;
    const buf = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
    for (const [k, pr] of prims.entries()) {
      const keep = [];
      for (let f = 0; f + 2 < pr.I.length; f += 3) if (!draped.has(`${k}:${f}`)) keep.push(pr.I[f], pr.I[f + 1], pr.I[f + 2]);
      pr.prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(keep)).setBuffer(buf));
    }
    for (const page of pageOut) {
      const tex = doc.createTexture().setImage(new Uint8Array(page.webp)).setMimeType('image/webp');
      const src = prims[page.faces[0]].prim.getMaterial();
      const mat = doc.createMaterial().setBaseColorTexture(tex).setDoubleSided(src?.getDoubleSided() ?? false);
      mat.getBaseColorTextureInfo().setMinFilter(9987).setMagFilter(9729);
      const Pout = [], Uout = [], Iout = [];
      for (let i = 0; i < page.faces.length; i += 2) {
        const pr = prims[page.faces[i]], f = page.faces[i + 1];
        for (const v of [pr.I[f], pr.I[f + 1], pr.I[f + 2]]) {
          Iout.push(Pout.length / 3);
          Pout.push(pr.P[v * 3], pr.P[v * 3 + 1], pr.P[v * 3 + 2]);
          Uout.push((pr.MX[v] - page.x0) / page.ext, (page.yTop - pr.MY[v]) / page.ext);
        }
      }
      const mesh = prims[page.faces[0]].mesh;
      mesh.addPrimitive(
        doc.createPrimitive().setMaterial(mat)
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(Pout)).setBuffer(buf))
          .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(Uout)).setBuffer(buf))
          .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(Iout)).setBuffer(buf)),
      );
    }
    await doc.transform(
      prune(),
      meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeTexcoord: 14 }),
    );

    let totalFaces = 0;
    for (const pr of prims) totalFaces += pr.I.length / 3;
    try {
      await io.write(outputPath, doc);
    } catch (err) {
      console.error(`write failed: ${err?.message || err}`);
      process.exit(5);
    }
    say({
      draped: draped.size,
      kept: totalFaces - draped.size,
      occluded,
      pages: pageOut.map((p) => ({ faces: p.faces.length / 2, bytes: p.webp.length })),
      cm,
      cmWanted,
      zoom,
      alignment,
      bytesOut: fs.statSync(outputPath).size,
    });
  } catch (err) {
    console.error(`drape failed: ${err?.stack || err}`);
    process.exit(4);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) await main();
