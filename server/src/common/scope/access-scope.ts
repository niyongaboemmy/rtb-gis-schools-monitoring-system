/**
 * Hierarchical geographic access scope.
 *
 * Every role carries an AccessLevel (National ▸ Province ▸ District ▸ Sector ▸
 * School). The tier decides *how wide* a user can see; the user's `location`
 * decides *where* the window sits. A user may see a school when their bound
 * node is an ancestor of — or equal to — that school's admin path.
 *
 * Enforcement is gated behind the `SCOPE_ENFORCEMENT` env flag so it can be
 * rolled out without any change in visible behaviour. With the flag off,
 * `resolveAccessScope` always reports `isNational` / `enforced:false` and every
 * helper below is a no-op.
 */

export type AccessTierSlug =
  | 'national'
  | 'province'
  | 'district'
  | 'sector'
  | 'school';

export interface AccessScope {
  /** 10 (national) … 50 (school). Lower = broader reach. */
  rank: number;
  slug: AccessTierSlug | null;
  levelName: string | null;
  province?: string;
  district?: string;
  sector?: string;
  schoolId?: string;
  /** true → no geographic filtering is applied. */
  isNational: boolean;
  /** true → SCOPE_ENFORCEMENT is on for this request. */
  enforced: boolean;
}

export const NATIONAL_RANK = 10;

export const RANK_BY_SLUG: Record<AccessTierSlug, number> = {
  national: 10,
  province: 20,
  district: 30,
  sector: 40,
  school: 50,
};

/**
 * Sentinel used when a scoped user has no bound node — forces zero rows.
 * It is the nil UUID so it is also valid syntax for `school.id` (uuid column)
 * comparisons, not just the varchar admin-area columns.
 */
const NO_MATCH = '00000000-0000-0000-0000-000000000000';

/**
 * Enforcement is ON by default. Set `SCOPE_ENFORCEMENT=false` to disable it
 * entirely (e.g. a one-off migration window). A user whose role has no access
 * level — or the National level — is never filtered, so org-wide roles keep
 * seeing everything; only roles explicitly bound to a sub-national tier are
 * scoped.
 */
export function scopeEnforcementEnabled(): boolean {
  return process.env.SCOPE_ENFORCEMENT !== 'false';
}

function normaliseRoleName(name: unknown): string {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/\s+/g, '_')
    : '';
}

/**
 * Build the scope descriptor from a request user (the TypeORM `User` entity
 * that `JwtStrategy` attaches, with `role.accessLevel` eagerly loaded).
 */
export function resolveAccessScope(user: any): AccessScope {
  const enforced = scopeEnforcementEnabled();

  const role = user && typeof user.role === 'object' ? user.role : null;
  const accessLevel = role?.accessLevel ?? null;
  const roleName = normaliseRoleName(role?.name);

  let slug: AccessTierSlug | null = null;
  let levelName: string | null = null;
  let rank = 100;

  if (accessLevel) {
    levelName = accessLevel.name ?? null;
    const rawSlug =
      accessLevel.slug ||
      (accessLevel.name ? String(accessLevel.name).toLowerCase() : null);
    if (rawSlug && rawSlug in RANK_BY_SLUG) {
      slug = rawSlug as AccessTierSlug;
    }
    rank =
      typeof accessLevel.rank === 'number' && accessLevel.rank > 0
        ? accessLevel.rank
        : slug
          ? RANK_BY_SLUG[slug]
          : 100;
  }

  // super_admin is always national, whatever its configured level.
  if (roleName === 'super_admin') {
    slug = 'national';
    rank = NATIONAL_RANK;
    levelName = levelName || 'National';
  }

  const loc = (user && user.location) || {};

  // No enforcement, an explicit national tier, or an unconfigured level all
  // mean "see everything" — the safe, non-breaking default.
  const isNational =
    !enforced || rank <= NATIONAL_RANK || slug === 'national' || slug === null;

  return {
    rank,
    slug,
    levelName,
    province: loc.province || undefined,
    district: loc.district || undefined,
    sector: loc.sector || undefined,
    schoolId: loc.schoolId || undefined,
    isNational,
    enforced,
  };
}

/**
 * AND the scope predicate onto a schools query builder.
 * `alias` is the column alias that carries `province/district/sector/id`
 * (the `schools` row itself, or a joined `school` relation).
 */
export function applySchoolScope<T extends { andWhere: (...a: any[]) => T }>(
  qb: T,
  scope: AccessScope,
  alias = 'school',
): T {
  if (!scope.enforced || scope.isNational) return qb;

  if (scope.slug === 'school') {
    return qb.andWhere(`${alias}.id = :scopeSchoolId`, {
      scopeSchoolId: scope.schoolId ?? NO_MATCH,
    });
  }

  qb.andWhere(`${alias}.province = :scopeProvince`, {
    scopeProvince: scope.province ?? NO_MATCH,
  });
  if (scope.slug === 'district' || scope.slug === 'sector') {
    qb.andWhere(`${alias}.district = :scopeDistrict`, {
      scopeDistrict: scope.district ?? NO_MATCH,
    });
  }
  if (scope.slug === 'sector') {
    qb.andWhere(`${alias}.sector = :scopeSector`, {
      scopeSector: scope.sector ?? NO_MATCH,
    });
  }
  return qb;
}

/** In-memory equivalent of `applySchoolScope`, for `.find()` result filtering. */
export function schoolMatchesScope(
  school: {
    id?: string;
    province?: string;
    district?: string;
    sector?: string;
  },
  scope: AccessScope,
): boolean {
  if (!scope.enforced || scope.isNational) return true;

  if (scope.slug === 'school') {
    return !!scope.schoolId && school.id === scope.schoolId;
  }
  if (!scope.province || school.province !== scope.province) return false;
  if (
    (scope.slug === 'district' || scope.slug === 'sector') &&
    (!scope.district || school.district !== scope.district)
  ) {
    return false;
  }
  if (
    scope.slug === 'sector' &&
    (!scope.sector || school.sector !== scope.sector)
  ) {
    return false;
  }
  return true;
}

/** Human-readable node label, e.g. "Musanze District" or "National". */
export function scopeLabel(scope: AccessScope): string {
  if (scope.isNational || !scope.slug || scope.slug === 'national') {
    return 'National';
  }
  const node =
    scope.slug === 'school'
      ? scope.schoolId
      : scope.slug === 'sector'
        ? scope.sector
        : scope.slug === 'district'
          ? scope.district
          : scope.province;
  const tier = scope.slug.charAt(0).toUpperCase() + scope.slug.slice(1);
  return node ? `${node} ${tier}` : tier;
}
