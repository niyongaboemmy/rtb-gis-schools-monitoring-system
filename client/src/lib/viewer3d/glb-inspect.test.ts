import { describe, expect, it } from "vitest";
import { inspectGlb, parseGlbHeader } from "./glb-inspect";

function glb(json: object): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4) text += " ";
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(20 + body.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, body.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  return out;
}

describe("glb-inspect", () => {
  it("flags a Meshopt-compressed file", async () => {
    const bytes = glb({ asset: { version: "2.0" }, extensionsUsed: ["EXT_meshopt_compression", "EXT_texture_webp"], textures: [{}] });
    const info = await inspectGlb(new Blob([bytes as BlobPart]));
    expect(info).toEqual({ extensions: ["EXT_meshopt_compression", "EXT_texture_webp"], textures: 1, precompressed: true });
  });

  it("passes a full export", () => {
    const info = parseGlbHeader(glb({ asset: { version: "2.0" }, textures: [{}, {}, {}] }).buffer as ArrayBuffer);
    expect(info?.precompressed).toBe(false);
    expect(info?.textures).toBe(3);
  });

  it("returns null for a file that is not a GLB", async () => {
    expect(await inspectGlb(new Blob(["not a model at all, just text"]))).toBeNull();
  });
});
