import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { BuildingCondition } from '../schools/entities/school-building.entity';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  MainDashboardDto,
  InfrastructureMetrics,
  MapSummary,
  FacilitiesSummary,
  UtilitiesSummary,
} from './dto/main-dashboard.dto';
import {
  ReportingDashboardDto,
  DecisionAssessmentSummary,
  AnalyticsMetrics,
  ReportingMetrics,
} from './dto/reporting-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolBuilding)
    private readonly buildingRepository: Repository<SchoolBuilding>,
    @InjectRepository(PopulationData)
    private readonly populationRepository: Repository<PopulationData>,
    private readonly reportsService: ReportsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async mainPayload(schoolId: string): Promise<MainDashboardDto> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: ['buildings', 'educationPrograms', 'populationData'],
    });
    if (!school) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }

    const buildings: any[] = school.buildings || [];
    const now = new Date().getFullYear();

    // Infrastructure health: map physical condition to numeric score and average
    const conditionMap: Record<string, number> = {
      [BuildingCondition.CRITICAL]: 90,
      [BuildingCondition.POOR]: 70,
      [BuildingCondition.FAIR]: 40,
      [BuildingCondition.GOOD]: 15,
    };
    const healthSum = buildings.reduce(
      (acc, b) => acc + (conditionMap[b.condition as string] ?? 0),
      0,
    );
    const healthIndex =
      buildings.length > 0 ? Math.round(healthSum / buildings.length) : 50;

    // Age score: based on average year built of buildings
    const ages = buildings
      .filter((b) => b.yearBuilt)
      .map((b) => now - Number(b.yearBuilt));
    const avgAge =
      ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
        : 0;
    // Use existing aging model to derive a score
    const ageScore = this.calculateAgeScore(
      buildings as any[],
      school.establishedYear,
    );

    // Maintenance due heuristic: if CPOR or last inspection older than 1 year (approx)
    const maintenanceDue = buildings.some((b) => {
      const isPoorOrBad =
        b.condition === BuildingCondition.POOR ||
        b.condition === BuildingCondition.CRITICAL;
      const lastInspect = b.lastInspectionDate
        ? new Date(b.lastInspectionDate).getTime()
        : 0;
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const outdated = lastInspect ? Date.now() - lastInspect > oneYear : false;
      return isPoorOrBad || outdated;
    });

    // Capacity utilization: total students / total capacity
    const totalStudents = (school.educationPrograms || []).reduce(
      (sum: number, p: any) => sum + (Number(p.totalStudents) || 0),
      0,
    );
    const totalCapacity = (school.educationPrograms || []).reduce(
      (sum: number, p: any) => sum + (Number(p.capacity) || 0),
      0,
    );
    const capacityUtilization =
      totalCapacity > 0 ? totalStudents / totalCapacity : 0;

    // GIS and facilities summary (best-effort from buildings)
    // Approximate campus area in km^2 if usedLandArea is available (assumes hectares)
    const areaKm2 =
      (school as any).usedLandArea != null
        ? Number((school as any).usedLandArea) * 0.01
        : 0;
    const featureCount = (buildings || []).length;
    const classrooms = buildings.filter((b: any) =>
      (b.function || '').toString().toLowerCase().includes('class'),
    ).length;
    const labs = buildings.filter((b: any) =>
      (b.function || '').toString().toLowerCase().includes('lab'),
    ).length;
    const dormitories = buildings.filter((b: any) =>
      (b.function || '').toString().toLowerCase().includes('dorm'),
    ).length;

    const infrastructure: InfrastructureMetrics = {
      healthIndex,
      ageScore,
      maintenanceDue,
      capacityUtilization,
    };
    const gis: MapSummary = { areaKm2, featureCount };
    const facilities: FacilitiesSummary = { classrooms, labs, dormitories };
    const utilities: UtilitiesSummary = {
      waterAvailability: true,
      powerReliability: 90,
    };

    return {
      timestamp: new Date().toISOString(),
      data: {
        infrastructure,
        gis,
        facilities,
        utilities,
      },
    };
  }

  async reportingPayload(schoolId: string): Promise<ReportingDashboardDto> {
    // Gather analytics-based metrics from the analytics module for this school
    const metrics = await this.analyticsService.getSchoolMetrics(schoolId);
    // Build decision assessment from analytics metrics
    const decisionAssessment: DecisionAssessmentSummary = {
      overallScore: metrics.overallScore,
      weightBreakdown: [
        { category: 'infrastructure', score: metrics.infrastructureScore },
        { category: 'building-age', score: metrics.buildingAgeScore },
        { category: 'population', score: metrics.populationPressureScore },
        { category: 'accessibility', score: metrics.accessibilityScore },
        { category: 'facility', score: metrics.facilityComplianceScore },
        { category: 'depreciation', score: metrics.depreciation },
      ],
    };

    // Initialize trends (fallbacks)
    const monthlyTrendsFromBackend: number[] = new Array(12).fill(0);
    const weeklyTrendsFromBackend: number[] = new Array(7).fill(0);

    // Analytics trends (from backend, if provided later). We'll start with backend-provided trends if present at metrics
    const analytics: AnalyticsMetrics = {
      trendScore: 0,
      perFeatureScores: [
        { feature: 'infrastructure', score: metrics.infrastructureScore },
        { feature: 'building-age', score: metrics.buildingAgeScore },
        { feature: 'population', score: metrics.populationPressureScore },
        { feature: 'accessibility', score: metrics.accessibilityScore },
        { feature: 'facility', score: metrics.facilityComplianceScore },
      ],
      trends: {
        monthly: monthlyTrendsFromBackend,
        weekly: weeklyTrendsFromBackend,
      },
    };

    // Reports summary (dynamic, pulled from Reports module)
    let lastReportDate = '';
    let generatedReportCount = metrics.reportSummary?.total ?? 0;
    let computedAvgResolutionTime = 0;
    let monthlyTrendsBack: number[] = new Array(12).fill(0);
    let weeklyTrendsBack: number[] = new Array(7).fill(0);
    // category counts from report categories
    const categoryKeys = [
      'infrastructure',
      'safety',
      'maintenance',
      'academic',
      'other',
    ];
    const categoriesCounts: Record<string, number> = {
      infrastructure: 0,
      safety: 0,
      maintenance: 0,
      academic: 0,
      other: 0,
    };

    // Status counts
    const statusCounts = {
      pending: 0,
      needIntervention: 0,
      solved: 0,
      failed: 0,
    };

    try {
      const resp = await this.reportsService.findAll({
        schoolId,
        page: 1,
        limit: 1000,
      });
      const reportsList = resp.data || [];
      if (reportsList.length > 0) {
        const latest = reportsList
          .slice()
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];
        lastReportDate = latest?.createdAt
          ? new Date(latest.createdAt).toISOString()
          : '';
        generatedReportCount = resp.total ?? reportsList.length;
        const nowDate = new Date();
        reportsList.forEach((r: any) => {
          const d = new Date(r.createdAt);
          const diffMonths =
            (nowDate.getFullYear() - d.getFullYear()) * 12 +
            (nowDate.getMonth() - d.getMonth());
          if (diffMonths >= 0 && diffMonths < 12) {
            monthlyTrendsBack[11 - diffMonths] += 1;
          }
          const diffDays = Math.floor(
            (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays >= 0 && diffDays < 7) {
            weeklyTrendsBack[6 - diffDays] += 1;
          }

          // Count by status
          const status = r.status?.toUpperCase();
          if (status === 'PENDING') {
            statusCounts.pending += 1;
          } else if (status === 'NEED_INTERVENTION') {
            statusCounts.needIntervention += 1;
          } else if (status === 'SOLVED') {
            statusCounts.solved += 1;
          } else if (status === 'FAILED') {
            statusCounts.failed += 1;
          }

          try {
            const cr = new Date(r.createdAt).getTime();
            const up = new Date(r.updatedAt).getTime();
            if (cr && up) {
              computedAvgResolutionTime += (up - cr) / (1000 * 60 * 60 * 24);
            }
          } catch {
            // ignore
          }
          // accumulate category counts from report's issueCategory
          const cats = Array.isArray((r as any).issueCategory)
            ? (r as any).issueCategory
            : [];
          cats.forEach((cat: string) => {
            const lower = String(cat).toLowerCase();
            if (categoryKeys.includes(lower)) {
              categoriesCounts[lower] = (categoriesCounts[lower] ?? 0) + 1;
            }
          });
        });
        if (reportsList.length > 0)
          computedAvgResolutionTime =
            computedAvgResolutionTime / reportsList.length;
      }
    } catch {
      // ignore
    }

    const reports: ReportingMetrics = {
      generatedReportCount,
      lastReportDate,
      avgResolutionTime: computedAvgResolutionTime,
      trends: {
        monthly: monthlyTrendsBack,
        weekly: weeklyTrendsBack,
      },
      categories: {
        infrastructure: categoriesCounts.infrastructure,
        safety: categoriesCounts.safety,
        maintenance: categoriesCounts.maintenance,
        academic: categoriesCounts.academic,
        other: categoriesCounts.other,
      },
      statusCounts,
    } as any;

    const dto: ReportingDashboardDto = {
      timestamp: new Date().toISOString(),
      data: {
        decisionAssessment,
        analytics,
        reports,
      },
    };
    return dto;
  }

  private calculateAgeScore(
    buildings: any[],
    establishedYear?: number,
  ): number {
    if (!buildings.length) return 50;

    const currentYear = new Date().getFullYear();
    const buildingAges = buildings
      .filter((b) => b.yearBuilt)
      .map((b) => currentYear - Number(b.yearBuilt));

    if (!buildingAges.length) return 50;

    const avgAge =
      buildingAges.reduce((sum, age) => sum + age, 0) / buildingAges.length;

    // Score based on average age: newer = better score
    // 0-10 years = 90-100, 10-20 years = 70-90, 20-30 years = 50-70, 30+ years = 30-50
    if (avgAge <= 10) return 95;
    if (avgAge <= 20) return 80;
    if (avgAge <= 30) return 60;
    return 40;
  }
}
