import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { fitTexturesToBudget, ktx2Url, pickModelVariant } from "./model-variant";
import { GPU_BUDGET, textureBytes } from "./gpu-budget";

const MB = 1024 * 1024;
const variant = (webpGpuMb: number) => ({ bytes: 50 * MB, gpuBytes: webpGpuMb * MB / 4, webpGpuBytes: webpGpuMb * MB });

describe("pickModelVariant", () => {
  it("stays on WebP without a KTX2 build or without GPU compression", () => {
    expect(pickModelVariant({ ktx2: null, device: "phone", compressed: true })).toBe("webp");
    expect(pickModelVariant({ ktx2: variant(400), device: "phone", compressed: false })).toBe("webp");
  });

  it("uses KTX2 on phones, and on desktops once WebP would take over half the budget", () => {
    expect(pickModelVariant({ ktx2: variant(120), device: "phone", compressed: true })).toBe("ktx2");
    expect(pickModelVariant({ ktx2: variant(120), device: "desktop", compressed: true })).toBe("webp");
    expect(pickModelVariant({ ktx2: variant(340), device: "desktop", compressed: true })).toBe("ktx2");
  });
});

describe("ktx2Url", () => {
  it("points beside the served model and keeps the query", () => {
    expect(ktx2Url("/files/schools/a/3d/site%20one.glb?v=2")).toBe("/files/schools/a/3d/site%20one.ktx2.glb?v=2");
    expect(ktx2Url("/files/schools/a/3d/site.GLB")).toBe("/files/schools/a/3d/site.ktx2.glb");
  });
});

describe("fitTexturesToBudget", () => {
  afterEach(() => vi.unstubAllGlobals());

  const tex = (size: number) => {
    const t = new THREE.Texture({ width: size, height: size, close: vi.fn() } as unknown as ImageBitmap);
    t.generateMipmaps = true;
    return t;
  };

  it("halves the largest plain textures until they fit, and says so", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async (_img: unknown, o: { resizeWidth: number; resizeHeight: number }) => ({ width: o.resizeWidth, height: o.resizeHeight, close: vi.fn() })));
    const pages = [tex(8192), tex(4096)];
    expect(pages.reduce((s, t) => s + textureBytes(t), 0)).toBeGreaterThan(GPU_BUDGET.phone);
    expect(await fitTexturesToBudget(pages, GPU_BUDGET.phone)).toBe(true);
    expect(pages.map((t) => (t.image as ImageBitmap).width)).toEqual([4096, 4096]);
    expect(pages.reduce((s, t) => s + textureBytes(t), 0)).toBeLessThanOrEqual(GPU_BUDGET.phone);
  });

  it("leaves textures alone when they already fit", async () => {
    const spy = vi.fn();
    vi.stubGlobal("createImageBitmap", spy);
    expect(await fitTexturesToBudget([tex(4096)], GPU_BUDGET.phone)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
