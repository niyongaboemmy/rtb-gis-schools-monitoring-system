/**
 * Repairs the "staircase" of photogrammetry GLBs exported in degrees.
 *
 * A GLB stores positions as 32-bit floats. Longitude near 30° can only step
 * every 2^-19° ≈ 21 cm east–west (latitude near 2°: 2^-23° ≈ 1.3 cm), so every
 * wall, kerb and roof edge of such an export is terraced (Nyamirama TSS: 537
 * distinct longitudes in 2 M vertices). The true position of each vertex lies
 * within ± half a step of what is stored.
 *
 * This smooths longitude and latitude over the mesh (umbrella average over
 * triangle neighbours, seam copies welded) while keeping every vertex inside
 * that ± half step — so the steps go and no real shape is invented. Altitude
 * is untouched (metres, already fine).
 *
 * Memory ≈ 28 bytes per welded vertex + 4 per vertex + a hash table; no
 * neighbour lists are built (they would be ~2 GB on an 80 M-triangle file).
 * Values are kept in units of one step around the site centre, so 32-bit
 * arrays are precise enough.
 */

/** Spacing of 32-bit floats around |v| (the step a stored value can take). */
export function float32Step(v) {
  const a = Math.abs(v);
  if (!(a > 0)) return 2 ** -149;
  return 2 ** (Math.floor(Math.log2(a)) - 23);
}

/**
 * @param {Array<{ positions: Float32Array, indices: Uint32Array | Uint16Array | null }>} prims
 *        positions as [lon°, lat°, alt m] triplets (all primitives of the mesh).
 * @param {{ iterations?: number, lon0: number, lat0: number }} opts
 * @returns {{ lonAt: (p: number, i: number) => number, latAt: (p: number, i: number) => number,
 *            stats: { vertices: number, welded: number, iterations: number, stepLonDeg: number, stepLatDeg: number, maxMoveSteps: number } }}
 */
export function destep(prims, opts) {
  const iterations = opts.iterations ?? 30;
  const { lon0, lat0 } = opts;
  const stepLon = float32Step(lon0);
  const stepLat = float32Step(lat0);

  // 1. Weld: one group per distinct (x, y, z) float32 triple.
  let total = 0;
  for (const p of prims) total += p.positions.length / 3;
  let cap = 1;
  while (cap < total * 1.4) cap <<= 1;
  const table = new Int32Array(cap).fill(-1); // → group id
  const repP = new Uint32Array(total); // group → global vertex (first seen)
  const bits = prims.map((p) => new Uint32Array(p.positions.buffer, p.positions.byteOffset, p.positions.length));
  const offsets = [];
  const g = prims.map((p) => new Uint32Array(p.positions.length / 3));
  let G = 0;
  let base = 0;
  /** Global vertex → [prim, local] for comparing a representative. */
  const locate = (gv) => {
    let k = 0;
    while (k + 1 < offsets.length && offsets[k + 1] <= gv) k++;
    return [k, gv - offsets[k]];
  };
  for (const [k, p] of prims.entries()) {
    offsets.push(base);
    const b = bits[k];
    const n = p.positions.length / 3;
    for (let i = 0; i < n; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      let h = (Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(z, 0xc2b2ae3d)) >>> 0;
      h &= cap - 1;
      for (;;) {
        const id = table[h];
        if (id < 0) {
          table[h] = G;
          repP[G] = base + i;
          g[k][i] = G++;
          break;
        }
        const [rk, ri] = prims.length === 1 ? [0, repP[id]] : locate(repP[id]);
        const rb = bits[rk];
        if (rb[ri * 3] === x && rb[ri * 3 + 1] === y && rb[ri * 3 + 2] === z) {
          g[k][i] = id;
          break;
        }
        h = (h + 1) & (cap - 1);
      }
    }
    base += n;
  }

  // 2. Start values, in steps from the site centre.
  const u0 = new Float32Array(G), v0 = new Float32Array(G);
  for (let id = 0; id < G; id++) {
    const [rk, ri] = prims.length === 1 ? [0, repP[id]] : locate(repP[id]);
    const pos = prims[rk].positions;
    u0[id] = (pos[ri * 3] - lon0) / stepLon;
    v0[id] = (pos[ri * 3 + 1] - lat0) / stepLat;
  }
  // Half-step bounds; per vertex only when the site crosses a power of two.
  const halfU = (id) => 0.5 * float32Step(lon0 + u0[id] * stepLon) / stepLon;
  const halfV = (id) => 0.5 * float32Step(lat0 + v0[id] * stepLat) / stepLat;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let id = 0; id < G; id++) {
    if (u0[id] < minU) minU = u0[id];
    if (u0[id] > maxU) maxU = u0[id];
    if (v0[id] < minV) minV = v0[id];
    if (v0[id] > maxV) maxV = v0[id];
  }
  const lonVaries = float32Step(lon0 + minU * stepLon) !== float32Step(lon0 + maxU * stepLon);
  const latVaries = float32Step(lat0 + minV * stepLat) !== float32Step(lat0 + maxV * stepLat);

  // 3. Smooth (Jacobi, umbrella over triangle neighbours), clamped.
  const u = Float32Array.from(u0), v = Float32Array.from(v0);
  const su = new Float32Array(G), sv = new Float32Array(G), cnt = new Float32Array(G);
  const eachTri = (fn) => {
    for (const [k, p] of prims.entries()) {
      const gk = g[k];
      const idx = p.indices;
      const n = idx ? idx.length : gk.length;
      for (let f = 0; f + 2 < n; f += 3) {
        const a = gk[idx ? idx[f] : f], b = gk[idx ? idx[f + 1] : f + 1], c = gk[idx ? idx[f + 2] : f + 2];
        fn(a, b, c);
      }
    }
  };
  // The usual case (one indexed primitive): triangles as group ids in one
  // flat array, so the hot loop has no calls or branches.
  const single = prims.length === 1 && prims[0].indices ? prims[0] : null;
  let tri = null;
  if (single) {
    const idx = single.indices, g0 = g[0];
    tri = new Uint32Array(idx.length - (idx.length % 3));
    for (let f = 0; f < tri.length; f++) tri[f] = g0[idx[f]];
    for (let f = 0; f < tri.length; f++) cnt[tri[f]] += 2;
  } else {
    eachTri((a, b, c) => { cnt[a] += 2; cnt[b] += 2; cnt[c] += 2; });
  }
  const accumulate = (a, b, c) => {
    su[a] += u[b] + u[c]; su[b] += u[a] + u[c]; su[c] += u[a] + u[b];
    sv[a] += v[b] + v[c]; sv[b] += v[a] + v[c]; sv[c] += v[a] + v[b];
  };
  for (let it = 0; it < iterations; it++) {
    su.fill(0);
    sv.fill(0);
    if (tri) {
      for (let f = 0; f < tri.length; f += 3) {
        const a = tri[f], b = tri[f + 1], c = tri[f + 2];
        const ua = u[a], ub = u[b], uc = u[c], va = v[a], vb = v[b], vc = v[c];
        su[a] += ub + uc; su[b] += ua + uc; su[c] += ua + ub;
        sv[a] += vb + vc; sv[b] += va + vc; sv[c] += va + vb;
      }
    } else {
      eachTri(accumulate);
    }
    for (let id = 0; id < G; id++) {
      const d = 1 + cnt[id];
      const hu = lonVaries ? halfU(id) : 0.5;
      const hv = latVaries ? halfV(id) : 0.5;
      const nu = (u[id] + su[id]) / d;
      const nv = (v[id] + sv[id]) / d;
      u[id] = nu < u0[id] - hu ? u0[id] - hu : nu > u0[id] + hu ? u0[id] + hu : nu;
      v[id] = nv < v0[id] - hv ? v0[id] - hv : nv > v0[id] + hv ? v0[id] + hv : nv;
    }
  }
  let maxMove = 0;
  for (let id = 0; id < G; id++) maxMove = Math.max(maxMove, Math.abs(u[id] - u0[id]), Math.abs(v[id] - v0[id]));

  return {
    lonAt: (k, i) => lon0 + u[g[k][i]] * stepLon,
    latAt: (k, i) => lat0 + v[g[k][i]] * stepLat,
    stats: {
      vertices: total,
      welded: G,
      iterations,
      stepLonDeg: stepLon,
      stepLatDeg: stepLat,
      maxMoveSteps: +maxMove.toFixed(3),
    },
  };
}

