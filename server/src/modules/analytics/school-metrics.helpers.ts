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

/** [school.capacityUtilisation] students ÷ capacity × 100, 1 dp; null when capacity unknown. */
export function capacityUtilisationPct(
  students: number,
  capacity: number,
): number | null {
  return capacity > 0 ? Math.round((students / capacity) * 1000) / 10 : null;
}

/**
 * [national.capacityUtilisation] Σ students ÷ Σ capacity × 100 (integer %),
 * over schools with programme capacity > 0 only. null when no school has
 * capacity data. Callers pass active, in-scope schools only.
 */
export function nationalCapacityUtilisation(
  schools: SchoolFigures[],
): number | null {
  let students = 0;
  let seats = 0;
  for (const s of schools) {
    const t = programmeTotals(s);
    if (t.capacity > 0) {
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
 * [school.avgBuildingAge] Mean (currentYear − yearBuilt) over buildings that
 * record a build year, rounded to whole years; null when none do.
 */
export function averageBuildingAge(
  buildings: Array<{ yearBuilt?: number | string | null }>,
  currentYear: number,
): number | null {
  const ages = buildings
    .filter((b) => b.yearBuilt)
    .map((b) => currentYear - parseInt(String(b.yearBuilt), 10))
    .filter((a) => Number.isFinite(a));
  return ages.length > 0
    ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
    : null;
}

/**
 * Which of the six score components were substituted with the neutral 50
 * because the input data is missing (WS1.7). `true` = estimated, not measured.
 */
export interface ComponentDataGaps {
  infrastructure: boolean;
  buildingAge: boolean;
  accessibility: boolean;
  population: boolean;
  facilityCompliance: boolean;
  resolution: boolean;
}

export function computeDataGaps(input: {
  assessedBuildingCount: number;
  buildingsWithYearCount: number;
  establishedYear: number | string | null | undefined;
  roadStatusPercentage: number | string | null | undefined;
  hasPopulationData: boolean;
  surveyCount: number;
  reportCount: number;
}): ComponentDataGaps {
  return {
    infrastructure: input.assessedBuildingCount === 0,
    buildingAge:
      input.buildingsWithYearCount === 0 && !numOrNull(input.establishedYear),
    accessibility: numOrNull(input.roadStatusPercentage) === null,
    population: !input.hasPopulationData,
    facilityCompliance: input.surveyCount === 0,
    resolution: input.reportCount === 0,
  };
}
