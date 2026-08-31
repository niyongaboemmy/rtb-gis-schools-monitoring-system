#!/usr/bin/env node
/**
 * GLB optimization pipeline for RTB photogrammetry models.
 *
 * Raw Metashape/photogrammetry exports are ~10-40x heavier than the web needs:
 * one dense mesh (10-20M triangles), no quantization, no geometry compression.
 * This collapses that to a streaming-friendly Meshopt GLB.
 *
 * Steps: dedup -> weld -> simplify (Meshopt) -> prune -> WebP textures ->
 *        quantize + reorder + EXT_meshopt_compression.
 *
 * Measured on "Fr Ramon TSS Kabuga": 486.7 MB / 19.5M tris  ->  15.9 MB / 2.0M tris
 * (30x, ~21s on a laptop). The viewer loads it via GLTFLoader + MeshoptDecoder.
 *
 * Run standalone or as a forked child of the API (isolated heap):
 *   node optimize.mjs <input.glb> <output.glb> [ratio=0.1] [textureSize=4096]
 *
 * Exit codes: 0 ok · 2 bad args · 3 read/parse · 4 transform · 5 write.
 * On success prints one JSON line to stdout: {bytesIn,bytesOut,trisIn,trisOut,ms}.
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

try {
  await document.transform(
    dedup(),
    weld(),
    // Meshopt simplifier: collapse to RATIO of triangles, bounded by an
    // absolute error of 1% of the model's size. lockBorder keeps open edges
    // (photogrammetry site boundaries) from peeling back.
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.01, lockBorder: true }),
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
  }) + '\n',
);
process.exit(0);
