/**
 * Site features ↔ 3D viewer objects (WS5.4 / WS5.5).
 *
 * Saved features come from the API in WGS84 (+ model-frame points for 3D
 * ones). Here they become the viewer's MeasureLine / Annotation objects in
 * SCENE coordinates; 2D-drawn features are draped onto the model surface.
 */
import type { GeoOrigin, ModelPoint } from "../../lib/geo-bridge";
import {
  measurePolygon,
  measureValue,
  type Measure3dKind,
  type Vec3,
} from "../../lib/measure/geometry3d";
import {
  buildGeometry,
  featureModelPoints,
  isMeasureKind,
  modelPointsToPositions,
  type NewSiteFeature,
  type SiteFeature,
} from "../../lib/measure/site-features";

export type MeasureKind3D = Measure3dKind;

export interface MeasurePoint {
  x: number;
  y: number;
  z: number;
}

export interface MeasureLine {
  /** Feature id when saved, else a local id. */
  id: string;
  points: MeasurePoint[];
  mode: MeasureKind3D;
  /** Metres or m² (PLAN area for areas), scale-corrected. */
  result: number;
  /** Sloped surface area, for areas. */
  surface?: number | null;
  warning?: string | null;
  name: string | null;
  color: string;
  saved: boolean;
  source: "2d" | "3d";
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string | null;
}

export interface Annotation {
  id: string;
  point: MeasurePoint;
  text: string;
  color: string;
  saved: boolean;
  source: "2d" | "3d";
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string | null;
}

export interface SceneFrame {
  /** Model (GLB) frame → scene. */
  toScene: (p: ModelPoint) => MeasurePoint;
  /** Scene → model frame. */
  toModel: (p: MeasurePoint) => ModelPoint;
  /** Surface height (scene y) under a scene x/z, or null if nothing is hit. */
  drapeY?: (x: number, z: number) => number | null;
}

const KIND_TO_MODE: Record<string, MeasureKind3D> = {
  measure_distance: "distance",
  measure_area: "area",
  measure_perimeter: "perimeter",
  measure_height: "height",
};

/** Computes a measurement's values from scene points + model scale. */
export function computeMeasure(mode: MeasureKind3D, pts: Vec3[], scale: number) {
  if (mode === "area") {
    const m = measurePolygon(pts, scale);
    return { result: m.planArea, surface: m.surfaceArea, warning: m.validity.message };
  }
  return { result: measureValue(mode, pts, { scale }), surface: null, warning: null };
}

export function featuresToScene(
  features: SiteFeature[],
  origin: GeoOrigin | null,
  frame: SceneFrame,
  scale: number,
): { measures: MeasureLine[]; annotations: Annotation[] } {
  const measures: MeasureLine[] = [];
  const annotations: Annotation[] = [];
  for (const f of features) {
    const modelPts = featureModelPoints(f, origin);
    if (!modelPts.length) continue;
    // 2D features have no real height — drape each vertex on the model.
    const drape = f.source === "2d" || !f.modelCoords?.length;
    const pts = modelPts.map((p) => {
      const s = frame.toScene(p);
      if (drape && frame.drapeY) {
        const y = frame.drapeY(s.x, s.z);
        if (y != null) s.y = y;
      }
      return s;
    });
    const meta = {
      saved: true,
      source: f.source,
      createdBy: f.createdBy,
      createdByName: f.createdByName,
      createdAt: f.createdAt,
    } as const;
    if (isMeasureKind(f.kind)) {
      const mode = KIND_TO_MODE[f.kind];
      // 3D-drawn: recompute from exact model points (picks up scale changes).
      // 2D-drawn: keep the map's geodesic value — draping must not change it.
      const fresh = computeMeasure(mode, pts, scale);
      const props = (f.properties ?? {}) as Record<string, unknown>;
      measures.push({
        id: f.id,
        points: pts,
        mode,
        result: f.source === "2d" && f.value != null ? f.value : fresh.result,
        surface:
          mode === "area"
            ? f.source === "2d"
              ? null
              : fresh.surface ?? (typeof props.surfaceArea === "number" ? props.surfaceArea : null)
            : null,
        warning: fresh.warning,
        name: f.label,
        color: f.color ?? (f.source === "2d" ? "#10b981" : "#3b82f6"),
        ...meta,
      });
    } else {
      annotations.push({
        id: f.id,
        point: pts[0],
        text: f.label || "Note",
        color: f.color ?? "#00d4aa",
        ...meta,
      });
    }
  }
  return { measures, annotations };
}

const MODE_TO_KIND = {
  distance: "measure_distance",
  area: "measure_area",
  perimeter: "measure_perimeter",
  height: "measure_height",
} as const;

/** Payload to save a 3D measurement. */
export function measureToFeature(
  m: Pick<MeasureLine, "mode" | "points" | "result" | "surface" | "name" | "color">,
  origin: GeoOrigin,
  frame: SceneFrame,
  approximateGeoref: boolean,
): NewSiteFeature {
  const kind = MODE_TO_KIND[m.mode];
  const modelCoords = m.points.map(frame.toModel);
  return {
    kind,
    source: "3d",
    geometry: buildGeometry(kind, modelPointsToPositions(modelCoords, origin)),
    modelCoords,
    value: Number(m.result.toFixed(4)),
    unit: m.mode === "area" ? "m2" : "m",
    label: m.name ?? null,
    color: m.color,
    properties: {
      ...(m.surface != null ? { surfaceArea: Number(m.surface.toFixed(4)) } : {}),
      ...(approximateGeoref ? { approximateGeoref: true } : {}),
    },
  };
}

/** Payload to save a 3D note. */
export function annotationToFeature(
  a: Pick<Annotation, "point" | "text" | "color">,
  origin: GeoOrigin,
  frame: SceneFrame,
  approximateGeoref: boolean,
): NewSiteFeature {
  const modelCoords = [frame.toModel(a.point)];
  return {
    kind: "note",
    source: "3d",
    geometry: buildGeometry("note", modelPointsToPositions(modelCoords, origin)),
    modelCoords,
    label: a.text.slice(0, 200),
    color: /^#[0-9a-f]{3,8}$/i.test(a.color) ? a.color : null,
    properties: approximateGeoref ? { approximateGeoref: true } : {},
  };
}
