/**
 * The one set of rules for a school's location (latitude / longitude).
 * Every writer — the school form, the map pin, KMZ uploads, 3D models —
 * goes through SchoolLocationService, which applies these.
 */

/** Where the current location came from. */
export type LocationSource = 'manual' | 'kmz' | 'glb' | 'seed';

/** Rwanda with a small margin (border schools). */
export const RWANDA_BOUNDS = {
  minLat: -2.95,
  maxLat: -0.95,
  minLng: 28.75,
  maxLng: 31.0,
} as const;

export const inRwanda = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= RWANDA_BOUNDS.minLat &&
  lat <= RWANDA_BOUNDS.maxLat &&
  lng >= RWANDA_BOUNDS.minLng &&
  lng <= RWANDA_BOUNDS.maxLng;

/** Stored precision (decimal(10,7)). */
export const round7 = (n: number): number => Number(Number(n).toFixed(7));

/**
 * Check a point typed or picked by a person. Returns the point to store, or
 * a plain-language reason it was refused.
 */
export function checkPoint(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | { error: string } {
  const a = Number(lat);
  const o = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(o))
    return { error: 'Latitude and longitude must be numbers.' };
  if (inRwanda(a, o)) return { lat: round7(a), lng: round7(o) };
  if (inRwanda(o, a))
    return {
      error:
        'Latitude and longitude look swapped: in Rwanda latitude is about -1 to -3 and longitude about 29 to 31.',
    };
  return {
    error:
      'This location is outside Rwanda. Latitude should be about -1 to -3 and longitude about 29 to 31.',
  };
}

/**
 * Whether a derived location may replace the current one:
 * - a person's edit (manual) always applies;
 * - a KMZ upload always applies — the site map is the reference;
 * - a 3D model only fills a missing location or one that came from a model
 *   or the seed data — it never overrides a person or a KMZ;
 * - re-processing an existing model (restore / nightly re-optimise) never
 *   changes the location.
 */
export function mayReplace(
  incoming: LocationSource | 'restore',
  current: { source: LocationSource | null; hasPoint: boolean },
): boolean {
  if (incoming === 'restore') return false;
  if (incoming === 'manual' || incoming === 'kmz') return true;
  if (incoming === 'seed') return !current.hasPoint;
  // glb
  return (
    !current.hasPoint ||
    current.source === null ||
    current.source === 'glb' ||
    current.source === 'seed'
  );
}
