/**
 * Client types for the analytics payloads rendered by the dashboards.
 * Mirrors server/src/modules/analytics/dto/school-metrics.dto.ts and
 * AnalyticsService.getOverview(). Numeric columns may arrive as strings.
 */
import type { RiskAssessmentData } from "./RiskAssessment";

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
  priorityLevel: PriorityKey;
  urgencyMonths: number | null;
  recommendations: string[];
  primaryRecommendation: string | null;
  estimatedBudgetRwf: number | null;
  scoreDeltaFromDistrict: number | null;
  dataCompletenessScore: number;
  reportSummary: ReportSummary;
  riskAssessment?: RiskAssessmentData;
}

export interface ProvinceStat {
  province: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
}

export interface HierarchyItem {
  label: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
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
  nationalCapacityUtilisation: Numeric;
  dataGaps?: { scoredSchools: number; infrastructure: number; population: number };
  totalStudents: Numeric;
  totalTeachers: Numeric;
  kmzCoverageRate: Numeric;
  surveyCompletionRate: Numeric;
  totalEstimatedBudgetRwf: Numeric;
  lastCalculatedAt: string | null;
  byPriority: Partial<Record<PriorityKey | "unassessed", number>>;
  provinceStats: ProvinceStat[];
  nationalRecommendations: string[];
}
