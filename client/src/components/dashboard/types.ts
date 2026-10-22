/**
 * Client types for the analytics payloads rendered by the dashboards.
 * Mirrors server/src/modules/analytics/dto/school-metrics.dto.ts and
 * AnalyticsService.getOverview(). Numeric columns may arrive as strings.
 */

export type Numeric = number | string | null | undefined;
export type PriorityKey = "critical" | "high" | "medium" | "low";

export interface ComponentDataGaps {
  infrastructure: boolean;
  buildingAge: boolean;
  accessibility: boolean;
  population: boolean;
  facilityCompliance: boolean;
  resolution: boolean;
}

export interface ReportSummary {
  total: number;
  critical: number;
  pending: number;
  resolved: number;
  failed: number;
  active: number;
  resolutionRate: number | null;
  avgResolutionDays: number | null;
  /** Age in days of the oldest open Issue Report; null when none are open. */
  oldestOpenDays?: number | null;
}

/** Scoring model served by the API — weights and bands are never hard-coded. */
export interface ScoringModel {
  version: number;
  weights: Record<
    | "infrastructure"
    | "buildingAge"
    | "accessibility"
    | "population"
    | "facilityCompliance"
    | "resolution",
    number
  >;
  bands: Record<PriorityKey, { min: number; max: number }>;
  neutral: number;
}

/** GET /schools/dashboard/reporting → data.reports (all server-computed, Kigali months). */
export interface ReportingData {
  summary: ReportSummary;
  months: Array<{ key: string; label: string; created: number; resolved: number }>;
  comparison: {
    current: { key: string; created: number; resolved: number };
    previous: { key: string; created: number; resolved: number };
    createdChangePct: number | null;
    resolvedChangePct: number | null;
  };
  categoryTags: Record<string, number>;
  statusCounts: { pending: number; needIntervention: number; solved: number; failed: number };
  lastReportDate: string | null;
  buildingsAttention: Array<{
    buildingId: string;
    name: string;
    yearBuilt: number | null;
    condition: string | null;
    pending: number;
    intervention: number;
    failed: number;
    lastReportAt: string | null;
    lastReporter: string | null;
    severity: "critical" | "high" | "medium";
  }>;
}

export interface SchoolMetrics {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  calculatedAt: string;
  totalStudents: number;
  totalCapacity: number;
  capacityUtilisation: number | null;
  totalTeachers: number;
  totalStaff: number;
  maleTeacherShare: number | null;
  studentToTeacherRatio: number | null;
  buildingCount: number;
  /** Buildings with a real structural record; only these feed the score. */
  assessedBuildingCount?: number;
  avgBuildingAge: number | null;
  avgBuildingYear: number | null;
  educationProgramsCount: number;
  usedLandArea: number | null;
  unusedLandArea: number | null;
  totalLandArea: number | null;
  usedLandPct: number | null;
  roadStatusPercentage: number | null;
  overallScore: number;
  infrastructureScore: number;
  buildingAgeScore: number;
  accessibilityScore: number;
  populationPressureScore: number;
  facilityComplianceScore: number;
  resolutionRateScore: number | null;
  hasInfraDataGap: boolean | null;
  hasPopDataGap: boolean | null;
  dataGaps?: ComponentDataGaps;
  /** Share of the score (0–1) from measured data. */
  dataCoverage?: number;
  /** True when no current assessment is stored and the score is display-only. */
  provisional?: boolean;
  scoringModel?: ScoringModel;
  priorityLevel: PriorityKey;
  urgencyMonths: number | null;
  recommendations: string[];
  primaryRecommendation: string | null;
  estimatedBudgetRwf: number | null;
  scoreDeltaFromDistrict: number | null;
  scoreDeltaFromProvince?: number | null;
  /** Other scored active schools behind each benchmark (needs ≥ 3). */
  districtPeerCount?: number;
  provincePeerCount?: number;

  dataCompletenessScore: number;
  reportSummary: ReportSummary;
  riskAssessment?: RiskAssessmentData;
}

export interface ProvinceStat {
  province: string;
  total: number;
  /** Schools with an assessment. */
  scored?: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  /** null when the province has no scored schools. */
  avgScore: number | null;
}

export interface HierarchyItem {
  label: string;
  total: number;
  scored?: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  /** null when nothing in the group is scored. */
  avgScore: number | null;
}

export interface NationalOverview {
  totalSchools: number;
  nationalAvgScore: Numeric;
  scoredSchoolCount: number;
  nationalAvgInfraScore: Numeric;
  nationalAvgPopScore: Numeric;
  nationalAvgAgeScore: Numeric;
  nationalAvgAccessScore: Numeric;
  nationalAvgComplianceScore: Numeric;
  nationalAvgResolutionScore?: Numeric;
  /** Mean data coverage (0–1) of scored schools. */
  avgDataCoverage?: Numeric;
  nationalCapacityUtilisation: Numeric;
  dataGaps?: {
    scoredSchools: number;
    infrastructure: number;
    population: number;
    buildingAge?: number;
    accessibility?: number;
    facilityCompliance?: number;
    resolution?: number;
  };
  totalStudents: Numeric;
  totalTeachers: Numeric;
  kmzCoverageRate: Numeric;
  surveyCompletionRate: Numeric;
  totalEstimatedBudgetRwf: Numeric;
  lastCalculatedAt: string | null;
  byPriority: Partial<Record<PriorityKey | "unassessed", number>>;
  provinceStats: ProvinceStat[];
  nationalRecommendations: string[];
  scoringModel?: ScoringModel;
}

/** "unknown" = the factor's input data is missing. */
export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

/** Shape of `riskAssessment` from GET /analytics/schools/:id/metrics (server: risk-assessment.ts). */
export interface RiskAssessmentData {
  indicative: true;
  impactScore: number;
  probabilityScore: number;
  overall: { score: number; level: RiskLevel; rule: string };
  factors: Array<{
    id: string;
    title: string;
    level: RiskLevel;
    impact: number;
    probability: number;
    riskScore: number;
    /** false → nothing observed / no data; excluded from the overall risk. */
    applies?: boolean;
    mitigation: string;
    timeline: string;
    owner: string;
    rule: string;
  }>;
  strategies: Array<{
    id: string;
    title: string;
    priority: "immediate" | "short-term" | "long-term";
    cost: "low" | "medium" | "high";
    effectiveness: number;
    description: string;
    rule: string;
  }>;
  rules: { impact: string; probability: string };
}

/** Building fields the dashboard reads (GET /schools/:id → buildings[]). */
export interface FacilityBuilding {
  id: string;
  name?: string | null;
  function?: string | null;
  condition?: string | null;
  roofCondition?: string | null;
  yearBuilt?: number | string | null;
  floors?: number | string | null;
  areaSquareMeters?: number | string | null;
  structuralScore?: number | string | null;
  lastInspectionDate?: string | null;
}
