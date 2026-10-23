/**
 * ktx2.mjs — GPU-compressed (KTX2 / UASTC) variant of an optimized GLB
 * (Phase 3 of docs/3D_QUALITY_IMPLEMENTATION_PLAN.md).
 *
 * The encode test needs the `ktx` tool (node install-ktx.mjs) and is skipped
 * without it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, noise, texturedGrid } from './fixtures.mjs';
import { ktxCreateArgs, uastcGpuBytes } from './ktx2.mjs';
import { findKtx } from './install-ktx.mjs';
import { imageSize } from './quality.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'glbktx2-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('encoder arguments: UASTC, light RDO, zstd, mipmaps, colour space', () => {
  const srgb = ktxCreateArgs(true, 2, 'a.png', 'a.ktx2');
  assert.deepEqual(srgb.slice(0, 5), ['create', '--format', 'R8G8B8A8_SRGB', '--assign-tf', 'srgb']);
  for (const flag of ['--generate-mipmap', '--uastc-rdo', '--zstd']) assert.ok(srgb.includes(flag), flag);
  assert.equal(srgb[srgb.indexOf('--encode') + 1], 'uastc');
  assert.equal(srgb[srgb.indexOf('--uastc-rdo-l') + 1], '1');
  assert.deepEqual(srgb.slice(-2), ['a.png', 'a.ktx2']);
  assert.equal(ktxCreateArgs(false, 1, 'n.png', 'n.ktx2')[2], 'R8G8B8A8_UNORM');
  assert.equal(uastcGpuBytes(4096, 4096), 22369621);
});

test('every page becomes KTX2 at full size; WebP is dropped; geometry is kept', { skip: !findKtx() && 'ktx not installed' }, async () => {
  const pages = [
    { image: await noise(512, 256).webp({ quality: 90 }).toBuffer(), mime: 'image/webp' },
    { image: await noise(256, 256, 40503).jpeg({ quality: 90 }).toBuffer(), mime: 'image/jpeg' },
  ];
  const input = await texturedGrid(path.join(TMP, 'two.glb'), pages);
  const before = await io.read(input);
  const output = path.join(TMP, 'two.ktx2.glb');
  const report = JSON.parse(execFileSync(process.execPath, [path.join(HERE, 'ktx2.mjs'), input, output], { encoding: 'utf8' }).trim().split('\n').pop());

  assert.equal(report.textures.length, 2);
  assert.equal(report.gpuBytes, uastcGpuBytes(512, 256) + uastcGpuBytes(256, 256));
  const doc = await io.read(output);
  const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
  assert.ok(used.includes('KHR_texture_basisu'));
  assert.ok(!used.includes('EXT_texture_webp'));
  assert.ok(doc.getRoot().listExtensionsRequired().some((e) => e.extensionName === 'KHR_texture_basisu'));
  const sizes = doc.getRoot().listTextures().map((t) => {
    const b = Buffer.from(t.getImage());
    assert.equal(t.getMimeType(), 'image/ktx2');
    assert.ok(b.readUInt32LE(40) > 1, 'mip levels present');
    return imageSize(t.getImage());
  });
  assert.deepEqual(sizes, [{ width: 512, height: 256 }, { width: 256, height: 256 }]);
  const tris = (d) => d.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives()[0].getIndices().getCount() / 3, 0);
  assert.equal(tris(doc), tris(before));
});
