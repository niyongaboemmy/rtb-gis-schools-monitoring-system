import { Injectable } from '@nestjs/common';
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

  async calculateSchoolScore(school: School): Promise<DecisionAssessment> {
    const buildings = school.buildings || [];
    const population = school.populationData?.[0];

    // Get facility survey compliance score
    const facilityScore = await this.calculateFacilityComplianceScore(
      school.id,
    );

    // Infrastructure score (30%) — based on building conditions
    const infraScore = this.calculateInfrastructureScore(buildings);

    // Building age score (20%) — older buildings score higher (need more attention)
    const ageScore = this.calculateAgeScore(
      buildings,
      parseFloat(String(school.establishedYear)),
    );

    // Accessibility score (15%) — placeholder based on district
    const accessScore = Math.floor(Math.random() * 40) + 50;

    // Population pressure score (15%)
    const popScore = this.calculatePopulationScore(
      population,
      parseFloat(String(school.totalStudents)),
    );

    // Overall weighted score: facility(20%) + infra(30%) + age(20%) + access(15%) + pop(15%)
    const overallScore = Math.round(
      facilityScore * 0.2 +
        infraScore * 0.3 +
        ageScore * 0.2 +
        accessScore * 0.15 +
        popScore * 0.15,
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
    if (!buildings || buildings.length === 0) return 0;
    const conditionMap = {
      [BuildingCondition.CRITICAL]: 90,
      [BuildingCondition.POOR]: 70,
      [BuildingCondition.FAIR]: 40,
      [BuildingCondition.GOOD]: 15,
    };
    const avg =
      buildings.reduce((s, b) => s + (conditionMap[b.condition] || 0), 0) /
      buildings.length;
    return Math.round(avg);
  }

  private calculateAgeScore(
    buildings: SchoolBuilding[],
    establishedYear?: number,
  ): number {
    const currentYear = new Date().getFullYear();
    const year =
      establishedYear || parseFloat(String(buildings[0]?.yearBuilt)) || 2000;
    const age = currentYear - year;
    if (age >= 40) return 90;
    if (age >= 25) return 70;
    if (age >= 15) return 50;
    if (age >= 5) return 30;
    return 15;
  }

  private calculatePopulationScore(
    population?: PopulationData,
    currentStudents?: number,
  ): number {
    if (!population) return 50;
    const capacity = currentStudents || 300;
    const demand = parseFloat(String(population.schoolAgePopulation2km || 0));
    const ratio = demand / capacity;
    if (ratio >= 5) return 90;
    if (ratio >= 3) return 70;
    if (ratio >= 2) return 50;
    if (ratio >= 1) return 30;
    return 15;
  }

  private scoreToPriorityLevel(score: number): PriorityLevel {
    if (score >= 75) return PriorityLevel.CRITICAL;
    if (score >= 55) return PriorityLevel.HIGH;
    if (score >= 35) return PriorityLevel.MEDIUM;
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
    const totalCapacity =
      school.educationPrograms?.reduce(
        (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
        0,
      ) || 0;
    const totalStudents = parseFloat(String(school.totalStudents)) || 0;

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
