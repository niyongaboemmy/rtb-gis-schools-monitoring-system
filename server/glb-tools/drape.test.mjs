/**
 * drape.mjs: roofs and ground textured from the site map's photo tiles.
 *
 * Synthetic site: a 40 × 40 m ground grid with a 6 × 6 m plate 3 m above it.
 * The model's own texture and the "orthophoto" tiles are drawn from the same
 * pattern, so they line up (or not, when the tiles are shifted).
 *
 *   node --test server/glb-tools/drape.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Document } from '@gltf-transform/core';
import { io } from './fixtures.mjs';
import { bestShift, localToMerc, metresPerDegree } from './drape.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'drape-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ORIGIN = { lat: -1.9626354, lng: 30.5533304 };
const R = 6378137;
const WORLD = 2 * Math.PI * R;
const toMerc = localToMerc(ORIGIN);

/** Pattern: 0.5 m cells of hashed brightness (strong edges for the alignment check). */
const pattern = (mx, my) => {
  const i = Math.floor(mx / 0.5), j = Math.floor(my / 0.5);
  const h = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0;
  return 40 + (h % 180);
};

/** Photo tiles at zoom z over the site, from the pattern (shifted east by `shiftM`). */
async function makeTiles(dir, z, shiftM = 0) {
  const res = WORLD / (256 * 2 ** z);
  const [x0, y0] = toMerc(-22, -22); // north-west corner (local z = -north)
  const [x1, y1] = toMerc(22, 22); // south-east
  const tx0 = Math.floor((x0 + WORLD / 2) / res / 256), tx1 = Math.floor((x1 + WORLD / 2) / res / 256);
  const ty0 = Math.floor((WORLD / 2 - y0) / res / 256), ty1 = Math.floor((WORLD / 2 - y1) / res / 256);
  for (let tx = tx0; tx <= tx1; tx++)
    for (let ty = ty0; ty <= ty1; ty++) {
      const px = Buffer.alloc(256 * 256 * 3);
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++) {
          const mx = (tx * 256 + x + 0.5) * res - WORLD / 2 - shiftM;
          const my = WORLD / 2 - (ty * 256 + y + 0.5) * res;
          px.fill(pattern(mx, my), (y * 256 + x) * 3, (y * 256 + x) * 3 + 3);
        }
      const f = path.join(dir, String(z), String(tx), `${ty}.webp`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      await sharp(px, { raw: { width: 256, height: 256, channels: 3 } }).webp({ quality: 95 }).toFile(f);
    }
}

/** The site model in the local frame, textured with the same pattern (8 cm/px). */
async function makeModel(file) {
  const doc = new Document();
  doc.createScene();
  const buf = doc.createBuffer();
  // Texture covers the ground: north-west (z = -20) to south-east (z = 20).
  const [ux0, uy1] = toMerc(-20, -20), [ux1, uy0] = toMerc(20, 20);
  const TEX = 512;
  const img = Buffer.alloc(TEX * TEX * 3);
  for (let y = 0; y < TEX; y++)
    for (let x = 0; x < TEX; x++) {
      const v = pattern(ux0 + ((x + 0.5) / TEX) * (ux1 - ux0), uy1 - ((y + 0.5) / TEX) * (uy1 - uy0));
      img.fill(v, (y * TEX + x) * 3, (y * TEX + x) * 3 + 3);
    }
  const tex = doc.createTexture().setImage(new Uint8Array(await sharp(img, { raw: { width: TEX, height: TEX, channels: 3 } }).png().toBuffer())).setMimeType('image/png');
  const mat = doc.createMaterial().setBaseColorTexture(tex);
  const P = [], U = [], I = [];
  const uvOf = (x, z) => {
    const [mx, my] = toMerc(x, z);
    return [(mx - ux0) / (ux1 - ux0), (uy1 - my) / (uy1 - uy0)];
  };
  const quadGrid = (xa, xb, za, zb, y, step) => {
    const nx = Math.round((xb - xa) / step), nz = Math.round((zb - za) / step), base = P.length / 3;
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = xa + i * step, z = za + j * step;
        P.push(x, y, z);
        U.push(...uvOf(x, z));
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = base + j * (nx + 1) + i;
        // Counter-clockwise seen from above (+Y normal).
        I.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
  };
  quadGrid(-20, 20, -20, 20, 0, 0.5); // ground
  quadGrid(-3, 3, -3, 3, 3, 0.5); // plate 3 m up
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(U)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)).setBuffer(buf));
  doc.getRoot().listScenes()[0].addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  await io.write(file, doc);
}

const drape = (input, output, tiles, extra = []) =>
  JSON.parse(
    execFileSync(process.execPath, [path.join(HERE, 'drape.mjs'), input, output, '--lat', String(ORIGIN.lat), '--lng', String(ORIGIN.lng), '--tiles', tiles, '--tiles-max-zoom', '22', '--cm', '4', '--page', '1024', '--max-pages', '9', ...extra], { encoding: 'utf8' })
      .trim().split('\n').pop(),
  );

test('local frame ↔ map: the inverse of optimize.mjs reprojection', () => {
  const m = metresPerDegree(ORIGIN.lat);
  const [mx, my] = toMerc(100, -50); // 100 m east, 50 m north
  const lng = (mx / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) * (180 / Math.PI);
  assert.ok(Math.abs((lng - ORIGIN.lng) * m.lon - 100) < 1e-6);
  assert.ok(Math.abs((lat - ORIGIN.lat) * m.lat - 50) < 1e-6);
});

test('bestShift finds a known offset', () => {
  const n = 128, a = new Float32Array(n * n), b = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) a[i] = ((Math.imul(i, 2654435761) >>> 0) % 255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) b[y * n + x] = a[((y - 3 + n) % n) * n + ((x - 2 + n) % n)];
  const s = bestShift(a, b, n, 6, 1);
  assert.equal(s.dx, 2);
  assert.equal(s.dy, 3);
  assert.ok(s.ncc > 0.99);
});

test('drapes visible upward faces, not the ground under the plate, with the right photo colours', async () => {
  const model = path.join(TMP, 'site.glb');
  const tiles = path.join(TMP, 'tiles');
  await makeModel(model);
  await makeTiles(tiles, 22);
  const out = path.join(TMP, 'site.draped.glb');
  const r = drape(model, out, tiles);
  assert.ok(!r.skipped, JSON.stringify(r));
  assert.ok(Math.hypot(r.alignment.shiftEastCm, r.alignment.shiftSouthCm) <= 8, JSON.stringify(r.alignment));
  assert.ok(r.draped > 10000, `draped ${r.draped}`);
  assert.ok(r.occluded > 50, `occluded ${r.occluded}`); // ground under the plate

  const doc = await io.read(out);
  const prims = doc.getRoot().listMeshes()[0].listPrimitives();
  assert.ok(prims.length >= 2, 'kept faces + at least one page');
  const draped = prims.find((p) => p.getMaterial().getBaseColorTexture().getMimeType() === 'image/webp');
  assert.ok(draped, 'a draped page (WebP)');
  // Sample the page texture at draped vertices: it must show the pattern there.
  const tex = draped.getMaterial().getBaseColorTexture();
  const { data, info } = await sharp(tex.getImage()).greyscale().raw().toBuffer({ resolveWithObject: true });
  const pos = draped.getAttribute('POSITION'), uv = draped.getAttribute('TEXCOORD_0');
  const node = doc.getRoot().listNodes().find((n) => n.getMesh());
  const m = node.getWorldMatrix();
  let ok = 0, n = 0;
  for (let i = 0; i < pos.getCount(); i += 97) {
    const p = pos.getElement(i, []), t = uv.getElement(i, []);
    const x = m[0] * p[0] + m[12], z = m[10] * p[2] + m[14];
    // Avoid cell borders, where a pixel may fall either side.
    const [mx, my] = toMerc(x, z);
    const frac = (v) => ((v % 1) + 1) % 1; // also for negative coordinates
    const fx = frac(mx / 0.5), fy = frac(my / 0.5);
    if (Math.min(fx, 1 - fx, fy, 1 - fy) < 0.15) continue;
    const px = Math.min(info.width - 1, Math.floor(t[0] * info.width)), py = Math.min(info.height - 1, Math.floor(t[1] * info.height));
    n++;
    if (Math.abs(data[py * info.width + px] - pattern(mx, my)) <= 12) ok++;
  }
  assert.ok(n > 20 && ok / n > 0.9, `${ok}/${n} draped vertices show the right colour`);
  // Ground faces under the plate keep the model texture: no draped vertex there at y = 0.
  for (let i = 0; i < pos.getCount(); i++) {
    const p = pos.getElement(i, []);
    const x = m[0] * p[0] + m[12], y = m[5] * p[1] + m[13], z = m[10] * p[2] + m[14];
    if (Math.abs(x) < 2.5 && Math.abs(z) < 2.5) assert.ok(y > 1, `ground under the plate draped at ${x},${z}`);
  }
});

test('photos that do not line up are refused (1 m shift)', async () => {
  const model = path.join(TMP, 'site.glb');
  const tiles = path.join(TMP, 'tiles-shifted');
  if (!fs.existsSync(model)) await makeModel(model);
  await makeTiles(tiles, 22, 1.0);
  const out = path.join(TMP, 'shifted.glb');
  const r = drape(model, out, tiles);
  assert.equal(r.skipped, 'photos and model do not line up', JSON.stringify(r));
  assert.ok(!fs.existsSync(out));
});

test('a page budget steps the detail down until the site fits; no draping when no sharper than the model', async () => {
  const model = path.join(TMP, 'site.glb');
  const tiles = path.join(TMP, 'tiles');
  if (!fs.existsSync(model)) await makeModel(model);
  if (!fs.existsSync(tiles)) await makeTiles(tiles, 22);
  // 40 m site, 1024 px pages at 4 cm (≈ 31 m each): 4 pages; budget 1.
  const one = drape(model, path.join(TMP, 'one-page.glb'), tiles, ['--max-pages', '1']);
  assert.ok(!one.skipped, JSON.stringify(one));
  assert.equal(one.pages.length, 1);
  assert.equal(one.cmWanted, 4);
  assert.ok(one.cm > 4 && one.cm < 7, `cm ${one.cm}`);
  // The model texture is ~8 cm/px here; at 4 cm draping is worth it, but a
  // model already at 4 cm/px gains nothing.
  const same = drape(model, path.join(TMP, 'same.glb'), tiles, ['--model-cm', '4']);
  assert.match(same.skipped, /not be sharper/);
});
