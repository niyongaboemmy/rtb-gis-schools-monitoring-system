import { describe, expect, it } from "vitest";
import {
  cumulativeLengths,
  distanceMeters,
  formatCoord,
  gridCluster,
  isFullRange,
  nearest,
  normProvince,
  parseRange,
  parseView,
  polygonArea,
  serializeView,
} from "./geo";

describe("national map geo helpers", () => {
  it("measures great-circle distance", () => {
    // Kigali → Huye is ~ 80–90 km as the crow flies.
    const d = distanceMeters([-1.9441, 30.0619], [-2.5967, 29.7394]);
    expect(d).toBeGreaterThan(75_000);
    expect(d).toBeLessThan(90_000);
    expect(distanceMeters([0, 0], [0, 0])).toBe(0);
  });

  it("accumulates path lengths per vertex", () => {
    const c = cumulativeLengths([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    expect(c[0]).toBe(0);
    expect(c[2]).toBeCloseTo(c[1] * 2, 0);
  });

  it("computes a geodesic polygon area", () => {
    // ~0.01° square at the equator ≈ 1.236 km².
    const a = polygonArea([
      [0, 0],
      [0, 0.01],
      [0.01, 0.01],
      [0.01, 0],
    ]);
    expect(a).toBeGreaterThan(1_200_000);
    expect(a).toBeLessThan(1_270_000);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
  });

  it("round-trips the map view through the URL", () => {
    const v = parseView(serializeView({ lat: -1.940312345, lng: 29.873912345, zoom: 8.456 }));
    expect(v).toEqual({ lat: -1.94031, lng: 29.87391, zoom: 8.46 });
    expect(parseView("nope")).toBeNull();
    expect(parseView("95,10,8")).toBeNull();
  });

  it("parses score ranges defensively", () => {
    expect(parseRange("35-75")).toEqual([35, 75]);
    expect(parseRange("80-20")).toEqual([20, 80]);
    expect(parseRange("x")).toEqual([0, 100]);
    expect(isFullRange(parseRange(null))).toBe(true);
  });

  it("clusters points sharing a grid cell", () => {
    const clusters = gridCluster(
      [
        { item: "a", x: 1, y: 1 },
        { item: "b", x: 10, y: 10 },
        { item: "c", x: 200, y: 200 },
      ],
      56,
    );
    expect(clusters).toHaveLength(2);
    const big = clusters.find((c) => c.items.length === 2)!;
    expect(big.items.sort()).toEqual(["a", "b"]);
    expect(big.x).toBeCloseTo(5.5);
  });

  it("finds the nearest points", () => {
    const pts = [
      { id: 1, lat: 0, lng: 0.5 },
      { id: 2, lat: 0, lng: 0.1 },
      { id: 3, lat: 0, lng: 2 },
    ];
    const r = nearest([0, 0], pts, 2, (p) => p.id === 2);
    expect(r.map((x) => x.point.id)).toEqual([1, 3]);
  });

  it("normalises province names and formats coordinates", () => {
    expect(normProvince("Kigali City")).toBe(normProvince("City of Kigali"));
    expect(normProvince("Eastern Province")).toBe("eastern");
    expect(formatCoord(-1.9403, 29.8739)).toBe("-1.94030, 29.87390");
  });
});
