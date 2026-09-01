#!/usr/bin/env node
/**
 * GLB optimization pipeline for RTB photogrammetry models.
 *
 * Raw Metashape/photogrammetry exports are ~10-40x heavier than the web needs:
 * one dense mesh (10-40M triangles), no quantization, no geometry compression.
 * This collapses that to a streaming-friendly Meshopt GLB.
 *
 * Steps: reproject (geographic -> local metres) -> dedup -> weld ->
 *        simplify (Meshopt, exact; sloppy fallback for huge meshes) -> prune ->
 *        WebP textures -> quantize + reorder + EXT_meshopt_compression.
 *
 * Measured on "Fr Ramon TSS Kabuga": 486.7 MB / 19.5M tris  ->  15.9 MB / 2.0M tris
 * (30x, ~21s on a laptop). The viewer loads it via GLTFLoader + MeshoptDecoder.
 *
 * Run standalone or as a forked child of the API (isolated heap):
 *   node optimize.mjs <input.glb> <output.glb> [ratio=0.1] [textureSize=4096]
 *
 * Exit codes: 0 ok · 2 bad args · 3 read/parse · 4 transform · 5 write.
 * On success prints one JSON line to stdout:
 *   {bytesIn,bytesOut,trisIn,trisOut,ratio,ms,method,reprojected,lat,lng}
 * `lat`/`lng` are the WGS84 centroid when the source carried geographic
 * vertex coordinates (so the caller can sync the school's location), else null.
 */
import fs from 'node:fs';
import process from 'node:process';

const [inputPath, outputPath, ratioArg, texArg] = process.argv.slice(2);
const RATIO = Number(ratioArg ?? 0.1); // keep ~10% of triangles
const TEX = Math.max(512, Number(texArg ?? 4096)); // max texture edge

if (!inputPath || !outputPath) {
  console.error('usage: optimize.mjs <input.glb> <output.glb> [ratio] [texSize]');
  process.exit(2);
}
if (!fs.existsSync(inputPath)) {
  console.error(`input not found: ${inputPath}`);
  process.exit(2);
}

const t0 = Date.now();

let NodeIO, ALL_EXTENSIONS, fns, MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder, sharp;
try {
  ({ NodeIO } = await import('@gltf-transform/core'));
  ({ ALL_EXTENSIONS } = await import('@gltf-transform/extensions'));
  fns = await import('@gltf-transform/functions');
  ({ MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer'));
  ({ default: sharp } = await import('sharp'));
} catch (err) {
  console.error(`dependency load failed: ${err?.message || err}`);
  process.exit(2);
}

const { dedup, prune, weld, simplify, textureCompress, meshopt } = fns;

const countTris = (doc) => {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      t += idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0;
    }
  return Math.round(t);
};

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

let document;
try {
  document = await io.read(inputPath);
} catch (err) {
  console.error(`read failed: ${err?.message || err}`);
  process.exit(3);
}

const bytesIn = fs.statSync(inputPath).size;
const trisIn = countTris(document);

// ── Reproject geographic vertex coordinates → local ENU metres ─────────────
// Agisoft Metashape can export a GLB whose POSITION accessor holds raw WGS84
// (longitude°, latitude°, altitude m). In a metric 3D scene that mesh is a
// sub-millimetre sliver — the viewer loads it but shows nothing. Detect that
// shape and bake every vertex into an East/Up/-North frame centred on the
// model, so the geometry gets sane extents (and float32 precision).
let reprojection = { reprojected: false, lat: null, lng: null };
try {
  reprojection = reprojectIfGeographic(document);
} catch (err) {
  console.error(`reprojection skipped: ${err?.message || err}`);
}

// ── Geometry decimation ───────────────────────────────────────────────────
// Exact Meshopt simplification is best, but its WASM heap (~2 GB, 32-bit)
// traps on very dense meshes (~30M+ tris). Fall back to `simplifySloppy`,
// which uses a fraction of the memory, for those.
// GLB_FORCE_SLOPPY=1 skips the exact attempt (ops escape hatch + test hook).
let method = 'exact';
try {
  if (process.env.GLB_FORCE_SLOPPY === '1') throw new Error('forced sloppy');
  await document.transform(
    dedup(),
    weld(),
    // Meshopt simplifier: collapse to RATIO of triangles, bounded by an
    // absolute error of 1% of the model's size. lockBorder keeps open edges
    // (photogrammetry site boundaries) from peeling back.
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.01, lockBorder: true }),
  );
} catch (err) {
  console.error(`exact simplify failed (${err?.message || err}) — using sloppy fallback`);
  method = 'sloppy';
  try {
    await document.transform(dedup(), weld());
    sloppySimplify(document, RATIO);
  } catch (err2) {
    console.error(`sloppy simplify failed: ${err2?.message || err2}`);
    method = 'none';
  }
}

try {
  await document.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
} catch (err) {
  console.error(`transform failed: ${err?.message || err}`);
  process.exit(4);
}

try {
  await io.write(outputPath, document);
} catch (err) {
  console.error(`write failed: ${err?.message || err}`);
  process.exit(5);
}

const bytesOut = fs.statSync(outputPath).size;
process.stdout.write(
  JSON.stringify({
    bytesIn,
    bytesOut,
    trisIn,
    trisOut: countTris(document),
    ratio: +(bytesIn / bytesOut).toFixed(1),
    ms: Date.now() - t0,
    method,
    reprojected: reprojection.reprojected,
    lat: reprojection.lat,
    lng: reprojection.lng,
  }) + '\n',
);
process.exit(0);

// ── helpers ───────────────────────────────────────────────────────────────

/** True when no node in the document carries a transform, so baking vertex
 *  positions in place is safe. */
function sceneHasNoNodeTransforms(root) {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const node of root.listNodes()) {
    const m = node.getMatrix?.() ?? I;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(m[i] - I[i]) > 1e-9) return false;
    }
  }
  return true;
}

function reprojectIfGeographic(doc) {
  const root = doc.getRoot();
  const prims = [];
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) prims.push({ prim, pos });
    }
  if (!prims.length) return { reprojected: false, lat: null, lng: null };

  // Union of POSITION bounds across every primitive.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const { pos } of prims) {
    const mn = pos.getMin([]);
    const mx = pos.getMax([]);
    minX = Math.min(minX, mn[0]); minY = Math.min(minY, mn[1]); minZ = Math.min(minZ, mn[2]);
    maxX = Math.max(maxX, mx[0]); maxY = Math.max(maxY, mx[1]); maxZ = Math.max(maxZ, mx[2]);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const looksGeographic =
    Math.abs(minX) <= 180 && Math.abs(maxX) <= 180 &&
    Math.abs(minY) <= 90 && Math.abs(maxY) <= 90 &&
    spanX > 1e-9 && spanY > 1e-9 &&
    spanX < 1 && spanY < 1 &&
    (Math.abs(minX) > 0.01 || Math.abs(minY) > 0.01);
  if (!looksGeographic) return { reprojected: false, lat: null, lng: null };

  // Only bake when the geometry sits at the scene origin untransformed.
  if (!sceneHasNoNodeTransforms(root)) {
    console.error('geographic POSITION found but a node carries a transform — leaving geometry as-is');
    return { reprojected: false, lat: +((minY + maxY) / 2).toFixed(7), lng: +((minX + maxX) / 2).toFixed(7) };
  }

  const lon0 = (minX + maxX) / 2;
  const lat0 = (minY + maxY) / 2;
  const alt0 = minZ;
  const r = Math.PI / 180;
  const la = lat0 * r;
  // Metres per degree on the WGS84 ellipsoid at lat0.
  const mPerLat = 111132.92 - 559.82 * Math.cos(2 * la) + 1.175 * Math.cos(4 * la);
  const mPerLon = 111412.84 * Math.cos(la) - 93.5 * Math.cos(3 * la);

  for (const { pos } of prims) {
    const src = pos.getArray();
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      out[i] = (src[i] - lon0) * mPerLon;        // East  → +X
      out[i + 1] = src[i + 2] - alt0;            // Up    → +Y
      out[i + 2] = -(src[i + 1] - lat0) * mPerLat; // North → -Z
    }
    pos.setArray(out);
  }

  console.error(
    `reprojected geographic GLB @ ${lat0.toFixed(6)},${lon0.toFixed(6)} ` +
      `(site ${(spanX * mPerLon).toFixed(0)}×${(spanY * mPerLat).toFixed(0)}×${(maxZ - minZ).toFixed(0)} m)`,
  );
  return { reprojected: true, lat: +lat0.toFixed(7), lng: +lon0.toFixed(7) };
}

/** Per-primitive `simplifySloppy` — a low-memory decimation for meshes too
 *  dense for the exact simplifier. Rewrites the index buffer in place; `prune`
 *  afterwards drops the vertices that fall out. */
function sloppySimplify(doc, ratio) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idxAcc = prim.getIndices();
      const posAcc = prim.getAttribute('POSITION');
      if (!idxAcc || !posAcc) continue;
      const indices = new Uint32Array(idxAcc.getArray());
      const positions = new Float32Array(posAcc.getArray());
      const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
      const [out] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, target, 0.01);
      idxAcc.setArray(out.length >= 3 ? out : indices);
    }
  }
}
