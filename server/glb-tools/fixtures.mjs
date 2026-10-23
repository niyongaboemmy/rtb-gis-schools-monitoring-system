/** Shared fixtures for the glb-tools tests (node --test). */
import sharp from 'sharp';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

/**
 * A 40 × 40 m textured ground grid (metres, Y up) per texture page, side by
 * side along X, with a LINEAR sampler like real exports. Writes `file`.
 */
export async function texturedGrid(file, pages) {
  const doc = new Document();
  doc.createScene();
  const buf = doc.createBuffer();
  const n = 60;
  pages.forEach(({ image, mime }, p) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        pos.push(p * 40 + (i / n) * 40, Math.sin(i * 0.3) * 0.2, -(j / n) * 40);
        uv.push(i / n, j / n);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
      }
    const tex = doc.createTexture().setImage(new Uint8Array(image)).setMimeType(mime);
    const mat = doc.createMaterial().setBaseColorTexture(tex);
    mat.getBaseColorTextureInfo().setMinFilter(9729).setMagFilter(9729);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf))
      .setMaterial(mat);
    doc.getRoot().listScenes()[0].addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  });
  await io.write(file, doc);
  return file;
}

/** A photo-like (non-uniform) image: prune() would turn a solid colour into a plain material colour. */
export const noise = (w, h, seed = 2654435761) =>
  sharp(Buffer.from(Array.from({ length: w * h * 3 }, (_, i) => (i * seed) % 251)), { raw: { width: w, height: h, channels: 3 } });
