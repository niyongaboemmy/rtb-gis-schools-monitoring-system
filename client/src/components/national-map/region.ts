import { useEffect, useState } from "react";
import type { Feature, FeatureCollection, Geometry, MultiLineString, Point, Polygon, MultiPolygon } from "geojson";
import type { GeometryCollection, MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon, Topology } from "topojson-specification";
import { feature as topoFeature, merge, mesh } from "topojson-client";
import type { LatLng } from "./geo";

type Role =
  | "rwanda"
  | "neighbour"
  | "lake"
  | "borders"
  | "province-borders"
  | "province-label"
  | "province"
  | "district"
  | "district-borders";
export type RegionFeature = Feature<Geometry, { name: string; role: Role }>;

export interface ProvinceShape {
  name: string;
  feature: RegionFeature;
  /** [south-west, north-east] in lat/lng. */
  bounds: [LatLng, LatLng];
  label: LatLng;
}

export interface DistrictShape {
  name: string;
  province: string;
  feature: RegionFeature;
  label: LatLng;
}

export interface MapRegion {
  rwanda: RegionFeature;
  /** Outer ring of Rwanda as lat/lng (for the focus mask). */
  rwandaRing: LatLng[];
  rwandaBounds: [LatLng, LatLng];
  lake: RegionFeature | null;
  provinceBorders: RegionFeature | null;
  provinces: ProvinceShape[];
  /** Internal district borders (not shared with a province border). */
  districtBorders: RegionFeature | null;
  districts: DistrictShape[];
}

type DistrictProps = { name: string; province: string; label: [number, number] };
type DistrictGeom = (TopoPolygon<DistrictProps> | TopoMultiPolygon<DistrictProps>) & { properties: DistrictProps };
/** Properties of a district arc owner (mesh filters get the generic object type). */
const propsOf = (g: { properties?: unknown }) => g.properties as DistrictProps;

const ringsOf = (g: Geometry): number[][][] =>
  g.type === "Polygon"
    ? (g as Polygon).coordinates
    : g.type === "MultiPolygon"
      ? (g as MultiPolygon).coordinates.flat()
      : [];

function boundsOf(g: Geometry): [LatLng, LatLng] {
  let s = 90,
    w = 180,
    n = -90,
    e = -180;
  for (const ring of ringsOf(g))
    for (const [lng, lat] of ring) {
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      w = Math.min(w, lng);
      e = Math.max(e, lng);
    }
  return [
    [s, w],
    [n, e],
  ];
}

/**
 * Loaded once per session, shared by every mount. Country, provinces and
 * districts all come from ONE topology (NISR districts, CC BY 4.0, built by
 * a topology-preserving simplification), so every level shares the exact
 * same edges — and they sit on the official lines in the imagery. The small
 * region file still supplies the lake and province label anchors.
 */
let cache: Promise<MapRegion> | null = null;
export function loadMapRegion(): Promise<MapRegion> {
  cache ??= Promise.all([import("../auth/rwanda-region.json"), import("./rwanda-admin.topo.json")]).then(
    ([regionMod, topoMod]) => {
      const fc = (regionMod.default ?? regionMod) as unknown as FeatureCollection<Geometry, { name: string; role: Role }>;
      const topo = (topoMod.default ?? topoMod) as unknown as Topology<{
        districts: GeometryCollection<DistrictProps>;
      }>;
      const geoms = topo.objects.districts.geometries as DistrictGeom[];
      const feature = (geometry: Geometry, name: string, role: Role): RegionFeature => ({
        type: "Feature",
        properties: { name, role },
        geometry,
      });

      const countryGeom = merge(topo, geoms) as MultiPolygon;
      const rwanda = feature(countryGeom, "Rwanda", "rwanda");
      const outer = countryGeom.coordinates.reduce((a, b) => (b[0].length > a[0].length ? b : a))[0];
      const labels = fc.features.filter((x) => x.properties.role === "province-label");
      const provinceNames = [...new Set(geoms.map((g) => g.properties.province))];
      const isProvinceEdge = (a: { properties?: unknown }, b: { properties?: unknown }) =>
        a !== b && propsOf(a).province !== propsOf(b).province;

      return {
        rwanda,
        rwandaRing: outer.map(([lng, lat]) => [lat, lng] as LatLng),
        rwandaBounds: boundsOf(countryGeom),
        lake: fc.features.find((x) => x.properties.role === "lake") ?? null,
        provinceBorders: feature(mesh(topo, topo.objects.districts, isProvinceEdge) as MultiLineString, "Province borders", "province-borders"),
        provinces: provinceNames.map((name) => {
          const geom = merge(topo, geoms.filter((g) => g.properties.province === name)) as MultiPolygon;
          const bounds = boundsOf(geom);
          const lp = labels.find((l) => l.properties.name === name)?.geometry as Point | undefined;
          const label: LatLng = lp
            ? [lp.coordinates[1], lp.coordinates[0]]
            : [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
          return { name, feature: feature(geom, name, "province"), bounds, label };
        }),
        districtBorders: feature(
          mesh(topo, topo.objects.districts, (a, b) => a !== b && !isProvinceEdge(a, b)) as MultiLineString,
          "District borders",
          "district-borders",
        ),
        districts: geoms.map((g) => ({
          name: g.properties.name,
          province: g.properties.province,
          feature: feature((topoFeature(topo, g) as Feature<Geometry, DistrictProps>).geometry, g.properties.name, "district"),
          label: [g.properties.label[1], g.properties.label[0]] as LatLng,
        })),
      };
    },
  );
  return cache;
}

export function useMapRegion(): MapRegion | null {
  const [region, setRegion] = useState<MapRegion | null>(null);
  useEffect(() => {
    let alive = true;
    void loadMapRegion().then((r) => alive && setRegion(r));
    return () => {
      alive = false;
    };
  }, []);
  return region;
}

/** Fallback while the JSON loads (and for tests): Rwanda's bounding box. */
export const RWANDA_BBOX: [LatLng, LatLng] = [
  [-2.84, 28.86],
  [-1.05, 30.9],
];
