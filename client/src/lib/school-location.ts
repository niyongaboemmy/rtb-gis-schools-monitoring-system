/**
 * The one way the client reads and checks a school's location. Mirrors
 * server/src/modules/schools/location/school-location.rules.ts.
 */

/** Rwanda with a small margin (border schools). */
export const RWANDA_BOUNDS = { minLat: -2.95, maxLat: -0.95, minLng: 28.75, maxLng: 31.0 } as const;

/** Middle of Rwanda: where a map opens for a school with no location yet. */
export const RWANDA_CENTER = { lat: -1.9403, lng: 29.8739 } as const;

export const inRwanda = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= RWANDA_BOUNDS.minLat &&
  lat <= RWANDA_BOUNDS.maxLat &&
  lng >= RWANDA_BOUNDS.minLng &&
  lng <= RWANDA_BOUNDS.maxLng;

const toNum = (v: unknown): number => (v === null || v === undefined || v === "" ? NaN : Number(v));

/**
 * A school's point, or null when it has none or it is not a real location
 * in Rwanda (0,0, swapped, outside the country). Decimal columns arrive as
 * strings; this parses them.
 */
export function schoolPoint(s: { latitude?: unknown; longitude?: unknown } | null | undefined): { lat: number; lng: number } | null {
  if (!s) return null;
  const lat = toNum(s.latitude);
  const lng = toNum(s.longitude);
  return inRwanda(lat, lng) ? { lat, lng } : null;
}

/** Check a point typed or picked by a person; same wording as the server. */
export function checkPoint(lat: unknown, lng: unknown): string | null {
  const a = toNum(lat);
  const o = toNum(lng);
  if (!Number.isFinite(a) || !Number.isFinite(o)) return "Enter latitude and longitude as numbers.";
  if (inRwanda(a, o)) return null;
  if (inRwanda(o, a)) return "Latitude and longitude look swapped: in Rwanda latitude is about -1 to -3 and longitude about 29 to 31.";
  return "This location is outside Rwanda. Latitude should be about -1 to -3 and longitude about 29 to 31.";
}

export type LocationSource = "manual" | "kmz" | "glb" | "seed";

/** Where the current location came from, in plain words. */
export const LOCATION_SOURCE_LABEL: Record<LocationSource, string> = {
  manual: "Set by hand",
  kmz: "From the site map (KMZ)",
  glb: "From the 3D model",
  seed: "Sample location",
};

export const locationSourceLabel = (src: unknown): string | null =>
  typeof src === "string" && src in LOCATION_SOURCE_LABEL ? LOCATION_SOURCE_LABEL[src as LocationSource] : null;
