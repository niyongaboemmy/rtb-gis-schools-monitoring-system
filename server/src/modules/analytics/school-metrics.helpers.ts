/**
 * school-metrics.helpers.ts
 *
 * Pure, unit-tested helpers for the derived figures shown on the school and
 * national dashboards (WS1.4 / WS1.6 / WS1.7). Every formula here is
 * documented in docs/METRIC_DICTIONARY.md under the metric id in brackets.
 * The client must render these values — never recompute them.
 */

/** Minimal school shape the helpers read (entity or plain object). */
export interface SchoolFigures {
  totalStudents?: number | string | null;
  totalTeachers?: number | string | null;
  maleTeachers?: number | string | null;
  femaleTeachers?: number | string | null;
  maleAdminStaff?: number | string | null;
  femaleAdminStaff?: number | string | null;
  maleSupportStaff?: number | string | null;
  femaleSupportStaff?: number | string | null;
  educationPrograms?: Array<{
    totalStudents?: number | string | null;
    capacity?: number | string | null;
  }> | null;
  usedLandArea?: number | string | null;
  unusedLandArea?: number | string | null;
  roadStatusPercentage?: number | string | null;
  establishedYear?: number | string | null;
}

type Numeric = number | string | null | undefined;

const num = (v: Numeric): number => {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: Numeric): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * [school.totalStudents] [school.totalCapacity]
 * Enrolment = Σ programme.totalStudents when > 0, else school.totalStudents.
 * Capacity  = Σ programme.capacity (0 = unknown).
 */
export function programmeTotals(s: SchoolFigures): {
  students: number;
  capacity: number;
} {
  const programs = s.educationPrograms ?? [];
  const fromPrograms = programs.reduce((a, p) => a + num(p?.totalStudents), 0);
  const capacity = programs.reduce((a, p) => a + num(p?.capacity), 0);
  return {
    students: fromPrograms > 0 ? fromPrograms : num(s.totalStudents),
    capacity,
  };
}

/**
 * [school.totalTeachers] Teaching staff = maleTeachers + femaleTeachers when
 * either is recorded, otherwise the school.totalTeachers column. Same rule as
 * the national `totalTeachers` aggregate so the two always agree.
 */
export function teacherCount(s: SchoolFigures): number {
  const hasBreakdown =
    numOrNull(s.maleTeachers) !== null || numOrNull(s.femaleTeachers) !== null;
  return hasBreakdown
    ? num(s.maleTeachers) + num(s.femaleTeachers)
    : num(s.totalTeachers);
}

/** [school.totalStaff] Teaching + administrative + support staff. */
export function staffCount(s: SchoolFigures): number {
  return (
    teacherCount(s) +
    num(s.maleAdminStaff) +
    num(s.femaleAdminStaff) +
    num(s.maleSupportStaff) +
    num(s.femaleSupportStaff)
  );
}

/** [school.maleTeacherShare] % of teachers who are male; null without a gender breakdown. */
export function maleTeacherSharePct(s: SchoolFigures): number | null {
  const m = num(s.maleTeachers);
  const f = num(s.femaleTeachers);
  return m + f > 0 ? Math.round((m / (m + f)) * 100) : null;
}

/** [school.studentTeacherRatio] students ÷ teachers, 1 dp; null when no teachers. */
export function studentTeacherRatio(
  students: number,
  teachers: number,
): number | null {
  return teachers > 0 ? Math.round((students / teachers) * 10) / 10 : null;
}

/**
 * Inputs for capacity utilisation. Numerator and denominator must come from the
 * same source — the programme rows — so a school is only rated when its
 * programmes record both capacity and enrolment. Mixing programme capacity with
 * the school-level `totalStudents` column produced ratios like 125 % for a
 * school whose programmes simply hadn't recorded students yet.
 * null → not enough programme data to rate.
 */
export function capacityInputs(
  s: SchoolFigures,
): { students: number; capacity: number } | null {
  const programs = s.educationPrograms ?? [];
  const students = programs.reduce((a, p) => a + num(p?.totalStudents), 0);
  const capacity = programs.reduce((a, p) => a + num(p?.capacity), 0);
  return capacity > 0 && students > 0 ? { students, capacity } : null;
}

/** [school.capacityUtilisation] students ÷ capacity × 100, 1 dp; null when capacity unknown. */
export function capacityUtilisationPct(
  students: number,
  capacity: number,
): number | null {
  return capacity > 0 ? Math.round((students / capacity) * 1000) / 10 : null;
}

/**
 * [national.capacityUtilisation] Σ students ÷ Σ capacity × 100 (integer %),
 * over schools whose programmes record both capacity and enrolment
 * (`capacityInputs`). null when no school has
 * capacity data. Callers pass active, in-scope schools only.
 */
export function nationalCapacityUtilisation(
  schools: SchoolFigures[],
): number | null {
  let students = 0;
  let seats = 0;
  for (const s of schools) {
    const t = capacityInputs(s);
    if (t) {
      seats += t.capacity;
      students += t.students;
    }
  }
  return seats > 0 ? Math.round((students / seats) * 100) : null;
}

/**
 * [school.landArea] Land in hectares. total = used + unused (null when both
 * unknown); usedPct = used ÷ total × 100, 1 dp (null when total is 0/unknown).
 */
export function landSummary(s: SchoolFigures): {
  usedHa: number | null;
  unusedHa: number | null;
  totalHa: number | null;
  usedPct: number | null;
} {
  const usedHa = numOrNull(s.usedLandArea);
  const unusedHa = numOrNull(s.unusedLandArea);
  const totalHa =
    usedHa === null && unusedHa === null
      ? null
      : (usedHa ?? 0) + (unusedHa ?? 0);
  const usedPct =
    totalHa && totalHa > 0 && usedHa !== null
      ? Math.round((usedHa / totalHa) * 1000) / 10
      : null;
  return { usedHa, unusedHa, totalHa, usedPct };
}

/**
 * Ages (currentYear − yearBuilt) of buildings with a usable build year. A year
 * in the future or non-numeric is bad data and is dropped, never turned into a
 * negative age (which used to score as brand-new stock).
 */
export function buildingAges(
  buildings: Array<{ yearBuilt?: number | string | null }>,
  currentYear: number,
): number[] {
  return buildings
    .filter((b) => b.yearBuilt)
    .map((b) => currentYear - parseInt(String(b.yearBuilt), 10))
    .filter((a) => Number.isFinite(a) && a >= 0);
}

/**
 * [school.avgBuildingAge] Mean (currentYear − yearBuilt) over buildings that
 * record a usable build year, rounded to whole years; null when none do.
 * Callers pass ASSESSED buildings (`assessedBuildings`) so this matches the
 * Building Age component.
 */
export function averageBuildingAge(
  buildings: Array<{ yearBuilt?: number | string | null }>,
  currentYear: number,
): number | null {
  const ages = buildingAges(buildings, currentYear);
  return ages.length > 0
    ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
    : null;
}

/** Building fields that tell a real structural record from a bare stub. */
export interface BuildingSignals {
  condition?: string | null;
  roofCondition?: string | null;
  yearBuilt?: number | string | null;
  structuralScore?: number | string | null;
  areaSquareMeters?: number | string | null;
  floors?: number | string | null;
  buildingCode?: string | null;
  notes?: string | null;
  footprintGeojson?: unknown;
  lastInspectionDate?: Date | string | null;
}

/**
 * [school.assessedBuildings] Buildings that carry a real structural record.
 * A KMZ/GLB import or a name-only save leaves `condition` empty and every
 * inventory field null — that is not an inspection and must not feed the
 * infrastructure score, building age, risk, budget or completeness. Every
 * consumer uses this one rule.
 */
export function assessedBuildings<T extends BuildingSignals>(
  buildings: T[] | null | undefined,
): T[] {
  if (!buildings?.length) return [];
  // '' from a blank form field is "not recorded", not a signal.
  const has = (v: unknown) =>
    v !== null &&
    v !== undefined &&
    !(typeof v === 'string' && v.trim() === '');
  return buildings.filter(
    (b) =>
      has(b.condition) ||
      has(b.roofCondition) ||
      has(b.yearBuilt) ||
      has(b.structuralScore) ||
      has(b.areaSquareMeters) ||
      has(b.floors) ||
      has(b.buildingCode) ||
      has(b.notes) ||
      b.footprintGeojson != null ||
      has(b.lastInspectionDate),
  );
}

/**
 * [component.population] input check. A population record only counts as data
 * when it carries a positive school-age population: a 0 / null / non-numeric
 * value is what the ArcGIS sync wrote when the query returned no features, and
 * used to score as "maximum headroom" (100).
 */
export function measuredSchoolAgePopulation(
  row: { schoolAgePopulation2km?: number | string | null } | null | undefined,
): number | null {
  if (!row) return null;
  const n = numOrNull(row.schoolAgePopulation2km);
  return n !== null && n > 0 ? n : null;
}

/**
 * Which of the six score components were substituted with the neutral 50
 * because the input data is missing (WS1.7). `true` = estimated, not measured.
 * Computed by scoring-engine.ts (computeAssessment) — the only definition.
 */
export interface ComponentDataGaps {
  infrastructure: boolean;
  buildingAge: boolean;
  accessibility: boolean;
  population: boolean;
  facilityCompliance: boolean;
  resolution: boolean;
}
