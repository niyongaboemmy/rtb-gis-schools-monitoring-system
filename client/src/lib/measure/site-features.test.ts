import { describe, expect, it } from "vitest";
import {
  buildGeometry,
  featureModelPoints,
  featureTo2dAnnotation,
  formatFeatureValue,
  geometryFromShape,
  geometryPositions,
  modelPointsToPositions,
  type SiteFeature,
} from "./site-features";

const ORIGIN = { lat: -1.96, lng: 30.55, alt: 1400 };

const feature = (over: Partial<SiteFeature>): SiteFeature => ({
  id: "f1",
  schoolId: "s1",
  kind: "measure_area",
  geometry: { type: "Polygon", coordinates: [[[30, -1], [30.001, -1], [30.001, -1.001], [30, -1]]] },
  modelCoords: null,
  value: 12_345.678,
  unit: "m2",
  label: null,
  description: null,
  color: null,
  properties: null,
  source: "2d",
  createdBy: "u1",
  createdByName: "Ana",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("site feature helpers", () => {
  it("builds closed polygons for areas and lines for distances", () => {
    const pts = [[30, -1], [30.001, -1], [30.001, -1.001]];
    expect(buildGeometry("measure_area", pts)).toEqual({ type: "Polygon", coordinates: [[...pts, pts[0]]] });
    expect(buildGeometry("measure_distance", pts).type).toBe("LineString");
    expect(buildGeometry("note", [[30, -1]]).type).toBe("Point");
  });

  it("geometryFromShape keeps the 2D shape", () => {
    expect(geometryFromShape("polygon", [30, -1, 30.1, -1, 30.1, -1.1])?.type).toBe("Polygon");
    expect(geometryFromShape("line", [30, -1, 30.1, -1])?.type).toBe("LineString");
    expect(geometryFromShape("point", [30, -1])).toEqual({ type: "Point", coordinates: [30, -1] });
    expect(geometryFromShape("line", [])).toBeNull();
  });

  it("drops the closing vertex of polygon rings", () => {
    expect(geometryPositions(feature({}).geometry)).toHaveLength(3);
  });

  it("uses exact model coords for 3D features and the bridge for 2D ones", () => {
    const mc = [{ x: 1, y: 2, z: 3 }];
    expect(featureModelPoints(feature({ source: "3d", modelCoords: mc }), ORIGIN)).toBe(mc);
    const pos = modelPointsToPositions([{ x: 10, y: 0, z: -20 }], ORIGIN);
    const back = featureModelPoints(feature({ geometry: { type: "Point", coordinates: pos[0] } }), ORIGIN)[0];
    expect(back.x).toBeCloseTo(10, 2);
    expect(back.z).toBeCloseTo(-20, 2);
  });

  it("formats values at the source's precision", () => {
    expect(formatFeatureValue(feature({}))).toContain("1.23 ha");
    expect(formatFeatureValue(feature({ kind: "measure_distance", value: 12.3456, source: "3d" }))).toBe("12.35 m");
    expect(formatFeatureValue(feature({ kind: "note", value: null }))).toBe("");
  });

  it("converts to the 2D layer's annotation shape", () => {
    const a = featureTo2dAnnotation(feature({ source: "3d" }));
    expect(a.type).toBe("polygon");
    expect(a.coordinates).toEqual([30, -1, 30.001, -1, 30.001, -1.001]);
    expect(a.areaSquareMeters).toBeCloseTo(12_345.678);
    expect(a.style.color).toBe("#8b5cf6"); // 3D-sourced colour in 2D
  });
});
