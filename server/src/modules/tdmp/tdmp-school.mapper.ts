import { createHash } from 'node:crypto';
import {
  SchoolStatus,
  SchoolType,
  type School,
  type TdmpSchoolData,
} from '../schools/entities/school.entity';
import { inRwanda, round7 } from '../schools/location/school-location.rules';
import { MIN_PLAUSIBLE_YEAR } from '../../common/validation/plausible-year';
import type { TdmpSchool } from './tdmp.types';

/**
 * School columns TDMP owns today. Once a school is linked (tdmpSchoolCode
 * set) nobody edits them here — the sync overwrites them. Only fields TDMP
 * actually sends are listed: learner / teacher gender splits and the head
 * teacher stay editable until TDMP grants those aggregates (requests R1, R3).
 * GPS is deliberately NOT here: RTB GIS owns location.
 * Mirrored in client/src/lib/tdmp.ts.
 */
export const TDMP_OWNED_SCHOOL_FIELDS = [
  'code',
  'name',
  'type',
  'status',
  'establishedYear',
  'province',
  'district',
  'sector',
  'cell',
  'village',
  'ownership',
  'totalStudents',
  'totalTeachers',
] as const;

export type TdmpOwnedField = (typeof TDMP_OWNED_SCHOOL_FIELDS)[number];

/**
 * Fields the school condition score reads. A sync emits `school.updated`
 * (→ rescore) only when one of these changed, not for a re-spelt name.
 */
export const SCORING_INPUT_FIELDS = [
  'status',
  'establishedYear',
  'totalStudents',
  'educationPrograms',
] as const;

/** TDMP `categoryBand` values that name one of our school types. */
export type TdmpBand = 'TSS' | 'VTC';

/** Everything fetched from TDMP for one school. */
export interface TdmpSchoolBundle {
  /** Normalised list row, merged with the detail record when it was read. */
  school: TdmpSchool;
  /** Band from the `categoryBand` sweeps; null = in neither, undefined = not swept. */
  band?: TdmpBand | null;
  /** When the detail record behind `school` was read (ISO), if it was. */
  detailFetchedAt?: string | null;
}

const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/**
 * Our type from TDMP's band. TDMP's `schoolCategory` is just "TVET" for every
 * school, so the TSS / VTC split comes from which `categoryBand` sweep listed
 * the school. Not in either: keep ours (flagged as unverified).
 */
export function mapSchoolType(
  band: TdmpBand | null | undefined,
  current?: SchoolType | null,
): { type: SchoolType; unverified: boolean } {
  if (band === 'TSS') return { type: SchoolType.TSS, unverified: false };
  if (band === 'VTC') return { type: SchoolType.VTC, unverified: false };
  return { type: current ?? SchoolType.TSS, unverified: true };
}

/**
 * TDMP isActive → our status. INACTIVE always wins; ACTIVE keeps our own
 * `under_renovation` (a GIS-side state TDMP knows nothing about); unknown
 * keeps whatever we have.
 */
export function mapStatus(
  isActive: string | null | undefined,
  current?: SchoolStatus | null,
): SchoolStatus {
  const v = (isActive ?? '').toUpperCase();
  if (v === 'INACTIVE') return SchoolStatus.INACTIVE;
  if (v === 'ACTIVE')
    return current === SchoolStatus.UNDER_RENOVATION
      ? SchoolStatus.UNDER_RENOVATION
      : SchoolStatus.ACTIVE;
  return current ?? SchoolStatus.ACTIVE;
}

/** Year of an ISO-ish date, when it is a plausible establishment year. */
export function yearOf(
  date: string | null | undefined,
  now = new Date(),
): number | null {
  const m = /^(\d{4})/.exec(date ?? '');
  if (!m) return null;
  const y = Number(m[1]);
  return y >= MIN_PLAUSIBLE_YEAR && y <= now.getFullYear() ? y : null;
}

/**
 * Fingerprint of what the sync would write for a school. Equal to the stored
 * `tdmpData.hash` = nothing changed upstream, so the row is not touched.
 */
export function hashBundle(bundle: TdmpSchoolBundle): string {
  const s = bundle.school;
  const l = s.location ?? {};
  const material = [
    s.id,
    s.schoolCode,
    s.schoolName,
    s.tmisSchoolCode,
    s.isActive,
    s.ownership,
    s.schoolCategory,
    s.institutionType,
    bundle.band ?? null,
    l.provinceId, l.provinceName, l.districtId, l.districtName,
    l.sectorId, l.sectorName, l.cellId, l.cellName, l.villageId, l.villageName,
    s.counts?.students, s.counts?.teachers, s.counts?.trades,
    (s.tradeNames ?? []).join(','),
    s.establishmentDate ?? null,
    s.currentAcademicYear ?? s.academicYear ?? null,
  ];
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

/**
 * The TDMP-owned columns and the TDMP extras for one school. Fields TDMP
 * leaves empty keep their current value (`current`) rather than being wiped.
 */
export function mapTdmpSchool(
  bundle: TdmpSchoolBundle,
  current: Partial<School> = {},
): { fields: Partial<School>; tdmpData: TdmpSchoolData } {
  const s = bundle.school;
  const loc = s.location ?? {};
  const keep = <K extends keyof School>(k: K, v: School[K] | null) =>
    v ?? (current[k] as School[K]);
  const type = mapSchoolType(bundle.band, current.type);

  const fields: Partial<School> = {
    code: s.schoolCode,
    name: text(s.schoolName) ?? current.name,
    type: type.type,
    status: mapStatus(s.isActive, current.status),
    establishedYear: keep('establishedYear', yearOf(s.establishmentDate)),
    province: text(loc.provinceName) ?? current.province ?? '',
    district: text(loc.districtName) ?? current.district ?? '',
    sector: text(loc.sectorName) ?? current.sector ?? '',
    cell: keep('cell', text(loc.cellName)),
    village: keep('village', text(loc.villageName)),
    provinceId: keep('provinceId', loc.provinceId ?? null),
    districtId: keep('districtId', loc.districtId ?? null),
    sectorId: keep('sectorId', loc.sectorId ?? null),
    cellId: keep('cellId', loc.cellId ?? null),
    villageId: keep('villageId', loc.villageId ?? null),
    ownership: keep('ownership', text(s.ownership)),
    totalStudents: keep('totalStudents', count(s.counts?.students)),
    totalTeachers: keep('totalTeachers', count(s.counts?.teachers)),
  };

  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.counts ?? {}))
    if (count(v) !== null) counts[k] = count(v)!;

  const prev = current.tdmpData ?? {};
  const tdmpData: TdmpSchoolData = {
    ownership: text(s.ownership),
    institutionType: text(s.institutionType),
    schoolCategory: text(s.schoolCategory),
    schoolStatus: text(s.schoolStatus),
    isActive: text(s.isActive),
    band: bundle.band ?? null,
    typeUnverified: type.unverified,
    tmisSchoolCode: text(s.tmisSchoolCode),
    trades: Array.isArray(s.tradeNames)
      ? s.tradeNames.filter((t) => typeof t === 'string')
      : [],
    counts,
    academicYear: text(s.currentAcademicYear) ?? text(s.academicYear),
    establishmentDate:
      text(s.establishmentDate) ?? prev.establishmentDate ?? null,
    sourceUpdatedAt:
      text(s.lastMaterialisedAt) ?? text(s.updatedAt) ?? prev.sourceUpdatedAt ?? null,
    hash: hashBundle(bundle),
    detailFetchedAt: bundle.detailFetchedAt ?? prev.detailFetchedAt ?? null,
    missingFromTdmp: false,
    missingRuns: 0,
  };

  return { fields, tdmpData };
}

/** TDMP's GPS as a starting location for a school new to RTB GIS. */
export function initialLocation(
  s: Pick<TdmpSchool, 'gpsLat' | 'gpsLong'>,
): { latitude: number; longitude: number } | null {
  const lat = Number(s.gpsLat);
  const lng = Number(s.gpsLong);
  if (s.gpsLat == null || s.gpsLong == null || !inRwanda(lat, lng)) return null;
  return { latitude: round7(lat), longitude: round7(lng) };
}

function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  if (x === null || y === null) return false;
  if (typeof x === 'number' || typeof y === 'number')
    return Number(x) === Number(y);
  return JSON.stringify(x) === JSON.stringify(y);
}

/** Names of the mapped fields whose value differs from `current`. */
export function changedFields(
  current: Partial<School>,
  fields: Partial<School>,
): string[] {
  return Object.entries(fields)
    .filter(([k, v]) => !same((current as Record<string, unknown>)[k], v))
    .map(([k]) => k);
}

/** Whether any of `changed` feeds the school condition score. */
export function touchesScoring(changed: readonly string[]): boolean {
  return changed.some((f) =>
    (SCORING_INPUT_FIELDS as readonly string[]).includes(f),
  );
}

/**
 * The TDMP-owned fields a PATCH tries to change on a linked school. Values
 * equal to the stored ones are fine (the form sends the whole record).
 */
export function lockedTdmpChanges(
  dto: Record<string, unknown>,
  current: Partial<School>,
): string[] {
  if (!current.tdmpSchoolCode) return [];
  return TDMP_OWNED_SCHOOL_FIELDS.filter(
    (f) =>
      dto[f] !== undefined &&
      !same(dto[f], (current as Record<string, unknown>)[f]),
  );
}
