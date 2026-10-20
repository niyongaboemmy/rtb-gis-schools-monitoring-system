/**
 * Site features (WS5.2): measurements, notes and pins shared by the 2D map and
 * the 3D model viewer. Types, API calls and the conversions each viewer needs.
 */
import { api } from "../api";
import { lngLatAltToModel, modelToLngLatAlt, type GeoOrigin, type ModelPoint } from "../geo-bridge";
import { formatMeasureArea, formatMeasureLength, type DisplayUnit } from "../viewer-tools";
import type { MeasureSource } from "../format";

export type SiteFeatureKind =
  | "measure_distance"
  | "measure_area"
  | "measure_perimeter"
  | "measure_height"
  | "note"
  | "pin";

export interface SiteFeatureGeometry {
  type: "Point" | "LineString" | "Polygon";
  coordinates: number[] | number[][] | number[][][];
}

export interface SiteFeature {
  id: string;
  schoolId: string;
  kind: SiteFeatureKind;
  geometry: SiteFeatureGeometry;
  modelCoords: ModelPoint[] | null;
  value: number | null;
  unit: string | null;
  label: string | null;
  description: string | null;
  color: string | null;
  properties: Record<string, unknown> | null;
  source: MeasureSource;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewSiteFeature = Pick<SiteFeature, "kind" | "geometry" | "source"> &
  Partial<Pick<SiteFeature, "modelCoords" | "value" | "unit" | "label" | "description" | "color" | "properties">>;

export const KIND_LABELS: Record<SiteFeatureKind, string> = {
  measure_distance: "Distance",
  measure_area: "Area",
  measure_perimeter: "Perimeter",
  measure_height: "Height",
  note: "Note",
  pin: "Pin",
};

export const isMeasureKind = (k: SiteFeatureKind) => k.startsWith("measure_");

// ── API ────────────────────────────────────────────────────────────────────

const base = (schoolId: string) => `/schools/${schoolId}/site-features`;

export async function fetchSiteFeatures(schoolId: string): Promise<SiteFeature[]> {
  const { data } = await api.get<SiteFeature[]>(base(schoolId));
  return Array.isArray(data) ? data : [];
}

export async function createSiteFeature(schoolId: string, body: NewSiteFeature): Promise<SiteFeature> {
  const { data } = await api.post<SiteFeature>(base(schoolId), body);
  return data;
}

export async function updateSiteFeature(
  schoolId: string,
  id: string,
  body: Partial<Omit<NewSiteFeature, "kind" | "source">>,
): Promise<SiteFeature> {
  const { data } = await api.patch<SiteFeature>(`${base(schoolId)}/${id}`, body);
  return data;
}

export async function deleteSiteFeature(schoolId: string, id: string): Promise<void> {
  await api.delete(`${base(schoolId)}/${id}`);
}

/** Downloads the server CSV (authenticated request → blob → file). */
export async function downloadSiteFeaturesCsv(schoolId: string, fileName = "site-features.csv"): Promise<void> {
  const { data } = await api.get(`${base(schoolId)}/export.csv`, { responseType: "blob" });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Geometry helpers ───────────────────────────────────────────────────────

/** Every [lng, lat, alt?] position in a geometry (outer ring for polygons, ring closure dropped). */
export function geometryPositions(g: SiteFeatureGeometry): number[][] {
  if (g.type === "Point") return [g.coordinates as number[]];
  if (g.type === "LineString") return g.coordinates as number[][];
  const ring = ((g.coordinates as number[][][])[0] ?? []).slice();
  if (ring.length > 1) {
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) ring.pop();
  }
  return ring;
}

/** Geometry for a kind from open positions (polygons are closed here). */
export function buildGeometry(kind: SiteFeatureKind, positions: number[][]): SiteFeatureGeometry {
  if (kind === "note" || kind === "pin" || positions.length === 1) {
    return { type: "Point", coordinates: positions[0] };
  }
  if ((kind === "measure_area" || kind === "measure_perimeter") && positions.length >= 3) {
    return { type: "Polygon", coordinates: [[...positions, positions[0]]] };
  }
  return { type: "LineString", coordinates: positions };
}

/** Geometry from the 2D drawing shape ("point" | "line" | "polygon") + flat [lng, lat, …]. */
export function geometryFromShape(shape: string, flat: number[]): SiteFeatureGeometry | null {
  const pos: number[][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pos.push([flat[i], flat[i + 1]]);
  if (!pos.length) return null;
  if (shape === "point" || shape === "text" || pos.length === 1) return { type: "Point", coordinates: pos[0] };
  if (shape === "polygon" || shape === "poly") {
    const a = pos[0], b = pos[pos.length - 1];
    const ring = a[0] === b[0] && a[1] === b[1] ? pos : [...pos, a];
    return ring.length >= 4 ? { type: "Polygon", coordinates: [ring] } : { type: "LineString", coordinates: pos };
  }
  return { type: "LineString", coordinates: pos };
}

/** Points for the 3D viewer, in the model frame. */
export function featureModelPoints(f: SiteFeature, origin: GeoOrigin | null): ModelPoint[] {
  if (f.source === "3d" && Array.isArray(f.modelCoords) && f.modelCoords.length) return f.modelCoords;
  if (!origin) return [];
  return geometryPositions(f.geometry).map((p) => lngLatAltToModel(p, origin));
}

export function modelPointsToPositions(pts: ModelPoint[], origin: GeoOrigin): number[][] {
  return pts.map((p) => {
    const [lng, lat, alt] = modelToLngLatAlt(p, origin);
    return [Number(lng.toFixed(9)), Number(lat.toFixed(9)), Number(alt.toFixed(3))];
  });
}

/** Mean [lng, lat] of a feature. */
export function featureCentroid(f: SiteFeature): [number, number] | null {
  const pts = geometryPositions(f.geometry);
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Display value of a measurement, at the source's honest precision. */
export function formatFeatureValue(
  f: Pick<SiteFeature, "kind" | "value" | "source">,
  unit: DisplayUnit = "m",
  scale = 1,
): string {
  if (f.value == null || !isMeasureKind(f.kind)) return "";
  if (f.kind === "measure_area") return formatMeasureArea(f.value * scale * scale, f.source, unit);
  return formatMeasureLength(f.value * scale, f.source, unit);
}

/**
 * The shape the 2D map layer (useSpatialDataSync / LayerManager) renders:
 * flat [lng, lat, …] coordinates plus label/style.
 */
export function featureTo2dAnnotation(f: SiteFeature) {
  const flat = geometryPositions(f.geometry).flatMap((p) => [p[0], p[1]]);
  const props = (f.properties ?? {}) as { icon?: string; style?: Record<string, unknown> };
  const icon = props.icon || (f.kind === "pin" ? "pin" : f.kind === "note" ? "pin" : "measure");
  const value = formatFeatureValue(f);
  const label = f.label || (isMeasureKind(f.kind) ? `${KIND_LABELS[f.kind]} ${value}` : "Note");
  return {
    id: f.id,
    featureId: f.id,
    kind: f.kind,
    source: f.source,
    type: f.geometry.type === "Point" ? "point" : f.geometry.type === "Polygon" ? "polygon" : "line",
    coordinates: flat,
    label,
    title: label,
    description: f.description ?? (isMeasureKind(f.kind) && f.label ? value : undefined),
    icon,
    iconType: icon,
    style: { ...(props.style ?? {}), color: f.color ?? (f.source === "3d" ? "#8b5cf6" : "#10b981"), iconType: icon },
    areaSquareMeters: f.kind === "measure_area" ? f.value ?? undefined : undefined,
    lengthMeters: f.kind !== "measure_area" && isMeasureKind(f.kind) ? f.value ?? undefined : undefined,
    createdAt: f.createdAt,
  };
}
