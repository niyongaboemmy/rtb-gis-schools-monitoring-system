import GeoJSON from "ol/format/GeoJSON";
import type Feature from "ol/Feature";
import { boundingExtent, containsCoordinate, createEmpty, extend, getHeight, getWidth, isEmpty, type Extent } from "ol/extent";
import { fromLonLat } from "ol/proj";

/** Wider than this (metres) is a neighbourhood, not a school compound. */
export const MAX_COMPOUND_M = 1500;
/** Zoom for a school known only by its point (a compound fills the screen). */
export const POINT_ZOOM = 19;
/** A frame is never tighter than this (metres), e.g. a single building. */
export const MIN_FRAME_M = 160;

export type Frame = { extent: Extent; source: string } | { center: number[]; zoom: number; source: string };

interface FrameInput {
  /** School boundaries from the API (`geojson`, WGS84). Campus first. */
  boundaries?: Array<{ geojson?: unknown; boundaryType?: string }> | null;
  /** Features drawn from the site map (KML), in EPSG:3857. */
  kmlFeatures?: Feature[];
  /** Mapped buildings, WGS84. */
  buildings?: Array<{ lat: number; lng: number }>;
  /** The school's recorded point, [lng, lat]. */
  point?: [number, number] | null;
  /** Extent of the drone / ground-overlay imagery, EPSG:3857. */
  imagery?: Extent | null;
}

const fits = (e: Extent | null | undefined): e is Extent =>
  !!e && !isEmpty(e) && Number.isFinite(e[0]) && getWidth(e) <= MAX_COMPOUND_M && getHeight(e) <= MAX_COMPOUND_M;

/** Grow a tiny extent around its centre so one building is not filled edge to edge. */
function atLeast(e: Extent, min = MIN_FRAME_M): Extent {
  const w = Math.max(getWidth(e), min) / 2;
  const h = Math.max(getHeight(e), min) / 2;
  const cx = (e[0] + e[2]) / 2;
  const cy = (e[1] + e[3]) / 2;
  return [cx - w, cy - h, cx + w, cy + h];
}

const valid = (lng: number, lat: number) => Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function boundaryExtent(boundaries: FrameInput["boundaries"]): Extent | null {
  if (!boundaries?.length) return null;
  const fmt = new GeoJSON();
  const opts = { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" };
  // The campus outline wins; other boundaries only when there is none.
  const ordered = [...boundaries].sort((a, b) => Number(b.boundaryType === "campus") - Number(a.boundaryType === "campus"));
  for (const b of ordered) {
    const g = b.geojson as { type?: string } | null | undefined;
    if (!g?.type) continue;
    try {
      const ext = createEmpty();
      if (g.type === "Feature" || g.type === "FeatureCollection") {
        fmt.readFeatures(g, opts).forEach((f) => {
          const geom = f.getGeometry();
          if (geom) extend(ext, geom.getExtent());
        });
      } else {
        extend(ext, fmt.readGeometry(g, opts).getExtent());
      }
      if (fits(ext)) return ext;
    } catch {
      /* unreadable boundary: try the next source */
    }
  }
  return null;
}

function featuresExtent(features: Feature[] | undefined, polygonsOnly: boolean): Extent | null {
  if (!features?.length) return null;
  const ext = createEmpty();
  for (const f of features) {
    const geom = f.getGeometry();
    if (!geom) continue;
    if (polygonsOnly && !/Polygon/.test(geom.getType())) continue;
    extend(ext, geom.getExtent());
  }
  return isEmpty(ext) || !Number.isFinite(ext[0]) ? null : ext;
}

/**
 * Where the map should open for a school: its compound, as tight as the data
 * allows. Anything wider than a compound (e.g. drone imagery of the whole
 * area) is skipped in favour of the school's own point.
 */
export function pickFrame({ boundaries, kmlFeatures, buildings, point, imagery }: FrameInput): Frame | null {
  const b = boundaryExtent(boundaries);
  if (b) return { extent: atLeast(b), source: "boundary" };

  const polygons = featuresExtent(kmlFeatures, true);
  if (fits(polygons)) return { extent: atLeast(polygons), source: "site-map outline" };

  const pts = (buildings ?? []).filter((p) => valid(p.lng, p.lat)).map((p) => fromLonLat([p.lng, p.lat]));
  const schoolPt = point && valid(point[0], point[1]) ? fromLonLat(point) : null;
  if (pts.length) {
    const ext = boundingExtent(schoolPt ? [...pts, schoolPt] : pts);
    // Buildings far from the school point (bad data) are not a compound.
    if (fits(ext)) return { extent: atLeast(ext), source: "buildings" };
  }

  const anyKml = featuresExtent(kmlFeatures, false);
  if (fits(anyKml) && (!schoolPt || containsCoordinate(atLeast(anyKml, 600), schoolPt))) return { extent: atLeast(anyKml), source: "site map" };

  // Drone imagery usually covers the whole area around the school: the
  // school's own point frames the compound better.
  if (schoolPt) return { center: schoolPt, zoom: POINT_ZOOM, source: "point" };
  if (pts.length) return { center: pts[0], zoom: POINT_ZOOM, source: "building" };
  if (imagery && !isEmpty(imagery)) return { extent: imagery, source: "imagery" };
  return null;
}

/**
 * Space kept clear around the framed compound: the header, the tool rail
 * (measured, since its width changes), the bottom controls — and on phones
 * the bottom tool bar.
 */
export function framePadding(viewportWidth: number, rail: DOMRect | null | undefined): number[] {
  if (viewportWidth < 768) return [76, 20, 196, 20];
  const right = rail ? Math.max(24, viewportWidth - rail.left + 24) : 96;
  return [88, right, 96, 40];
}
