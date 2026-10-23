/**
 * optimize.mjs texture handling (Phase 1 of 3D_QUALITY_IMPLEMENTATION_PLAN):
 * web-ready textures pass through untouched, others become WebP, samplers
 * become mipmapped, and the report carries the detail measurement.
 *
 *   node --test server/glb-tools/optimize.texture.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, noise, texturedGrid } from './fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'optimize.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'glbtex-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const build = (name, image, mime) => texturedGrid(path.join(TMP, `${name}.glb`), [{ image, mime }]);

const run = (input) => {
  const output = input.replace(/\.glb$/, '.out.glb');
  const report = JSON.parse(execFileSync(process.execPath, [SCRIPT, input, output, '0.5', '8192'], { encoding: 'utf8' }).trim().split('\n').pop());
  return { output, report };
};

test('a JPEG atlas passes through byte for byte; sampler becomes mipmapped; detail is reported', async () => {
  const jpeg = await noise(2000, 2000).jpeg({ quality: 90 }).toBuffer();
  const { output, report } = run(await build('jpeg', jpeg, 'image/jpeg'));
  assert.deepEqual(report.textures, [{ action: 'kept', mime: 'image/jpeg', width: 2000, height: 2000 }]);
  const doc = await io.read(output);
  const tex = doc.getRoot().listTextures()[0];
  assert.equal(tex.getMimeType(), 'image/jpeg');
  assert.ok(Buffer.from(tex.getImage()).equals(jpeg), 'texture bytes unchanged');
  const info = doc.getRoot().listMaterials()[0].getBaseColorTextureInfo();
  assert.equal(info.getMinFilter(), 9987);
  // 40 m over 2000 px ≈ 2 cm per pixel, on input and output alike.
  assert.ok(Math.abs(report.quality.cmPerPixel.horizontal.median - 2) < 0.1, JSON.stringify(report.quality.cmPerPixel));
  assert.ok(Math.abs(report.qualityIn.cmPerPixel.horizontal.median - 2) < 0.1);
  assert.equal(report.quality.score, 'sharp');
});

test('a PNG atlas is re-encoded to WebP at full size', async () => {
  const png = await noise(1500, 1000).png().toBuffer();
  const { output, report } = run(await build('png', png, 'image/png'));
  assert.equal(report.textures[0].action, 'reencoded');
  assert.equal(report.textures[0].width, 1500);
  const tex = (await io.read(output)).getRoot().listTextures()[0];
  assert.equal(tex.getMimeType(), 'image/webp');
});
