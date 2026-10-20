/**
 * The ONE 3D measurement implementation (WS6.3). Every 3D viewer uses these
 * functions; nothing else may compute a 3D length or area.
 *
 * Frame: the school model frame — X East, Y Up, Z = −North, metres. "Plan"
 * quantities are the horizontal projection (X/Z), which is what a 2D map
 * measures; "surface" quantities follow the clicked points in 3D.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);

export function distance3d(a: Vec3, b: Vec3): number {
  return len(sub(b, a));
}

/** Horizontal (plan) distance between two points. */
export function planDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Total length along an open polyline (3D, slope distance). */
export function polylineLength(pts: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distance3d(pts[i - 1], pts[i]);
  return total;
}

/** Horizontal length along an open polyline. */
export function polylinePlanLength(pts: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += planDistance(pts[i - 1], pts[i]);
  return total;
}

/** Closed-ring length (3D). */
export function perimeter(pts: Vec3[]): number {
  if (pts.length < 2) return 0;
  if (pts.length === 2) return 2 * distance3d(pts[0], pts[1]);
  return polylineLength(pts) + distance3d(pts[pts.length - 1], pts[0]);
}

/** Plan (horizontally projected) area — shoelace on X/Z. Comparable to 2D. */
export function planArea(pts: Vec3[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
}

/** Newell's vector area: half the sum of edge cross products. */
function newellVector(pts: Vec3[]): Vec3 {
  const n = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return { x: n.x / 2, y: n.y / 2, z: n.z / 2 };
}

/**
 * Surface area: the polygon's area on its best-fit plane (Newell normal).
 * Exact for planar polygons (a sloped roof face); for non-planar point sets it
 * is the area projected onto the best-fit plane.
 */
export function surfaceArea(pts: Vec3[]): number {
  if (pts.length < 3) return 0;
  return len(newellVector(pts));
}

/** Vertical difference between the first and last point (always ≥ 0). */
export function heightDelta(pts: Vec3[]): number {
  if (pts.length < 2) return 0;
  return Math.abs(pts[pts.length - 1].y - pts[0].y);
}

export type PolygonIssue = "too-few-points" | "collinear" | "self-intersecting";

export interface PolygonValidity {
  valid: boolean;
  issue: PolygonIssue | null;
  message: string | null;
}

function segmentsIntersect(
  p1: [number, number], p2: [number, number],
  p3: [number, number], p4: [number, number],
): boolean {
  const o = (a: [number, number], b: [number, number], c: [number, number]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = o(p3, p4, p1), d2 = o(p3, p4, p2), d3 = o(p1, p2, p3), d4 = o(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Polygon checks: ≥3 points, not all collinear, and no self-intersection
 * (tested in the polygon's own best-fit plane, so vertical walls work too).
 */
export function validatePolygon(pts: Vec3[]): PolygonValidity {
  if (pts.length < 3) {
    return { valid: false, issue: "too-few-points", message: "An area needs at least 3 points." };
  }
  // Largest triangle spanned from the first point: ~0 → all points on a line.
  // (Newell's net area can't be used here: a symmetric bow-tie nets to 0.)
  // Its normal is also the plane used for the self-intersection test.
  let n: Vec3 = { x: 0, y: 0, z: 0 };
  let best = 0;
  const p0 = pts[0];
  for (let i = 1; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = sub(pts[i], p0), b = sub(pts[j], p0);
      const c = { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
      const l = len(c);
      if (l > best) { best = l; n = c; }
    }
  }
  const per = perimeter(pts);
  if (best <= 1e-9 * Math.max(per * per, 1e-12)) {
    return { valid: false, issue: "collinear", message: "The points lie on a straight line — there is no area." };
  }
  // Drop the dominant normal axis to get a 2D projection that preserves topology.
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  const proj = (p: Vec3): [number, number] =>
    ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.y, p.z] : [p.x, p.y];
  const flat = pts.map(proj);
  const m = flat.length;
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      if (j === i + 1 || (i === 0 && j === m - 1)) continue; // adjacent edges
      if (segmentsIntersect(flat[i], flat[(i + 1) % m], flat[j], flat[(j + 1) % m])) {
        return {
          valid: false,
          issue: "self-intersecting",
          message: "The outline crosses itself — the area is unreliable. Redraw it without crossing lines.",
        };
      }
    }
  }
  return { valid: true, issue: null, message: null };
}

export interface PolygonMeasure {
  planArea: number;
  surfaceArea: number;
  perimeter: number;
  validity: PolygonValidity;
}

/** All polygon quantities at once, scaled by the model scale factor. */
export function measurePolygon(pts: Vec3[], scale = 1): PolygonMeasure {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    planArea: planArea(pts) * s * s,
    surfaceArea: surfaceArea(pts) * s * s,
    perimeter: perimeter(pts) * s,
    validity: validatePolygon(pts),
  };
}

export type Measure3dKind = "distance" | "area" | "perimeter" | "height";

/**
 * Primary value of a 3D measurement in metres (or m² for area). Area is the
 * PLAN area by default so it compares with 2D; pass `areaMode: "surface"` for
 * the sloped-surface value. `scale` is the model scale factor (WS6.4).
 */
export function measureValue(
  kind: Measure3dKind,
  pts: Vec3[],
  { scale = 1, areaMode = "plan" }: { scale?: number; areaMode?: "plan" | "surface" } = {},
): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  switch (kind) {
    case "distance":
      return polylineLength(pts) * s;
    case "perimeter":
      return perimeter(pts) * s;
    case "height":
      return heightDelta(pts) * s;
    case "area":
      return (areaMode === "surface" ? surfaceArea(pts) : planArea(pts)) * s * s;
  }
}
