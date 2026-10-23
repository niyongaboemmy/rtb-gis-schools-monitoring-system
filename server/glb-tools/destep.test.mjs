/**
 * destep.mjs — repair of the 21 cm staircase in GLBs exported in 32-bit degrees.
 *
 *   node --test server/glb-tools/destep.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { destep, float32Step } from './destep.mjs';

const LON0 = 30.5533304;
const LAT0 = -1.9626354;
const M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const M_LAT = 110574;

test('32-bit step sizes near Nyamirama: 21 cm east, 1.3 cm north', () => {
  assert.equal(float32Step(LON0), 2 ** -19);
  assert.equal(float32Step(LAT0), 2 ** -23);
  assert.ok(Math.abs(float32Step(LON0) * M_LON - 0.212) < 0.002);
});

/** A smooth curved kerb surface, 30 × 30 m at 5 cm spacing, stored as float32 degrees. */
function kerb(n = 600, dup = false) {
  const trueLon = new Float64Array(n * n), trueLat = new Float64Array(n * n);
  const pos = new Float32Array(n * n * 3 + (dup ? n * 3 : 0));
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      // Curved line: east offset bends with north position (the classic diagonal staircase).
      const e = i * 0.05 + 2 * Math.sin(j * 0.01);
      const nn = j * 0.05;
      trueLon[k] = LON0 + e / M_LON;
      trueLat[k] = LAT0 + nn / M_LAT;
      pos[k * 3] = trueLon[k];
      pos[k * 3 + 1] = trueLat[k];
      pos[k * 3 + 2] = 1512 + 0.1 * Math.sin(i * 0.05);
    }
  const idx = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      idx.push(a, a + 1, a + n + 1, a, a + n + 1, a + n);
    }
  if (dup) {
    // A texture seam: column 300 duplicated as separate vertices (same position).
    for (let j = 0; j < n; j++) for (let c = 0; c < 3; c++) pos[(n * n + j) * 3 + c] = pos[(j * n + 300) * 3 + c];
  }
  return { n, trueLon, trueLat, pos, idx: Uint32Array.from(idx) };
}

const rmsCm = (n, at, truth, mPerDeg) => {
  let s = 0;
  for (let k = 0; k < n * n; k++) s += ((at(k) - truth[k]) * mPerDeg) ** 2;
  return Math.sqrt(s / (n * n)) * 100;
};

test('removes most of the staircase error and never moves past half a step', () => {
  const { n, trueLon, trueLat, pos, idx } = kerb();
  const before = rmsCm(n, (k) => pos[k * 3], trueLon, M_LON);
  const r = destep([{ positions: pos, indices: idx }], { lon0: LON0, lat0: LAT0 });
  const after = rmsCm(n, (k) => r.lonAt(0, k), trueLon, M_LON);
  assert.ok(before > 5, `stored error ${before.toFixed(1)} cm`);
  assert.ok(after < before / 3, `east error ${before.toFixed(1)} → ${after.toFixed(1)} cm`);
  assert.ok(rmsCm(n, (k) => r.latAt(0, k), trueLat, M_LAT) <= rmsCm(n, (k) => pos[k * 3 + 1], trueLat, M_LAT) + 0.01);
  assert.ok(r.stats.maxMoveSteps <= 0.5 + 1e-6, `moved ${r.stats.maxMoveSteps} steps`);
  for (let k = 0; k < n * n; k += 97)
    assert.ok(Math.abs(r.lonAt(0, k) - pos[k * 3]) <= float32Step(LON0) * 0.501);
});

test('seam copies of a vertex move together', () => {
  const { n, pos, idx } = kerb(600, true);
  const r = destep([{ positions: pos, indices: idx }], { lon0: LON0, lat0: LAT0 });
  assert.ok(r.stats.welded <= n * n, `welded ${r.stats.welded}`);
  for (let j = 0; j < n; j += 50) assert.equal(r.lonAt(0, n * n + j), r.lonAt(0, j * n + 300));
});
