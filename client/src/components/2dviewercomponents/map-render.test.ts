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
