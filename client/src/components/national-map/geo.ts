/**
 * Pure geometry + view helpers for the National map (no Leaflet, no React),
 * so they can be unit-tested and reused.
 */

export type LatLng = [number, number];

const R_EARTH = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a path in metres. */
export function pathLength(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

/** Running length at each vertex (first is 0). */
export function cumulativeLengths(points: LatLng[]): number[] {
  const out: number[] = [];
  let run = 0;
  points.forEach((p, i) => {
    if (i > 0) run += distanceMeters(points[i - 1], p);
    out.push(run);
  });
  return out;
}

/** Geodesic polygon area in m² (spherical excess; same maths as Leaflet.draw). */
export function polygonArea(points: LatLng[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += rad(p2[1] - p1[1]) * (2 + Math.sin(rad(p1[0])) + Math.sin(rad(p2[0])));
  }
  return Math.abs((area * R_EARTH * R_EARTH) / 2);
}

/** "-1.94030, 29.87390" — fixed 5 decimals (~1 m), locale-independent. */
export function formatCoord(lat: number, lng: number): string {
  const f = (n: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
      useGrouping: false,
    }).format(n);
  return `${f(lat)}, ${f(lng)}`;
}

/** "City of Kigali" / "Kigali City" / "kigali" → "kigali". */
export const normProvince = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/province|city of|city/g, "")
    .trim();

/* ───────────────────────────── map view in the URL ───────────────────────────── */

export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

/** "-1.94030,29.87390,8.50" → view (null when malformed or off-planet). */
/** Camera on first open and on "reset view": Kigali-centred, most of Rwanda in frame. */
export const HOME_VIEW: MapView = { lat: -1.98465, lng: 30.05072, zoom: 9.5 };

export function parseView(raw: string | null | undefined): MapView | null {
  if (!raw) return null;
  const [lat, lng, zoom] = raw.split(",").map(Number);
  if (![lat, lng, zoom].every(Number.isFinite)) return null;
  if (Math.abs(lat) > 85 || Math.abs(lng) > 180 || zoom < 1 || zoom > 22) return null;
  return { lat, lng, zoom };
}

export function serializeView(v: MapView): string {
  const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
  return `${r(v.lat, 5)},${r(v.lng, 5)},${r(v.zoom, 2)}`;
}

/* ───────────────────────────── score range ───────────────────────────── */

export type ScoreRange = [number, number];
export const FULL_RANGE: ScoreRange = [0, 100];

/** "35-75" → [35, 75]; anything else → the full range. */
export function parseRange(raw: string | null | undefined): ScoreRange {
  const m = /^(\d{1,3})-(\d{1,3})$/.exec(raw ?? "");
  if (!m) return FULL_RANGE;
  const a = Math.max(0, Math.min(100, Number(m[1])));
  const b = Math.max(0, Math.min(100, Number(m[2])));
  return a <= b ? [a, b] : [b, a];
}

export const isFullRange = (r: ScoreRange) => r[0] <= 0 && r[1] >= 100;

/* ───────────────────────────── clustering ───────────────────────────── */

export interface ClusterInput<T> {
  item: T;
  /** Projected pixel position at the current zoom. */
  x: number;
  y: number;
}

export interface Cluster<T> {
  items: T[];
  x: number;
  y: number;
}

/**
 * Grid clustering in screen space: points sharing a `cell`-pixel square are
 * merged, then the cluster sits at the members' mean position. Deterministic
 * and O(n) — plenty for a few thousand schools.
 */
export function gridCluster<T>(points: ClusterInput<T>[], cell = 56): Cluster<T>[] {
  const buckets = new Map<string, { items: T[]; sx: number; sy: number }>();
  for (const p of points) {
    const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
    const b = buckets.get(key);
    if (b) {
      b.items.push(p.item);
      b.sx += p.x;
      b.sy += p.y;
    } else {
      buckets.set(key, { items: [p.item], sx: p.x, sy: p.y });
    }
  }
  return [...buckets.values()].map((b) => ({
    items: b.items,
    x: b.sx / b.items.length,
    y: b.sy / b.items.length,
  }));
}

/** The `k` points nearest to `origin`, with their distance in metres. */
export function nearest<T extends { lat: number; lng: number }>(
  origin: LatLng,
  points: T[],
  k = 5,
  exclude?: (p: T) => boolean,
): { point: T; meters: number }[] {
  return points
    .filter((p) => !exclude?.(p))
    .map((point) => ({ point, meters: distanceMeters(origin, [point.lat, point.lng]) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, k);
}
