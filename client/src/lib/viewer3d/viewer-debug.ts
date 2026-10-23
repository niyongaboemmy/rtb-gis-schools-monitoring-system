import * as THREE from "three";
import { sceneTextureBytes } from "./gpu-budget";

/**
 * A small test hook for the 3D viewer, used by the quality/performance
 * harness (scripts/viewer-bench.mjs). Present in development builds, or when
 * `localStorage["rtb-viewer-debug"] === "1"`. Never changes the scene unless
 * a test calls setView().
 */
export interface ViewerDebug {
  ready: boolean;
  /** Frames rendered so far. */
  frames: () => number;
  /** GPU resources in use. */
  info: () => { textures: number; geometries: number; textureBytes: number; triangles: number; calls: number };
  /** Every texture on the model with its sampling settings. */
  textures: () => Array<{ width: number; height: number; mipmaps: boolean; minFilter: number; anisotropy: number; colorSpace: string; compressed: boolean }>;
  /** Model bounds in scene units. */
  bounds: () => { min: number[]; max: number[] } | null;
  /** Put the camera at `position`, looking at `target`. */
  setView: (v: { position: number[]; target: number[] }) => void;
}

declare global {
  interface Window {
    __rtbViewer?: ViewerDebug;
  }
}

const enabled = () => {
  try {
    return import.meta.env.DEV || localStorage.getItem("rtb-viewer-debug") === "1";
  } catch {
    return import.meta.env.DEV;
  }
};

export function attachViewerDebug(opts: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update: () => void };
  getModel: () => THREE.Object3D | null;
}): () => void {
  if (!enabled() || typeof window === "undefined") return () => {};
  const { renderer, camera, controls, getModel } = opts;
  const hook: ViewerDebug = {
    ready: true,
    frames: () => renderer.info.render.frame,
    info: () => ({
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      textureBytes: sceneTextureBytes(getModel()),
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
    }),
    textures: () => {
      const seen = new Set<THREE.Texture>();
      const out: ReturnType<ViewerDebug["textures"]> = [];
      getModel()?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as unknown as Record<string, unknown>[]) {
          const t = m?.map as THREE.Texture | undefined;
          if (!t || seen.has(t)) continue;
          seen.add(t);
          const img = t.image as { width?: number; height?: number } | null;
          out.push({
            width: img?.width ?? 0,
            height: img?.height ?? 0,
            mipmaps: t.generateMipmaps || (Array.isArray(t.mipmaps) && t.mipmaps.length > 1),
            minFilter: t.minFilter,
            anisotropy: t.anisotropy,
            colorSpace: t.colorSpace,
            compressed: !!(t as THREE.CompressedTexture).isCompressedTexture,
          });
        }
      });
      return out;
    },
    bounds: () => {
      const m = getModel();
      if (!m) return null;
      const box = new THREE.Box3().setFromObject(m);
      return { min: box.min.toArray(), max: box.max.toArray() };
    },
    setView: ({ position, target }) => {
      camera.position.fromArray(position);
      controls.target.fromArray(target);
      camera.lookAt(controls.target);
      controls.update();
    },
  };
  window.__rtbViewer = hook;
  return () => {
    if (window.__rtbViewer === hook) delete window.__rtbViewer;
  };
}
