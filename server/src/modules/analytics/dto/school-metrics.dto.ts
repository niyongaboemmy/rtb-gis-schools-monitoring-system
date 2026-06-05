import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriorityLevel } from '../entities/decision-assessment.entity';

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

  @ApiProperty({ description: 'Reports with status NEED_INTERVENTION' })
  critical: number;

  @ApiProperty({ description: 'Reports with status PENDING' })
  pending: number;

  @ApiProperty({ description: 'Reports with status SOLVED' })
  resolved: number;

  @ApiProperty({ description: 'Reports with status FAILED' })
  failed: number;

  @ApiProperty({ type: [RecentReportDto] })
  recentCritical: RecentReportDto[];
}

export class SchoolMetricsDto {
  // ── Metadata ────────────────────────────────────────────────────────────────
  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  schoolCode: string;

  @ApiProperty({ description: 'ISO 8601 timestamp of when metrics were calculated' })
  calculatedAt: string;

  // ── Population / staff ───────────────────────────────────────────────────────
  @ApiProperty()
  totalStudents: number;

  @ApiProperty()
  totalCapacity: number;

  @ApiProperty()
  totalTeachers: number;

  @ApiProperty()
  totalStaff: number;

  @ApiProperty({ description: 'Percentage of male teachers (0–100)' })
  maleTeacherRatio: number;

  @ApiPropertyOptional({ nullable: true, description: 'Students per teaching staff (not all staff)' })
  studentToTeacherRatio: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Students per latrine unit' })
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

  @ApiPropertyOptional({ nullable: true, description: 'Average building age in years' })
  avgBuildingAge: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Average calendar year buildings were built' })
  avgBuildingYear: number | null;

  // ── School profile ───────────────────────────────────────────────────────────
  @ApiPropertyOptional({ nullable: true, description: 'Year the school was established' })
  establishedYear: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'School age in years from establishedYear' })
  schoolAge: number | null;

  // ── Programs & land ──────────────────────────────────────────────────────────
  @ApiProperty()
  educationProgramsCount: number;

  @ApiPropertyOptional({ nullable: true })
  usedLandArea: number | null;

  @ApiPropertyOptional({ nullable: true })
  unusedLandArea: number | null;

  @ApiPropertyOptional({ nullable: true })
  roadStatusPercentage: number | null;

  // ── Assessment scores (0–100) ────────────────────────────────────────────────
  @ApiProperty()
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

  @ApiProperty({ description: 'Depreciation percentage derived from buildingAgeScore (0–100)' })
  depreciation: number;

  @ApiPropertyOptional({ nullable: true, description: 'Issue resolution rate score (0–100), 50 = no reports' })
  resolutionRateScore: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'True when no building data exists (infra score defaulted to 0)' })
  hasInfraDataGap: boolean | null;

  @ApiPropertyOptional({ nullable: true, description: 'True when no population data exists (pop score defaulted to 50)' })
  hasPopDataGap: boolean | null;

  // ── Decision data ─────────────────────────────────────────────────────────────
  @ApiProperty({ enum: PriorityLevel })
  priorityLevel: PriorityLevel;

  @ApiPropertyOptional({ nullable: true, description: 'Months until intervention is recommended' })
  urgencyMonths: number | null;

  @ApiProperty({ type: [String] })
  recommendations: string[];

  @ApiPropertyOptional({ nullable: true })
  primaryRecommendation: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Estimated remediation budget in Rwandan Francs' })
  estimatedBudgetRwf: number | null;

  // ── Survey ────────────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ nullable: true, description: 'ISO 8601 date of most recent facility survey' })
  lastSurveyDate: string | null;

  // ── Peer benchmarking ─────────────────────────────────────────────────────────
  @ApiPropertyOptional({ nullable: true, description: 'Avg overallScore of other schools in same district' })
  districtAvgScore: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Avg overallScore of other schools in same province' })
  provinceAvgScore: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'This school minus district avg (positive = above peers)' })
  scoreDeltaFromDistrict: number | null;

  @ApiPropertyOptional({ nullable: true })
  scoreDeltaFromProvince: number | null;

  // ── Data quality ──────────────────────────────────────────────────────────────
  @ApiProperty({ minimum: 0, maximum: 100, description: '% of 10 key data fields that are populated' })
  dataCompletenessScore: number;

  @ApiPropertyOptional({ nullable: true, description: 'KMZ processing status for this school' })
  kmzStatus: string | null;

  // ── Risk matrix inputs ────────────────────────────────────────────────────────
  @ApiPropertyOptional({ nullable: true, description: 'Consequence severity score (0–100) for risk matrix' })
  riskImpactScore: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Failure likelihood score (0–100) for risk matrix' })
  riskProbabilityScore: number | null;

  // ── Reporting summary ─────────────────────────────────────────────────────────
  @ApiProperty({ type: ReportSummaryDto })
  reportSummary: ReportSummaryDto;
}
