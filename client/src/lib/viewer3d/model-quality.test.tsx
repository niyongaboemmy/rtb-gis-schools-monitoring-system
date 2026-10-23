import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { detailCm, detailExplanation } from "./model-quality";
import { ViewerStatsFooter } from "../../components/3dviewercomponents/ViewerStatsFooter";
import { sceneTextureBytes, textureBytes } from "./gpu-budget";
import * as THREE from "three";

const q = {
  served: {
    cmPerPixel: { horizontal: { median: 8.85, p90: 16.4 }, vertical: { median: 8.65, p90: 17.6 }, overall: { median: 8.79, p90: 16.8 } },
    score: "low" as const,
    warnings: ["One texture covers the whole site; export several texture pages or 3D Tiles for sharp detail."],
  },
};

describe("model detail", () => {
  it("headlines ground/roof detail and explains it in plain words", () => {
    expect(detailCm(q)).toBe(8.85);
    expect(detailCm(null)).toBeNull();
    expect(detailExplanation(q)).toMatch(/8\.8 cm of ground and roofs and 8\.7 cm of walls.*2 cm/s);
    expect(detailExplanation(q)).toMatch(/One texture covers/);
  });

  it("shows the detail in the viewer stats bar", () => {
    const stats = { fileName: "nyamirama.glb", fileSize: 1, loadTime: 1, triangles: 1, meshes: 1, textures: 1 };
    render(<ViewerStatsFooter stats={stats} showMeasurePanel={false} formatBytes={String} formatTime={String} quality={q} />);
    expect(screen.getByText("8.8 cm/px")).toBeInTheDocument();
    expect(screen.getByText("Low detail")).toBeInTheDocument();
  });
});

describe("GPU texture budget", () => {
  it("counts a 4096² RGBA texture with mipmaps as ≈ 85 MB, without as 64 MB", () => {
    const t = new THREE.Texture({ width: 4096, height: 4096 } as unknown as HTMLImageElement);
    expect(textureBytes(t) / 1048576).toBeCloseTo(85.3, 0);
    t.generateMipmaps = false;
    expect(textureBytes(t) / 1048576).toBe(64);
  });

  it("counts each texture once across meshes", () => {
    const t = new THREE.Texture({ width: 1024, height: 1024 } as unknown as HTMLImageElement);
    const mat = new THREE.MeshBasicMaterial({ map: t });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), mat), new THREE.Mesh(new THREE.BufferGeometry(), mat));
    expect(sceneTextureBytes(g)).toBe(textureBytes(t));
  });
});
