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

/**
 * Pick the best coordinate from KML-derived sources, in priority order:
 *   1. the authored LookAt / Camera view
 *   2. the centre of the ground-overlay bounding box(es)
 *   3. the centroid of point/vertex coordinates
 */
export function pickKmlCoordinate(sources: {
  initialView?: { latitude?: number; longitude?: number } | null;
  groundOverlays?: Array<Partial<LatLonBox>> | null;
  points?: Array<[number, number]> | null; // [lng, lat]
}): DerivedCoordinate | null {
  const { initialView, groundOverlays, points } = sources;

  if (
    initialView &&
    isPlausibleLatLng(initialView.latitude, initialView.longitude)
  ) {
    return {
      lat: Number(initialView.latitude),
      lng: Number(initialView.longitude),
      source: 'kml:view',
    };
  }

  const boxes = (groundOverlays || []).filter(
    (b) =>
      b &&
      isPlausibleLatLng(b.north, b.east) &&
      isPlausibleLatLng(b.south, b.west),
  ) as LatLonBox[];
  if (boxes.length) {
    const lat =
      boxes.reduce((s, b) => s + (b.north + b.south) / 2, 0) / boxes.length;
    const lng =
      boxes.reduce((s, b) => s + (b.east + b.west) / 2, 0) / boxes.length;
    if (isPlausibleLatLng(lat, lng)) {
      return { lat, lng, source: 'kml:overlay-bounds' };
    }
  }

  const pts = (points || []).filter(([lng, lat]) =>
    isPlausibleLatLng(lat, lng),
  );
  if (pts.length) {
    const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (isPlausibleLatLng(lat, lng)) {
      return { lat, lng, source: 'kml:centroid' };
    }
  }

  return null;
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
