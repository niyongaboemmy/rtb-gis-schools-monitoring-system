import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GPU_BUDGET, textureBytes, type deviceClass } from "./gpu-budget";

/**
 * Which build of a school model to load (Phase 3 of
 * docs/3D_QUALITY_IMPLEMENTATION_PLAN.md). The server keeps the WebP build and,
 * for heavy textures, a KTX2 / UASTC build beside it (`<name>.ktx2.glb`): ≈ 4×
 * less GPU memory, ≈ 2.8× larger download.
 */
export interface Ktx2Variant {
  bytes: number;
  gpuBytes: number;
  webpGpuBytes: number;
}

type Device = ReturnType<typeof deviceClass>;

/** Largest KTX2 copy a phone downloads; above it the WebP build loads and its textures are scaled to fit. */
export const PHONE_MAX_KTX2_BYTES = 80 * 1024 * 1024;

/**
 * KTX2 when the device has GPU texture compression and needs it:
 * - phones, as long as the copy is a reasonable download (≤ 80 MB);
 * - desktops, only when the WebP build would not fit ~90% of their budget
 *   (KTX2 is ≈ 2.8× the download, so it must buy something).
 * Without compression support KTX2 would be unpacked to plain pixels: no gain.
 */
export function pickModelVariant(o: {
  ktx2: Ktx2Variant | null | undefined;
  device: Device;
  compressed: boolean;
}): "ktx2" | "webp" {
  if (!o.ktx2 || !o.compressed) return "webp";
  if (o.device === "phone") return o.ktx2.bytes <= PHONE_MAX_KTX2_BYTES ? "ktx2" : "webp";
  return o.ktx2.webpGpuBytes > GPU_BUDGET.desktop * 0.9 ? "ktx2" : "webp";
}

/** `…/3d/site.glb?v=1` → `…/3d/site.ktx2.glb?v=1` */
export function ktx2Url(servedUrl: string): string {
  const [p, q] = servedUrl.split("?");
  return p.replace(/\.glb$/i, ".ktx2.glb") + (q ? `?${q}` : "");
}

let compressedSupport: boolean | null = null;

/** Does this GPU sample a compressed format UASTC transcodes to (ASTC, BC7, ETC2, S3TC)? */
export function hasCompressedTextures(): boolean {
  if (compressedSupport != null) return compressedSupport;
  compressedSupport = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      const ext = gl.getSupportedExtensions() ?? [];
      compressedSupport = [
        "WEBGL_compressed_texture_astc",
        "EXT_texture_compression_bptc",
        "WEBGL_compressed_texture_etc",
        "WEBGL_compressed_texture_s3tc",
      ].some((e) => ext.includes(e));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* no WebGL2: stay on WebP */
  }
  return compressedSupport;
}

let ktx2Loader: KTX2Loader | null = null;

/** One KTX2 loader per page; the Basis transcoder is self-hosted in /basis/. */
export function ktx2LoaderFor(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`).detectSupport(renderer);
  }
  return ktx2Loader;
}

/**
 * Last resort when plain (uncompressed) textures exceed the device budget:
 * halve the largest until they fit. Returns true when detail was reduced.
 */
export async function fitTexturesToBudget(textures: THREE.Texture[], budget: number): Promise<boolean> {
  const plain = textures.filter((t) => !(t as THREE.CompressedTexture).isCompressedTexture);
  let total = textures.reduce((s, t) => s + textureBytes(t), 0);
  let reduced = false;
  while (total > budget) {
    const big = plain
      .filter((t) => ((t.image as { width?: number })?.width ?? 0) > 1024)
      .sort((a, b) => textureBytes(b) - textureBytes(a))[0];
    if (!big) break;
    const img = big.image as ImageBitmap | HTMLImageElement | HTMLCanvasElement;
    const before = textureBytes(big);
    const half = await createImageBitmap(img, {
      resizeWidth: Math.max(1, Math.floor(img.width / 2)),
      resizeHeight: Math.max(1, Math.floor(img.height / 2)),
      resizeQuality: "high",
    });
    if ("close" in img && typeof img.close === "function") img.close();
    big.image = half;
    big.needsUpdate = true;
    total += textureBytes(big) - before;
    reduced = true;
  }
  return reduced;
}
