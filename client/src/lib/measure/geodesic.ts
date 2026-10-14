/**
 * 2D map measurement maths (WS6.1).
 *
 * The map draws in EPSG:3857. Two implementations live here:
 *
 *  - `spherical*` — thin wrappers over `ol/sphere` getLength / getArea (what
 *    the viewer used before). They assume a sphere of radius 6,371,008.8 m,
 *    which near Kigali over-reads north–south lengths by ~0.56 %.
 *  - `ellipsoidal*` / `local*` — WGS84-ellipsoid lengths (Vincenty) and areas
 *    in a local tangent plane via the geo-bridge. These are what the viewer
 *    uses now; they also agree with the 3D plan maths by construction.
 */
import { getArea, getLength } from "ol/sphere";
import { LineString, Polygon } from "ol/geom";
import type Geometry from "ol/geom/Geometry";
import { fromLonLat, toLonLat } from "ol/proj";
import { wgs84ToEnu, type GeoOrigin } from "../geo-bridge";

export type LonLat = [number, number] | number[];

// ── ol/sphere wrappers (EPSG:3857 geometries, as the map hook builds them) ──

export function sphericalLength(coords: LonLat[]): number {
  return getLength(new LineString(coords.map((c) => fromLonLat([c[0], c[1]]))));
}

export function sphericalArea(ring: LonLat[]): number {
  return getArea(new Polygon([ring.map((c) => fromLonLat([c[0], c[1]]))]));
}

// ── WGS84 ellipsoid ─────────────────────────────────────────────────────────

const A = 6378137.0;
const F = 1 / 298.257223563;
const B = A * (1 - F);
const D2R = Math.PI / 180;

/** Vincenty inverse distance on WGS84, metres. */
export function vincentyDistance(a: LonLat, b: LonLat): number {
  const L = (b[0] - a[0]) * D2R;
  const U1 = Math.atan((1 - F) * Math.tan(a[1] * D2R));
  const U2 = Math.atan((1 - F) * Math.tan(b[1] * D2R));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1), sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
  let lambda = L;
  let iter = 0;
  let sinSigma = 0, cosSigma = 0, sigma = 0, cos2Alpha = 0, cos2SigmaM = 0;
  for (;;) {
    const sinL = Math.sin(lambda), cosL = Math.cos(lambda);
    sinSigma = Math.hypot(cosU2 * sinL, cosU1 * sinU2 - sinU1 * cosU2 * cosL);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinL) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cos2Alpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cos2Alpha : 0;
    const C = (F / 16) * cos2Alpha * (4 + F * (4 - 3 * cos2Alpha));
    const prev = lambda;
    lambda = L + (1 - C) * F * sinAlpha *
      (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - prev) < 1e-12) break;
    if (++iter > 200) {
      // Near-antipodal: never happens at site scale; fall back to the sphere.
      return sphericalLength([a, b]);
    }
  }
  const u2 = (cos2Alpha * (A * A - B * B)) / (B * B);
  const AA = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const BB = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dSigma = BB * sinSigma * (cos2SigmaM + (BB / 4) *
    (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
      (BB / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  return B * AA * (sigma - dSigma);
}

/** Polyline length on the WGS84 ellipsoid, metres. */
export function ellipsoidalLength(coords: LonLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += vincentyDistance(coords[i - 1], coords[i]);
  return total;
}

/** Centroid (mean vertex) of a lon/lat ring as a tangent-plane origin. */
export function ringOrigin(ring: LonLat[]): GeoOrigin {
  const n = ring.length || 1;
  return {
    lng: ring.reduce((s, c) => s + c[0], 0) / n,
    lat: ring.reduce((s, c) => s + c[1], 0) / n,
    alt: 0,
  };
}

/**
 * Polygon area projected on the local tangent plane of the WGS84 ellipsoid,
 * m². Exact to well under 0.01 % for site-scale polygons (< ~10 km).
 */
export function localArea(ring: LonLat[], origin: GeoOrigin = ringOrigin(ring)): number {
  if (ring.length < 3) return 0;
  const pts = ring.map((c) => wgs84ToEnu({ lng: c[0], lat: c[1], alt: 0 }, origin));
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.e * b.n - b.e * a.n;
  }
  return Math.abs(s) / 2;
}

/** Closed-ring perimeter on the ellipsoid. */
export function ellipsoidalPerimeter(ring: LonLat[]): number {
  if (ring.length < 2) return 0;
  const closed = sameLonLat(ring[0], ring[ring.length - 1]) ? ring : [...ring, ring[0]];
  return ellipsoidalLength(closed);
}

function sameLonLat(a: LonLat, b: LonLat) {
  return a[0] === b[0] && a[1] === b[1];
}

// ── Helpers for EPSG:3857 OpenLayers geometries (used by useMapInteractions) ─

export function lengthOf3857(geom: LineString): number {
  return ellipsoidalLength(geom.getCoordinates().map((c) => toLonLat(c)));
}

export function areaOf3857(geom: Polygon): number {
  const ring = geom.getCoordinates()[0] ?? [];
  const ll = ring.map((c) => toLonLat(c));
  // OL rings repeat the first vertex at the end — drop it for the shoelace.
  if (ll.length > 1 && sameLonLat(ll[0], ll[ll.length - 1])) ll.pop();
  return localArea(ll);
}

export function perimeterOf3857(geom: Polygon): number {
  return ellipsoidalPerimeter((geom.getCoordinates()[0] ?? []).map((c) => toLonLat(c)));
}

/** Length for a line, area for a polygon, 0 otherwise. */
export function measureGeometry3857(geom: Geometry): { length: number; area: number } {
  if (geom instanceof LineString) return { length: lengthOf3857(geom), area: 0 };
  if (geom instanceof Polygon) return { length: perimeterOf3857(geom), area: areaOf3857(geom) };
  return { length: 0, area: 0 };
}
