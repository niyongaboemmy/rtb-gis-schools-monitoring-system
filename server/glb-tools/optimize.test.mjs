/**
 * Integration tests for optimize.mjs — the reprojection + decimation pipeline.
 * Builds synthetic GLBs, runs the real script as a child process, and inspects
 * the JSON report plus the decoded output geometry.
 *
 *   node --test server/glb-tools/optimize.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'optimize.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'glbopt-'));

const { NodeIO, Document } = await import('@gltf-transform/core');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
const { dequantize } = await import('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

/**
 * Build a grid mesh. `mapXYZ(u, v)` returns the [x, y, z] for grid coords
 * u, v in [0, 1]. `nodeTransform` optionally sets a node translation.
 */
async function buildGlb(name, n, mapXYZ, nodeTransform) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const [x, y, z] = mapXYZ(i / (n - 1), j / (n - 1));
      positions.push(x, y, z);
    }
  const indices = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  const pos = doc
    .createAccessor('POSITION')
    .setType('VEC3')
    .setArray(new Float32Array(positions))
    .setBuffer(buffer);
  const idx = doc
    .createAccessor('indices')
    .setType('SCALAR')
    .setArray(new Uint32Array(indices))
    .setBuffer(buffer);
  const uv = doc
    .createAccessor('TEXCOORD_0')
    .setType('VEC2')
    .setArray(new Float32Array((positions.length / 3) * 2).fill(0.5))
    .setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', pos)
    .setAttribute('TEXCOORD_0', uv)
    .setIndices(idx);
  const mesh = doc.createMesh('m').addPrimitive(prim);
  const node = doc.createNode('n').setMesh(mesh);
  if (nodeTransform) node.setTranslation(nodeTransform);
  doc.createScene('s').addChild(node);

  const file = path.join(TMP, name);
  await io.write(file, doc);
  return file;
}

function runOptimize(input, env = {}) {
  const out = input.replace(/\.glb$/, '.out.glb');
  const stdout = execFileSync(
    process.execPath,
    ['--max-old-space-size=2048', SCRIPT, input, out, '0.5', '2048'],
    // Pre-smoothing nudges vertices on a tiny synthetic grid enough to trip the
    // tight geometry asserts; it has its own test. Disable it by default here.
    { encoding: 'utf8', env: { GLB_NO_SMOOTH: '1', ...process.env, ...env } },
  );
  const report = JSON.parse(stdout.trim().split('\n').pop());
  return { out, report };
}

function mulMat4Vec3(m, v) {
  // m is column-major 4x4 (glTF convention).
  const [x, y, z] = v;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}

async function boundsOf(file) {
  const doc = await io.read(file);
  await doc.transform(dequantize()); // undo KHR_mesh_quantization
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION').getArray();
      for (let i = 0; i < a.length; i += 3) {
        const p = mulMat4Vec3(world, [a[i], a[i + 1], a[i + 2]]);
        for (let k = 0; k < 3; k++) {
          mn[k] = Math.min(mn[k], p[k]);
          mx[k] = Math.max(mx[k], p[k]);
        }
      }
    }
  }
  return { mn, mx, span: mx.map((v, k) => v - mn[k]) };
}

// Nyamirama-like geographic box.
const LON0 = 30.5533304;
const LAT0 = -1.9626354;
const LON_SPAN = 0.00205; // ~228 m
const LAT_SPAN = 0.00257; // ~284 m
const ALT_LO = 1512;
const ALT_SPAN = 84;

test('geographic Metashape GLB is reprojected to a local metric frame', async () => {
  const input = await buildGlb('geo.glb', 24, (u, v) => [
    LON0 - LON_SPAN / 2 + u * LON_SPAN, // X = longitude
    LAT0 - LAT_SPAN / 2 + v * LAT_SPAN, // Y = latitude
    ALT_LO + ((u + v) / 2) * ALT_SPAN, // Z = altitude
  ]);
  const { out, report } = runOptimize(input);

  assert.equal(report.reprojected, true);
  assert.ok(Math.abs(report.lat - LAT0) < 1e-5, `lat ${report.lat}`);
  assert.ok(Math.abs(report.lng - LON0) < 1e-5, `lng ${report.lng}`);

  const r = Math.PI / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * LAT0 * r) + 1.175 * Math.cos(4 * LAT0 * r);
  const mLon = 111412.84 * Math.cos(LAT0 * r) - 93.5 * Math.cos(3 * LAT0 * r);

  const { mn, mx, span } = await boundsOf(out);
  // East/+X spans longitude, Up/+Y spans altitude, -North/-Z spans latitude.
  assert.ok(Math.abs(span[0] - LON_SPAN * mLon) / (LON_SPAN * mLon) < 0.02, `X span ${span[0]}`);
  assert.ok(Math.abs(span[1] - ALT_SPAN) / ALT_SPAN < 0.05, `Y span ${span[1]}`);
  assert.ok(Math.abs(span[2] - LAT_SPAN * mLat) / (LAT_SPAN * mLat) < 0.02, `Z span ${span[2]}`);
  // Ground sits at Y = 0 (within 14-bit quantization error over the height range).
  assert.ok(Math.abs(mn[1]) < 0.05, `min Y ${mn[1]}`);
  // Centred on X and Z.
  assert.ok(Math.abs(mn[0] + mx[0]) < 1, `X not centred: ${mn[0]}..${mx[0]}`);
  assert.ok(Math.abs(mn[2] + mx[2]) < 1, `Z not centred: ${mn[2]}..${mx[2]}`);
});

test('already-metric GLB is left untouched (no reprojection)', async () => {
  const input = await buildGlb('metric.glb', 20, (u, v) => [
    -100 + u * 200,
    ((u + v) / 2) * 30,
    -120 + v * 240,
  ]);
  const { report } = runOptimize(input);
  assert.equal(report.reprojected, false);
  assert.equal(report.lat, null);
  assert.equal(report.lng, null);
});

test('geographic GLB with a node transform: coord reported, geometry not baked', async () => {
  const input = await buildGlb(
    'geo-xform.glb',
    16,
    (u, v) => [
      LON0 - LON_SPAN / 2 + u * LON_SPAN,
      LAT0 - LAT_SPAN / 2 + v * LAT_SPAN,
      ALT_LO + v * ALT_SPAN,
    ],
    [5, 0, 0],
  );
  const { out, report } = runOptimize(input);
  assert.equal(report.reprojected, false);
  assert.ok(Math.abs(report.lat - LAT0) < 1e-5);
  assert.ok(Math.abs(report.lng - LON0) < 1e-5);
  // Geometry NOT baked: still sub-degree extents, not hundreds of metres.
  const { mx, span } = await boundsOf(out);
  assert.ok(span[0] < 1, `X span should be degree-scale, got ${span[0]}`);
  assert.ok(mx[0] > 30, `X should still be near longitude 30.55 (+5 node tx), got ${mx[0]}`);
});

test('small mesh uses the exact simplifier, not the sloppy fallback', async () => {
  const input = await buildGlb('small.glb', 12, (u, v) => [u * 50, 0, v * 50]);
  const { report } = runOptimize(input);
  assert.equal(report.method, 'exact');
});

test('pre-smoothing runs and still yields a valid, reprojected GLB', async () => {
  const input = await buildGlb('smooth.glb', 40, (u, v) => [
    LON0 - LON_SPAN / 2 + u * LON_SPAN,
    LAT0 - LAT_SPAN / 2 + v * LAT_SPAN,
    ALT_LO + v * ALT_SPAN + 4 * Math.sin(u * 30) * Math.cos(v * 24), // noise
  ]);
  const { out, report } = runOptimize(input, { GLB_NO_SMOOTH: '0', GLB_SMOOTH: '0.5' });
  assert.equal(report.reprojected, true);
  assert.ok(report.trisOut > 0);
  const { span } = await boundsOf(out);
  const r = Math.PI / 180;
  const mLon = 111412.84 * Math.cos(LAT0 * r) - 93.5 * Math.cos(3 * LAT0 * r);
  // Footprint unchanged; smoothing only relaxes the surface between the edges.
  assert.ok(Math.abs(span[0] - LON_SPAN * mLon) / (LON_SPAN * mLon) < 0.05, `X span ${span[0]}`);
});

test('tiled exact path reprojects, decimates, and preserves attributes', async () => {
  const input = await buildGlb('tiled.glb', 60, (u, v) => [
    LON0 - LON_SPAN / 2 + u * LON_SPAN,
    LAT0 - LAT_SPAN / 2 + v * LAT_SPAN,
    ALT_LO + v * ALT_SPAN + 6 * Math.sin(u * 20) * Math.cos(v * 16),
  ]);
  const { out, report } = runOptimize(input, { GLB_FORCE_TILED: '1' });
  assert.equal(report.method, 'tiled');
  assert.equal(report.reprojected, true);
  assert.ok(report.trisOut > 0 && report.trisOut < report.trisIn, `tris ${report.trisIn} -> ${report.trisOut}`);

  const doc = await io.read(out);
  await doc.transform(dequantize());
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  assert.ok(prim.getAttribute('TEXCOORD_0'), 'UVs survived tiling');
  const { span } = await boundsOf(out);
  const r = Math.PI / 180;
  const mLon = 111412.84 * Math.cos(LAT0 * r) - 93.5 * Math.cos(3 * LAT0 * r);
  assert.ok(Math.abs(span[0] - LON_SPAN * mLon) / (LON_SPAN * mLon) < 0.05, `X span ${span[0]}`);
});

test('sloppy fallback path still reprojects and produces a valid GLB', async () => {
  const input = await buildGlb('sloppy.glb', 40, (u, v) => [
    LON0 - LON_SPAN / 2 + u * LON_SPAN,
    LAT0 - LAT_SPAN / 2 + v * LAT_SPAN,
    ALT_LO + v * ALT_SPAN + 8 * Math.sin(u * 12) * Math.cos(v * 9), // relief
  ]);
  const { out, report } = runOptimize(input, { GLB_FORCE_SLOPPY: '1' });
  assert.equal(report.method, 'sloppy');
  assert.equal(report.reprojected, true);
  assert.ok(report.trisOut > 0 && report.trisOut <= report.trisIn, `tris ${report.trisIn} -> ${report.trisOut}`);
  const { span } = await boundsOf(out);
  const r = Math.PI / 180;
  const mLon = 111412.84 * Math.cos(LAT0 * r) - 93.5 * Math.cos(3 * LAT0 * r);
  assert.ok(Math.abs(span[0] - LON_SPAN * mLon) / (LON_SPAN * mLon) < 0.05, `X span ${span[0]}`);
});

test('output GLB decodes with MeshoptDecoder and has finite positions', async () => {
  const input = await buildGlb('decode.glb', 20, (u, v) => [
    LON0 - LON_SPAN / 2 + u * LON_SPAN,
    LAT0 - LAT_SPAN / 2 + v * LAT_SPAN,
    ALT_LO + u * ALT_SPAN,
  ]);
  const { out } = runOptimize(input);
  const doc = await io.read(out);
  const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
  assert.ok(used.includes('EXT_meshopt_compression'), `extensions: ${used}`);
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION').getArray();
      for (const v of a) assert.ok(Number.isFinite(v));
      n += a.length;
    }
  assert.ok(n > 0);
});
