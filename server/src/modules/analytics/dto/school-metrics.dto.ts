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
  // --- Metadata ---
  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  schoolCode: string;

  @ApiProperty({ description: 'ISO 8601 timestamp of when metrics were calculated' })
  calculatedAt: string;

  // --- Derived population/staff stats ---
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

  // --- Building stats ---
  @ApiProperty()
  buildingCount: number;

  @ApiPropertyOptional({ nullable: true, description: 'Average building age in years' })
  avgBuildingAge: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Average calendar year buildings were built' })
  avgBuildingYear: number | null;

  // --- Programs & land ---
  @ApiProperty()
  educationProgramsCount: number;

  @ApiPropertyOptional({ nullable: true })
  usedLandArea: number | null;

  @ApiPropertyOptional({ nullable: true })
  unusedLandArea: number | null;

  @ApiPropertyOptional({ nullable: true })
  roadStatusPercentage: number | null;

  // --- Assessment scores (0–100, higher = more at-risk/needs attention) ---
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

  // --- Decision data ---
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

  // --- Reporting summary ---
  @ApiProperty({ type: ReportSummaryDto })
  reportSummary: ReportSummaryDto;
}
