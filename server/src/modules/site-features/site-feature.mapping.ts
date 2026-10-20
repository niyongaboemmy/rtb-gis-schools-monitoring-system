/**
 * Pure conversions between the legacy stores and `site_features` (WS5.2).
 * Kept free of Nest/TypeORM so they are unit-tested directly.
 */
import { modelToWgs84, type GeoOrigin } from '../kmz/geo-derive';
import type {
  ModelCoord,
  SiteFeature,
  SiteFeatureGeometry,
  SiteFeatureKind,
} from './entities/site-feature.entity';

export type FeatureDraft = Pick<
  SiteFeature,
  | 'kind'
  | 'geometry'
  | 'modelCoords'
  | 'value'
  | 'unit'
  | 'label'
  | 'description'
  | 'color'
  | 'properties'
  | 'source'
  | 'legacyId'
>;

const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Accepts flat [lng, lat, lng, lat…] or nested [[lng, lat], …] arrays. */
export function toPositions(coords: unknown): number[][] {
  if (!Array.isArray(coords)) return [];
  if (coords.every(finite)) {
    const out: number[][] = [];
    for (let i = 0; i + 1 < coords.length; i += 2)
      out.push([coords[i], coords[i + 1]]);
    return out;
  }
  const out: number[][] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && c.length >= 2 && finite(c[0]) && finite(c[1])) {
      out.push([c[0], c[1]]);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(coords);
  return out;
}

const inRange = (p: number[]) => Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

function closeRing(ring: number[][]): number[][] {
  if (!ring.length) return ring;
  const [a, b] = [ring[0], ring[ring.length - 1]];
  return a[0] === b[0] && a[1] === b[1] && (a[2] ?? 0) === (b[2] ?? 0)
    ? ring
    : [...ring, a];
}

/** Line / polygon geometry for a set of positions, by feature kind. */
export function geometryFor(
  kind: SiteFeatureKind,
  positions: number[][],
): SiteFeatureGeometry | null {
  const pts = positions.filter(inRange);
  if (!pts.length) return null;
  if (kind === 'note' && pts.length === 1)
    return { type: 'Point', coordinates: pts[0] };
  if (kind === 'pin') return { type: 'Point', coordinates: pts[0] };
  const polygonal = kind === 'measure_area' || kind === 'measure_perimeter';
  if (polygonal && pts.length >= 3)
    return { type: 'Polygon', coordinates: [closeRing(pts)] };
  if (pts.length >= 2) return { type: 'LineString', coordinates: pts };
  return { type: 'Point', coordinates: pts[0] };
}

/** School.siteAnnotations entry (2D) → site feature. */
export function legacyAnnotationToFeature(ann: any): FeatureDraft | null {
  if (!ann || typeof ann !== 'object') return null;
  const positions = toPositions(ann.coordinates);
  const isMeasure =
    String(ann.id ?? '').startsWith('meas-') ||
    finite(ann.areaSquareMeters) ||
    finite(ann.lengthMeters);
  let kind: SiteFeatureKind = 'note';
  let value: number | null = null;
  let unit: string | null = null;
  if (isMeasure && ann.type === 'polygon') {
    kind = 'measure_area';
    value = finite(ann.areaSquareMeters) ? ann.areaSquareMeters : null;
    unit = 'm2';
  } else if (isMeasure && ann.type === 'line') {
    kind = 'measure_distance';
    value = finite(ann.lengthMeters) ? ann.lengthMeters : null;
    unit = 'm';
  }
  const geometry = geometryFor(kind, positions);
  if (!geometry) return null;
  const style = ann.style && typeof ann.style === 'object' ? ann.style : {};
  const icon = ann.icon || ann.iconType || style.iconType || null;
  const color =
    typeof style.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(style.color)
      ? style.color
      : null;
  return {
    kind,
    geometry,
    modelCoords: null,
    value,
    unit,
    label: str(ann.title || ann.label || ann.content, 200),
    description: str(ann.description, 2000),
    color,
    properties: {
      ...(icon ? { icon } : {}),
      ...(Object.keys(style).length ? { style } : {}),
      ...(ann.createdAt ? { legacyCreatedAt: String(ann.createdAt) } : {}),
    },
    source: '2d',
    legacyId: ann.id ? String(ann.id).slice(0, 100) : null,
  };
}

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : null;

function validPoint(p: any): p is ModelCoord {
  return p && finite(p.x) && finite(p.y) && finite(p.z);
}

/** Plan (X/Z shoelace) area — same maths as client lib/measure planArea. */
export function modelPlanArea(pts: ModelCoord[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
}

/** 3D viewer-state measure / annotation (model coords) → site feature. */
export function legacy3dToFeature(
  item: any,
  type: 'measure' | 'annotation',
  origin: GeoOrigin,
  approximate: boolean,
): FeatureDraft | null {
  if (!item || typeof item !== 'object') return null;
  const color =
    typeof item.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(item.color)
      ? item.color
      : null;
  const toLla = (p: ModelCoord) => {
    const g = modelToWgs84(p, origin);
    return [g.lng, g.lat, Number(g.alt.toFixed(3))];
  };
  if (type === 'annotation') {
    if (!validPoint(item.point)) return null;
    const p = { x: item.point.x, y: item.point.y, z: item.point.z };
    return {
      kind: 'note',
      geometry: { type: 'Point', coordinates: toLla(p) },
      modelCoords: [p],
      value: null,
      unit: null,
      label: str(item.text, 200),
      description: null,
      color,
      properties: approximate ? { approximateGeoref: true } : {},
      source: '3d',
      legacyId: item.id ? String(item.id).slice(0, 100) : null,
    };
  }
  const pts: ModelCoord[] = (Array.isArray(item.points) ? item.points : [])
    .filter(validPoint)
    .map((p: ModelCoord) => ({ x: p.x, y: p.y, z: p.z }));
  if (pts.length < 2) return null;
  const mode = ['distance', 'area', 'perimeter', 'height'].includes(item.mode)
    ? item.mode
    : 'distance';
  const kind = `measure_${mode}` as SiteFeatureKind;
  const geometry = geometryFor(kind, pts.map(toLla));
  if (!geometry) return null;
  const value =
    mode === 'area'
      ? modelPlanArea(pts)
      : finite(item.result)
        ? item.result
        : null;
  return {
    kind,
    geometry,
    modelCoords: pts,
    value,
    unit: mode === 'area' ? 'm2' : 'm',
    label: null,
    description: null,
    color,
    properties: {
      ...(mode === 'area' && finite(item.result)
        ? { surfaceArea: item.result }
        : {}),
      ...(approximate ? { approximateGeoref: true } : {}),
    },
    source: '3d',
    legacyId: item.id ? String(item.id).slice(0, 100) : null,
  };
}

/** site feature → the shape the legacy 2D endpoint returned. */
export function featureToLegacyAnnotation(f: SiteFeature) {
  const g = f.geometry;
  const flat: number[] =
    g.type === 'Point'
      ? (g.coordinates as number[]).slice(0, 2)
      : (g.type === 'Polygon'
          ? (g.coordinates as number[][][])[0]
          : (g.coordinates as number[][])
        ).flatMap((p) => [p[0], p[1]]);
  const props = (f.properties ?? {}) as Record<string, any>;
  return {
    id: f.id,
    type:
      g.type === 'Point' ? 'point' : g.type === 'Polygon' ? 'polygon' : 'line',
    label: f.label ?? undefined,
    title: f.label ?? undefined,
    description: f.description ?? undefined,
    coordinates: flat,
    icon: props.icon,
    style: { ...(props.style ?? {}), ...(f.color ? { color: f.color } : {}) },
    ...(f.kind === 'measure_area' && f.value != null
      ? { areaSquareMeters: f.value }
      : {}),
    ...(f.kind !== 'measure_area' && f.unit === 'm' && f.value != null
      ? { lengthMeters: f.value }
      : {}),
    createdAt: (f.createdAt ?? new Date()).toISOString(),
  };
}

/** Mean vertex of a geometry (for CSV / fly-to). */
export function geometryCentroid(
  g: SiteFeatureGeometry,
): [number, number] | null {
  const pts = toPositions(g.coordinates);
  if (!pts.length) return null;
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

/** One CSV cell: quoted, and defused against spreadsheet formula injection. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s =
    v instanceof Date
      ? v.toISOString()
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v as string | number | boolean);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim()
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export const CSV_COLUMNS = [
  'id',
  'kind',
  'label',
  'value',
  'unit',
  'source',
  'created_by',
  'created_at',
  'updated_at',
  'centroid_lat',
  'centroid_lng',
  'description',
  'geometry_geojson',
] as const;

export function featuresToCsv(features: SiteFeature[]): string {
  const rows = features.map((f) => {
    const c = geometryCentroid(f.geometry);
    return [
      f.id,
      f.kind,
      f.label,
      f.value == null ? '' : Number(f.value.toFixed(f.source === '3d' ? 2 : 1)),
      f.unit === 'm2' ? 'm²' : f.unit,
      f.source,
      f.createdByName,
      f.createdAt,
      f.updatedAt,
      c ? c[1].toFixed(7) : '',
      c ? c[0].toFixed(7) : '',
      f.description,
      JSON.stringify(f.geometry),
    ]
      .map(csvCell)
      .join(',');
  });
  // BOM so Excel opens UTF-8 (m², names) correctly.
  return '﻿' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
