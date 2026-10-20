import { describe, expect, it } from "vitest";
import {
  ellipsoidalLength,
  localArea,
  sphericalArea,
  sphericalLength,
  areaOf3857,
  lengthOf3857,
} from "./geodesic";
import { enuToWgs84 } from "../geo-bridge";
import { LineString, Polygon } from "ol/geom";
import { fromLonLat } from "ol/proj";

const KIGALI = { lat: -1.9441, lng: 30.0619, alt: 0 };

/** A square of `side` metres centred on Kigali, as a lon/lat ring. */
function squareRing(side: number) {
  const h = side / 2;
  return [
    [-h, -h], [h, -h], [h, h], [-h, h],
  ].map(([e, n]) => {
    const g = enuToWgs84({ e, n, u: 0 }, KIGALI);
    return [g.lng, g.lat];
  });
}

describe("2D geodesic maths (WS6.1)", () => {
  it("1° of latitude near Kigali ≈ 110.6 km (±0.5 %)", () => {
    const d = ellipsoidalLength([[30.06, -2.44], [30.06, -1.44]]);
    expect(Math.abs(d - 110_600) / 110_600).toBeLessThan(0.005);
    expect(d).toBeCloseTo(110_576, -1); // WGS84 meridian arc
  });

  it("a 100 m × 100 m square ≈ 1 ha (±1 %)", () => {
    const ring = squareRing(100);
    expect(Math.abs(localArea(ring) - 10_000) / 10_000).toBeLessThan(0.01);
    expect(localArea(ring)).toBeCloseTo(10_000, 0);
  });

  it("ol/sphere (old method) stays within 1 % but over-reads N–S lengths near the equator", () => {
    const sph = sphericalLength([[30.06, -2.44], [30.06, -1.44]]);
    const ell = ellipsoidalLength([[30.06, -2.44], [30.06, -1.44]]);
    expect(sph / ell - 1).toBeGreaterThan(0.004);
    expect(sph / ell - 1).toBeLessThan(0.01);
    expect(Math.abs(sphericalArea(squareRing(100)) - 10_000) / 10_000).toBeLessThan(0.01);
  });

  it("EPSG:3857 geometry helpers match the lon/lat functions", () => {
    const ring = squareRing(100);
    const poly = new Polygon([[...ring, ring[0]].map((c) => fromLonLat(c))]);
    expect(areaOf3857(poly)).toBeCloseTo(10_000, 0);
    const line = new LineString([ring[0], ring[1]].map((c) => fromLonLat(c)));
    expect(lengthOf3857(line)).toBeCloseTo(100, 1);
  });
});
