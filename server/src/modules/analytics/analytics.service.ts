import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DecisionAssessment,
  PriorityLevel,
} from './entities/decision-assessment.entity';
import { School } from '../schools/entities/school.entity';
import {
  SchoolBuilding,
  BuildingCondition,
} from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import {
  SchoolFacilitySurvey,
  ComplianceLevel,
} from '../schools/entities/school-facility-survey.entity';
import { SchoolMetricsDto, ReportSummaryDto } from './dto/school-metrics.dto';
import { IssueReport, ReportStatus } from '../reports/entities/issue-report.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(DecisionAssessment)
    private readonly assessmentRepository: Repository<DecisionAssessment>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolBuilding)
    private readonly buildingRepository: Repository<SchoolBuilding>,
    @InjectRepository(PopulationData)
    private readonly populationRepository: Repository<PopulationData>,
    @InjectRepository(SchoolFacilitySurvey)
    private readonly surveyRepository: Repository<SchoolFacilitySurvey>,
    @InjectRepository(IssueReport)
    private readonly issueReportRepository: Repository<IssueReport>,
  ) {}

  async getOverview() {
    const [totalSchools, byPriority, criticalSchools, recentAssessments] =
      await Promise.all([
        this.schoolRepository.count(),
        this.schoolRepository
          .createQueryBuilder('s')
          .select('s.priorityLevel', 'priority')
          .addSelect('COUNT(*)', 'count')
          .groupBy('s.priorityLevel')
          .getRawMany(),
        this.schoolRepository.find({
          where: { priorityLevel: PriorityLevel.CRITICAL as any },
          take: 5,
          order: { overallScore: 'DESC' },
        }),
        this.assessmentRepository.find({
          relations: ['school'],
          take: 10,
          order: { createdAt: 'DESC' },
        }),
      ]);

    const provinceStats = await this.schoolRepository
      .createQueryBuilder('s')
      .select('s.province', 'province')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN s.priorityLevel = 'critical' THEN 1 ELSE 0 END)",
        'critical',
      )
      .addSelect(
        "SUM(CASE WHEN s.priorityLevel = 'high' THEN 1 ELSE 0 END)",
        'high',
      )
      .groupBy('s.province')
      .orderBy('total', 'DESC')
      .getRawMany();

    return {
      totalSchools,
      byPriority: byPriority.reduce(
        (acc, r) => ({
          ...acc,
          [r.priority || 'unassessed']: parseFloat(String(r.count)),
        }),
        {},
      ),
      criticalSchools,
      recentAssessments,
      provinceStats,
    };
  }

  async getDecisions(query?: { province?: string; priority?: string }) {
    const qb = this.assessmentRepository
      .createQueryBuilder('da')
      .leftJoinAndSelect('da.school', 'school')
      .orderBy('da.overallScore', 'DESC');

    if (query?.province)
      qb.andWhere('school.province = :province', { province: query.province });
    if (query?.priority)
      qb.andWhere('da.priorityLevel = :priority', { priority: query.priority });

    return qb.getMany();
  }

  async recalculateAllScores(): Promise<{ processed: number }> {
    const schools = await this.schoolRepository.find({
      relations: ['buildings', 'populationData'],
    });

    let processed = 0;
    for (const school of schools) {
      await this.calculateSchoolScore(school);
      processed++;
    }
    return { processed };
  }

  async getSchoolMetrics(schoolId: string): Promise<SchoolMetricsDto> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: ['buildings', 'populationData'],
    });

    if (!school) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }

    const assessment = await this.calculateSchoolScore(school);
    const facilityComplianceScore =
      await this.calculateFacilityComplianceScore(schoolId);

    const currentYear = new Date().getFullYear();
    const buildings = school.buildings ?? [];
    const programs = (school.educationPrograms as any[]) ?? [];

    const totalStudentsFromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
      0,
    );
    const totalCapacityFromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
      0,
    );
    const totalStudents =
      totalStudentsFromPrograms > 0
        ? totalStudentsFromPrograms
        : parseFloat(String(school.totalStudents)) || 0;
    const totalCapacity = totalCapacityFromPrograms;

    const maleTeachers = parseFloat(String(school.maleTeachers)) || 0;
    const femaleTeachers = parseFloat(String(school.femaleTeachers)) || 0;
    const totalTeachers = maleTeachers + femaleTeachers;
    const totalStaff =
      maleTeachers +
      femaleTeachers +
      (parseFloat(String(school.maleAdminStaff)) || 0) +
      (parseFloat(String(school.femaleAdminStaff)) || 0) +
      (parseFloat(String(school.maleSupportStaff)) || 0) +
      (parseFloat(String(school.femaleSupportStaff)) || 0);
    const maleTeacherRatio =
      totalTeachers > 0 ? Math.round((maleTeachers / totalTeachers) * 100) : 0;

    const buildingsWithYear = buildings.filter((b) => b.yearBuilt);
    const ages = buildingsWithYear.map(
      (b) => currentYear - parseFloat(String(b.yearBuilt)),
    );
    const avgBuildingAge =
      ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
        : null;
    const avgBuildingYear =
      avgBuildingAge !== null ? currentYear - avgBuildingAge : null;

    const ageScore = parseFloat(String(assessment.buildingAgeScore));
    const depreciation = Math.min(
      100,
      Math.max(5, Math.round(100 - ageScore)),
    );

    const dto = new SchoolMetricsDto();
    dto.schoolId = school.id;
    dto.schoolName = school.name;
    dto.schoolCode = school.code;
    dto.calculatedAt = new Date().toISOString();

    dto.totalStudents = totalStudents;
    dto.totalCapacity = totalCapacity;
    dto.totalTeachers = totalTeachers;
    dto.totalStaff = totalStaff;
    dto.maleTeacherRatio = maleTeacherRatio;

    dto.buildingCount = buildings.length;
    dto.avgBuildingAge = avgBuildingAge;
    dto.avgBuildingYear = avgBuildingYear;

    dto.educationProgramsCount = programs.length;
    dto.usedLandArea =
      school.usedLandArea != null
        ? parseFloat(String(school.usedLandArea))
        : null;
    dto.unusedLandArea =
      school.unusedLandArea != null
        ? parseFloat(String(school.unusedLandArea))
        : null;
    dto.roadStatusPercentage = school.roadStatusPercentage ?? null;

    dto.overallScore = parseFloat(String(assessment.overallScore));
    dto.infrastructureScore = parseFloat(String(assessment.infrastructureScore));
    dto.buildingAgeScore = ageScore;
    dto.accessibilityScore = parseFloat(String(assessment.accessibilityScore));
    dto.populationPressureScore = parseFloat(
      String(assessment.populationPressureScore),
    );
    dto.facilityComplianceScore = facilityComplianceScore;
    dto.depreciation = depreciation;

    dto.priorityLevel = assessment.priorityLevel;
    dto.urgencyMonths = assessment.urgencyMonths ?? null;
    dto.recommendations = assessment.recommendations ?? [];
    dto.primaryRecommendation = assessment.primaryRecommendation ?? null;
    dto.estimatedBudgetRwf =
      assessment.estimatedBudgetRwf != null
        ? parseFloat(String(assessment.estimatedBudgetRwf))
        : null;

    const allReports = await this.issueReportRepository.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
      take: 2000,
    });
    const reportSummary: ReportSummaryDto = {
      total: allReports.length,
      critical: allReports.filter(
        (r) => r.status === ReportStatus.NEED_INTERVENTION,
      ).length,
      pending: allReports.filter((r) => r.status === ReportStatus.PENDING)
        .length,
      resolved: allReports.filter((r) => r.status === ReportStatus.SOLVED)
        .length,
      failed: allReports.filter((r) => r.status === ReportStatus.FAILED).length,
      recentCritical: allReports
        .filter((r) => r.status === ReportStatus.NEED_INTERVENTION)
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          facilityId: r.facilityId,
          description: r.description,
          status: r.status,
          buildingId: r.buildingId,
          createdAt: r.createdAt.toISOString(),
        })),
    };
    dto.reportSummary = reportSummary;

    return dto;
  }

  async calculateSchoolScore(school: School): Promise<DecisionAssessment> {
    const buildings = school.buildings || [];
    const population = school.populationData?.[0];

    // Get facility survey compliance score
    const facilityScore = await this.calculateFacilityComplianceScore(
      school.id,
    );

    // Infrastructure score (30%) — based on building conditions
    const infraScore = this.calculateInfrastructureScore(buildings);

    // Building age score — newer average age = higher score (healthier asset base)
    const ageScore = this.calculateAgeScore(
      buildings,
      school.establishedYear != null
        ? Number(school.establishedYear)
        : undefined,
    );

    // Accessibility score — road status percentage (0–100, higher = better connectivity)
    const accessScore = Math.min(
      100,
      Math.max(0, parseFloat(String(school.roadStatusPercentage)) || 50),
    );

    const programs = (school.educationPrograms as any[]) ?? [];
    const studentsFromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
      0,
    );
    const totalStudents =
      studentsFromPrograms > 0
        ? studentsFromPrograms
        : parseFloat(String(school.totalStudents)) || 0;

    // Population pressure score — lower demographic pressure = higher score
    const popScore = this.calculatePopulationScore(population, totalStudents);

    // Global strength: simple equal-weight average of all 5 health dimensions
    const overallScore = Math.round(
      (facilityScore + infraScore + ageScore + accessScore + popScore) / 5,
    );

    const priorityLevel = this.scoreToPriorityLevel(overallScore);
    const recommendations = this.generateRecommendations(
      school,
      overallScore,
      infraScore,
      ageScore,
      popScore,
      facilityScore,
    );

    // Upsert
    const existing = await this.assessmentRepository.findOne({
      where: { schoolId: school.id },
    });

    const assessment = existing
      ? Object.assign(existing, {
          infrastructureScore: infraScore,
          buildingAgeScore: ageScore,
          accessibilityScore: accessScore,
          populationPressureScore: popScore,
          overallScore,
          priorityLevel,
          recommendations,
        })
      : this.assessmentRepository.create({
          schoolId: school.id,
          infrastructureScore: infraScore,
          buildingAgeScore: ageScore,
          accessibilityScore: accessScore,
          populationPressureScore: popScore,
          overallScore,
          priorityLevel,
          recommendations,
        });

    const saved = await this.assessmentRepository.save(assessment);

    // Update school priority
    await this.schoolRepository.update(school.id, {
      priorityLevel: priorityLevel as any,
      overallScore,
    });
    return saved;
  }

  private calculateInfrastructureScore(buildings: SchoolBuilding[]): number {
    if (!buildings || buildings.length === 0) return 50;
    // Higher = healthier infrastructure
    const conditionMap = {
      [BuildingCondition.GOOD]: 100,
      [BuildingCondition.FAIR]: 70,
      [BuildingCondition.POOR]: 40,
      [BuildingCondition.CRITICAL]: 10,
    };
    const avg =
      buildings.reduce((s, b) => s + (conditionMap[b.condition] ?? 50), 0) /
      buildings.length;
    return Math.round(avg);
  }

  private calculateAgeScore(
    buildings: SchoolBuilding[],
    establishedYear?: number,
  ): number {
    const currentYear = new Date().getFullYear();
    const buildingAges = buildings
      .filter((b) => b.yearBuilt)
      .map((b) => currentYear - Number(b.yearBuilt));

    let avgAge: number;
    if (buildingAges.length > 0) {
      avgAge =
        buildingAges.reduce((sum, age) => sum + age, 0) / buildingAges.length;
    } else if (establishedYear) {
      avgAge = currentYear - establishedYear;
    } else {
      return 50;
    }

    // Newer stock = higher score (aligned with infrastructure “health”)
    if (avgAge <= 10) return 95;
    if (avgAge <= 20) return 80;
    if (avgAge <= 30) return 60;
    return 40;
  }

  private calculatePopulationScore(
    population?: PopulationData,
    currentStudents?: number,
  ): number {
    if (!population) return 50;
    const capacity = currentStudents || 300;
    const demand = parseFloat(String(population.schoolAgePopulation2km || 0));
    const ratio = demand / capacity;
    // Higher = lower demographic pressure (more capacity headroom = healthier)
    if (ratio >= 5) return 10;
    if (ratio >= 3) return 30;
    if (ratio >= 2) return 50;
    if (ratio >= 1) return 70;
    return 100;
  }

  private scoreToPriorityLevel(score: number): PriorityLevel {
    // Low health score = needs more attention = higher priority
    if (score < 35) return PriorityLevel.CRITICAL;
    if (score < 55) return PriorityLevel.HIGH;
    if (score < 75) return PriorityLevel.MEDIUM;
    return PriorityLevel.LOW;
  }

  private generateRecommendations(
    school: School,
    overall: number,
    infra: number,
    age: number,
    pop: number,
    facility: number,
  ): string[] {
    const recs: string[] = [];
    const buildings = school.buildings || [];
    const programs = school.educationPrograms ?? [];
    const totalCapacity =
      programs.reduce(
        (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
        0,
      ) || 0;
    const totalStudentsFromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
      0,
    );
    const totalStudents =
      totalStudentsFromPrograms > 0
        ? totalStudentsFromPrograms
        : parseFloat(String(school.totalStudents)) || 0;

    // 1. Structural & Safety (High Urgency)
    const criticalBuildings = buildings.filter(
      (b) =>
        b.condition === BuildingCondition.CRITICAL ||
        b.condition === BuildingCondition.POOR,
    );
    if (criticalBuildings.length > 0) {
      recs.push(
        `[URGENT] Structural renovation required for ${criticalBuildings.length} building(s) in poor/critical condition.`,
      );
    }

    // 2. Capacity & Overcrowding (Critical)
    if (totalCapacity > 0 && totalStudents > totalCapacity * 1.1) {
      const excess = totalStudents - totalCapacity;
      const classroomsNeeded = Math.ceil(excess / 40); // Assuming 40 students per classroom
      recs.push(
        `[CRITICAL] School is over capacity by ${Math.round((totalStudents / totalCapacity - 1) * 100)}%. Recommended addition of ${classroomsNeeded} classrooms.`,
      );
    }

    if (recs.length === 0) {
      recs.push('Continue routine maintenance and monitoring.');
    }

    return recs;
  }

  private async calculateFacilityComplianceScore(
    schoolId: string,
  ): Promise<number> {
    const surveys = await this.surveyRepository.find({
      where: { schoolId },
    });

    if (surveys.length === 0) return 50; // Default if no surveys

    const complianceMap = {
      [ComplianceLevel.COMPLIANT]: 100,
      [ComplianceLevel.PARTIAL]: 50,
      [ComplianceLevel.NON_COMPLIANT]: 0,
    };

    const totalScore = surveys.reduce(
      (sum, survey) => sum + (complianceMap[survey.compliance] || 50),
      0,
    );

    return Math.round(totalScore / surveys.length);
  }
}
