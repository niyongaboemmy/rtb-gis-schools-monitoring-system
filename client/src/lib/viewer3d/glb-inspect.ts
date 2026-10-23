/**
 * Reads only the JSON header of a .glb in the browser, before upload, to tell
 * whether the file was already compressed for the web (Meshopt / Draco /
 * quantised). Such files have lost detail upstream; the survey team should
 * send the full export instead (docs/3D_SURVEY_SPEC.md).
 */
export interface GlbInfo {
  extensions: string[];
  textures: number;
  precompressed: boolean;
}

const COMPRESSED = ["EXT_meshopt_compression", "KHR_draco_mesh_compression", "KHR_mesh_quantization"];
const MAX_JSON = 64 * 1024 * 1024;

/** Parse the header bytes of a GLB (the first 20 bytes plus the JSON chunk). */
export function parseGlbHeader(buf: ArrayBuffer): GlbInfo | null {
  if (buf.byteLength < 20) return null;
  const v = new DataView(buf);
  if (v.getUint32(0, true) !== 0x46546c67) return null; // "glTF"
  const len = v.getUint32(12, true);
  if (v.getUint32(16, true) !== 0x4e4f534a || 20 + len > buf.byteLength) return null; // "JSON"
  try {
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len)));
    const extensions: string[] = json.extensionsUsed ?? [];
    return {
      extensions,
      textures: Array.isArray(json.textures) ? json.textures.length : 0,
      precompressed: extensions.some((e) => COMPRESSED.includes(e)),
    };
  } catch {
    return null;
  }
}

/** Inspect a picked file; null when it is not a readable GLB. */
export async function inspectGlb(file: Blob): Promise<GlbInfo | null> {
  const head = await file.slice(0, 20).arrayBuffer();
  if (head.byteLength < 20) return null;
  const len = new DataView(head).getUint32(12, true);
  if (len > MAX_JSON) return null;
  return parseGlbHeader(await file.slice(0, 20 + len).arrayBuffer());
}
