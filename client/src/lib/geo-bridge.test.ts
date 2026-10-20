import { describe, expect, it } from "vitest";
import {
  ecefToGeodetic,
  geodeticToEcef,
  modelToWgs84,
  wgs84ToModel,
  wgs84ToEnu,
} from "./geo-bridge";
import { localArea } from "./measure/geodesic";
import { planArea } from "./measure/geometry3d";

const ORIGIN = { lat: -1.9626354, lng: 30.5533304, alt: 1450 };

describe("geo-bridge (WS5.3)", () => {
  it("ECEF round trip is sub-millimetre", () => {
    const [x, y, z] = geodeticToEcef(ORIGIN.lat, ORIGIN.lng, ORIGIN.alt);
    const g = ecefToGeodetic(x, y, z);
    expect(g.lat).toBeCloseTo(ORIGIN.lat, 10);
    expect(g.lng).toBeCloseTo(ORIGIN.lng, 10);
    expect(g.alt).toBeCloseTo(ORIGIN.alt, 4);
  });

  it("origin maps to model (0,0,0); axes are East=+X, Up=+Y, North=−Z", () => {
    const o = wgs84ToModel(ORIGIN, ORIGIN);
    expect(Math.hypot(o.x, o.y, o.z)).toBeLessThan(1e-6);
    const north = modelToWgs84({ x: 0, y: 0, z: -100 }, ORIGIN);
    expect(north.lat).toBeGreaterThan(ORIGIN.lat);
    expect(north.lng).toBeCloseTo(ORIGIN.lng, 9);
    const east = modelToWgs84({ x: 100, y: 0, z: 0 }, ORIGIN);
    expect(east.lng).toBeGreaterThan(ORIGIN.lng);
    const up = modelToWgs84({ x: 0, y: 10, z: 0 }, ORIGIN);
    expect(up.alt - ORIGIN.alt).toBeCloseTo(10, 6);
  });

  it("round trip model → WGS84 → model is < 1 cm at 1 km from the origin", () => {
    for (const p of [
      { x: 1000, y: 0, z: 0 },
      { x: 0, y: 25, z: -1000 },
      { x: -707, y: -40, z: 707 },
      { x: 700, y: 80, z: 700 },
    ]) {
      const back = wgs84ToModel(modelToWgs84(p, ORIGIN), ORIGIN);
      expect(Math.hypot(back.x - p.x, back.y - p.y, back.z - p.z)).toBeLessThan(0.01);
    }
  });

  it("1 km east in ENU is 1 km on the ground", () => {
    const g = modelToWgs84({ x: 1000, y: 0, z: 0 }, ORIGIN);
    const enu = wgs84ToEnu(g, ORIGIN);
    expect(enu.e).toBeCloseTo(1000, 3);
  });
});

describe("2D ↔ 3D sync verification (WS5.8)", () => {
  // A ~42 m × 18 m L-shaped building footprint drawn in 2D (lon/lat).
  const footprint: [number, number][] = [
    [30.55310, -1.96270],
    [30.55348, -1.96270],
    [30.55348, -1.96254],
    [30.55330, -1.96254],
    [30.55330, -1.96240],
    [30.55310, -1.96240],
  ];

  it("WGS84 → model → WGS84 positional error < 0.5 m", () => {
    for (const [lng, lat] of footprint) {
      const m = wgs84ToModel({ lat, lng, alt: ORIGIN.alt }, ORIGIN);
      const back = modelToWgs84(m, ORIGIN);
      const err = wgs84ToEnu(back, { lat, lng, alt: ORIGIN.alt });
      expect(Math.hypot(err.e, err.n)).toBeLessThan(0.5);
    }
  });

  it("2D geodesic area and 3D plan area agree within 2 %", () => {
    const area2d = localArea(footprint);
    const model = footprint.map(([lng, lat]) => wgs84ToModel({ lat, lng, alt: ORIGIN.alt }, ORIGIN));
    const area3d = planArea(model);
    expect(area2d).toBeGreaterThan(500);
    expect(Math.abs(area3d - area2d) / area2d).toBeLessThan(0.02);
  });
});
