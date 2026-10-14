import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriorityLevel } from '../entities/decision-assessment.entity';
import type {
  MitigationStrategy,
  RiskFactor,
  RiskLevel,
} from '../risk-assessment';

export class RecentReportDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  facilityId: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  buildingId: string | null;

  @ApiProperty()
  createdAt: string;
}

export class ReportSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty({ description: 'Issue Reports that Need Intervention' })
  critical: number;

  @ApiProperty({ description: 'Issue Reports that are Pending' })
  pending: number;

  @ApiProperty({ description: 'Issue Reports that are Resolved' })
  resolved: number;

  @ApiProperty({ description: 'Issue Reports whose repair Failed' })
  failed: number;

  @ApiProperty({
    description: 'Open Issue Reports = Pending + Needs Intervention + Failed',
  })
  active: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Resolution rate % = Resolved ÷ all Issue Reports × 100 (integer); null when there are no reports',
  })
  resolutionRate: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Mean days from report creation to resolution over reports with a resolution date; null when none',
  })
  avgResolutionDays: number | null;

  @ApiProperty({ type: [RecentReportDto] })
  recentCritical: RecentReportDto[];
}

/** Which score components used the neutral 50 because data is missing (WS1.7). */
export class ComponentDataGapsDto {
  @ApiProperty() infrastructure: boolean;
  @ApiProperty() buildingAge: boolean;
  @ApiProperty() accessibility: boolean;
  @ApiProperty() population: boolean;
  @ApiProperty() facilityCompliance: boolean;
  @ApiProperty() resolution: boolean;
}

/** Indicative risk heuristics — see analytics/risk-assessment.ts (WS1.5). */
export class RiskAssessmentDto {
  @ApiProperty({
    description: 'Always true: these are rules of thumb, not measurements',
  })
  indicative: true;
  @ApiProperty() impactScore: number;
  @ApiProperty() probabilityScore: number;
  @ApiProperty() overall: { score: number; level: RiskLevel; rule: string };
  @ApiProperty() factors: RiskFactor[];
  @ApiProperty() strategies: MitigationStrategy[];
  @ApiProperty() rules: { impact: string; probability: string };
}

export class SchoolMetricsDto {
  // ── Metadata ────────────────────────────────────────────────────────────────
  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  schoolCode: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp of when metrics were calculated',
  })
  calculatedAt: string;

  // ── Population / staff ───────────────────────────────────────────────────────
  @ApiProperty()
  totalStudents: number;

  @ApiProperty()
  totalCapacity: number;

  @ApiProperty({
    description:
      'Teaching staff: male + female teachers when recorded, else the totalTeachers field',
  })
  totalTeachers: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Enrolment ÷ capacity × 100 (1 dp); null when capacity is unknown',
  })
  capacityUtilisation: number | null;

  @ApiProperty()
  totalStaff: number;

  @ApiProperty({
    description:
      'Percentage of male teachers (0–100); 0 when no gender breakdown',
  })
  maleTeacherRatio: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Percentage of male teachers (0–100); null when no gender breakdown',
  })
  maleTeacherShare: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Students per teaching staff (not all staff)',
  })
  studentToTeacherRatio: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Students per latrine unit',
  })
  studentToLatrineRatio: number | null;

  @ApiPropertyOptional({ nullable: true })
  latrineCount: number | null;

  // ── Utilities & connectivity ─────────────────────────────────────────────────
  @ApiPropertyOptional({ nullable: true })
  hasElectricity: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  waterSourceType: string | null;

  @ApiPropertyOptional({ nullable: true })
  hasInternet: boolean | null;

  // ── Building stats ───────────────────────────────────────────────────────────
  @ApiProperty()
  buildingCount: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Average building age in years',
  })
  avgBuildingAge: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Average calendar year buildings were built',
  })
  avgBuildingYear: number | null;

  // ── School profile ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    nullable: true,
    description: 'Year the school was established',
  })
  establishedYear: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'School age in years from establishedYear',
  })
  schoolAge: number | null;

  // ── Programs & land ──────────────────────────────────────────────────────────
  @ApiProperty()
  educationProgramsCount: number;

  @ApiPropertyOptional({ nullable: true, description: 'Used land, hectares' })
  usedLandArea: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Unused land, hectares' })
  unusedLandArea: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Used + unused land, hectares; null when both are unknown',
  })
  totalLandArea: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Used ÷ total land × 100 (1 dp)',
  })
  usedLandPct: number | null;

  @ApiPropertyOptional({ nullable: true })
  roadStatusPercentage: number | null;

  // ── Assessment scores (0–100) ────────────────────────────────────────────────
  @ApiProperty({
    description:
      'School Condition Score (0–100, higher = better): the six-factor weighted composite',
  })
  overallScore: number;

  @ApiProperty()
  infrastructureScore: number;

  @ApiProperty()
  buildingAgeScore: number;

  @ApiProperty()
  accessibilityScore: number;

  @ApiProperty()
  populationPressureScore: number;

  @ApiProperty()
  facilityComplianceScore: number;

  @ApiProperty({
    deprecated: true,
    description:
      'Deprecated: 100 − Building Age Score (clamped 5–100). Not accounting depreciation; display buildingAgeScore instead.',
  })
  depreciation: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Issue resolution rate score (0–100), 50 = no reports',
  })
  resolutionRateScore: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'True when no assessed building data exists (infrastructure component defaulted to the neutral 50)',
  })
  hasInfraDataGap: boolean | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'True when no population data exists (pop score defaulted to 50)',
  })
  hasPopDataGap: boolean | null;

  // ── Decision data ─────────────────────────────────────────────────────────────
  @ApiProperty({ enum: PriorityLevel })
  priorityLevel: PriorityLevel;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Months until intervention is recommended',
  })
  urgencyMonths: number | null;

  @ApiProperty({ type: [String] })
  recommendations: string[];

  @ApiPropertyOptional({ nullable: true })
  primaryRecommendation: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Estimated remediation budget in Rwandan Francs',
  })
  estimatedBudgetRwf: number | null;

  // ── Survey ────────────────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    nullable: true,
    description: 'ISO 8601 date of most recent facility survey',
  })
  lastSurveyDate: string | null;

  // ── Peer benchmarking ─────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    nullable: true,
    description: 'Avg overallScore of other schools in same district',
  })
  districtAvgScore: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Avg overallScore of other schools in same province',
  })
  provinceAvgScore: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'This school minus district avg (positive = above peers)',
  })
  scoreDeltaFromDistrict: number | null;

  @ApiPropertyOptional({ nullable: true })
  scoreDeltaFromProvince: number | null;

  // ── Data quality ──────────────────────────────────────────────────────────────
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: '% of 10 key data fields that are populated',
  })
  dataCompletenessScore: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'KMZ processing status for this school',
  })
  kmzStatus: string | null;

  // ── Risk matrix inputs ────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    nullable: true,
    description: 'Consequence severity score (0–100) for risk matrix',
  })
  riskImpactScore: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Failure likelihood score (0–100) for risk matrix',
  })
  riskProbabilityScore: number | null;

  // ── Reporting summary ─────────────────────────────────────────────────────────
  @ApiProperty({ type: ReportSummaryDto })
  reportSummary: ReportSummaryDto;

  // ── Data gaps & indicative risk ──────────────────────────────────────────────
  @ApiProperty({
    type: ComponentDataGapsDto,
    description:
      'Per component: true when the neutral 50 was used because data is missing',
  })
  dataGaps: ComponentDataGapsDto;

  @ApiProperty({ type: RiskAssessmentDto })
  riskAssessment: RiskAssessmentDto;
}
