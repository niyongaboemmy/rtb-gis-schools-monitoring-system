import type { SelectQueryBuilder } from 'typeorm';
import type { EmbedLocation, EmbedView } from './partner-embed';
import { EMBED_VIEWS } from './partner-embed';

/**
 * What a partner key may reach (its access level). Every partner endpoint
 * applies it: data lists are filtered to it, a school outside it does not
 * exist for the key, and embed links can never cover more than it.
 */
export const PARTNER_ACCESS_TIERS = [
  'national',
  'province',
  'district',
  'schools',
] as const;
export type PartnerAccessTier = (typeof PARTNER_ACCESS_TIERS)[number];

export interface PartnerAccess {
  tier: PartnerAccessTier;
  province?: string | null;
  district?: string | null;
  /** TDMP / SDMS codes, for the 'schools' tier. */
  schoolCodes?: string[] | null;
  /** Embedded views the key may open. */
  views: EmbedView[];
}

/** Max schools in a 'schools' key. */
export const MAX_ACCESS_SCHOOLS = 200;

const same = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** The access level stored on a key, with safe defaults for older rows. */
export function accessOf(key: {
  accessTier?: string | null;
  accessProvince?: string | null;
  accessDistrict?: string | null;
  accessSchoolCodes?: string[] | null;
  allowedViews?: string[] | null;
}): PartnerAccess {
  const tier = (PARTNER_ACCESS_TIERS as readonly string[]).includes(
    key.accessTier ?? '',
  )
    ? (key.accessTier as PartnerAccessTier)
    : 'national';
  const views = (
    key.allowedViews?.length ? key.allowedViews : [...EMBED_VIEWS]
  ).filter((v): v is EmbedView =>
    (EMBED_VIEWS as readonly string[]).includes(v),
  );
  return {
    tier,
    province: key.accessProvince ?? null,
    district: key.accessDistrict ?? null,
    schoolCodes: key.accessSchoolCodes ?? null,
    views,
  };
}

/** Whether a school lies inside the key's access. */
export function schoolInAccess(
  access: PartnerAccess,
  school: {
    code?: string | null;
    tdmpSchoolCode?: string | null;
    province?: string | null;
    district?: string | null;
  },
): boolean {
  switch (access.tier) {
    case 'national':
      return true;
    case 'province':
      return same(school.province, access.province);
    case 'district':
      return (
        same(school.district, access.district) &&
        (!access.province || same(school.province, access.province))
      );
    case 'schools': {
      const codes = new Set(
        (access.schoolCodes ?? []).map((c) => c.trim().toLowerCase()),
      );
      return [school.tdmpSchoolCode, school.code].some(
        (c) => !!c && codes.has(c.trim().toLowerCase()),
      );
    }
  }
}

/** Restricts a schools query (alias `s`) to the key's access. */
export function applyAccess<T extends object>(
  qb: SelectQueryBuilder<T>,
  access: PartnerAccess,
  alias = 's',
) {
  switch (access.tier) {
    case 'national':
      return qb;
    case 'province':
      return qb.andWhere(`LOWER(${alias}.province) = LOWER(:accProvince)`, {
        accProvince: access.province ?? '',
      });
    case 'district':
      qb.andWhere(`LOWER(${alias}.district) = LOWER(:accDistrict)`, {
        accDistrict: access.district ?? '',
      });
      if (access.province)
        qb.andWhere(`LOWER(${alias}.province) = LOWER(:accProvince)`, {
          accProvince: access.province,
        });
      return qb;
    case 'schools': {
      const codes = (access.schoolCodes ?? []).map((c) => c.trim());
      if (!codes.length) return qb.andWhere('1 = 0');
      return qb.andWhere(
        `(${alias}."tdmpSchoolCode" IN (:...accCodes) OR ${alias}.code IN (:...accCodes))`,
        { accCodes: codes },
      );
    }
  }
}

export type AreaClamp =
  | { ok: true; loc: EmbedLocation }
  | { ok: false; reason: string; needsDistrictCheck?: false }
  | { ok: 'check'; district: string; province: string };

/**
 * The area a national-map link may cover, given what the partner asked for:
 * never wider than the key. 'check' = a district inside the key's province,
 * which the caller confirms against the school data.
 */
export function clampMapArea(
  access: PartnerAccess,
  asked: { province?: string; district?: string },
): AreaClamp {
  const province = asked.province?.trim() || undefined;
  const district = asked.district?.trim() || undefined;
  switch (access.tier) {
    case 'national':
      if (district)
        return { ok: true, loc: { tier: 'district', province, district } };
      if (province) return { ok: true, loc: { tier: 'province', province } };
      return { ok: true, loc: { tier: 'national' } };
    case 'province':
      if (province && !same(province, access.province))
        return {
          ok: false,
          reason: `This key only covers ${access.province}.`,
        };
      if (district)
        return { ok: 'check', district, province: access.province ?? '' };
      return {
        ok: true,
        loc: { tier: 'province', province: access.province ?? undefined },
      };
    case 'district':
      if (
        (district && !same(district, access.district)) ||
        (province && access.province && !same(province, access.province))
      )
        return {
          ok: false,
          reason: `This key only covers ${access.district} district.`,
        };
      return {
        ok: true,
        loc: {
          tier: 'district',
          province: access.province ?? undefined,
          district: access.district ?? undefined,
        },
      };
    case 'schools':
      return {
        ok: false,
        reason: 'This key covers specific schools only: use a school view.',
      };
  }
}

/** One line describing an access level, for lists and logs. */
export function describeAccess(a: PartnerAccess): string {
  switch (a.tier) {
    case 'national':
      return 'All schools (national)';
    case 'province':
      return `${a.province} province`;
    case 'district':
      return `${a.district} district`;
    case 'schools':
      return `${a.schoolCodes?.length ?? 0} school(s)`;
  }
}
