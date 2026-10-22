/**
 * Helpers to pull a representative school coordinate out of an uploaded
 * KMZ/KML or GLB, so the School's latitude/longitude can be kept in sync with
 * whatever the geospatial file actually says.
 */

export interface DerivedCoordinate {
  lat: number;
  lng: number;
  source: string;
}

/** A finite, in-range lat/lng that isn't null-island (0,0). */
export function isPlausibleLatLng(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const o = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(o)) return false;
  if (Math.abs(a) > 90 || Math.abs(o) > 180) return false;
  if (Math.abs(a) < 1e-6 && Math.abs(o) < 1e-6) return false;
  return true;
}

interface LatLonBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** About 2 km: wider than this is an area, not a school compound. */
const COMPOUND_DEG = 0.02;

const median = (xs: number[]): number => {
  const v = [...xs].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/**
 * Pick the school's point from KML-derived sources, in priority order:
 *   1. the centre of what is drawn on the site map (every vertex of the
 *      placemarks), ignoring stray features far from the rest
 *   2. the centre of compound-sized ground overlays (drone images)
 *   3. an authored LookAt (a Camera is where the viewer stands, not the site)
 *   4. the centre of any ground overlays
 * The caller (SchoolLocationService) still checks the point is in Rwanda.
 */
export function pickKmlCoordinate(sources: {
  initialView?: { latitude?: number; longitude?: number; type?: string } | null;
  groundOverlays?: Array<Partial<LatLonBox>> | null;
  points?: Array<[number, number]> | null; // [lng, lat]
}): DerivedCoordinate | null {
  const { initialView, groundOverlays, points } = sources;

  // 1. Drawn features: bbox centre of the points near the median.
  const pts = (points || []).filter(([lng, lat]) =>
    isPlausibleLatLng(lat, lng),
  );
  if (pts.length) {
    const mLng = median(pts.map((p) => p[0]));
    const mLat = median(pts.map((p) => p[1]));
    const near = pts.filter(
      ([lng, lat]) =>
        Math.abs(lng - mLng) <= COMPOUND_DEG &&
        Math.abs(lat - mLat) <= COMPOUND_DEG,
    );
    const use = near.length ? near : pts;
    const lngs = use.map((p) => p[0]);
    const lats = use.map((p) => p[1]);
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    if (isPlausibleLatLng(lat, lng))
      return { lat, lng, source: 'kml:features' };
  }

  const boxes = (groundOverlays || []).filter(
    (b) =>
      b &&
      isPlausibleLatLng(b.north, b.east) &&
      isPlausibleLatLng(b.south, b.west),
  ) as LatLonBox[];
  const centre = (bs: LatLonBox[]): DerivedCoordinate | null => {
    if (!bs.length) return null;
    const lat = bs.reduce((s, b) => s + (b.north + b.south) / 2, 0) / bs.length;
    const lng = bs.reduce((s, b) => s + (b.east + b.west) / 2, 0) / bs.length;
    return isPlausibleLatLng(lat, lng)
      ? { lat, lng, source: 'kml:overlay-bounds' }
      : null;
  };

  // 2. Compound-sized drone images.
  const compact = centre(
    boxes.filter(
      (b) =>
        Math.abs(b.north - b.south) <= COMPOUND_DEG &&
        Math.abs(b.east - b.west) <= COMPOUND_DEG,
    ),
  );
  if (compact) return compact;

  // 3. Authored LookAt.
  if (
    initialView &&
    initialView.type !== 'Camera' &&
    isPlausibleLatLng(initialView.latitude, initialView.longitude)
  ) {
    return {
      lat: Number(initialView.latitude),
      lng: Number(initialView.longitude),
      source: 'kml:view',
    };
  }

  // 4. Any drone image.
  return centre(boxes);
}

/** WGS84 ECEF (metres) → geodetic lat/lng in degrees. */
export function ecefToLatLng(
  x: number,
  y: number,
  z: number,
): { lat: number; lng: number } | null {
  const a = 6378137.0; // semi-major axis
  const f = 1 / 298.257223563;
  const b = a * (1 - f);
  const e2 = 1 - (b * b) / (a * a);
  const p = Math.hypot(x, y);
  if (p < 1e-6) return null;

  const lng = Math.atan2(y, x);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const sinLat = Math.sin(lat);
    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    const h = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - (e2 * N) / (N + h)));
  }
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/**
 * Best-effort geo-reference from a GLB. A plain GLB has no coordinates, but
 * Cesium/Metashape georeferenced exports carry an ECEF origin via the
 * `CESIUM_RTC` extension or a root-node translation on the Earth's surface.
 * Only reads the JSON chunk — no geometry decode.
 */
export function deriveCoordinateFromGlb(
  buffer: Buffer,
): DerivedCoordinate | null {
  try {
    if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67)
      return null; // "glTF"
    const jsonLen = buffer.readUInt32LE(12);
    if (jsonLen <= 0 || jsonLen + 20 > buffer.length) return null;
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLen));

    const EARTH_MIN = 6_300_000;
    const EARTH_MAX = 6_450_000;
    const fromEcef = (v: any, src: string): DerivedCoordinate | null => {
      if (!Array.isArray(v) || v.length < 3) return null;
      const [x, y, z] = v.map(Number);
      if (![x, y, z].every(Number.isFinite)) return null;
      const r = Math.hypot(x, y, z);
      if (r < EARTH_MIN || r > EARTH_MAX) return null;
      const g = ecefToLatLng(x, y, z);
      if (!g || !isPlausibleLatLng(g.lat, g.lng)) return null;
      return { lat: g.lat, lng: g.lng, source: src };
    };

    const rtc = json.extensions?.CESIUM_RTC?.center;
    const viaRtc = fromEcef(rtc, 'glb:cesium-rtc');
    if (viaRtc) return viaRtc;

    for (const node of json.nodes || []) {
      const viaNode = fromEcef(node.translation, 'glb:node-translation');
      if (viaNode) return viaNode;
    }

    // Agisoft Metashape can export a GLB whose POSITION accessor holds raw
    // WGS84 (longitude°, latitude°, altitude m) instead of local metres. Read
    // the accessor bounds (no geometry decode) and, if they look geographic,
    // take the centroid.
    const viaVertices = deriveFromGlbPositionBounds(json);
    if (viaVertices) return viaVertices;

    return null;
  } catch {
    return null;
  }
}

/**
 * Inspect POSITION accessor min/max in an already-parsed glTF JSON chunk.
 * Returns the WGS84 centroid when the bounds look like degrees (a Metashape
 * "export in project CRS" GLB), else null. Mirrors the detection in
 * `server/glb-tools/optimize.mjs`.
 */
function deriveFromGlbPositionBounds(json: any): DerivedCoordinate | null {
  const accessors: any[] = Array.isArray(json.accessors) ? json.accessors : [];
  const meshes: any[] = Array.isArray(json.meshes) ? json.meshes : [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let seen = false;

  for (const mesh of meshes) {
    for (const prim of mesh?.primitives || []) {
      const idx = prim?.attributes?.POSITION;
      const acc = typeof idx === 'number' ? accessors[idx] : null;
      if (!acc || !Array.isArray(acc.min) || !Array.isArray(acc.max)) continue;
      const [nx, ny] = acc.min.map(Number);
      const [xx, xy] = acc.max.map(Number);
      if (![nx, ny, xx, xy].every(Number.isFinite)) continue;
      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, xx);
      maxY = Math.max(maxY, xy);
      seen = true;
    }
  }
  if (!seen) return null;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const looksGeographic =
    Math.abs(minX) <= 180 &&
    Math.abs(maxX) <= 180 &&
    Math.abs(minY) <= 90 &&
    Math.abs(maxY) <= 90 &&
    spanX > 1e-9 &&
    spanY > 1e-9 &&
    spanX < 1 &&
    spanY < 1 &&
    (Math.abs(minX) > 0.01 || Math.abs(minY) > 0.01);
  if (!looksGeographic) return null;

  const lng = (minX + maxX) / 2;
  const lat = (minY + maxY) / 2;
  if (!isPlausibleLatLng(lat, lng)) return null;
  return { lat, lng, source: 'glb:geo-vertices' };
}

// ─── Model ↔ WGS84 bridge (WS5.3) ──────────────────────────────────────────
// Server twin of client/src/lib/geo-bridge.ts — keep the two in step.
// Model frame (set by glb-tools/optimize.mjs): +X East, +Y Up, −Z North, metres,
// centred on the georeference origin; Y = 0 is the origin's ellipsoidal height.

export interface GeoOrigin {
  lat: number;
  lng: number;
  alt: number;
}

export interface ModelPoint {
  x: number;
  y: number;
  z: number;
}

const WGS_A = 6378137.0;
const WGS_F = 1 / 298.257223563;
const WGS_E2 = WGS_F * (2 - WGS_F);
const WGS_B = WGS_A * (1 - WGS_F);
const WGS_EP2 = (WGS_A * WGS_A - WGS_B * WGS_B) / (WGS_B * WGS_B);
const D2R = Math.PI / 180;

export function geodeticToEcef(
  lat: number,
  lng: number,
  alt = 0,
): [number, number, number] {
  const phi = lat * D2R;
  const lam = lng * D2R;
  const s = Math.sin(phi);
  const N = WGS_A / Math.sqrt(1 - WGS_E2 * s * s);
  return [
    (N + alt) * Math.cos(phi) * Math.cos(lam),
    (N + alt) * Math.cos(phi) * Math.sin(lam),
    (N * (1 - WGS_E2) + alt) * s,
  ];
}

export function ecefToGeodetic(x: number, y: number, z: number): GeoOrigin {
  const p = Math.hypot(x, y);
  const lng = Math.atan2(y, x);
  const theta = Math.atan2(z * WGS_A, p * WGS_B);
  let phi = Math.atan2(
    z + WGS_EP2 * WGS_B * Math.sin(theta) ** 3,
    p - WGS_E2 * WGS_A * Math.cos(theta) ** 3,
  );
  let h = 0;
  for (let i = 0; i < 5; i++) {
    const s = Math.sin(phi);
    const N = WGS_A / Math.sqrt(1 - WGS_E2 * s * s);
    h =
      Math.abs(Math.cos(phi)) > 1e-10
        ? p / Math.cos(phi) - N
        : Math.abs(z) - WGS_B;
    phi = Math.atan2(z, p * (1 - (WGS_E2 * N) / (N + h)));
  }
  return { lat: phi / D2R, lng: lng / D2R, alt: h };
}

function enuBasis(o: GeoOrigin) {
  const sp = Math.sin(o.lat * D2R);
  const cp = Math.cos(o.lat * D2R);
  const sl = Math.sin(o.lng * D2R);
  const cl = Math.cos(o.lng * D2R);
  return {
    east: [-sl, cl, 0],
    north: [-sp * cl, -sp * sl, cp],
    up: [cp * cl, cp * sl, sp],
    o: geodeticToEcef(o.lat, o.lng, o.alt),
  };
}

export function wgs84ToEnu(
  p: GeoOrigin,
  origin: GeoOrigin,
): { e: number; n: number; u: number } {
  const { east, north, up, o } = enuBasis(origin);
  const [x, y, z] = geodeticToEcef(p.lat, p.lng, p.alt);
  const d = [x - o[0], y - o[1], z - o[2]];
  const dot = (v: number[]) => v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
  return { e: dot(east), n: dot(north), u: dot(up) };
}

export function enuToWgs84(
  v: { e: number; n: number; u: number },
  origin: GeoOrigin,
): GeoOrigin {
  const { east, north, up, o } = enuBasis(origin);
  const c = (i: number) => o[i] + east[i] * v.e + north[i] * v.n + up[i] * v.u;
  return ecefToGeodetic(c(0), c(1), c(2));
}

export function modelToWgs84(p: ModelPoint, origin: GeoOrigin): GeoOrigin {
  return enuToWgs84({ e: p.x, n: -p.z, u: p.y }, origin);
}

export function wgs84ToModel(p: GeoOrigin, origin: GeoOrigin): ModelPoint {
  const v = wgs84ToEnu(p, origin);
  return { x: v.e, y: v.u, z: -v.n };
}

// ─── GLB extent + model-scale check (WS6.4) ────────────────────────────────

interface PositionBounds {
  min: [number, number, number];
  max: [number, number, number];
  /** True when any node carries a transform that the bounds don't include. */
  transformed: boolean;
}

/** Union of POSITION accessor bounds from a GLB's JSON chunk (no decode). */
export function readGlbPositionBounds(buffer: Buffer): PositionBounds | null {
  try {
    if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67)
      return null;
    const jsonLen = buffer.readUInt32LE(12);
    if (jsonLen <= 0 || jsonLen + 20 > buffer.length) return null;
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLen));
    const accessors: any[] = Array.isArray(json.accessors)
      ? json.accessors
      : [];
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    let seen = false;
    for (const mesh of json.meshes || []) {
      for (const prim of mesh?.primitives || []) {
        const idx = prim?.attributes?.POSITION;
        const acc = typeof idx === 'number' ? accessors[idx] : null;
        if (!acc || !Array.isArray(acc.min) || !Array.isArray(acc.max))
          continue;
        // Quantized positions carry their scale on the node — unusable here.
        if (acc.normalized || (acc.componentType && acc.componentType !== 5126))
          return null;
        const mn = acc.min.map(Number);
        const mx = acc.max.map(Number);
        if (![...mn, ...mx].slice(0, 6).every(Number.isFinite)) continue;
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], mn[i]);
          max[i] = Math.max(max[i], mx[i]);
        }
        seen = true;
      }
    }
    if (!seen) return null;
    const transformed = (json.nodes || []).some(
      (n: any) =>
        Array.isArray(n?.matrix) ||
        (Array.isArray(n?.scale) &&
          n.scale.some((s: number) => Math.abs(s - 1) > 1e-9)) ||
        (Array.isArray(n?.rotation) &&
          n.rotation.some(
            (r: number, i: number) => Math.abs(r - (i === 3 ? 1 : 0)) > 1e-9,
          )),
    );
    return { min, max, transformed };
  } catch {
    return null;
  }
}

export interface GlbGeoInfo {
  /** POSITION held raw WGS84 degrees (the optimizer reprojects these). */
  geographic: boolean;
  /** Model-frame georeference origin; null for a plain local-metres model. */
  origin: GeoOrigin | null;
  extentEastM: number;
  extentNorthM: number;
}

/**
 * Horizontal extent (metres) of a GLB, plus the georeference origin when the
 * vertices are geographic. The origin mirrors optimize.mjs: centre of the
 * lon/lat bounds, altitude = lowest vertex (model Y = 0).
 */
export function deriveGlbGeoInfo(buffer: Buffer): GlbGeoInfo | null {
  const b = readGlbPositionBounds(buffer);
  if (!b) return null;
  const [minX, minY, minZ] = b.min;
  const [maxX, maxY, maxZ] = b.max;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const geographic =
    Math.abs(minX) <= 180 &&
    Math.abs(maxX) <= 180 &&
    Math.abs(minY) <= 90 &&
    Math.abs(maxY) <= 90 &&
    spanX > 1e-9 &&
    spanY > 1e-9 &&
    spanX < 1 &&
    spanY < 1 &&
    (Math.abs(minX) > 0.01 || Math.abs(minY) > 0.01);
  if (geographic) {
    if (b.transformed) return null;
    const origin: GeoOrigin = {
      lat: (minY + maxY) / 2,
      lng: (minX + maxX) / 2,
      alt: minZ,
    };
    const ext = lonLatExtentMeters([
      [minX, minY],
      [maxX, maxY],
    ]);
    if (!ext) return null;
    return { geographic: true, origin, ...ext };
  }
  if (b.transformed) return null;
  // Local metres, glTF Y-up: plan extent is X by Z.
  const e = maxX - minX;
  const n = maxZ - minZ;
  if (!(e > 0.5 && n > 0.5 && e < 50_000 && n < 50_000)) return null;
  return { geographic: false, origin: null, extentEastM: e, extentNorthM: n };
}

/** East/North extent in metres of a set of [lng, lat] positions. */
export function lonLatExtentMeters(
  coords: Array<[number, number] | number[]>,
): { extentEastM: number; extentNorthM: number } | null {
  const pts = coords.filter(
    (c) => Array.isArray(c) && isPlausibleLatLng(c[1], c[0]),
  );
  if (pts.length < 2) return null;
  const lngs = pts.map((c) => Number(c[0]));
  const lats = pts.map((c) => Number(c[1]));
  const w = Math.min(...lngs);
  const e = Math.max(...lngs);
  const s = Math.min(...lats);
  const n = Math.max(...lats);
  const origin: GeoOrigin = { lat: (s + n) / 2, lng: (w + e) / 2, alt: 0 };
  const east =
    wgs84ToEnu({ lat: origin.lat, lng: e, alt: 0 }, origin).e -
    wgs84ToEnu({ lat: origin.lat, lng: w, alt: 0 }, origin).e;
  const north =
    wgs84ToEnu({ lat: n, lng: origin.lng, alt: 0 }, origin).n -
    wgs84ToEnu({ lat: s, lng: origin.lng, alt: 0 }, origin).n;
  if (!(east > 0 && north > 0)) return null;
  return { extentEastM: east, extentNorthM: north };
}

/** Every [lng, lat] position inside an arbitrary GeoJSON object. */
export function collectGeoJsonPositions(
  geo: unknown,
  out: number[][] = [],
): number[][] {
  if (Array.isArray(geo)) {
    if (
      geo.length >= 2 &&
      typeof geo[0] === 'number' &&
      typeof geo[1] === 'number'
    ) {
      out.push(geo as number[]);
    } else {
      for (const g of geo) collectGeoJsonPositions(g, out);
    }
  } else if (geo && typeof geo === 'object') {
    const o = geo as Record<string, unknown>;
    if ('coordinates' in o) collectGeoJsonPositions(o.coordinates, out);
    if (Array.isArray(o.features)) collectGeoJsonPositions(o.features, out);
    if (o.geometry) collectGeoJsonPositions(o.geometry, out);
    if (Array.isArray(o.geometries)) collectGeoJsonPositions(o.geometries, out);
  }
  return out;
}

export interface ModelScaleCheck {
  ratioEast: number;
  ratioNorth: number;
  /** Multiply model measurements by this; null when scale can't be judged. */
  scaleFactor: number | null;
  /** Non-null when the model and footprint disagree by more than tolerance. */
  warning: string | null;
}

/**
 * Compare the GLB's horizontal extent with the KMZ footprint extent (WS6.4).
 *
 *  - Both axes within `tolerance` of 1 → scale OK (factor 1, no warning).
 *  - Both axes off by the SAME ratio → a uniform scale error (e.g. exported
 *    in the wrong unit): factor = 1 / ratio, applied to measurements.
 *  - Axes disagree → the two files cover different areas, so the scale can't
 *    be verified: warn, factor null (measurements are not corrected).
 */
export function compareModelScale(
  glb: { extentEastM: number; extentNorthM: number },
  footprint: { extentEastM: number; extentNorthM: number },
  tolerance = 0.02,
): ModelScaleCheck | null {
  const vals = [
    glb.extentEastM,
    glb.extentNorthM,
    footprint.extentEastM,
    footprint.extentNorthM,
  ];
  if (!vals.every((v) => Number.isFinite(v) && v > 0)) return null;
  const rE = glb.extentEastM / footprint.extentEastM;
  const rN = glb.extentNorthM / footprint.extentNorthM;
  const mean = Math.sqrt(rE * rN);
  const round = (v: number) => Number(v.toFixed(4));
  const base = { ratioEast: round(rE), ratioNorth: round(rN) };

  if (Math.abs(rE - 1) <= tolerance && Math.abs(rN - 1) <= tolerance) {
    return { ...base, scaleFactor: 1, warning: null };
  }
  const m = (v: number) => `${v.toFixed(0)} m`;
  if (Math.abs(rE / rN - 1) <= tolerance) {
    const factor = 1 / mean;
    const pct = Math.abs(mean - 1) * 100;
    return {
      ...base,
      scaleFactor: Number(factor.toFixed(6)),
      warning:
        `The 3D model is ${pct.toFixed(1)}% ${mean > 1 ? 'larger' : 'smaller'} than the KMZ footprint ` +
        `(${m(glb.extentEastM)} × ${m(glb.extentNorthM)} vs ${m(footprint.extentEastM)} × ${m(footprint.extentNorthM)}). ` +
        `3D measurements are corrected by ×${factor.toFixed(4)}; re-export the model at the correct scale.`,
    };
  }
  return {
    ...base,
    scaleFactor: null,
    warning:
      `The 3D model extent (${m(glb.extentEastM)} × ${m(glb.extentNorthM)}) does not match the KMZ footprint ` +
      `(${m(footprint.extentEastM)} × ${m(footprint.extentNorthM)}), so its scale could not be verified. ` +
      `Check 3D measurements against a known dimension.`,
  };
}
