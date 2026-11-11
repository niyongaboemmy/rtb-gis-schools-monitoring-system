import type { TdmpAccessScope } from '../../tdmp/tdmp.types';
import type { User } from '../../users/entities/user.entity';
import { NATIONAL_RANK } from '../../../common/scope/access-scope';

/** Why a TDMP user may not sign in here. Maps to `?sso_error=` codes. */
export class TdmpSignInRefused extends Error {
  constructor(
    readonly reason: 'not_allowed' | 'inactive',
    readonly detail: string,
  ) {
    super(detail);
  }
}

/** A role as the mapping needs it. */
export interface MappableRole {
  id: string;
  name: string;
  permissions?: string[] | null;
  tdmpRoleNames?: string[] | null;
  accessLevel?: { rank?: number | null; slug?: string | null } | null;
}

/** Breadth of a role: lower = sees more. No level = national. */
function reachOf(role: MappableRole): number {
  const lvl = role.accessLevel;
  if (!lvl || lvl.slug === 'national') return NATIONAL_RANK;
  return typeof lvl.rank === 'number' && lvl.rank > 0 ? lvl.rank : 100;
}

/**
 * Our role for a TDMP user: every role listing one of the user's TDMP role
 * names (case-insensitive) is a candidate; the broadest reach wins, then the
 * most permissions. Falls back to `defaultRoleName`, else null (refuse).
 */
export function pickRole<R extends MappableRole>(
  tdmpRoleNames: readonly string[],
  roles: readonly R[],
  defaultRoleName = '',
): R | null {
  const wanted = new Set(tdmpRoleNames.map((n) => n.trim().toLowerCase()));
  const candidates = roles.filter((r) =>
    (r.tdmpRoleNames ?? []).some((n) => wanted.has(n.trim().toLowerCase())),
  );
  if (candidates.length) {
    return [...candidates].sort(
      (a, b) =>
        reachOf(a) - reachOf(b) ||
        (b.permissions?.length ?? 0) - (a.permissions?.length ?? 0) ||
        a.name.localeCompare(b.name),
    )[0];
  }
  if (defaultRoleName)
    return roles.find((r) => r.name === defaultRoleName) ?? null;
  return null;
}

/** Where a TDMP user sits, before the anchor school is resolved locally. */
export interface TdmpPlacement {
  tier: NonNullable<User['location']['tier']>;
  province?: string;
  district?: string;
  schoolCode?: string;
  schoolName?: string;
}

const clean = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * TDMP's row-level scope → our geographic placement. `deny` and anything
 * unrecognised return null: the user is refused rather than over-granted.
 */
export function placementFromScope(
  scope: TdmpAccessScope,
): TdmpPlacement | null {
  const as = scope.accessScope ?? { kind: '' };
  const anchor = scope.anchorSchool ?? null;
  const province = clean(as.provinceName) ?? clean(anchor?.provinceName);
  const district = clean(as.districtName) ?? clean(anchor?.districtName);
  switch ((as.kind ?? '').trim().toLowerCase()) {
    case 'unrestricted':
    case 'national':
      return { tier: 'national' };
    case 'province':
      return { tier: 'province', province };
    case 'district':
      return { tier: 'district', province, district };
    case 'school':
      return {
        tier: 'school',
        province,
        district,
        schoolCode: clean(as.schoolCode) ?? clean(anchor?.schoolCode),
        schoolName: clean(anchor?.schoolName),
      };
    default:
      return null;
  }
}

/** "Jean Claude Uwimana" → first "Jean", last "Claude Uwimana". */
export function splitName(
  name: string | null | undefined,
  fallback: string,
): { firstName: string; lastName: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: fallback, lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
