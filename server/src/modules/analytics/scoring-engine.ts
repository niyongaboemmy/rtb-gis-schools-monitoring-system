/**
 * scoring-engine.ts
 *
 * The School Condition Score as ONE pure function: inputs in, assessment out.
 * No repositories, no clock reads (the caller passes `now`), no side effects —
 * so the same code scores a school for persistence, for a read-only preview
 * and for `scripts/verify-dashboards.ts`' stale-assessment check.
 *
 * Weights, bands and maps live in scoring.constants.ts; formulas are
 * documented in docs/METRIC_DICTIONARY.md.
 */
import { BuildingCondition } from '../schools/entities/school-building.entity';
import { ComplianceLevel } from '../schools/entities/school-facility-survey.entity';
import {
  ReportStatus,
  ReportType,
} from '../reports/entities/issue-report.entity';
import { PriorityLevel } from './entities/decision-assessment.entity';
import {
  CONDITION_SCORE_MAP,
  COMPLIANCE_SCORE_MAP,
  DEFAULT_CATCHMENT_CAPACITY,
  NEUTRAL_SCORE,
  RESOLUTION_MIN_REPORTS,
  RESOLUTION_SLA_DAYS,
  SCORING_VERSION,
  ageToScore,
  clamp0to100,
  computeCoverage,
  computeOverallScore,
  demandRatioToScore,
  scoreToPriorityLevel,
  urgencyMonthsFromScore,
} from './scoring.constants';
import {
  BuildingSignals,
  ComponentDataGaps,
  assessedBuildings,
  buildingAges,
  measuredSchoolAgePopulation,
  programmeTotals,
} from './school-metrics.helpers';

const DAY_MS = 86_400_000;

export interface ScoringBuilding extends BuildingSignals {
  condition?: BuildingCondition | string | null;
}

export interface ScoringSchool {
  id: string;
  buildings?: ScoringBuilding[] | null;
  educationPrograms?: Array<{
    totalStudents?: number | string | null;
    capacity?: number | string | null;
  }> | null;
  totalStudents?: number | string | null;
  establishedYear?: number | string | null;
  roadStatusPercentage?: number | string | null;
}

export interface ScoringReport {
  status: ReportStatus;
  /** Missing on rows created before change requests existed → an issue. */
  type?: string | null;
  createdAt: Date | string;
}

export interface ScoringInputs {
  school: ScoringSchool;
  /** Latest population record for the school, or null. */
  population: { schoolAgePopulation2km?: number | string | null } | null;
  /** One row per surveyed facility item (unique per school/facility/item). */
  surveys: Array<{ compliance: ComplianceLevel | string }>;
  /** Every report for the school; the engine filters to Issue Reports. */
  reports: ScoringReport[];
  now: Date;
}

export interface AssessmentResult {
  scoringVersion: number;
  infrastructureScore: number;
  buildingAgeScore: number;
  accessibilityScore: number;
  populationPressureScore: number;
  facilityComplianceScore: number;
  resolutionRateScore: number;
  overallScore: number;
  priorityLevel: PriorityLevel;
  urgencyMonths: number;
  dataGaps: ComponentDataGaps;
  /** Summed weight of measured components, 0–1. */
  dataCoverage: number;
  hasInfraDataGap: boolean;
  hasPopDataGap: boolean;
  recommendations: string[];
  primaryRecommendation: string | null;
  estimatedBudgetRwf: number | null;
  /** Facts the score was built from (risk panel, budget, verifier). */
  basis: {
    buildingCount: number;
    assessedBuildingCount: number;
    poorOrCriticalBuildingCount: number;
    /** Mean age of assessed buildings with a usable build year. */
    avgBuildingAge: number | null;
    eligibleReports: number;
    solvedReports: number;
  };
}

/** True for an Issue Report (not a data change request). */
export const isIssueReport = (r: { type?: string | null }): boolean =>
  r.type == null || r.type === (ReportType.ISSUE as string);

/** [component.infrastructure] Mean condition score of assessed buildings. */
export function infrastructureScore(assessed: ScoringBuilding[]): {
  score: number;
  gap: boolean;
} {
  const rated = assessed.filter(
    (b) => b.condition != null && b.condition in CONDITION_SCORE_MAP,
  );
  if (rated.length === 0) return { score: NEUTRAL_SCORE, gap: true };
  const avg =
    rated.reduce(
      (s, b) => s + CONDITION_SCORE_MAP[b.condition as BuildingCondition],
      0,
    ) / rated.length;
  return { score: clamp0to100(Math.round(avg)), gap: false };
}

/**
 * [component.buildingAge] Mean age of assessed buildings with a usable build
 * year; falls back to the school's establishment year (a measured proxy).
 */
export function buildingAgeScore(
  assessed: ScoringBuilding[],
  establishedYear: number | string | null | undefined,
  currentYear: number,
): { score: number; gap: boolean; avgAge: number | null } {
  const ages = buildingAges(assessed, currentYear);
  if (ages.length > 0) {
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    return { score: ageToScore(avg), gap: false, avgAge: Math.round(avg) };
  }
  const est = parseInt(String(establishedYear ?? ''), 10);
  if (Number.isFinite(est) && est > 0 && est <= currentYear) {
    return { score: ageToScore(currentYear - est), gap: false, avgAge: null };
  }
  return { score: NEUTRAL_SCORE, gap: true, avgAge: null };
}

/** [component.accessibility] Road-status percentage, 0–100. */
export function accessibilityScore(
  roadStatusPercentage: number | string | null | undefined,
): { score: number; gap: boolean } {
  const n =
    roadStatusPercentage == null || roadStatusPercentage === ''
      ? NaN
      : Number(roadStatusPercentage);
  if (!Number.isFinite(n)) return { score: NEUTRAL_SCORE, gap: true };
  return { score: clamp0to100(n), gap: false };
}

/**
 * [component.population] Capacity headroom against the school-age population
 * within 2 km. Seat capacity = Σ programme capacity, else enrolment, else 300.
 */
export function populationScore(
  population: ScoringInputs['population'],
  school: ScoringSchool,
): { score: number; gap: boolean } {
  const demand = measuredSchoolAgePopulation(population);
  if (demand === null) return { score: NEUTRAL_SCORE, gap: true };
  const { students, capacity } = programmeTotals(school);
  const seats = capacity > 0 ? capacity : students;
  const denominator = Math.max(
    1,
    seats > 0 ? seats : DEFAULT_CATCHMENT_CAPACITY,
  );
  return { score: demandRatioToScore(demand / denominator), gap: false };
}

/** [component.facilityCompliance] Mean compliance over surveyed items. */
export function facilityComplianceScore(surveys: ScoringInputs['surveys']): {
  score: number;
  gap: boolean;
} {
  if (surveys.length === 0) return { score: NEUTRAL_SCORE, gap: true };
  const total = surveys.reduce(
    (sum, s) =>
      sum +
      (COMPLIANCE_SCORE_MAP[s.compliance as ComplianceLevel] ?? NEUTRAL_SCORE),
    0,
  );
  return { score: Math.round(total / surveys.length), gap: false };
}

/**
 * [component.resolution] Share of ELIGIBLE Issue Reports that are solved.
 * Eligible = solved, or open for longer than RESOLUTION_SLA_DAYS. Data change
 * requests are not issues and never count. Fewer than RESOLUTION_MIN_REPORTS
 * eligible reports → neutral 50 + gap, so filing a report never lowers the
 * score before anyone has had time to act on it.
 */
export function resolutionScore(
  reports: ScoringReport[],
  now: Date,
): { score: number; gap: boolean; eligible: number; solved: number } {
  const cutoff = now.getTime() - RESOLUTION_SLA_DAYS * DAY_MS;
  let eligible = 0;
  let solved = 0;
  for (const r of reports) {
    if (!isIssueReport(r)) continue;
    if (r.status === ReportStatus.SOLVED) {
      eligible++;
      solved++;
    } else if (new Date(r.createdAt).getTime() <= cutoff) {
      eligible++;
    }
  }
  if (eligible < RESOLUTION_MIN_REPORTS) {
    return { score: NEUTRAL_SCORE, gap: true, eligible, solved };
  }
  return {
    score: Math.round((solved / eligible) * 100),
    gap: false,
    eligible,
    solved,
  };
}

/** Enrolment vs programme capacity (0 when either is unknown). */
function capacityGap(school: ScoringSchool) {
  const { students, capacity } = programmeTotals(school);
  const over =
    capacity > 0 && students > capacity * 1.1 ? students - capacity : 0;
  return {
    classroomsNeeded: over > 0 ? Math.ceil(over / 40) : 0, // 40 learners / classroom
    overCapacityPct:
      capacity > 0 ? Math.round((students / capacity - 1) * 100) : 0,
  };
}

interface RecContext {
  infra: number;
  age: number;
  access: number;
  pop: number;
  facility: number;
  resolution: number;
  gaps: ComponentDataGaps;
  poorOrCritical: number;
  classroomsNeeded: number;
  overCapacityPct: number;
}

/**
 * Severity-ordered, tagged recommendations. Every weak MEASURED sub-dimension
 * and every data gap produces an actionable line — an estimated (neutral)
 * component never triggers a "fix this" line, it triggers a "collect this" one.
 */
export function generateRecommendations(c: RecContext): string[] {
  const recs: string[] = [];
  const g = c.gaps;

  if (c.poorOrCritical > 0) {
    recs.push(
      `[URGENT] Structural renovation required for ${c.poorOrCritical} building(s) in poor/critical condition.`,
    );
  } else if (c.infra < 35 && !g.infrastructure) {
    recs.push(
      `[URGENT] Building stock scores ${Math.round(c.infra)}/100 — commission a structural safety audit.`,
    );
  }
  if (c.classroomsNeeded > 0) {
    recs.push(
      `[CRITICAL] Over capacity by ${c.overCapacityPct}% — add ${c.classroomsNeeded} classroom(s) or introduce shift scheduling.`,
    );
  }

  if (g.infrastructure) {
    recs.push(
      '[DATA] No assessed building-condition records on file — dispatch a facility survey / drone KMZ capture to enable accurate scoring.',
    );
  }
  if (g.population) {
    recs.push(
      '[DATA] Catchment demographic data unavailable — request an ArcGIS population pull for this sector.',
    );
  }
  if (g.accessibility) {
    recs.push(
      '[DATA] Road access not recorded — capture the road-status percentage on the school profile.',
    );
  }

  if (c.age < 45 && !g.buildingAge) {
    recs.push(
      `[PLAN] Ageing asset portfolio (age score ${Math.round(c.age)}/100) — budget for phased renewal.`,
    );
  }
  if (c.access < 45 && !g.accessibility) {
    recs.push(
      `[ACCESS] Poor road access (${Math.round(c.access)}/100) — coordinate all-season access works with RTDA / district.`,
    );
  }
  if (c.pop < 40 && !g.population) {
    recs.push(
      '[CAPACITY] Demographic pressure exceeds capacity headroom — begin an expansion feasibility study.',
    );
  }
  if (c.facility < 50 && !g.facilityCompliance) {
    recs.push(
      `[COMPLIANCE] Facility survey shows gaps (${Math.round(c.facility)}/100) — remediate WASH, safety and accessibility items.`,
    );
  }
  if (c.resolution < 50 && !g.resolution) {
    recs.push(
      '[OPERATIONS] Low issue-resolution rate — strengthen maintenance follow-through and close outstanding reports.',
    );
  }

  if (recs.length === 0) {
    recs.push(
      '[OK] All indicators within acceptable range — continue routine maintenance and monitoring.',
    );
  }
  return recs.slice(0, 6);
}

/**
 * Indicative rehabilitation budget in RWF. Not a bill of quantities — a
 * planning-grade estimate so the decision queue can be sorted/summed by cost.
 * Only measured weaknesses are costed; missing data costs a survey.
 */
export const BUDGET_UNITS_RWF = {
  criticalBlock: 45_000_000, // major rehab of a poor/critical block
  ageingBlock: 12_000_000, // renewal contribution per block
  survey: 3_500_000, // facility survey + KMZ capture
  classroom: 18_000_000, // one new classroom
  access: 20_000_000, // all-season access works
  compliance: 8_000_000, // WASH / safety remediation package
} as const;

export function estimateBudgetRwf(
  c: RecContext & { assessedCount: number },
): number | null {
  const U = BUDGET_UNITS_RWF;
  let budget = c.poorOrCritical * U.criticalBlock;
  if (c.gaps.infrastructure) budget += U.survey;
  if (c.age < 40 && !c.gaps.buildingAge && c.assessedCount > 0)
    budget += c.assessedCount * U.ageingBlock;
  budget += c.classroomsNeeded * U.classroom;
  if (c.access < 45 && !c.gaps.accessibility) budget += U.access;
  if (c.facility < 50 && !c.gaps.facilityCompliance) budget += U.compliance;
  return budget > 0 ? budget : null;
}

/** Score one school. Pure: same inputs → same assessment. */
export function computeAssessment(i: ScoringInputs): AssessmentResult {
  const currentYear = i.now.getFullYear();
  const buildings = i.school.buildings ?? [];
  const assessed = assessedBuildings(buildings);

  const infra = infrastructureScore(assessed);
  const age = buildingAgeScore(assessed, i.school.establishedYear, currentYear);
  const access = accessibilityScore(i.school.roadStatusPercentage);
  const pop = populationScore(i.population, i.school);
  const facility = facilityComplianceScore(i.surveys);
  const resolution = resolutionScore(i.reports, i.now);

  const dataGaps: ComponentDataGaps = {
    infrastructure: infra.gap,
    buildingAge: age.gap,
    accessibility: access.gap,
    population: pop.gap,
    facilityCompliance: facility.gap,
    resolution: resolution.gap,
  };

  const overallScore = computeOverallScore({
    infrastructure: infra.score,
    buildingAge: age.score,
    accessibility: access.score,
    population: pop.score,
    facilityCompliance: facility.score,
    resolution: resolution.score,
  });

  const poorOrCritical = assessed.filter(
    (b) =>
      b.condition === BuildingCondition.POOR ||
      b.condition === BuildingCondition.CRITICAL,
  ).length;
  const cap = capacityGap(i.school);
  const ctx: RecContext = {
    infra: infra.score,
    age: age.score,
    access: access.score,
    pop: pop.score,
    facility: facility.score,
    resolution: resolution.score,
    gaps: dataGaps,
    poorOrCritical,
    classroomsNeeded: cap.classroomsNeeded,
    overCapacityPct: cap.overCapacityPct,
  };
  const recommendations = generateRecommendations(ctx);

  return {
    scoringVersion: SCORING_VERSION,
    infrastructureScore: infra.score,
    buildingAgeScore: age.score,
    accessibilityScore: access.score,
    populationPressureScore: pop.score,
    facilityComplianceScore: facility.score,
    resolutionRateScore: resolution.score,
    overallScore,
    priorityLevel: scoreToPriorityLevel(overallScore),
    urgencyMonths: urgencyMonthsFromScore(overallScore),
    dataGaps,
    dataCoverage: computeCoverage(dataGaps),
    hasInfraDataGap: infra.gap,
    hasPopDataGap: pop.gap,
    recommendations,
    primaryRecommendation: recommendations[0] ?? null,
    estimatedBudgetRwf: estimateBudgetRwf({
      ...ctx,
      assessedCount: assessed.length,
    }),
    basis: {
      buildingCount: buildings.length,
      assessedBuildingCount: assessed.length,
      poorOrCriticalBuildingCount: poorOrCritical,
      avgBuildingAge: age.avgAge,
      eligibleReports: resolution.eligible,
      solvedReports: resolution.solved,
    },
  };
}

/** Fields persisted on `decision_assessments` (and compared for change). */
export const PERSISTED_SCORE_FIELDS = [
  'infrastructureScore',
  'buildingAgeScore',
  'accessibilityScore',
  'populationPressureScore',
  'facilityComplianceScore',
  'resolutionRateScore',
  'overallScore',
  'priorityLevel',
  'urgencyMonths',
  'hasInfraDataGap',
  'hasPopDataGap',
  'dataCoverage',
  'scoringVersion',
  'estimatedBudgetRwf',
] as const;

/** Normalise a stored/computed value: pg decimals arrive as strings. */
const norm = (v: unknown): unknown => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
    return Number(v);
  return v;
};

/** True when a stored assessment differs from a freshly computed one. */
export function assessmentChanged(
  stored: Record<string, unknown> | null | undefined,
  next: AssessmentResult,
): boolean {
  if (!stored) return true;
  const n = next as unknown as Record<string, unknown>;
  for (const k of PERSISTED_SCORE_FIELDS) {
    if (norm(stored[k]) !== norm(n[k])) return true;
  }
  // jsonb does not preserve key order — compare the gap flags key by key.
  const gaps = (stored.dataGaps ?? null) as Record<string, unknown> | null;
  if (
    !gaps ||
    (Object.keys(next.dataGaps) as Array<keyof ComponentDataGaps>).some(
      (k) => gaps[k] !== next.dataGaps[k],
    )
  )
    return true;
  return (
    JSON.stringify(stored.recommendations ?? null) !==
    JSON.stringify(next.recommendations)
  );
}
