import * as THREE from "three";

/** GPU texture memory the 3D viewer may use, by device class (bytes). */
export const GPU_BUDGET = {
  desktop: 512 * 1024 * 1024,
  phone: 256 * 1024 * 1024,
} as const;

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap"] as const;

/** Bytes one texture occupies on the GPU (mip chain included). */
export function textureBytes(tex: THREE.Texture): number {
  // GPU-compressed (KTX2 / Basis): the mip levels carry their real sizes.
  const ct = tex as THREE.CompressedTexture;
  if (ct.isCompressedTexture && Array.isArray(ct.mipmaps) && ct.mipmaps.length) {
    return (ct.mipmaps as Array<{ data?: ArrayBufferView }>).reduce((s, m) => s + (m.data?.byteLength ?? 0), 0);
  }
  const img = tex.image as { width?: number; height?: number } | null;
  const w = img?.width ?? 0;
  const h = img?.height ?? 0;
  // RGBA8 + full mip chain (≈ 4/3).
  return Math.round(w * h * 4 * (tex.generateMipmaps === false ? 1 : 4 / 3));
}

/** Total GPU texture bytes under an object (each texture counted once). */
export function sceneTextureBytes(root: THREE.Object3D | null): number {
  if (!root) return 0;
  const seen = new Set<THREE.Texture>();
  let total = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as unknown as Record<string, unknown>[];
    for (const m of mats)
      for (const slot of TEXTURE_SLOTS) {
        const t = m?.[slot] as THREE.Texture | undefined;
        if (t && !seen.has(t)) {
          seen.add(t);
          total += textureBytes(t);
        }
      }
  });
  return total;
}

/** Rough device class for budgets: touch-first or ≤ 4 GB RAM counts as a phone. */
export function deviceClass(): keyof typeof GPU_BUDGET {
  if (typeof window === "undefined") return "desktop";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return coarse || (mem != null && mem <= 4) ? "phone" : "desktop";
}
