#!/usr/bin/env node
/**
 * GPU-compressed variant of an optimized GLB: every texture page re-encoded to
 * KTX2 / UASTC (+ Zstandard, mipmaps), marked KHR_texture_basisu. Geometry is
 * copied as is (Meshopt).
 *
 * Why: a 4096² photo texture takes ≈ 85 MB of GPU memory as WebP/JPEG but
 * ≈ 21 MB as UASTC, so multi-page (sharp) models fit phones. The file is
 * larger to download (≈ 2.8× WebP), so the API builds this variant only for
 * models whose textures exceed the GPU budget, and the viewer picks it per
 * device (docs/3D_QUALITY_IMPLEMENTATION_PLAN.md, Phase 3).
 *
 * Measured on the Nyamirama 4096² page (2 threads): 62 s, 0.7 GB peak,
 * PSNR 42 dB vs the source. An 8192² page: 192 s, 2.5 GB peak.
 *
 *   node ktx2.mjs <input.glb> <output.glb>
 *
 * Exit codes: 0 ok · 2 bad args / no ktx · 3 read · 4 encode · 5 write.
 * On success prints one JSON line:
 *   {bytesIn, bytesOut, gpuBytes, ms, textures: [{width, height, bytesIn, bytesOut, ms}]}
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { findKtx, ktxEnv } from './install-ktx.mjs';

const run = promisify(execFile);

/** `ktx create` arguments for one page. UASTC level 2, light RDO (λ = 1). */
export function ktxCreateArgs(srgb, threads, input, output) {
  return [
    'create',
    '--format', srgb ? 'R8G8B8A8_SRGB' : 'R8G8B8A8_UNORM',
    '--assign-tf', srgb ? 'srgb' : 'linear',
    '--generate-mipmap',
    '--encode', 'uastc',
    '--uastc-quality', '2',
    '--uastc-rdo',
    '--uastc-rdo-l', '1',
    '--zstd', '18',
    '--threads', String(threads),
    input,
    output,
  ];
}

/** GPU bytes of a UASTC page once transcoded (BC7 / ASTC 4×4: 1 byte per pixel, + mips). */
export const uastcGpuBytes = (w, h) => Math.round(w * h * (4 / 3));

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath || !fs.existsSync(inputPath)) {
    console.error('usage: ktx2.mjs <input.glb> <output.glb>');
    process.exit(2);
  }
  const ktx = findKtx();
  if (!ktx) {
    console.error('ktx not available (run: node install-ktx.mjs)');
    process.exit(2);
  }
  const threads = Math.max(1, Number(process.env.KTX_THREADS || Math.min(2, os.cpus().length)));
  const t0 = Date.now();

  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS, KHRTextureBasisu } = await import('@gltf-transform/extensions');
  const { getTextureColorSpace } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  const { default: sharp } = await import('sharp');
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

  let doc;
  try {
    doc = await io.read(inputPath);
  } catch (err) {
    console.error(`read failed: ${err?.message || err}`);
    process.exit(3);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rtb-ktx2-'));
  const report = [];
  let gpuBytes = 0;
  try {
    for (const [i, tex] of doc.getRoot().listTextures().entries()) {
      const img = tex.getImage();
      if (!img || tex.getMimeType() === 'image/ktx2') continue;
      const t = Date.now();
      const png = path.join(work, `${i}.png`);
      const out = path.join(work, `${i}.ktx2`);
      // One page at a time: decode → PNG → ktx → back into the document.
      const info = await sharp(img, { limitInputPixels: false }).ensureAlpha().png({ compressionLevel: 1 }).toFile(png);
      const srgb = getTextureColorSpace(tex) !== 'srgb-linear';
      await run(ktx, ktxCreateArgs(srgb, threads, png, out), { env: ktxEnv(), maxBuffer: 16 * 1024 * 1024 });
      const bytes = fs.readFileSync(out);
      tex.setImage(new Uint8Array(bytes)).setMimeType('image/ktx2');
      if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.\w+$/, '.ktx2'));
      fs.rmSync(png, { force: true });
      fs.rmSync(out, { force: true });
      gpuBytes += uastcGpuBytes(info.width, info.height);
      report.push({ width: info.width, height: info.height, bytesIn: img.byteLength, bytesOut: bytes.byteLength, ms: Date.now() - t });
    }
  } catch (err) {
    console.error(`encode failed: ${err?.stderr || err?.message || err}`);
    process.exit(4);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }

  doc.createExtension(KHRTextureBasisu).setRequired(true);
  for (const ext of doc.getRoot().listExtensionsUsed())
    if (ext.extensionName === 'EXT_texture_webp') ext.dispose();

  try {
    await io.write(outputPath, doc);
  } catch (err) {
    console.error(`write failed: ${err?.message || err}`);
    process.exit(5);
  }
  process.stdout.write(
    JSON.stringify({
      bytesIn: fs.statSync(inputPath).size,
      bytesOut: fs.statSync(outputPath).size,
      gpuBytes,
      ms: Date.now() - t0,
      textures: report,
    }) + '\n',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) await main();
