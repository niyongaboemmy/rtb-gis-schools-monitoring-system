/**
 * Coordinate bridge between the 3D model frame and WGS84 (WS5.3).
 *
 * The server's GLB optimizer bakes every school model into a local metric
 * frame centred on a georeference origin (see
 * `server/glb-tools/optimize.mjs` → `reprojectIfGeographic`):
 *
 *   model +X = East, model +Y = Up, model −Z = North   (metres)
 *
 * This module converts between that frame and WGS84 latitude / longitude /
 * ellipsoidal height through a proper local tangent plane (WGS84 ellipsoid,
 * geodetic → ECEF → ENU), not a flat "metres per degree" scale.
 *
 * The server keeps a twin of these functions in
 * `server/src/modules/kmz/geo-derive.ts`; keep the two in step.
 */

export interface GeoOrigin {
  /** Latitude in degrees. */
  lat: number;
  /** Longitude in degrees. */
  lng: number;
  /** Ellipsoidal height of the model's Y = 0 plane, metres (0 when unknown). */
  alt: number;
}

export interface Enu {
  e: number;
  n: number;
  u: number;
}

export interface ModelPoint {
  x: number;
  y: number;
  z: number;
}

export interface LatLngAlt {
  lat: number;
  lng: number;
  alt: number;
}

// WGS84 ellipsoid
const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const B = A * (1 - F);
const EP2 = (A * A - B * B) / (B * B);

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function geodeticToEcef(lat: number, lng: number, alt = 0): [number, number, number] {
  const phi = lat * D2R;
  const lam = lng * D2R;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const N = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  return [
    (N + alt) * cosPhi * Math.cos(lam),
    (N + alt) * cosPhi * Math.sin(lam),
    (N * (1 - E2) + alt) * sinPhi,
  ];
}

/** ECEF → geodetic (Bowring's start + Newton refinement; sub-mm everywhere). */
export function ecefToGeodetic(x: number, y: number, z: number): LatLngAlt {
  const p = Math.hypot(x, y);
  const lng = Math.atan2(y, x);
  // Bowring's initial parametric latitude
  const theta = Math.atan2(z * A, p * B);
  let phi = Math.atan2(
    z + EP2 * B * Math.sin(theta) ** 3,
    p - E2 * A * Math.cos(theta) ** 3,
  );
  let h = 0;
  for (let i = 0; i < 5; i++) {
    const sinPhi = Math.sin(phi);
    const N = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
    h = Math.abs(Math.cos(phi)) > 1e-10 ? p / Math.cos(phi) - N : Math.abs(z) - B;
    phi = Math.atan2(z, p * (1 - (E2 * N) / (N + h)));
  }
  return { lat: phi * R2D, lng: lng * R2D, alt: h };
}

function enuBasis(origin: GeoOrigin) {
  const phi = origin.lat * D2R;
  const lam = origin.lng * D2R;
  const sp = Math.sin(phi), cp = Math.cos(phi), sl = Math.sin(lam), cl = Math.cos(lam);
  return {
    east: [-sl, cl, 0] as const,
    north: [-sp * cl, -sp * sl, cp] as const,
    up: [cp * cl, cp * sl, sp] as const,
    o: geodeticToEcef(origin.lat, origin.lng, origin.alt),
  };
}

export function wgs84ToEnu(p: LatLngAlt, origin: GeoOrigin): Enu {
  const { east, north, up, o } = enuBasis(origin);
  const [x, y, z] = geodeticToEcef(p.lat, p.lng, p.alt);
  const dx = x - o[0], dy = y - o[1], dz = z - o[2];
  return {
    e: east[0] * dx + east[1] * dy + east[2] * dz,
    n: north[0] * dx + north[1] * dy + north[2] * dz,
    u: up[0] * dx + up[1] * dy + up[2] * dz,
  };
}

export function enuToWgs84(v: Enu, origin: GeoOrigin): LatLngAlt {
  const { east, north, up, o } = enuBasis(origin);
  const x = o[0] + east[0] * v.e + north[0] * v.n + up[0] * v.u;
  const y = o[1] + east[1] * v.e + north[1] * v.n + up[1] * v.u;
  const z = o[2] + east[2] * v.e + north[2] * v.n + up[2] * v.u;
  return ecefToGeodetic(x, y, z);
}

/** Model frame (x East, y Up, z = −North) → WGS84. */
export function modelToWgs84(p: ModelPoint, origin: GeoOrigin): LatLngAlt {
  return enuToWgs84({ e: p.x, n: -p.z, u: p.y }, origin);
}

/** WGS84 → model frame (x East, y Up, z = −North). */
export function wgs84ToModel(p: LatLngAlt, origin: GeoOrigin): ModelPoint {
  const v = wgs84ToEnu(p, origin);
  return { x: v.e, y: v.u, z: -v.n };
}

/** GeoJSON position order: [lng, lat, alt]. */
export function modelToLngLatAlt(p: ModelPoint, origin: GeoOrigin): [number, number, number] {
  const g = modelToWgs84(p, origin);
  return [g.lng, g.lat, g.alt];
}

export function lngLatAltToModel(pos: number[], origin: GeoOrigin): ModelPoint {
  return wgs84ToModel({ lng: pos[0], lat: pos[1], alt: pos[2] ?? origin.alt }, origin);
}

export function isValidOrigin(o: Partial<GeoOrigin> | null | undefined): o is GeoOrigin {
  return (
    !!o &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng) &&
    Math.abs(o.lat as number) <= 90 &&
    Math.abs(o.lng as number) <= 180 &&
    !(Math.abs(o.lat as number) < 1e-6 && Math.abs(o.lng as number) < 1e-6)
  );
}
