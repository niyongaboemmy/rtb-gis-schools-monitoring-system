import { describe, expect, it } from "vitest";
import Feature from "ol/Feature";
import Polygon from "ol/geom/Polygon";
import { getWidth } from "ol/extent";
import { fromLonLat } from "ol/proj";
import { framePadding, MIN_FRAME_M, pickFrame, POINT_ZOOM } from "./frame";

const point: [number, number] = [30.5533, -1.9626];
const square = (lng: number, lat: number, d: number) => [
  [lng - d, lat - d],
  [lng + d, lat - d],
  [lng + d, lat + d],
  [lng - d, lat + d],
  [lng - d, lat - d],
];

describe("pickFrame", () => {
  it("prefers the campus boundary", () => {
    const f = pickFrame({ boundaries: [{ boundaryType: "campus", geojson: { type: "Polygon", coordinates: [square(...point, 0.001)] } }], point });
    expect(f?.source).toBe("boundary");
  });

  it("uses site-map outlines next, ignoring imagery", () => {
    const poly = new Feature(new Polygon([square(...point, 0.001).map((c) => fromLonLat(c))]));
    const imagery = [...fromLonLat([30.54, -1.97]), ...fromLonLat([30.57, -1.95])];
    expect(pickFrame({ kmlFeatures: [poly], point, imagery })?.source).toBe("site-map outline");
  });

  it("frames the school point, not wide drone imagery", () => {
    const imagery = [...fromLonLat([30.551, -1.9645]), ...fromLonLat([30.5555, -1.9605])];
    const f = pickFrame({ point, imagery });
    expect(f).toMatchObject({ source: "point", zoom: POINT_ZOOM });
  });

  it("frames buildings with the school point, never tighter than the minimum", () => {
    const f = pickFrame({ buildings: [{ lat: -1.9626, lng: 30.5533 }], point });
    expect(f?.source).toBe("buildings");
    if (f && "extent" in f) expect(getWidth(f.extent)).toBeGreaterThanOrEqual(MIN_FRAME_M);
  });

  it("skips buildings recorded far from the school", () => {
    expect(pickFrame({ buildings: [{ lat: -1.93, lng: 30.1 }], point })?.source).toBe("point");
  });

  it("ignores a 0,0 point", () => {
    expect(pickFrame({ point: [0, 0] })).toBeNull();
  });
});

describe("framePadding", () => {
  it("keeps the compound clear of the rail on desktop and the bottom bar on phones", () => {
    const rail = { left: 1200 } as DOMRect;
    expect(framePadding(1440, rail)[1]).toBe(264);
    expect(framePadding(390, null)[2]).toBeGreaterThan(150);
  });
});
