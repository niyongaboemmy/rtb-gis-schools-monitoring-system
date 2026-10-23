/**
 * Tests for the detail meter (quality.mjs): known geometry + texture sizes
 * must give the expected centimetres per texture pixel.
 *
 *   node --test server/glb-tools/quality.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { Document } from '@gltf-transform/core';
import { imageSize, measureQuality } from './quality.mjs';

const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#777' } }).png().toBuffer();
const jpg = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#777' } }).jpeg().toBuffer();
const webp = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#777' } }).webp().toBuffer();

/** Quad (2 triangles) from 4 corners + UVs, on its own node. */
function quad(doc, buffer, material, corners, uvs) {
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(corners.flat())).setBuffer(buffer);
  const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs.flat())).setBuffer(buffer);
  const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setIndices(idx).setMaterial(material);
  const node = doc.createNode().setMesh(doc.createMesh().addPrimitive(prim));
  doc.getRoot().listScenes()[0].addChild(node);
  return node;
}

test('reads image sizes from PNG, JPEG and WebP headers', async () => {
  assert.deepEqual(imageSize(await png(300, 200)), { width: 300, height: 200 });
  assert.deepEqual(imageSize(await jpg(640, 480)), { width: 640, height: 480 });
  assert.deepEqual(imageSize(await webp(1024, 512)), { width: 1024, height: 512 });
});

test('a 10 m roof on a 1000 px texture is 1 cm per pixel; a wall on a quarter of it is 2 cm', async () => {
  const doc = new Document();
  doc.createScene();
  const buffer = doc.createBuffer();
  const tex = doc.createTexture().setImage(await png(1000, 1000)).setMimeType('image/png');
  const mat = doc.createMaterial().setBaseColorTexture(tex);
  // Horizontal 10 x 10 m (Y up), UV covers the whole texture → 1 cm/px.
  quad(doc, buffer, mat, [[0, 0, 0], [10, 0, 0], [10, 0, -10], [0, 0, -10]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // Vertical 10 x 10 m wall using a quarter (500 x 500 px) → 2 cm/px.
  quad(doc, buffer, mat, [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]);
  const q = measureQuality(doc);
  assert.equal(q.triangles, 4);
  assert.equal(q.surfaceM2, 200);
  assert.equal(q.cmPerPixel.horizontal.median, 1);
  assert.equal(q.cmPerPixel.vertical.median, 2);
  assert.equal(q.shares.horizontal, 0.5);
  assert.equal(q.score, 'sharp');
  assert.equal(q.precompressed, false);
  assert.equal(q.textures[0].width, 1000);
});

test('applies node transforms (a scaled node counts real metres)', async () => {
  const doc = new Document();
  doc.createScene();
  const buffer = doc.createBuffer();
  const mat = doc.createMaterial().setBaseColorTexture(doc.createTexture().setImage(await png(100, 100)).setMimeType('image/png'));
  quad(doc, buffer, mat, [[0, 0, 0], [1, 0, 0], [1, 0, -1], [0, 0, -1]], [[0, 0], [1, 0], [1, 1], [0, 1]]).setScale([10, 10, 10]);
  const q = measureQuality(doc);
  assert.equal(q.surfaceM2, 100);
  assert.equal(q.cmPerPixel.horizontal.median, 10); // 10 m over 100 px
  assert.equal(q.score, 'low');
  assert.ok(q.warnings.some((w) => /10 cm/.test(w)));
});
