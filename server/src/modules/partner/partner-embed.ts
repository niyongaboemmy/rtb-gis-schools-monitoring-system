/**
 * Embedded views for partner platforms (TDMP): which views exist, where they
 * live in the web app, and how an embed session narrows what the read-only
 * partner account may see. Pure functions — no Nest, no database.
 *
 * Flow: the partner's server asks for a signed embed link (partner API key)
 * → the browser opens the link in an iframe → the page exchanges the link for
 * a short read-only session (`emb` claim) → JwtStrategy narrows the account's
 * scope to the link's scope and refuses anything but reads.
 */

export const EMBED_VIEWS = [
  'school-dashboard',
  'school-map-2d',
  'school-map-3d',
  'national-map',
  'national-dashboard',
] as const;
export type EmbedView = (typeof EMBED_VIEWS)[number];

export const isSchoolView = (v: EmbedView) =>
  v !== 'national-map' && v !== 'national-dashboard';

/** Web-app path of a view (the client renders these without app chrome). */
export function embedPath(view: EmbedView, schoolId?: string): string {
  switch (view) {
    case 'school-dashboard':
      return `/embed/schools/${schoolId}/dashboard`;
    case 'school-map-2d':
      return `/embed/schools/${schoolId}/map-2d`;
    case 'school-map-3d':
      return `/embed/schools/${schoolId}/map-3d`;
    case 'national-map':
      return '/embed/map';
    case 'national-dashboard':
      return '/embed/dashboard';
  }
}

/**
 * The API routes each embedded view may call (GET only, after /api/v1,
 * without the query string). An embed session reaches exactly its view: a
 * dashboard link cannot load map tiles or a 3D model, a 2D link cannot load
 * the dashboard figures or the 3D model, and so on. `:sid` is the link's own
 * school, so a school view never reaches another school even on an allowed
 * route. Scope (school / area) is still enforced by the usual guards.
 */
const SID = ':sid';
export const EMBED_VIEW_ROUTES: Record<EmbedView, string[]> = {
  'school-dashboard': [
    `/schools/${SID}`,
    `/analytics/schools/${SID}/metrics`,
    `/analytics/schools/${SID}/actions`,
    '/schools/dashboard/reporting',
    '/schools/dashboard/reporting/overview',
    '/reports',
    '/schools/facilities',
  ],
  'school-map-2d': [
    `/schools/${SID}`,
    `/schools/${SID}/buildings`,
    `/schools/${SID}/kmz/2d/manifest`,
    `/schools/${SID}/kmz/2d/tiles`,
    `/schools/${SID}/kmz/places-overlay`,
    `/schools/${SID}/site-features`,
    '/schools/facilities',
  ],
  'school-map-3d': [
    `/schools/${SID}`,
    `/schools/${SID}/buildings`,
    `/schools/${SID}/kmz/status`,
    `/schools/${SID}/viewer-state`,
    `/schools/${SID}/site-features`,
    '/schools/facilities',
  ],
  'national-map': ['/schools', '/analytics/overview', '/analytics/hierarchy'],
  'national-dashboard': [
    '/schools',
    '/analytics/overview',
    '/analytics/hierarchy',
  ],
};

/** `/api/v1/schools/x?y=1` → `/schools/x` (no prefix, no query, no trailing slash). */
export function apiPath(url: string): string {
  const path = (url ?? '').split('?')[0].split('#')[0];
  return path.replace(/^\/api\/v1(?=\/|$)/, '').replace(/\/+$/, '') || '/';
}

/** Whether an embed session for `view` (school `sid`) may make this request. */
export function embedRouteAllowed(
  view: EmbedView,
  sid: string | undefined,
  method: string,
  url: string,
): boolean {
  if (!EMBED_READ_METHODS.has((method ?? 'GET').toUpperCase())) return false;
  const path = apiPath(url);
  return (EMBED_VIEW_ROUTES[view] ?? []).some((route) => {
    if (route.includes(SID)) return !!sid && path === route.replace(SID, sid);
    return path === route;
  });
}

/** Where an embed session may look: the same shape as `user.location`. */
export interface EmbedLocation {
  tier: 'national' | 'province' | 'district' | 'school';
  province?: string;
  district?: string;
  sector?: string;
  schoolId?: string;
  schoolName?: string;
}

/** Claims carried by an embed session's access token. */
export interface EmbedClaims {
  /** Partner key id. */
  pk: string;
  view: EmbedView;
  /** Our school id for school views. */
  sid?: string;
  loc: EmbedLocation;
}

/** Payload of the signed link the partner's server receives. */
export interface EmbedLinkPayload extends EmbedClaims {
  typ: 'embed-link';
  /** Minutes the session opened from this link may last. */
  smin: number;
  jti: string;
}

export const EMBED_LINK_TTL = { min: 60, max: 3600, default: 300 } as const;
export const EMBED_SESSION_MINUTES = {
  min: 5,
  max: 480,
  default: 120,
} as const;

export const clamp = (
  n: unknown,
  r: { min: number; max: number; default: number },
) => {
  const v = Number(n);
  return Number.isFinite(v)
    ? Math.min(r.max, Math.max(r.min, Math.round(v)))
    : r.default;
};

/** The scope of a school view: that school only. */
export function schoolLocation(s: {
  id: string;
  name: string;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
}): EmbedLocation {
  return {
    tier: 'school',
    province: s.province ?? undefined,
    district: s.district ?? undefined,
    sector: s.sector ?? undefined,
    schoolId: s.id,
    schoolName: s.name,
  };
}

/** The scope of the national map: everything, or one province / district. */
export function areaLocation(area?: {
  province?: string | null;
  district?: string | null;
}): EmbedLocation {
  const province = area?.province?.trim() || undefined;
  const district = area?.district?.trim() || undefined;
  if (district) return { tier: 'district', province, district };
  if (province) return { tier: 'province', province };
  return { tier: 'national' };
}

/** HTTP methods an embed session may use. */
export const EMBED_READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The partner account as an embed session sees it: its location replaced by
 * the link's scope (resolveAccessScope then narrows the role's national tier
 * to it). Returns null when the token's account is not a partner account,
 * which callers treat as unauthorised.
 */
export function applyEmbedClaims<
  U extends { authSource?: string; location?: unknown },
>(user: U, emb: EmbedClaims): (U & { embed: EmbedClaims }) | null {
  if (user.authSource !== 'partner') return null;
  return Object.assign(user, { location: { ...emb.loc }, embed: emb });
}
