#!/usr/bin/env node
/**
 * Detail meter for photogrammetry GLBs: how many centimetres of real surface
 * each texture pixel has to cover.
 *
 * For every triangle: covered texture pixels (UV area × texture width × height)
 * against its real 3D area (world space, metres). The result is area-weighted
 * and split by surface direction: "horizontal" (ground, roofs; |normal.y| ≥ 0.7
 * in the glTF Y-up frame) and "vertical" (walls). Also reports how much of
 * each texture is actually used, triangle density, and whether the file
 * arrived already web-compressed (quantised / meshopt / small atlas), i.e.
 * detail was removed before upload.
 *
 *   node quality.mjs <model.glb>        → prints one JSON line
 *
 * Library use: `measureQuality(document)` (positions must be in metres).
 */
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Thresholds (cm per pixel, median of ground/roofs) for the score label. */
export const DETAIL_SHARP_CM = 2.5;
export const DETAIL_FAIR_CM = 5;

const MAX_SAMPLED_TRIS = 2_000_000;

/** Width/height of an image: PNG, JPEG, WebP or KTX2, read from the header. */
export function imageSize(bytes) {
  if (!bytes || bytes.length < 32) return null;
  const b = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
  // PNG
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  // KTX2: «KTX 20»
  if (b[0] === 0xab && b[1] === 0x4b && b[2] === 0x54 && b[3] === 0x58 && b[5] === 0x32 && b[6] === 0x30)
    return { width: b.readUInt32LE(20), height: b.readUInt32LE(24) };
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  // JPEG: walk to the first SOFn marker
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

function weightedPercentile(values, weights, n, q) {
  if (!n) return null;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  let total = 0;
  for (let i = 0; i < n; i++) total += weights[i];
  let acc = 0;
  for (const i of idx) {
    acc += weights[i];
    if (acc >= q * total) return values[i];
  }
  return values[idx[idx.length - 1]];
}

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

/**
 * Measure a glTF-Transform Document. Positions are taken in world space
 * (node transforms applied) and must be in metres.
 */
export function measureQuality(doc) {
  const root = doc.getRoot();
  const used = root.listExtensionsUsed().map((e) => e.extensionName);

  const textures = root.listTextures().map((t) => {
    const size = imageSize(t.getImage());
    return { mime: t.getMimeType(), width: size?.width ?? 0, height: size?.height ?? 0, bytes: t.getImage()?.byteLength ?? 0 };
  });
  const texIndex = new Map(root.listTextures().map((t, i) => [t, i]));
  const uvPixels = new Float64Array(textures.length);

  // Count triangles first (for sampling).
  let totalTris = 0;
  for (const m of root.listMeshes())
    for (const p of m.listPrimitives()) {
      const idx = p.getIndices();
      const pos = p.getAttribute('POSITION');
      if (pos) totalTris += (idx ? idx.getCount() : pos.getCount()) / 3;
    }
  const stride = Math.max(1, Math.ceil(totalTris / MAX_SAMPLED_TRIS));
  const cap = Math.ceil(totalTris / stride) + 16;
  const val = { h: new Float32Array(cap), v: new Float32Array(cap) };
  const wgt = { h: new Float32Array(cap), v: new Float32Array(cap) };
  const cnt = { h: 0, v: 0 };
  let surface = 0;
  let surfaceH = 0;
  let surfaceV = 0;
  let untextured = 0;

  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  const ua = [0, 0], ub = [0, 0], uc = [0, 0];
  const tx = (m, p, out) => {
    const [x, y, z] = p;
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  };

  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // triangles only
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const uv = prim.getAttribute('TEXCOORD_0');
      const tex = prim.getMaterial()?.getBaseColorTexture() ?? null;
      const ti = tex ? texIndex.get(tex) : undefined;
      const W = ti != null ? textures[ti].width : 0;
      const H = ti != null ? textures[ti].height : 0;
      const idx = prim.getIndices();
      const nTri = (idx ? idx.getCount() : pos.getCount()) / 3;
      const vi = (k) => (idx ? idx.getScalar(k) : k);
      const pa = [0, 0, 0], pb = [0, 0, 0], pc = [0, 0, 0];
      for (let t = 0; t < nTri; t += stride) {
        const i0 = vi(t * 3), i1 = vi(t * 3 + 1), i2 = vi(t * 3 + 2);
        pos.getElement(i0, pa); pos.getElement(i1, pb); pos.getElement(i2, pc);
        tx(m, pa, a); tx(m, pb, b); tx(m, pc, c);
        const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
        const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const len = Math.hypot(nx, ny, nz);
        const area = (len / 2) * stride; // stand in for the skipped triangles
        if (!(area > 1e-9)) continue;
        surface += area;
        const horizontal = Math.abs(ny / len) >= 0.7;
        if (horizontal) surfaceH += area; else surfaceV += area;
        if (!uv || !W || !H) { untextured += area; continue; }
        uv.getElement(i0, ua); uv.getElement(i1, ub); uv.getElement(i2, uc);
        const px = (Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2) * W * H;
        if (!(px > 1e-6)) continue;
        uvPixels[ti] += px * stride;
        const cmPerPx = Math.sqrt(area / stride / px) * 100;
        const k = horizontal ? 'h' : 'v';
        if (cnt[k] < cap) {
          val[k][cnt[k]] = cmPerPx;
          wgt[k][cnt[k]] = area;
          cnt[k]++;
        }
      }
    }
  }

  const stats = (k) => ({
    median: round(weightedPercentile(val[k], wgt[k], cnt[k], 0.5)),
    p90: round(weightedPercentile(val[k], wgt[k], cnt[k], 0.9)),
  });
  const allVal = new Float32Array(cnt.h + cnt.v);
  const allW = new Float32Array(cnt.h + cnt.v);
  allVal.set(val.h.subarray(0, cnt.h)); allVal.set(val.v.subarray(0, cnt.v), cnt.h);
  allW.set(wgt.h.subarray(0, cnt.h)); allW.set(wgt.v.subarray(0, cnt.v), cnt.h);

  const horizontal = stats('h');
  const vertical = stats('v');
  const overall = {
    median: round(weightedPercentile(allVal, allW, allVal.length, 0.5)),
    p90: round(weightedPercentile(allVal, allW, allVal.length, 0.9)),
  };
  const ref = horizontal.median ?? overall.median;
  const maxTex = Math.max(0, ...textures.map((t) => Math.max(t.width, t.height)));
  const precompressed =
    used.includes('EXT_meshopt_compression') || used.includes('KHR_draco_mesh_compression') || used.includes('KHR_mesh_quantization');

  return {
    triangles: Math.round(totalTris),
    surfaceM2: Math.round(surface),
    trianglesPerM2: surface ? round(totalTris / surface, 1) : null,
    textures: textures.map((t, i) => ({ ...t, used: t.width * t.height ? round(Math.min(1, uvPixels[i] / (t.width * t.height)), 3) : null })),
    texturePixels: textures.reduce((s, t) => s + t.width * t.height, 0),
    cmPerPixel: { horizontal, vertical, overall },
    shares: { horizontal: surface ? round(surfaceH / surface, 3) : null, vertical: surface ? round(surfaceV / surface, 3) : null, untextured: surface ? round(untextured / surface, 3) : null },
    score: ref == null ? 'unknown' : ref <= DETAIL_SHARP_CM ? 'sharp' : ref <= DETAIL_FAIR_CM ? 'fair' : 'low',
    precompressed,
    /** Hints for the uploader, in plain words. */
    warnings: [
      ...(precompressed ? ['This file was already compressed for the web before upload; ask the surveyor for the full export.'] : []),
      ...(textures.length === 1 && maxTex <= 4096 && surface > 20_000 ? ['One texture covers the whole site; export several texture pages or 3D Tiles for sharp detail.'] : []),
      ...(ref != null && ref > DETAIL_FAIR_CM ? [`Each texture pixel covers about ${round(ref, 1)} cm; aim for 2 cm or less.`] : []),
    ],
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('usage: quality.mjs <model.glb>');
    process.exit(2);
  }
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder } = await import('meshoptimizer');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file);
  process.stdout.write(JSON.stringify(measureQuality(doc)) + '\n');
}
