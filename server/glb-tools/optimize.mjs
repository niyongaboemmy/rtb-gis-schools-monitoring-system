#!/usr/bin/env node
/**
 * GLB optimization pipeline for RTB photogrammetry models.
 *
 * Raw Metashape/photogrammetry exports are ~10-40x heavier than the web needs:
 * one dense mesh (10-40M triangles), no quantization, no geometry compression.
 * This collapses that to a streaming-friendly Meshopt GLB.
 *
 * Steps: reproject (geographic -> local metres) -> dedup -> weld ->
 *        simplify (Meshopt exact edge-collapse; tiled-exact for huge meshes;
 *        sloppy only as a last resort) -> weld seams -> prune -> WebP textures
 *        -> 16-bit quantize + reorder + EXT_meshopt_compression.
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
 * `method` is 'exact' | 'tiled' | 'sloppy' | 'none'.
 * `lat`/`lng` are the WGS84 centroid when the source carried geographic
 * vertex coordinates (so the caller can sync the school's location), else null.
 */
import fs from 'node:fs';
import process from 'node:process';

const [inputPath, outputPath, ratioArg, texArg] = process.argv.slice(2);
const RATIO = Number(ratioArg ?? 0.3); // keep ~15% of triangles
// Max texture edge. Photogrammetry site textures are a single ~4096 atlas over
// the whole campus (~14 px/m) — that is already the source ceiling, so never
// downscale below it; only cap pathological > 8192 exports.
const TEX = Math.max(512, Number(texArg ?? 8192));
// WebP quality for the base-colour atlas. 95 ≈ visually lossless vs the source
// JPEG; the texture is only ~5 MB so quality is worth far more than the bytes.
const TEX_QUALITY = Number(process.env.GLB_TEXTURE_QUALITY || 95);
// Hard ceiling on output triangles regardless of RATIO. Higher = crisper roof
// edges / less facet-stepping when zoomed right in, at ~7 MB per extra million
// triangles. A site digital-twin is inspected up close, so keep it generous.
const MAX_OUT_TRIS = Number(process.env.GLB_MAX_OUT_TRIS || 5_000_000);
// Absolute simplification error as a fraction of model size. Tight — a loose
// value lets the simplifier flatten gently-curved roofs into visible steps.
const SIMPLIFY_ERROR = Number(process.env.GLB_SIMPLIFY_ERROR || 0.001);
// Per-tile triangle budget for the tiled exact simplifier (stays well under
// the Meshopt WASM heap limit).
const MAX_TILE_TRIS = 14_000_000;

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
// Quality order: exact Meshopt edge-collapse (`simplify`) preserves surfaces
// and silhouettes. Its WASM heap (~2 GB, 32-bit) traps on very dense meshes
// (~25M+ tris), so for those we run the SAME exact simplifier per spatial tile
// (`tiledSimplify`) — still edge-collapse, just chunked. `simplifySloppy` is a
// last resort only: it vertex-clusters onto a grid and visibly terraces flat
// photogrammetry surfaces.
// Env overrides (ops + tests): GLB_FORCE_TILED=1, GLB_FORCE_SLOPPY=1.
const targetTris = Math.max(
  1,
  Math.min(Math.round(trisIn * RATIO), MAX_OUT_TRIS),
);
const effectiveRatio = Math.min(1, targetTris / Math.max(trisIn, 1));

// Optional Laplacian relaxation before decimation. OFF by default: a
// photogrammetry mesh has ~20 % position-split vertices (texture-atlas chart
// seams), and relaxing each copy toward its own 1-ring pulls the copies apart —
// tearing a fine crack network across every surface. Only enable with
// GLB_SMOOTH after also welding split positions.
if (process.env.GLB_SMOOTH) {
  try {
    smoothMesh(document, Number(process.env.GLB_SMOOTH), 1);
  } catch (err) {
    console.error(`pre-smooth skipped: ${err?.message || err}`);
  }
}

const exactSimplify = (ratio = effectiveRatio) =>
  document.transform(
    dedup(),
    weld(),
    // Collapse to `ratio` of triangles, bounded by an absolute error (fraction
    // of model size). lockBorder keeps open edges (photogrammetry site
    // boundaries) from peeling back.
    simplify({
      simplifier: MeshoptSimplifier,
      ratio,
      error: SIMPLIFY_ERROR,
      lockBorder: true,
    }),
  );

let method = 'exact';
try {
  if (process.env.GLB_FORCE_TILED === '1') throw new Error('forced tiled');
  if (process.env.GLB_FORCE_SLOPPY === '1') throw new Error('forced sloppy');
  await exactSimplify();
} catch (err) {
  // The exact simplifier's WASM heap traps past ~27M triangles. Fall back to
  // running the SAME exact edge-collapse per spatial tile (with LockBorder so
  // tile-cut edges stay put and fuse at the final weld). Meshopt's simplify
  // preserves the texture-atlas charts, so no streaking; the only cost is a
  // faint denser band along the handful of tile seams.
  console.error(`exact simplify failed (${err?.message || err}) — tiled exact`);
  method = 'tiled';
  try {
    if (process.env.GLB_FORCE_SLOPPY === '1') throw new Error('forced sloppy');
    await document.transform(dedup(), weld());
    tiledSimplify(document, effectiveRatio);
  } catch (err3) {
    console.error(`tiled simplify failed (${err3?.message || err3}) — sloppy`);
    method = 'sloppy';
    try {
      sloppySimplify(document, effectiveRatio);
    } catch (err4) {
      console.error(`sloppy simplify failed: ${err4?.message || err4}`);
      method = 'none';
    }
  }
}

try {
  await document.transform(
    weld(), // exact weld — fuses the lattice-aligned tile seams
    prune(),
    // Convert the atlas to WebP at near-lossless quality. `resize` is only an
    // upper bound (TEX = 8192), so a 4096 source passes through un-resampled —
    // downscaling here was a big part of the "blurry" look.
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [TEX, TEX],
      quality: TEX_QUALITY,
      effort: 6,
    }),
    // 16-bit positions (~4 mm grid on a 280 m site; 14-bit ≈ 17 mm and visibly
    // stair-steps roofs) and 14-bit UVs (12-bit smears the 4096 atlas).
    meshopt({
      encoder: MeshoptEncoder,
      level: 'medium',
      quantizePosition: 16,
      quantizeTexcoord: 14,
    }),
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

/**
 * One or more passes of neighbour-averaging (Laplacian) relaxation on every
 * primitive's POSITION, blended `factor` toward the local mean. Adjacency is
 * accumulated on the fly (no per-vertex neighbour lists) so it scales to tens
 * of millions of vertices.
 */
function smoothMesh(doc, factor, iters) {
  if (factor <= 0) return;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idxAcc = prim.getIndices();
      const posAcc = prim.getAttribute('POSITION');
      if (!idxAcc || !posAcc) continue;
      const I = idxAcc.getArray();
      let P = new Float32Array(posAcc.getArray());
      const nv = P.length / 3;

      for (let it = 0; it < iters; it++) {
        const sx = new Float64Array(nv);
        const sy = new Float64Array(nv);
        const sz = new Float64Array(nv);
        const cnt = new Uint32Array(nv);
        const acc = (a, b) => {
          sx[a] += P[b * 3]; sy[a] += P[b * 3 + 1]; sz[a] += P[b * 3 + 2]; cnt[a]++;
        };
        for (let t = 0; t < I.length; t += 3) {
          const a = I[t], b = I[t + 1], c = I[t + 2];
          acc(a, b); acc(b, a);
          acc(b, c); acc(c, b);
          acc(c, a); acc(a, c);
        }
        const out = new Float32Array(P.length);
        const f = factor;
        for (let v = 0; v < nv; v++) {
          const n = cnt[v];
          if (!n) {
            out[v * 3] = P[v * 3]; out[v * 3 + 1] = P[v * 3 + 1]; out[v * 3 + 2] = P[v * 3 + 2];
            continue;
          }
          out[v * 3] = P[v * 3] * (1 - f) + (sx[v] / n) * f;
          out[v * 3 + 1] = P[v * 3 + 1] * (1 - f) + (sy[v] / n) * f;
          out[v * 3 + 2] = P[v * 3 + 2] * (1 - f) + (sz[v] / n) * f;
        }
        P = out;
      }
      posAcc.setArray(P);
    }
  }
}

/**
 * Snap every vertex to a `cell`-metre lattice and merge — but only vertices
 * that ALSO share a texture coordinate (to ~1/512 of the atlas). Photogrammetry
 * atlases pack adjacent faces into different charts, so two verts at the same
 * 3D spot on a chart edge carry unrelated UVs; merging them streaks a diagonal
 * slice of the atlas across the triangle (rainbow "contour" artefact). Keeping
 * UV in the key preserves the charts while still fusing true near-duplicates
 * and aligning everything to a lattice so tile-cut edges match exactly.
 * Returns the kept triangle count.
 */
function gridSnapWeld(doc, cell) {
  const inv = 1 / cell;
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idxAcc = prim.getIndices();
      const posAcc = prim.getAttribute('POSITION');
      if (!idxAcc || !posAcc) continue;
      const I = idxAcc.getArray();
      const P = posAcc.getArray();
      const uvAcc = prim.getAttribute('TEXCOORD_0');
      const UV = uvAcc ? uvAcc.getArray() : null;
      const attrs = prim
        .listSemantics()
        .filter((s) => s !== 'POSITION')
        .map((s) => {
          const acc = prim.getAttribute(s);
          const arr = acc.getArray();
          return { acc, arr, comps: acc.getElementSize(), float: arr instanceof Float32Array };
        });

      const cellOf = new Map();
      const newP = [];
      const newA = attrs.map(() => []);
      const remap = new Uint32Array(P.length / 3);
      for (let v = 0; v < P.length / 3; v++) {
        const kx = Math.round(P[v * 3] * inv);
        const ky = Math.round(P[v * 3 + 1] * inv);
        const kz = Math.round(P[v * 3 + 2] * inv);
        const ku = UV ? Math.round(UV[v * 2] * 512) : 0;
        const kw = UV ? Math.round(UV[v * 2 + 1] * 512) : 0;
        const key = `${kx}_${ky}_${kz}_${ku}_${kw}`;
        let c = cellOf.get(key);
        if (c === undefined) {
          c = newP.length / 3;
          cellOf.set(key, c);
          newP.push(kx * cell, ky * cell, kz * cell);
          attrs.forEach((at, ai) => {
            for (let q = 0; q < at.comps; q++) newA[ai].push(at.arr[v * at.comps + q]);
          });
        }
        remap[v] = c;
      }

      // Drop degenerate triangles and near-zero-area slivers (thin folds where
      // a sub-grid feature collapsed) — those are what Z-fight after snapping.
      const minArea = cell * cell * 0.25;
      const newI = [];
      const ax = new Float32Array(3), ay = new Float32Array(3), az = new Float32Array(3);
      for (let f = 0; f < I.length; f += 3) {
        const a = remap[I[f]], b = remap[I[f + 1]], c = remap[I[f + 2]];
        if (a === b || b === c || a === c) continue;
        ax[0] = newP[a * 3]; ay[0] = newP[a * 3 + 1]; az[0] = newP[a * 3 + 2];
        ax[1] = newP[b * 3]; ay[1] = newP[b * 3 + 1]; az[1] = newP[b * 3 + 2];
        ax[2] = newP[c * 3]; ay[2] = newP[c * 3 + 1]; az[2] = newP[c * 3 + 2];
        const ux = ax[1] - ax[0], uy = ay[1] - ay[0], uz = az[1] - az[0];
        const vx = ax[2] - ax[0], vy = ay[2] - ay[0], vz = az[2] - az[0];
        const cxp = uy * vz - uz * vy, cyp = uz * vx - ux * vz, czp = ux * vy - uy * vx;
        if (Math.hypot(cxp, cyp, czp) * 0.5 < minArea) continue;
        newI.push(a, b, c);
      }

      posAcc.setArray(new Float32Array(newP));
      idxAcc.setArray(new Uint32Array(newI));
      attrs.forEach((at, ai) => {
        at.acc.setArray(at.float ? new Float32Array(newA[ai]) : at.arr.constructor.from(newA[ai]));
      });
      total += newI.length / 3;
    }
  }
  return total;
}

/**
 * Tiled exact simplification for meshes too dense for one `simplify()` call
 * (its WASM heap traps past ~27M tris).
 *
 * Split into as FEW spatial tiles as possible (fewer tiles = fewer seams), run
 * the exact Meshopt edge-collapse per tile with `LockBorder` so the tile-cut
 * edges keep their exact source positions, then concatenate. Because those
 * seam vertices are byte-identical on both sides, the pipeline's final `weld()`
 * fuses them into a shared edge — watertight, no crack network, and the atlas
 * charts are untouched (no texture streaking). The only artefact is a slightly
 * denser band of triangles along the seam lines.
 */
function tiledSimplify(doc, ratio) {
  const buffer = doc.getRoot().listBuffers()[0];

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idxAcc = prim.getIndices();
      const posAcc = prim.getAttribute('POSITION');
      if (!idxAcc || !posAcc) continue;

      const I = new Uint32Array(idxAcc.getArray());
      const P = new Float32Array(posAcc.getArray());
      const triCount = I.length / 3;

      const attrs = prim
        .listSemantics()
        .filter((s) => s !== 'POSITION')
        .map((s) => {
          const acc = prim.getAttribute(s);
          const arr = acc.getArray();
          return { acc, arr, comps: acc.getElementSize(), float: arr instanceof Float32Array };
        });

      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < P.length; i += 3) {
        if (P[i] < x0) x0 = P[i];
        if (P[i] > x1) x1 = P[i];
        if (P[i + 2] < z0) z0 = P[i + 2];
        if (P[i + 2] > z1) z1 = P[i + 2];
      }
      const G = Math.max(1, Math.ceil(Math.sqrt(triCount / MAX_TILE_TRIS)));
      const cX = (x1 - x0) / G || 1;
      const cZ = (z1 - z0) / G || 1;

      const buckets = Array.from({ length: G * G }, () => []);
      for (let t = 0; t < triCount; t++) {
        const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
        const mx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3;
        const mz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
        const gx = Math.min(G - 1, Math.max(0, ((mx - x0) / cX) | 0));
        const gz = Math.min(G - 1, Math.max(0, ((mz - z0) / cZ) | 0));
        buckets[gz * G + gx].push(t);
      }

      const outP = [];
      const outI = [];
      const outA = attrs.map(() => []);
      let base = 0;

      for (const tris of buckets) {
        if (!tris.length) continue;
        const remap = new Map();
        const lp = [];
        const la = attrs.map(() => []);
        const li = new Uint32Array(tris.length * 3);
        for (let k = 0; k < tris.length; k++) {
          for (let j = 0; j < 3; j++) {
            const v = I[tris[k] * 3 + j];
            let nv = remap.get(v);
            if (nv === undefined) {
              nv = lp.length / 3;
              remap.set(v, nv);
              lp.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
              attrs.forEach((at, ai) => {
                for (let q = 0; q < at.comps; q++) la[ai].push(at.arr[v * at.comps + q]);
              });
            }
            li[k * 3 + j] = nv;
          }
        }

        const lpa = new Float32Array(lp);
        const target = Math.max(3, Math.floor((li.length * ratio) / 3) * 3);
        let simp;
        try {
          [simp] = MeshoptSimplifier.simplify(li, lpa, 3, target, SIMPLIFY_ERROR, ['LockBorder']);
        } catch (err) {
          console.error(`  tile simplify failed (${err?.message || err}) — raw`);
          simp = li;
        }

        for (let x = 0; x < simp.length; x++) outI.push(simp[x] + base);
        for (let x = 0; x < lp.length; x++) outP.push(lp[x]);
        attrs.forEach((_, ai) => {
          const src = la[ai];
          for (let x = 0; x < src.length; x++) outA[ai].push(src[x]);
        });
        base += lp.length / 3;
      }

      posAcc.setArray(new Float32Array(outP));
      prim.setIndices(
        doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(outI)).setBuffer(buffer),
      );
      attrs.forEach((at, ai) => {
        at.acc.setArray(
          at.float ? new Float32Array(outA[ai]) : at.arr.constructor.from(outA[ai]),
        );
      });
      console.error(`  tiled ${G}x${G}: ${triCount} -> ${outI.length / 3} tris`);
    }
  }
}

/** Per-primitive `simplifySloppy` — a low-memory last resort. It grid-clusters
 *  vertices, which terraces flat surfaces, so it is only used when both the
 *  exact and tiled paths fail. Rewrites the index buffer in place. */
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
