import { describe, expect, it } from "vitest";
import {
  heightDelta,
  measurePolygon,
  measureValue,
  perimeter,
  planArea,
  polylineLength,
  surfaceArea,
  validatePolygon,
  type Vec3,
} from "./geometry3d";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe("3D measurement maths (WS6.2)", () => {
  // Unit cube: base corners on y=0, top at y=1.
  const base = [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)];
  const side = [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)]; // vertical face

  it("unit cube: base face", () => {
    expect(planArea(base)).toBeCloseTo(1, 12);
    expect(surfaceArea(base)).toBeCloseTo(1, 12);
    expect(perimeter(base)).toBeCloseTo(4, 12);
  });

  it("unit cube: vertical face has surface area 1 and plan area 0", () => {
    expect(surfaceArea(side)).toBeCloseTo(1, 12);
    expect(planArea(side)).toBeCloseTo(0, 12);
    expect(validatePolygon(side).valid).toBe(true);
  });

  it("unit cube: edge, diagonal and height", () => {
    expect(polylineLength([v(0, 0, 0), v(1, 0, 0)])).toBeCloseTo(1, 12);
    expect(polylineLength([v(0, 0, 0), v(1, 1, 1)])).toBeCloseTo(Math.sqrt(3), 12);
    expect(heightDelta([v(0, 0, 0), v(1, 1, 1)])).toBeCloseTo(1, 12);
  });

  it("sloped rectangle: plan vs surface area", () => {
    // 10 m wide (X), 4 m deep in plan (Z), rising 3 m → sloped length 5 m.
    const roof = [v(0, 0, 0), v(10, 0, 0), v(10, 3, -4), v(0, 3, -4)];
    const m = measurePolygon(roof);
    expect(m.planArea).toBeCloseTo(40, 9);
    expect(m.surfaceArea).toBeCloseTo(50, 9);
    expect(m.perimeter).toBeCloseTo(30, 9);
    expect(m.validity.valid).toBe(true);
    expect(measureValue("area", roof)).toBeCloseTo(40, 9); // plan is the default
    expect(measureValue("area", roof, { areaMode: "surface" })).toBeCloseTo(50, 9);
  });

  it("collinear points are rejected", () => {
    const line = [v(0, 0, 0), v(1, 0, 1), v(2, 0, 2), v(3, 0, 3)];
    const r = validatePolygon(line);
    expect(r.valid).toBe(false);
    expect(r.issue).toBe("collinear");
    expect(surfaceArea(line)).toBeCloseTo(0, 12);
  });

  it("fewer than 3 points is rejected", () => {
    expect(validatePolygon([v(0, 0, 0), v(1, 0, 0)]).issue).toBe("too-few-points");
  });

  it("self-intersecting bow-tie is flagged", () => {
    const bowtie = [v(0, 0, 0), v(2, 0, 2), v(2, 0, 0), v(0, 0, 2)];
    const r = validatePolygon(bowtie);
    expect(r.valid).toBe(false);
    expect(r.issue).toBe("self-intersecting");
  });

  it("applies the model scale factor (length ×f, area ×f²)", () => {
    expect(measureValue("distance", [v(0, 0, 0), v(10, 0, 0)], { scale: 1.05 })).toBeCloseTo(10.5, 9);
    expect(measureValue("area", base, { scale: 2 })).toBeCloseTo(4, 9);
    expect(measureValue("height", [v(0, 0, 0), v(0, 5, 0)], { scale: 0.5 })).toBeCloseTo(2.5, 9);
  });
});
