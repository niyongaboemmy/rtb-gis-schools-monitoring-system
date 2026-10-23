import { describe, expect, it, vi } from "vitest";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { createMapHudStore } from "./map-hud-store";
import { kmlStyle } from "./MapUtils";

describe("map HUD store", () => {
  it("batches many updates into one notification per frame and skips no-ops", async () => {
    vi.useFakeTimers();
    const store = createMapHudStore({ lat: -1.9, lng: 30 });
    const listener = vi.fn();
    store.subscribe(listener);
    for (let i = 0; i < 50; i++) store.setPointer(-1.9 + i * 1e-6, 30);
    store.setDecoding(3);
    store.setTilesLoading(false); // unchanged
    await vi.runAllTimersAsync();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toMatchObject({ decoding: 3, tilesLoading: false });
    expect(store.get().lat).toBeCloseTo(-1.9 + 49e-6, 9);
    listener.mockClear();
    store.setPointer(store.get().lat, store.get().lng);
    await vi.runAllTimersAsync();
    expect(listener).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("site-map style cache", () => {
  it("reuses one style per label and geometry type", () => {
    const a = new Feature({ geometry: new Point([0, 0]), name: "Block A" });
    const b = new Feature({ geometry: new Point([5, 5]), name: "Block A" });
    const c = new Feature({ geometry: new Point([5, 5]), name: "Block B" });
    expect(kmlStyle(a)).toBe(kmlStyle(b));
    expect(kmlStyle(a)).not.toBe(kmlStyle(c));
    expect(kmlStyle(c).getText()?.getText()).toBe("Block B");
  });
});

import { pyramidTileGrid } from "./hooks/useKmzLoader";

describe("site-map pyramid tile grid", () => {
  it("matches libvips' google layout: top-left origin, z/y/x, maxZoom at native resolution", () => {
    const grid = pyramidTileGrid({ maxZoom: 5, resolution: 0.15, origin: [3345963, -216814] });
    expect(grid.getResolution(5)).toBeCloseTo(0.15, 9);
    expect(grid.getResolution(0)).toBeCloseTo(0.15 * 32, 9);
    // Tile (z=5, x=1, y=2) starts 256 px right and 512 px down from the image's top-left.
    const ext = grid.getTileCoordExtent([5, 1, 2]);
    expect(ext[0]).toBeCloseTo(3345963 + 256 * 0.15, 6);
    expect(ext[3]).toBeCloseTo(-216814 - 512 * 0.15, 6);
  });
});

describe("detailPhotos", () => {
  it("keeps only photos that can beat the pyramid, coarse first", async () => {
    const { detailPhotos } = await import("./hooks/useKmzLoader");
    const sq = (side: number, name: string) => ({ name, ext: [0, 0, side, side] });
    // Pyramid pixel 0.05 m: a 512 px photo is finer when it spans < 25.6 m; keep ≤ 1024 px worth (51.2 m).
    const out = detailPhotos([sq(12.5, "fine"), sq(200, "coarse"), sq(50, "mid"), sq(25, "finer-mid")], 0.05);
    expect(out.map((p) => p.name)).toEqual(["mid", "finer-mid", "fine"]);
  });
});

describe("full-detail site tiles grid", () => {
  it("asks for one level deeper on 2x screens, drawing each file pixel on one screen pixel", async () => {
    const { siteTilesGrid, siteTilesMinViewZoom } = await import("./hooks/useKmzLoader");
    const world = 2 * Math.PI * 6378137;
    const viewRes = world / (256 * 2 ** 22); // view at zoom 22 (CSS pixels)
    expect(siteTilesGrid(24, 1).getZForResolution(viewRes)).toBe(22);
    expect(siteTilesGrid(24, 2).getZForResolution(viewRes)).toBe(23);
    // Same tile coordinates on both grids: z/x/y files are shared.
    expect(siteTilesGrid(24, 2).getTileCoordExtent([23, 100, 200])).toEqual(siteTilesGrid(24, 1).getTileCoordExtent([23, 100, 200]));
    // Beyond the deepest level the grid stops (OpenLayers enlarges it).
    expect(siteTilesGrid(24, 2).getZForResolution(viewRes / 64)).toBe(24);
    expect(siteTilesMinViewZoom(16, 1)).toBe(16);
    expect(siteTilesMinViewZoom(16, 2)).toBe(15);
  });
});
