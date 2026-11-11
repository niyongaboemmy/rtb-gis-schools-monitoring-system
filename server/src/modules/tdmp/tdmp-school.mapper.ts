import {
  SchoolStatus,
  SchoolType,
  type School,
  type TdmpSchoolData,
} from '../schools/entities/school.entity';
import { inRwanda, round7 } from '../schools/location/school-location.rules';
import { MIN_PLAUSIBLE_YEAR } from '../../common/validation/plausible-year';
import type { TdmpInfrastructure, TdmpSchool, TdmpTeacher } from './tdmp.types';

/**
 * School columns TDMP owns. Once a school is linked (tdmpSchoolCode set)
 * nobody edits them here — the sync overwrites them. GPS (latitude,
 * longitude, elevation) is deliberately NOT here: RTB GIS owns location.
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
  'totalStudents',
  'maleStudents',
  'femaleStudents',
  'totalTeachers',
  'maleTeachers',
  'femaleTeachers',
  'headTeacher',
] as const;

export type TdmpOwnedField = (typeof TDMP_OWNED_SCHOOL_FIELDS)[number];

/** Everything fetched from TDMP for one school. */
export interface TdmpSchoolBundle {
  school: TdmpSchool;
  infrastructure?: TdmpInfrastructure | null;
  /** Students by gender (`meta.page.total` of filtered /students). */
  students?: { male: number | null; female: number | null } | null;
  /** The school's teachers (compact shape), or null when not fetched. */
  teachers?: TdmpTeacher[] | null;
}

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

/** TSS / VTC / INTEGRATED from TDMP's free-text school category. */
export function mapSchoolType(
  category: string | null | undefined,
  current?: SchoolType | null,
): SchoolType {
  const c = (category ?? '').toUpperCase();
  const vtc = c.includes('VTC') || c.includes('VOCATIONAL');
  const tss = c.includes('TSS') || c.includes('TECHNICAL SECONDARY');
  if (c.includes('INTEGRATED') || (vtc && tss)) return SchoolType.INTEGRATED;
  if (vtc) return SchoolType.VTC;
  if (tss) return SchoolType.TSS;
  return current ?? SchoolType.TSS;
}

/** TDMP isActive ("ACTIVE" / "INACTIVE") → our status; unknown keeps ours. */
export function mapStatus(
  isActive: string | null | undefined,
  current?: SchoolStatus | null,
): SchoolStatus {
  const v = (isActive ?? '').toUpperCase();
  if (v === 'INACTIVE') return SchoolStatus.INACTIVE;
  if (v === 'ACTIVE') return SchoolStatus.ACTIVE;
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

function genderOf(g: string | null | undefined): 'male' | 'female' | null {
  const v = (g ?? '').trim().toLowerCase();
  if (v.startsWith('f')) return 'female';
  if (v.startsWith('m')) return 'male';
  return null;
}

/** Teacher gender split and head teacher name. */
export function summariseTeachers(teachers: TdmpTeacher[]): {
  maleTeachers: number;
  femaleTeachers: number;
  headTeacher: string | null;
} {
  let male = 0;
  let female = 0;
  let head: string | null = null;
  for (const t of teachers) {
    const g = genderOf(t.gender);
    if (g === 'male') male++;
    else if (g === 'female') female++;
    if (t.isHeadTeacher && !head)
      head =
        text(t.names) ??
        ([t.firstName, t.lastName].filter(Boolean).join(' ') || null);
  }
  return { maleTeachers: male, femaleTeachers: female, headTeacher: head };
}

const INFRA_GROUPS = [
  'buildings',
  'ict',
  'sanitation',
  'housing',
  'utilities',
  'healthAndSafety',
  'food',
  'books',
] as const;

function infrastructureOf(
  infra: TdmpInfrastructure | null | undefined,
): TdmpSchoolData['infrastructure'] {
  if (!infra) return null;
  const out: NonNullable<TdmpSchoolData['infrastructure']> = {};
  for (const g of INFRA_GROUPS) {
    const group = infra[g];
    if (group && typeof group === 'object') out[g] = { ...group };
  }
  return Object.keys(out).length ? out : null;
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

  const fields: Partial<School> = {
    code: s.schoolCode,
    name: text(s.schoolName) ?? current.name,
    type: mapSchoolType(s.schoolCategory, current.type),
    status: mapStatus(s.isActive, current.status),
    establishedYear: keep('establishedYear', yearOf(s.establishmentDate)),
    province: text(loc.provinceName) ?? current.province ?? '',
    district: text(loc.districtName) ?? current.district ?? '',
    sector: text(loc.sectorName) ?? current.sector ?? '',
    cell: keep('cell', text(loc.cellName)),
    village: keep('village', text(loc.villageName)),
    totalStudents: keep('totalStudents', count(s.counts?.students)),
    totalTeachers: keep('totalTeachers', count(s.counts?.teachers)),
  };

  if (bundle.students) {
    fields.maleStudents = keep('maleStudents', count(bundle.students.male));
    fields.femaleStudents = keep(
      'femaleStudents',
      count(bundle.students.female),
    );
  }

  let staff: TdmpSchoolData['staff'];
  if (bundle.teachers) {
    const summary = summariseTeachers(bundle.teachers);
    staff = summary;
    fields.maleTeachers = summary.maleTeachers;
    fields.femaleTeachers = summary.femaleTeachers;
    fields.headTeacher = keep('headTeacher', summary.headTeacher);
  }

  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.counts ?? {}))
    if (count(v) !== null) counts[k] = count(v)!;

  const tdmpData: TdmpSchoolData = {
    ownership: text(s.ownership) ?? text(bundle.infrastructure?.ownershipType),
    institutionType: text(s.institutionType),
    schoolCategory: text(s.schoolCategory),
    schoolStatus: text(s.schoolStatus),
    isActive: text(s.isActive),
    tmisSchoolCode: text(s.tmisSchoolCode),
    trades: Array.isArray(s.tradeNames)
      ? s.tradeNames.filter((t) => typeof t === 'string')
      : [],
    counts,
    infrastructure: infrastructureOf(bundle.infrastructure),
    staff: staff ?? current.tdmpData?.staff,
    academicYear: text(s.currentAcademicYear) ?? text(s.academicYear),
    sourceUpdatedAt: text(s.lastMaterialisedAt) ?? text(s.updatedAt),
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
