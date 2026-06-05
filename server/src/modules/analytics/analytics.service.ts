import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  DecisionAssessment,
  PriorityLevel,
} from './entities/decision-assessment.entity';
import { ScoreHistory } from './entities/score-history.entity';
import { RecommendationAction, ActionStatus } from './entities/recommendation-action.entity';
import { School, KmzProcessingStatus } from '../schools/entities/school.entity';
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
import { AuditService, AuditActor } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(DecisionAssessment)
    private readonly assessmentRepository: Repository<DecisionAssessment>,
    @InjectRepository(ScoreHistory)
    private readonly scoreHistoryRepository: Repository<ScoreHistory>,
    @InjectRepository(RecommendationAction)
    private readonly actionRepository: Repository<RecommendationAction>,
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
    private readonly auditService: AuditService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async getOverview() {
    // Run all aggregate queries in parallel — each raw result is parsed immediately
    // after the Promise.all because the pg driver returns numeric columns as strings.
    const [
      totalSchools,
      byPriority,
      criticalSchools,
      recentAssessments,
      scoreAvgResult,
      studentsResult,
      teachersResult,
      kmzResult,
      surveyResult,
      budgetResult,
      lastCalcResult,
      provinceStatsRaw,
    ] = await Promise.all([
      // 1. total school count
      this.schoolRepository.count(),

      // 2. counts per priority band
      this.schoolRepository
        .createQueryBuilder('s')
        .select('s.priorityLevel', 'priority')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.priorityLevel')
        .getRawMany(),

      // 3. critical schools spotlight (top 5)
      this.schoolRepository.find({
        where: { priorityLevel: PriorityLevel.CRITICAL as any },
        take: 5,
        order: { overallScore: 'DESC' },
      }),

      // 4. recent assessments feed — join on schoolId varchar (school_id FK is NULL)
      this.assessmentRepository
        .createQueryBuilder('da')
        .leftJoinAndMapOne(
          'da.school',
          'School',
          's',
          'CAST(s.id AS text) = da.schoolId',
        )
        .orderBy('da.createdAt', 'DESC')
        .take(10)
        .getMany(),

      // 5. national score sub-dimension averages — queried directly from
      //    assessmentRepository to avoid the broken dual-FK situation on
      //    decision_assessments (school_id FK is NULL; schoolId varchar has data).
      this.assessmentRepository
        .createQueryBuilder('da')
        .select('ROUND(AVG(da.overallScore)::numeric, 1)', 'nationalAvgScore')
        .addSelect('COUNT(da.id)', 'scoredCount')
        .addSelect(
          'ROUND(AVG(da.buildingAgeScore)::numeric, 1)',
          'nationalAvgAgeScore',
        )
        .addSelect(
          'ROUND(AVG(da.accessibilityScore)::numeric, 1)',
          'nationalAvgAccessScore',
        )
        .addSelect(
          'ROUND(AVG(da.facilityComplianceScore)::numeric, 1)',
          'nationalAvgComplianceScore',
        )
        .getRawOne(),

      // 6. total enrolled students (school-level roll-up)
      this.schoolRepository
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.totalStudents), 0)', 'totalStudents')
        .getRawOne(),

      // 7. total teaching staff — prefer gender breakdown when populated,
      //    fall back to s.totalTeachers (seed data only populates totalTeachers).
      this.schoolRepository
        .createQueryBuilder('s')
        .select(
          `COALESCE(SUM(CASE
            WHEN s.maleTeachers IS NOT NULL OR s.femaleTeachers IS NOT NULL
            THEN COALESCE(s.maleTeachers, 0) + COALESCE(s.femaleTeachers, 0)
            ELSE COALESCE(s.totalTeachers, 0)
          END), 0)`,
          'totalTeachers',
        )
        .getRawOne(),

      // 8. KMZ coverage — only COMPLETED uploads count as "mapped"
      this.schoolRepository
        .createQueryBuilder('s')
        .select('COUNT(*)', 'withKmz')
        .where('s.kmzStatus = :status', { status: KmzProcessingStatus.COMPLETED })
        .getRawOne(),

      // 9. survey coverage — distinct schools with ≥1 facility survey record
      this.surveyRepository
        .createQueryBuilder('sv')
        .select('COUNT(DISTINCT sv.schoolId)', 'withSurvey')
        .getRawOne(),

      // 10. total estimated rehabilitation budget
      this.assessmentRepository
        .createQueryBuilder('da')
        .select('COALESCE(SUM(da.estimatedBudgetRwf), 0)', 'totalBudget')
        .where('da.estimatedBudgetRwf IS NOT NULL')
        .getRawOne(),

      // 11. last recalculation timestamp (most recent assessment write)
      this.assessmentRepository
        .createQueryBuilder('da')
        .select('MAX(da.updatedAt)', 'lastCalculatedAt')
        .getRawOne(),

      // 12. province stats — all four priority bands + avg/min/max scores
      this.schoolRepository
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
        .addSelect(
          "SUM(CASE WHEN s.priorityLevel = 'medium' THEN 1 ELSE 0 END)",
          'medium',
        )
        .addSelect(
          "SUM(CASE WHEN s.priorityLevel = 'low' THEN 1 ELSE 0 END)",
          'low',
        )
        .addSelect('ROUND(AVG(s.overallScore)::numeric, 1)', 'avgScore')
        .addSelect('MIN(s.overallScore)', 'minScore')
        .addSelect('MAX(s.overallScore)', 'maxScore')
        .groupBy('s.province')
        .orderBy('total', 'DESC')
        .getRawMany(),
    ]);

    // ── Parse all raw results — pg driver returns numerics as strings ──────────

    const nationalAvgScore =
      parseFloat(String(scoreAvgResult?.nationalAvgScore)) || 0;
    const scoredSchoolCount =
      parseInt(String(scoreAvgResult?.scoredCount), 10) || 0;
    const nationalAvgAgeScore =
      parseFloat(String(scoreAvgResult?.nationalAvgAgeScore)) || 0;
    const nationalAvgAccessScore =
      parseFloat(String(scoreAvgResult?.nationalAvgAccessScore)) || 0;
    const nationalAvgComplianceScore =
      parseFloat(String(scoreAvgResult?.nationalAvgComplianceScore)) || 0;

    // SUM results come back as numeric strings; parseInt is correct for whole-number counts
    const totalStudents =
      parseInt(String(studentsResult?.totalStudents), 10) || 0;
    const totalTeachers =
      parseInt(String(teachersResult?.totalTeachers), 10) || 0;

    const withKmz    = parseInt(String(kmzResult?.withKmz),       10) || 0;
    const withSurvey = parseInt(String(surveyResult?.withSurvey), 10) || 0;

    // Coverage rates are percentages of total schools — guard against div/0
    const kmzCoverageRate =
      totalSchools > 0 ? Math.round((withKmz / totalSchools) * 100) : 0;
    const surveyCompletionRate =
      totalSchools > 0 ? Math.round((withSurvey / totalSchools) * 100) : 0;

    const totalEstimatedBudgetRwf =
      parseFloat(String(budgetResult?.totalBudget)) || 0;
    const lastCalculatedAt = lastCalcResult?.lastCalculatedAt ?? null;

    // Normalise province rows — every numeric field is a raw string from the driver
    const provinceStats = provinceStatsRaw.map((p) => ({
      province: p.province as string,
      total:    parseInt(String(p.total),    10) || 0,
      critical: parseInt(String(p.critical), 10) || 0,
      high:     parseInt(String(p.high),     10) || 0,
      medium:   parseInt(String(p.medium),   10) || 0,
      low:      parseInt(String(p.low),      10) || 0,
      avgScore: parseFloat(String(p.avgScore)) || 0,
      // minScore/maxScore can legitimately be null (province has no scored schools yet)
      minScore: p.minScore != null ? parseFloat(String(p.minScore)) : null,
      maxScore: p.maxScore != null ? parseFloat(String(p.maxScore)) : null,
    }));

    // Extract critical count before the reduce collapses the byPriority array
    const criticalRow   = byPriority.find((r) => r.priority === PriorityLevel.CRITICAL);
    const criticalCount = parseInt(String(criticalRow?.count), 10) || 0;

    const nationalRecommendations = this.generateNationalRecommendations(
      criticalCount,
      provinceStats,
    );

    return {
      totalSchools,
      nationalAvgScore,
      scoredSchoolCount,
      nationalAvgAgeScore,
      nationalAvgAccessScore,
      nationalAvgComplianceScore,
      totalStudents,
      totalTeachers,
      kmzCoverageRate,
      surveyCompletionRate,
      totalEstimatedBudgetRwf,
      lastCalculatedAt,
      byPriority: byPriority.reduce(
        (acc, r) => ({
          ...acc,
          [r.priority || 'unassessed']: parseInt(String(r.count), 10) || 0,
        }),
        {},
      ),
      criticalSchools,
      recentAssessments,
      provinceStats,
      nationalRecommendations,
    };
  }

  async exportNationalCsv(): Promise<string> {
    // Cannot use relations: ['school'] — the school_id FK column is NULL in existing
    // records (data is stored in the schoolId varchar column instead).
    // Fetch schools separately and build a lookup map.
    const [assessments, schools] = await Promise.all([
      this.assessmentRepository.find({ order: { overallScore: 'ASC' } }),
      this.schoolRepository.find(),
    ]);
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const header = [
      'Name',
      'Code',
      'Province',
      'District',
      'Overall Score',
      'Priority Level',
      'Infrastructure Score',
      'Building Age Score',
      'Accessibility Score',
      'Facility Compliance Score',
      'Total Students',
      'Urgency (months)',
      'Estimated Budget (RWF)',
      'Last Calculated',
    ].join(',');

    const rows = assessments.map((a) => {
      const s = schoolMap.get(a.schoolId);
      const safeName = `"${(s?.name ?? '').replace(/"/g, '""')}"`;
      return [
        safeName,
        s?.code ?? '',
        s?.province ?? '',
        s?.district ?? '',
        parseFloat(String(a.overallScore)).toFixed(0),
        a.priorityLevel ?? '',
        parseFloat(String(a.infrastructureScore)).toFixed(0),
        parseFloat(String(a.buildingAgeScore)).toFixed(0),
        parseFloat(String(a.accessibilityScore)).toFixed(0),
        parseFloat(String(a.facilityComplianceScore ?? 0)).toFixed(0),
        parseInt(String(s?.totalStudents ?? 0), 10),
        a.urgencyMonths ?? '',
        parseFloat(String(a.estimatedBudgetRwf ?? 0)).toFixed(0),
        a.updatedAt?.toISOString() ?? '',
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  // ── Score History ────────────────────────────────────────────────────────

  async getScoreHistory(schoolId: string, months = 12): Promise<ScoreHistory[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    return this.scoreHistoryRepository.find({
      where: { schoolId, recordedAt: MoreThanOrEqual(since) },
      order: { recordedAt: 'ASC' },
    });
  }

  // ── Hierarchy Drill-down ─────────────────────────────────────────────────

  async getHierarchy(province?: string, district?: string) {
    // Parse every raw numeric field — pg driver returns counts/averages as strings.
    const parseRow = (r: any, labelKey: string) => ({
      label:    r[labelKey] as string,
      total:    parseInt(String(r.total),    10) || 0,
      critical: parseInt(String(r.critical), 10) || 0,
      high:     parseInt(String(r.high),     10) || 0,
      medium:   parseInt(String(r.medium),   10) || 0,
      low:      parseInt(String(r.low),      10) || 0,
      avgScore: parseFloat(String(r.avgScore))   || 0,
    });

    const prioritySelects = (qb: any) =>
      qb
        .addSelect("SUM(CASE WHEN s.priorityLevel = 'critical' THEN 1 ELSE 0 END)", 'critical')
        .addSelect("SUM(CASE WHEN s.priorityLevel = 'high'     THEN 1 ELSE 0 END)", 'high')
        .addSelect("SUM(CASE WHEN s.priorityLevel = 'medium'   THEN 1 ELSE 0 END)", 'medium')
        .addSelect("SUM(CASE WHEN s.priorityLevel = 'low'      THEN 1 ELSE 0 END)", 'low')
        .addSelect('ROUND(AVG(s.overallScore)::numeric, 1)', 'avgScore');

    if (!province) {
      const qb = this.schoolRepository
        .createQueryBuilder('s')
        .select('s.province', 'province')
        .addSelect('COUNT(*)', 'total');
      prioritySelects(qb);
      const rows = await qb.groupBy('s.province').orderBy('total', 'DESC').getRawMany();
      return { level: 'national', items: rows.map((r) => parseRow(r, 'province')) };
    }

    if (!district) {
      const qb = this.schoolRepository
        .createQueryBuilder('s')
        .select('s.district', 'district')
        .addSelect('COUNT(*)', 'total');
      prioritySelects(qb);
      const rows = await qb
        .where('s.province = :province', { province })
        .groupBy('s.district')
        .orderBy('total', 'DESC')
        .getRawMany();
      return { level: 'province', province, items: rows.map((r) => parseRow(r, 'district')) };
    }

    // Province + district → individual school rows
    const schools = await this.schoolRepository.find({
      where: { province: province as any, district: district as any },
      select: ['id', 'name', 'code', 'priorityLevel', 'overallScore', 'kmzStatus'],
      order: { overallScore: 'ASC' },
    });
    return { level: 'district', province, district, schools };
  }

  // ── Recommendation Actions ───────────────────────────────────────────────

  async getActions(schoolId: string): Promise<RecommendationAction[]> {
    return this.actionRepository.find({
      where: { schoolId },
      order: { createdAt: 'ASC' },
    });
  }

  async createAction(
    schoolId: string,
    recommendation: string,
  ): Promise<RecommendationAction> {
    const action = this.actionRepository.create({
      schoolId,
      recommendation,
      status: 'open',
    });
    return this.actionRepository.save(action);
  }

  async updateAction(
    id: string,
    patch: { status?: ActionStatus; assignedTo?: string | null; dueDate?: string | null },
  ): Promise<RecommendationAction> {
    const action = await this.actionRepository.findOne({ where: { id } });
    if (!action) throw new NotFoundException(`Action ${id} not found`);
    Object.assign(action, patch);
    return this.actionRepository.save(action);
  }

  private generateNationalRecommendations(
    criticalCount: number,
    provinceStats: Array<{ province: string; avgScore: number }>,
  ): string[] {
    const recs: string[] = [];

    if (criticalCount > 0) {
      recs.push(
        `[URGENT] ${criticalCount} school(s) require immediate infrastructure intervention.`,
      );
    }

    // Province with the lowest computed average score
    const sorted = [...provinceStats].sort((a, b) => a.avgScore - b.avgScore);
    const lowestProvince = sorted[0];
    if (lowestProvince && lowestProvince.province) {
      recs.push(
        `[STRATEGIC] ${lowestProvince.province} has the lowest average score (${lowestProvince.avgScore.toFixed(0)}) — prioritise GIS mapping and assessment coverage.`,
      );
    }

    if (criticalCount > 0) {
      recs.push(
        `[CRITICAL] ${criticalCount} critical-priority school(s) require urgent WASH and sanitation review.`,
      );
    }

    if (recs.length === 0) {
      recs.push('[INFO] All schools are within acceptable performance bands. Continue routine monitoring.');
    }

    return recs;
  }

  async getDecisions(query?: { province?: string; priority?: string }) {
    // Join schools on schoolId (varchar) rather than the broken school_id FK column
    const qb = this.assessmentRepository
      .createQueryBuilder('da')
      .leftJoinAndMapOne(
        'da.school',
        'School',
        's',
        'CAST(s.id AS text) = da.schoolId',
      )
      .orderBy('da.overallScore', 'DESC');

    if (query?.province)
      qb.andWhere('s.province = :province', { province: query.province });
    if (query?.priority)
      qb.andWhere('da.priorityLevel = :priority', { priority: query.priority });

    return qb.getMany();
  }

  async recalculateAllScores(actor?: AuditActor): Promise<{ processed: number }> {
    const schools = await this.schoolRepository.find({
      relations: ['buildings', 'populationData'],
    });

    let processed = 0;
    for (const school of schools) {
      await this.calculateSchoolScore(school);
      processed++;
    }

    this.auditService.log(
      actor ?? null,
      'analytics.recalculate',
      'system',
      undefined,
      { processed },
    );

    return { processed };
  }

  async recalculateSchoolScore(
    schoolId: string,
  ): Promise<DecisionAssessment> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: ['buildings', 'populationData'],
    });
    if (!school) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }
    return this.calculateSchoolScore(school);
  }

  @OnEvent('school.updated')
  async handleSchoolUpdated(event: { schoolId: string }): Promise<void> {
    try {
      await this.recalculateSchoolScore(event.schoolId);
      this.logger.debug(`Score recalculated for school ${event.schoolId} after school.updated event`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Background recalculation failed for school ${event.schoolId}: ${message}`,
      );
    }
  }

  async getSchoolMetrics(schoolId: string): Promise<SchoolMetricsDto> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: ['buildings', 'populationData'],
    });

    if (!school) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }

    // calculateSchoolScore persists all component scores — run first so the
    // assessment entity is always up-to-date before we read it.
    const assessment = await this.calculateSchoolScore(school);

    // facilityComplianceScore is now persisted on the assessment; the fallback
    // recalculation guards against the first run before Phase 1 migrations.
    const facilityComplianceScore =
      assessment.facilityComplianceScore ??
      (await this.calculateFacilityComplianceScore(schoolId));

    const currentYear = new Date().getFullYear();
    const buildings   = school.buildings ?? [];
    const programs    = (school.educationPrograms as any[]) ?? [];

    // ── Student / capacity counts ─────────────────────────────────────────────
    const totalStudentsFromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
      0,
    );
    const totalCapacityFromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
      0,
    );
    // Prefer program-level roll-up; fall back to school.totalStudents
    const totalStudents =
      totalStudentsFromPrograms > 0
        ? totalStudentsFromPrograms
        : parseFloat(String(school.totalStudents)) || 0;
    const totalCapacity = totalCapacityFromPrograms;

    // ── Staff counts — parse every field; TypeORM int columns can return strings ──
    const maleTeachers   = parseFloat(String(school.maleTeachers))   || 0;
    const femaleTeachers = parseFloat(String(school.femaleTeachers)) || 0;
    const totalTeachers  = maleTeachers + femaleTeachers;
    const totalStaff =
      maleTeachers +
      femaleTeachers +
      (parseFloat(String(school.maleAdminStaff))    || 0) +
      (parseFloat(String(school.femaleAdminStaff))  || 0) +
      (parseFloat(String(school.maleSupportStaff))  || 0) +
      (parseFloat(String(school.femaleSupportStaff)) || 0);
    const maleTeacherRatio =
      totalTeachers > 0 ? Math.round((maleTeachers / totalTeachers) * 100) : 0;

    // ── Building age ──────────────────────────────────────────────────────────
    const buildingsWithYear = buildings.filter((b) => b.yearBuilt);
    const ages = buildingsWithYear.map(
      // parseInt for year columns; parseFloat would work too but years are integers
      (b) => currentYear - parseInt(String(b.yearBuilt), 10),
    );
    const avgBuildingAge =
      ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
        : null;
    const avgBuildingYear =
      avgBuildingAge !== null ? currentYear - avgBuildingAge : null;

    // ── Score fields from assessment ──────────────────────────────────────────
    const ageScore   = parseFloat(String(assessment.buildingAgeScore));
    const depreciation = Math.min(100, Math.max(5, Math.round(100 - ageScore)));

    // ── School profile ────────────────────────────────────────────────────────
    const establishedYearParsed = school.establishedYear
      ? parseInt(String(school.establishedYear), 10)
      : null;
    const schoolAge =
      establishedYearParsed != null
        ? currentYear - establishedYearParsed
        : null;

    // ── Ratios ────────────────────────────────────────────────────────────────
    // Education standard: students per TEACHING staff (not all staff ÷ students)
    const studentToTeacherRatio =
      totalTeachers > 0
        ? parseFloat((totalStudents / totalTeachers).toFixed(1))
        : null;

    // latrineCount: field does not yet exist on School or SchoolFacilitySurvey —
    // will be non-null once those columns are added; null is the honest value here.
    const latrineCount =
      parseFloat(
        String(
          (school as any).latrineCount ?? 0,
        ),
      ) || 0;
    const studentToLatrineRatio =
      latrineCount > 0
        ? parseFloat((totalStudents / latrineCount).toFixed(1))
        : null;

    // ── Utility / connectivity fields (future schema columns; null until added) ──
    const hasElectricity: boolean | null = (school as any).hasElectricity  ?? null;
    const waterSourceType: string | null = (school as any).waterSourceType ?? null;
    const hasInternet: boolean | null    = (school as any).hasInternet     ?? null;

    // ── Latest facility survey (used for date + data-completeness check) ───────
    const latestSurvey = await this.surveyRepository.findOne({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });

    // ── Parallel peer-benchmarking queries ────────────────────────────────────
    // Exclude the current school from both averages so it doesn't skew its own peer group.
    const [districtAvgRow, provinceAvgRow, allReports] = await Promise.all([
      this.schoolRepository
        .createQueryBuilder('s')
        .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
        .where('s.district = :d', { d: school.district })
        .andWhere('s.id != :id', { id: school.id })
        .andWhere('s.overallScore IS NOT NULL')
        .getRawOne(),

      this.schoolRepository
        .createQueryBuilder('s')
        .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
        .where('s.province = :p', { p: school.province })
        .andWhere('s.id != :id', { id: school.id })
        .andWhere('s.overallScore IS NOT NULL')
        .getRawOne(),

      // Reports fetch moved here to run in parallel
      this.issueReportRepository.find({
        where: { schoolId },
        order: { createdAt: 'DESC' },
        take: 2000,
      }),
    ]);

    // Parse AVG results — pg driver returns numeric as string
    const districtAvg =
      districtAvgRow?.avg != null
        ? parseFloat(String(districtAvgRow.avg))
        : null;
    const provinceAvg =
      provinceAvgRow?.avg != null
        ? parseFloat(String(provinceAvgRow.avg))
        : null;

    const overallScoreParsed = parseFloat(String(assessment.overallScore));

    const scoreDeltaFromDistrict =
      districtAvg != null
        ? parseFloat((overallScoreParsed - districtAvg).toFixed(1))
        : null;
    const scoreDeltaFromProvince =
      provinceAvg != null
        ? parseFloat((overallScoreParsed - provinceAvg).toFixed(1))
        : null;

    // ── Data completeness score (10-point binary checklist) ───────────────────
    const completenessChecks = [
      buildings.length > 0,                                            // GIS building data
      totalStudents > 0,                                               // enrolment data
      totalTeachers > 0,                                               // staffing data
      school.province != null && school.province !== '',               // location: province
      school.district != null && school.district !== '',               // location: district
      school.roadStatusPercentage != null,                             // accessibility data
      establishedYearParsed != null,                                   // school age data
      latestSurvey != null,                                            // facility survey done
      (school.populationData?.length ?? 0) > 0,                       // population data
      school.kmzStatus === KmzProcessingStatus.COMPLETED,              // GIS mapping completed
    ];
    const filledCount = completenessChecks.filter(Boolean).length;
    const dataCompletenessScore = Math.round(
      (filledCount / completenessChecks.length) * 100,
    );

    // ── Risk matrix input scores ──────────────────────────────────────────────
    const criticalBuildingCount = buildings.filter(
      (b) =>
        b.condition === BuildingCondition.CRITICAL ||
        b.condition === BuildingCondition.POOR,
    ).length;
    const safeAvgBuildingAge = avgBuildingAge ?? 50;
    const urgencyMo          = assessment.urgencyMonths ?? 36;

    // Days since last survey — Infinity when never surveyed (pessimistic, correct)
    const daysSinceLastSurvey = latestSurvey
      ? (Date.now() - new Date(latestSurvey.createdAt).getTime()) / 86_400_000
      : Infinity;

    // Impact = consequence severity if the risk materialises
    //   50% from overall score deficit, 30% from critical-building proportion,
    //   20% from urgency (more urgent = higher impact contribution)
    const riskImpactScore = Math.min(
      100,
      Math.round(
        (100 - overallScoreParsed) * 0.5 +
        (criticalBuildingCount / Math.max(1, buildings.length)) * 100 * 0.3 +
        (urgencyMo === 0 ? 100 : Math.max(0, 100 - urgencyMo * 2)) * 0.2,
      ),
    );

    // Probability = likelihood of structural / operational failure
    //   50% from building age (older = more likely), 25% from pop-data gap,
    //   25% from survey staleness (longer since last survey = higher probability)
    const riskProbabilityScore = Math.min(
      100,
      Math.round(
        Math.min(100, safeAvgBuildingAge * 1.5) * 0.5 +
        ((assessment.hasPopDataGap ?? false) ? 60 : 20) * 0.25 +
        (daysSinceLastSurvey > 365 ? 80 : daysSinceLastSurvey > 180 ? 50 : 20) *
          0.25,
      ),
    );

    // ── Assemble DTO ──────────────────────────────────────────────────────────
    const dto = new SchoolMetricsDto();

    // Metadata
    dto.schoolId      = school.id;
    dto.schoolName    = school.name;
    dto.schoolCode    = school.code;
    dto.calculatedAt  = new Date().toISOString();

    // Population / staff
    dto.totalStudents        = totalStudents;
    dto.totalCapacity        = totalCapacity;
    dto.totalTeachers        = totalTeachers;
    dto.totalStaff           = totalStaff;
    dto.maleTeacherRatio     = maleTeacherRatio;
    dto.studentToTeacherRatio = studentToTeacherRatio;
    dto.studentToLatrineRatio = studentToLatrineRatio;
    dto.latrineCount         = latrineCount > 0 ? latrineCount : null;

    // Utilities
    dto.hasElectricity  = hasElectricity;
    dto.waterSourceType = waterSourceType;
    dto.hasInternet     = hasInternet;

    // Buildings
    dto.buildingCount    = buildings.length;
    dto.avgBuildingAge   = avgBuildingAge;
    dto.avgBuildingYear  = avgBuildingYear;

    // School profile
    dto.establishedYear = establishedYearParsed;
    dto.schoolAge       = schoolAge;

    // Programs & land
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

    // Assessment scores
    dto.overallScore            = overallScoreParsed;
    dto.infrastructureScore     = parseFloat(String(assessment.infrastructureScore));
    dto.buildingAgeScore        = ageScore;
    dto.accessibilityScore      = parseFloat(String(assessment.accessibilityScore));
    dto.populationPressureScore = parseFloat(String(assessment.populationPressureScore));
    dto.facilityComplianceScore = facilityComplianceScore;
    dto.depreciation            = depreciation;
    dto.resolutionRateScore     =
      assessment.resolutionRateScore != null
        ? parseFloat(String(assessment.resolutionRateScore))
        : null;
    dto.hasInfraDataGap = assessment.hasInfraDataGap ?? null;
    dto.hasPopDataGap   = assessment.hasPopDataGap   ?? null;

    // Decision data
    dto.priorityLevel        = assessment.priorityLevel;
    dto.urgencyMonths        = assessment.urgencyMonths ?? null;
    dto.recommendations      = assessment.recommendations ?? [];
    dto.primaryRecommendation = assessment.primaryRecommendation ?? null;
    dto.estimatedBudgetRwf =
      assessment.estimatedBudgetRwf != null
        ? parseFloat(String(assessment.estimatedBudgetRwf))
        : null;

    // Survey
    dto.lastSurveyDate = latestSurvey?.createdAt
      ? new Date(latestSurvey.createdAt).toISOString()
      : null;

    // Peer benchmarking
    dto.districtAvgScore       = districtAvg;
    dto.provinceAvgScore       = provinceAvg;
    dto.scoreDeltaFromDistrict = scoreDeltaFromDistrict;
    dto.scoreDeltaFromProvince = scoreDeltaFromProvince;

    // Data quality
    dto.dataCompletenessScore = dataCompletenessScore;
    dto.kmzStatus = school.kmzStatus ?? null;

    // Risk matrix
    dto.riskImpactScore       = riskImpactScore;
    dto.riskProbabilityScore  = riskProbabilityScore;

    // Reporting summary
    const reportSummary: ReportSummaryDto = {
      total:    allReports.length,
      critical: allReports.filter((r) => r.status === ReportStatus.NEED_INTERVENTION).length,
      pending:  allReports.filter((r) => r.status === ReportStatus.PENDING).length,
      resolved: allReports.filter((r) => r.status === ReportStatus.SOLVED).length,
      failed:   allReports.filter((r) => r.status === ReportStatus.FAILED).length,
      recentCritical: allReports
        .filter((r) => r.status === ReportStatus.NEED_INTERVENTION)
        .slice(0, 5)
        .map((r) => ({
          id:          r.id,
          facilityId:  r.facilityId,
          description: r.description,
          status:      r.status,
          buildingId:  r.buildingId,
          createdAt:   r.createdAt.toISOString(),
        })),
    };
    dto.reportSummary = reportSummary;

    return dto;
  }

  async calculateSchoolScore(school: School): Promise<DecisionAssessment> {
    const buildings = school.buildings || [];
    const population = school.populationData?.[0];

    // Facility survey compliance score (15% weight)
    const facilityScore = await this.calculateFacilityComplianceScore(school.id);

    // Issue resolution rate score (5% weight)
    const totalReports = await this.issueReportRepository.count({
      where: { schoolId: school.id },
    });
    const resolvedReports = await this.issueReportRepository.count({
      where: { schoolId: school.id, status: ReportStatus.SOLVED },
    });
    const resolutionRateScore =
      totalReports > 0
        ? Math.min(100, Math.round((resolvedReports / totalReports) * 100))
        : 50; // no reports = neutral (school not penalised for clean record)

    // Infrastructure score (35%) — based on building conditions
    const infraScore = this.calculateInfrastructureScore(buildings);
    const hasInfraDataGap = buildings.length === 0;

    // Building age score (25%) — newer average age = higher score
    const ageScore = this.calculateAgeScore(
      buildings,
      school.establishedYear != null
        ? Number(school.establishedYear)
        : undefined,
    );

    // Accessibility score (10%) — road status percentage (0–100, higher = better)
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

    // Population / capacity resilience score (10%) — more headroom = higher score
    const { score: popScore, hasPopDataGap } = this.calculatePopulationScore(
      population,
      totalStudents,
    );

    // Clamp every component before combining (parseFloat may produce NaN)
    const safeInfra      = Math.min(100, Math.max(0, parseFloat(String(infraScore))          || 0));
    const safeAge        = Math.min(100, Math.max(0, parseFloat(String(ageScore))             || 0));
    const safeAccess     = Math.min(100, Math.max(0, parseFloat(String(accessScore))          || 0));
    const safePop        = Math.min(100, Math.max(0, parseFloat(String(popScore))             || 0));
    const safeFacility   = Math.min(100, Math.max(0, parseFloat(String(facilityScore))        || 0));
    const safeResolution = Math.min(100, Math.max(0, parseFloat(String(resolutionRateScore))  || 50));

    // Weighted composite — weights sum to 1.0
    const overallScore = Math.min(100, Math.round(
      safeInfra      * 0.35 +
      safeAge        * 0.25 +
      safeAccess     * 0.10 +
      safePop        * 0.10 +
      safeFacility   * 0.15 +
      safeResolution * 0.05,
    ));

    // Urgency timeline derived from overall score band
    const urgencyMonths = (() => {
      if (overallScore < 35) return 0;
      if (overallScore < 45) return 3;
      if (overallScore < 55) return 6;
      if (overallScore < 65) return 12;
      if (overallScore < 75) return 18;
      return 36;
    })();

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

    const fields = {
      infrastructureScore: infraScore,
      buildingAgeScore: ageScore,
      accessibilityScore: accessScore,
      populationPressureScore: popScore,
      facilityComplianceScore: facilityScore,
      resolutionRateScore,
      hasInfraDataGap,
      hasPopDataGap,
      overallScore,
      urgencyMonths,
      priorityLevel,
      recommendations,
    };

    const assessment = existing
      ? Object.assign(existing, fields)
      : this.assessmentRepository.create({ schoolId: school.id, ...fields });

    const saved = await this.assessmentRepository.save(assessment);

    // Update school priority and overall score
    await this.schoolRepository.update(school.id, {
      priorityLevel: priorityLevel as any,
      overallScore,
    });

    this.eventsGateway?.emitScoresRecalculated(school.id, {
      schoolId: school.id,
      overallScore: saved.overallScore,
      infrastructureScore: saved.infrastructureScore,
      buildingAgeScore: saved.buildingAgeScore,
      accessibilityScore: saved.accessibilityScore,
      populationPressureScore: saved.populationPressureScore,
      priorityLevel: saved.priorityLevel,
    });

    // Persist score snapshot — parse every value so no raw strings enter the history table
    await this.scoreHistoryRepository.save({
      schoolId:                school.id,
      overallScore:            parseFloat(String(overallScore)),
      infrastructureScore:     parseFloat(String(infraScore)),
      buildingAgeScore:        parseFloat(String(ageScore)),
      accessibilityScore:      parseFloat(String(accessScore)),
      populationPressureScore: parseFloat(String(popScore)),
      facilityComplianceScore: parseFloat(String(facilityScore)),
      resolutionRateScore:     parseFloat(String(resolutionRateScore)),
    });

    return saved;
  }

  private calculateInfrastructureScore(buildings: SchoolBuilding[]): number {
    if (!buildings || buildings.length === 0) return 0; // missing data is a risk
    const conditionMap = {
      [BuildingCondition.GOOD]: 100,
      [BuildingCondition.FAIR]: 70,
      [BuildingCondition.POOR]: 30,
      [BuildingCondition.CRITICAL]: 10,
    };
    const avg =
      buildings.reduce((s, b) => s + (conditionMap[b.condition] ?? 50), 0) /
      buildings.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  }

  private calculateAgeScore(
    buildings: SchoolBuilding[],
    establishedYear?: number,
  ): number {
    const currentYear = new Date().getFullYear();
    const buildingAges = buildings
      .filter((b) => b.yearBuilt)
      .map((b) => currentYear - parseInt(String(b.yearBuilt), 10));

    let avgAge: number;
    if (buildingAges.length > 0) {
      avgAge =
        buildingAges.reduce((sum, age) => sum + age, 0) / buildingAges.length;
    } else if (establishedYear) {
      avgAge = currentYear - parseInt(String(establishedYear), 10);
    } else {
      return 50; // no age data — neutral; flagged via hasInfraDataGap
    }

    if (avgAge <= 10) return 95;
    if (avgAge <= 20) return 80;
    if (avgAge <= 30) return 60;
    if (avgAge <= 40) return 45;
    if (avgAge <= 50) return 30;
    if (avgAge <= 60) return 20;
    return 10; // > 60 years — critical structural risk
  }

  private calculatePopulationScore(
    population?: PopulationData,
    currentStudents?: number,
  ): { score: number; hasPopDataGap: boolean } {
    if (!population) return { score: 50, hasPopDataGap: true };
    const capacity = Math.max(1, parseFloat(String(currentStudents)) || 300);
    const demand = parseFloat(String(population.schoolAgePopulation2km)) || 0;
    const ratio = demand / capacity;
    // Higher score = more capacity headroom = better (label: "Capacity Resilience")
    let score: number;
    if (ratio >= 5) score = 10;
    else if (ratio >= 3) score = 30;
    else if (ratio >= 2) score = 50;
    else if (ratio >= 1) score = 70;
    else score = 100;
    return { score, hasPopDataGap: false };
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
