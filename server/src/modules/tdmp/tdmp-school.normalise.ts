import type { TdmpLocation, TdmpSchool } from './tdmp.types';

/**
 * TDMP merges several upstream systems and its rows show it: `"unfetched"`
 * placeholders, mixed-case enums (`PRIVATE` / `Private`) and a few test rows.
 * Everything the sync reads goes through here first, so the mapper only ever
 * sees clean values or `null` ("TDMP doesn't know" → keep ours).
 */

/** Values TDMP uses for "no data". */
const UNKNOWN = new Set(['', 'unfetched', 'missing', 'null', 'undefined', 'n/a']);

export type Ownership = 'Public' | 'Gov Aided' | 'Private' | 'Others';

const OWNERSHIP: Record<string, Ownership> = {
  PUBLIC: 'Public',
  GOV_AIDED: 'Gov Aided',
  GOVERNMENT_AIDED: 'Gov Aided',
  PRIVATE: 'Private',
  OTHERS: 'Others',
  OTHER: 'Others',
};

/** Trimmed text, or null for empty / placeholder values. */
export function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return UNKNOWN.has(t.toLowerCase()) ? null : t;
}

/** Upper-case enum value (`Private` → `PRIVATE`), or null. */
export function cleanEnum(v: unknown): string | null {
  const t = clean(v);
  return t ? t.toUpperCase().replace(/[\s-]+/g, '_') : null;
}

const id = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;

/** Ownership from TDMP's `ownership` band, else from `schoolStatus`. */
export function ownershipOf(
  s: Pick<TdmpSchool, 'ownership' | 'schoolStatus'>,
): Ownership | null {
  return (
    OWNERSHIP[cleanEnum(s.ownership) ?? ''] ??
    OWNERSHIP[cleanEnum(s.schoolStatus) ?? ''] ??
    null
  );
}

function location(loc: TdmpLocation | null | undefined): TdmpLocation {
  const l = loc ?? {};
  return {
    provinceId: id(l.provinceId),
    provinceName: clean(l.provinceName),
    districtId: id(l.districtId),
    districtName: clean(l.districtName),
    sectorId: id(l.sectorId),
    sectorName: clean(l.sectorName),
    cellId: id(l.cellId),
    cellName: clean(l.cellName),
    villageId: id(l.villageId),
    villageName: clean(l.villageName),
  };
}

export type NormaliseResult =
  | { ok: true; school: TdmpSchool }
  | { ok: false; code: string | null; reason: string };

/**
 * A clean copy of one TDMP school row, or why it is skipped. Rows from
 * `ignoreSources` (TDMP test data) and rows without a code or district are
 * skipped: they cannot be matched or placed in anyone's access scope.
 */
export function normaliseTdmpSchool(
  raw: TdmpSchool,
  ignoreSources: readonly string[] = [],
): NormaliseResult {
  const code = clean(raw?.schoolCode);
  if (!code) return { ok: false, code: null, reason: 'no school code' };

  const source = clean(raw.authoritativeSource)?.toLowerCase() ?? null;
  if (source && ignoreSources.includes(source))
    return { ok: false, code, reason: `test row (source "${source}")` };

  const loc = location(raw.location);
  if (!loc.districtId && !loc.districtName)
    return { ok: false, code, reason: 'no district' };

  const counts: NonNullable<TdmpSchool['counts']> = {};
  for (const [k, v] of Object.entries(raw.counts ?? {}))
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0)
      counts[k as keyof typeof counts] = Math.round(v);

  return {
    ok: true,
    school: {
      ...raw,
      schoolCode: code,
      schoolName: clean(raw.schoolName) ?? code,
      tmisSchoolCode: clean(raw.tmisSchoolCode),
      institutionType: cleanEnum(raw.institutionType),
      schoolCategory: cleanEnum(raw.schoolCategory),
      schoolStatus: cleanEnum(raw.schoolStatus),
      isActive: cleanEnum(raw.isActive),
      ownership: ownershipOf(raw),
      categoryBand: cleanEnum(raw.categoryBand),
      authoritativeSource: source,
      location: loc,
      counts,
      tradeNames: Array.isArray(raw.tradeNames)
        ? [
            ...new Set(
              raw.tradeNames
                .map((t) => clean(t)?.toUpperCase())
                .filter((t): t is string => !!t),
            ),
          ].sort()
        : [],
      establishmentDate: clean(raw.establishmentDate),
      currentAcademicYear: clean(raw.currentAcademicYear),
      academicYear: clean(raw.academicYear),
    },
  };
}
