import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { BuildingCondition } from '../schools/entities/school-building.entity';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { MainDashboardDto, InfrastructureMetrics, MapSummary, FacilitiesSummary, UtilitiesSummary } from './dto/main-dashboard.dto';
import { ReportingDashboardDto, DecisionAssessmentSummary, AnalyticsMetrics, ReportingMetrics } from './dto/reporting-dashboard.dto';

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
    const healthSum = buildings.reduce((acc, b) => acc + (conditionMap[b.condition as string] ?? 0), 0);
    const healthIndex = buildings.length > 0 ? Math.round(healthSum / buildings.length) : 50;

    // Age score: based on average year built of buildings
    const ages = buildings
      .filter((b) => b.yearBuilt)
      .map((b) => now - Number(b.yearBuilt));
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    // Use existing aging model to derive a score
    const ageScore = this.calculateAgeScore(buildings as any[], school.establishedYear);

    // Maintenance due heuristic: if CPOR or last inspection older than 1 year (approx)
    const maintenanceDue = buildings.some((b) => {
      const isPoorOrBad = b.condition === BuildingCondition.POOR || b.condition === BuildingCondition.CRITICAL;
      const lastInspect = b.lastInspectionDate ? new Date(b.lastInspectionDate).getTime() : 0;
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const outdated = lastInspect ? Date.now() - lastInspect > oneYear : false;
      return isPoorOrBad || outdated;
    });

    // Capacity utilization: total students / total capacity
    const totalStudents = (school.educationPrograms || []).reduce((sum: number, p: any) => sum + (Number(p.totalStudents) || 0), 0);
    const totalCapacity = (school.educationPrograms || []).reduce((sum: number, p: any) => sum + (Number(p.capacity) || 0), 0);
    const capacityUtilization = totalCapacity > 0 ? totalStudents / totalCapacity : 0;

    // GIS and facilities summary (best-effort from buildings)
    // Approximate campus area in km^2 if usedLandArea is available (assumes hectares)
    const areaKm2 = (school as any).usedLandArea != null ? Number((school as any).usedLandArea) * 0.01 : 0;
    const featureCount = (buildings || []).length;
    const classrooms = buildings.filter((b: any) => ((b.function || '').toString().toLowerCase().includes('class'))).length;
    const labs = buildings.filter((b: any) => ((b.function || '').toString().toLowerCase().includes('lab'))).length;
    const dormitories = buildings.filter((b: any) => ((b.function || '').toString().toLowerCase().includes('dorm'))).length;

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
    // Build decision assessment summary from analytics metrics
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

    // Build analytics metrics with optional trends (monthly/weekly)
    const monthlyTrends: number[] = [];
    const weeklyTrends: number[] = [];
    // If you have historical data in metrics or can compute from reports, populate here.
    // For now, initialize with zeros of length 12 and 7 to keep UI consistent.
    for (let i = 0; i < 12; i++) monthlyTrends.push(0);
    for (let i = 0; i < 7; i++) weeklyTrends.push(0);

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
        monthly: monthlyTrends,
        weekly: weeklyTrends,
      },
    };

    // Reports summary
    let lastReportDate = '';
    let generatedReportCount = metrics.reportSummary?.total ?? 0;
    try {
      const resp = await this.reportsService.findAll({ schoolId, page: 1, limit: 1 });
      if (resp.data && resp.data.length > 0) {
        lastReportDate = resp.data[0].createdAt?.toISOString?.() ?? '';
        generatedReportCount = resp.total;
      }
    } catch {
      // ignore and use defaults
    }
    const reports: ReportingMetrics = {
      generatedReportCount,
      lastReportDate,
    };

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
}
