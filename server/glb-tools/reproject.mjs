#!/usr/bin/env node
/**
 * Standalone geographic → local-ENU-metres reprojection for a GLB.
 *
 * Agisoft Metashape can export a GLB whose POSITION accessor holds raw WGS84
 * (longitude°, latitude°, altitude m). In a metric 3D scene that mesh is a
 * sub-millimetre sliver — the viewer loads it but shows nothing. This bakes
 * every vertex into an East/Up/-North frame centred on the model and writes the
 * GLB back out otherwise unchanged.
 *
 * Split out of optimize.mjs for models too dense to weld/simplify in one
 * gltf-transform pass (~50M+ tris): run this on the gltfpack-decimated output
 * (small, fast) rather than the raw. Nothing else here changes the mesh.
 *
 *   node reproject.mjs <input.glb> <output.glb>
 *
 * Prints one JSON line: {"reprojected":bool,"lat":num|null,"lng":num|null}
 * Exit: 0 ok · 2 bad args / read / write.
 */
import fs from 'node:fs';
import process from 'node:process';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('usage: reproject.mjs <input.glb> <output.glb>');
  process.exit(2);
}
if (!fs.existsSync(inputPath)) {
  console.error(`input not found: ${inputPath}`);
  process.exit(2);
}

let NodeIO, ALL_EXTENSIONS, MeshoptDecoder, MeshoptEncoder;
try {
  ({ NodeIO } = await import('@gltf-transform/core'));
  ({ ALL_EXTENSIONS } = await import('@gltf-transform/extensions'));
  ({ MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer'));
} catch (err) {
  console.error(`dependency load failed: ${err?.message || err}`);
  process.exit(2);
}
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

let document;
try {
  document = await io.read(inputPath);
} catch (err) {
  console.error(`read failed: ${err?.message || err}`);
  process.exit(2);
}

const result = reprojectIfGeographic(document);

try {
  await io.write(outputPath, document);
} catch (err) {
  console.error(`write failed: ${err?.message || err}`);
  process.exit(2);
}

process.stdout.write(JSON.stringify(result) + '\n');
process.exit(0);

// ── helpers (kept byte-for-byte in sync with optimize.mjs) ────────────────

/** True when no node carries a transform, so baking positions in place is safe. */
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

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const { pos } of prims) {
    const mn = pos.getMin([]);
    const mx = pos.getMax([]);
    minX = Math.min(minX, mn[0]);
    minY = Math.min(minY, mn[1]);
    minZ = Math.min(minZ, mn[2]);
    maxX = Math.max(maxX, mx[0]);
    maxY = Math.max(maxY, mx[1]);
    maxZ = Math.max(maxZ, mx[2]);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const looksGeographic =
    Math.abs(minX) <= 180 &&
    Math.abs(maxX) <= 180 &&
    Math.abs(minY) <= 90 &&
    Math.abs(maxY) <= 90 &&
    spanX > 1e-9 &&
    spanY > 1e-9 &&
    spanX < 1 &&
    spanY < 1 &&
    (Math.abs(minX) > 0.01 || Math.abs(minY) > 0.01);
  if (!looksGeographic) return { reprojected: false, lat: null, lng: null };

  if (!sceneHasNoNodeTransforms(root)) {
    console.error(
      'geographic POSITION found but a node carries a transform — leaving geometry as-is',
    );
    return {
      reprojected: false,
      lat: +((minY + maxY) / 2).toFixed(7),
      lng: +((minX + maxX) / 2).toFixed(7),
    };
  }

  const lon0 = (minX + maxX) / 2;
  const lat0 = (minY + maxY) / 2;
  const alt0 = minZ;
  const r = Math.PI / 180;
  const la = lat0 * r;
  const mPerLat =
    111132.92 - 559.82 * Math.cos(2 * la) + 1.175 * Math.cos(4 * la);
  const mPerLon = 111412.84 * Math.cos(la) - 93.5 * Math.cos(3 * la);

  for (const { pos } of prims) {
    const src = pos.getArray();
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      out[i] = (src[i] - lon0) * mPerLon; // East  → +X
      out[i + 1] = src[i + 2] - alt0; // Up    → +Y
      out[i + 2] = -(src[i + 1] - lat0) * mPerLat; // North → -Z
    }
    pos.setArray(out);
  }

  console.error(
    `reprojected geographic GLB @ ${lat0.toFixed(6)},${lon0.toFixed(6)} ` +
      `(site ${(spanX * mPerLon).toFixed(0)}×${(spanY * mPerLat).toFixed(0)}×${(
        maxZ - minZ
      ).toFixed(0)} m)`,
  );
  return { reprojected: true, lat: +lat0.toFixed(7), lng: +lon0.toFixed(7) };
}
