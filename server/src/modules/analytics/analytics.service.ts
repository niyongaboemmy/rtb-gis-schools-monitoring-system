import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  DecisionAssessment,
  PriorityLevel,
} from './entities/decision-assessment.entity';
import { ScoreHistory } from './entities/score-history.entity';
import {
  RecommendationAction,
  ActionStatus,
} from './entities/recommendation-action.entity';
import { School, KmzProcessingStatus } from '../schools/entities/school.entity';
import {
  SchoolBuilding,
  BuildingCondition,
} from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { SchoolFacilitySurvey } from '../schools/entities/school-facility-survey.entity';
import { SchoolMetricsDto, ReportSummaryDto } from './dto/school-metrics.dto';
import {
  IssueReport,
  ReportStatus,
} from '../reports/entities/issue-report.entity';
import { AccessScope, applySchoolScope } from '../../common/scope/access-scope';
import {
  ACTIVE_SCHOOL_STATUS,
  whereActiveSchool,
} from '../../common/school/active-school';
import {
  NEUTRAL_SCORE,
  CONDITION_SCORE_MAP,
  COMPLIANCE_SCORE_MAP,
  DEFAULT_CATCHMENT_CAPACITY,
  ageToScore,
  demandRatioToScore,
  scoreToPriorityLevel,
  urgencyMonthsFromScore,
  computeOverallScore,
  clamp0to100,
  safeScore,
} from './scoring.constants';
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

  async getOverview(scope?: AccessScope) {
    // Resolve the caller's in-scope school ids once, then constrain every
    // aggregate below with a uniform `id IN (...)`. Null → national, no filter.
    let scopeIds: string[] | null = null;
    if (scope && scope.enforced && !scope.isNational) {
      const rows = await applySchoolScope(
        this.schoolRepository.createQueryBuilder('s').select('s.id', 'id'),
        scope,
        's',
      ).getRawMany();
      scopeIds = rows.map((r) => String(r.id));
      // Nil UUID keeps `s.id IN (...)` valid syntax while matching nothing.
      if (scopeIds.length === 0)
        scopeIds = ['00000000-0000-0000-0000-000000000000'];
    }
    const inScope = <T extends { andWhere: (...a: any[]) => T }>(
      qb: T,
      col: string,
    ): T =>
      scopeIds ? qb.andWhere(`${col} IN (:...scopeIds)`, { scopeIds }) : qb;

    // Constrain to operating schools only. `statusAlias` is the School alias in
    // the query ('s' everywhere here); every aggregate must exclude `inactive`
    // and `under_renovation` rows so national KPIs reflect the live network.
    const activeInScope = <T extends { andWhere: (...a: any[]) => T }>(
      qb: T,
      col: string,
      statusAlias = 's',
    ): T =>
      inScope(
        qb.andWhere(`${statusAlias}.status = :activeStatus`, {
          activeStatus: ACTIVE_SCHOOL_STATUS,
        }),
        col,
      );

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
      capacityRows,
    ] = await Promise.all([
      // 1. total active school count
      activeInScope(
        this.schoolRepository.createQueryBuilder('s'),
        's.id',
      ).getCount(),

      // 2. counts per priority band
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('s.priorityLevel', 'priority')
          .addSelect('COUNT(*)', 'count'),
        's.id',
      )
        .groupBy('s.priorityLevel')
        .getRawMany(),

      // 3. critical schools spotlight (top 5)
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .where('s.priorityLevel = :crit', { crit: PriorityLevel.CRITICAL }),
        's.id',
      )
        .orderBy('s.overallScore', 'DESC')
        .take(5)
        .getMany(),

      // 4. recent assessments feed — inner-join on schoolId varchar (school_id FK
      //    is NULL); the join + active filter drop orphaned / non-active rows.
      activeInScope(
        this.assessmentRepository
          .createQueryBuilder('da')
          .innerJoinAndMapOne(
            'da.school',
            'School',
            's',
            'CAST(s.id AS text) = da.schoolId',
          ),
        'da.schoolId',
      )
        .orderBy('da.createdAt', 'DESC')
        .take(10)
        .getMany(),

      // 5. national score sub-dimension averages — queried directly from
      //    assessmentRepository to avoid the broken dual-FK situation on
      //    decision_assessments (school_id FK is NULL; schoolId varchar has data).
      activeInScope(
        this.assessmentRepository
          .createQueryBuilder('da')
          .innerJoin('School', 's', 'CAST(s.id AS text) = da.schoolId')
          .select('ROUND(AVG(da.overallScore)::numeric, 1)', 'nationalAvgScore')
          .addSelect('COUNT(da.id)', 'scoredCount'),
        'da.schoolId',
      )
        .addSelect(
          'ROUND(AVG(da.infrastructureScore)::numeric, 1)',
          'nationalAvgInfraScore',
        )
        .addSelect(
          'ROUND(AVG(da.populationPressureScore)::numeric, 1)',
          'nationalAvgPopScore',
        )
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
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('COALESCE(SUM(s.totalStudents), 0)', 'totalStudents'),
        's.id',
      ).getRawOne(),

      // 7. total teaching staff — prefer gender breakdown when populated,
      //    fall back to s.totalTeachers (seed data only populates totalTeachers).
      activeInScope(
        this.schoolRepository.createQueryBuilder('s').select(
          `COALESCE(SUM(CASE
            WHEN s.maleTeachers IS NOT NULL OR s.femaleTeachers IS NOT NULL
            THEN COALESCE(s.maleTeachers, 0) + COALESCE(s.femaleTeachers, 0)
            ELSE COALESCE(s.totalTeachers, 0)
          END), 0)`,
          'totalTeachers',
        ),
        's.id',
      ).getRawOne(),

      // 8. KMZ coverage — only COMPLETED uploads count as "mapped"
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('COUNT(*)', 'withKmz')
          .where('s.kmzStatus = :status', {
            status: KmzProcessingStatus.COMPLETED,
          }),
        's.id',
      ).getRawOne(),

      // 9. survey coverage — distinct active schools with ≥1 facility survey record
      activeInScope(
        this.surveyRepository
          .createQueryBuilder('sv')
          .innerJoin('School', 's', 'CAST(s.id AS text) = sv.schoolId')
          .select('COUNT(DISTINCT sv.schoolId)', 'withSurvey'),
        'sv.schoolId',
      ).getRawOne(),

      // 10. total estimated rehabilitation budget
      activeInScope(
        this.assessmentRepository
          .createQueryBuilder('da')
          .innerJoin('School', 's', 'CAST(s.id AS text) = da.schoolId')
          .select('COALESCE(SUM(da.estimatedBudgetRwf), 0)', 'totalBudget')
          .where('da.estimatedBudgetRwf IS NOT NULL'),
        'da.schoolId',
      ).getRawOne(),

      // 11. last recalculation timestamp (most recent assessment write)
      activeInScope(
        this.assessmentRepository
          .createQueryBuilder('da')
          .innerJoin('School', 's', 'CAST(s.id AS text) = da.schoolId')
          .select('MAX(da.updatedAt)', 'lastCalculatedAt'),
        'da.schoolId',
      ).getRawOne(),

      // 12. province stats — all four priority bands + avg/min/max scores
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('s.province', 'province')
          .addSelect('COUNT(*)', 'total'),
        's.id',
      )
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

      // 13. capacity-utilisation inputs — program-level roll-up done in JS
      //     (educationPrograms is a jsonb array; SQL aggregation is brittle).
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select(['s.id', 's.totalStudents', 's.educationPrograms']),
        's.id',
      ).getMany(),
    ]);

    // National capacity utilisation = Σ enrolled ÷ Σ programme capacity (0–100+).
    let capStudents = 0;
    let capSeats = 0;
    for (const s of capacityRows) {
      const programs = (s.educationPrograms as any[]) ?? [];
      const seats = programs.reduce(
        (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
        0,
      );
      const enrolled =
        programs.reduce(
          (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
          0,
        ) ||
        parseFloat(String(s.totalStudents)) ||
        0;
      if (seats > 0) {
        capSeats += seats;
        capStudents += enrolled;
      }
    }
    const nationalCapacityUtilisation =
      capSeats > 0 ? Math.round((capStudents / capSeats) * 100) : null;

    // ── Parse all raw results — pg driver returns numerics as strings ──────────

    const nationalAvgScore =
      parseFloat(String(scoreAvgResult?.nationalAvgScore)) || 0;
    const scoredSchoolCount =
      parseInt(String(scoreAvgResult?.scoredCount), 10) || 0;
    const nationalAvgInfraScore =
      parseFloat(String(scoreAvgResult?.nationalAvgInfraScore)) || 0;
    const nationalAvgPopScore =
      parseFloat(String(scoreAvgResult?.nationalAvgPopScore)) || 0;
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

    const withKmz = parseInt(String(kmzResult?.withKmz), 10) || 0;
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
      total: parseInt(String(p.total), 10) || 0,
      critical: parseInt(String(p.critical), 10) || 0,
      high: parseInt(String(p.high), 10) || 0,
      medium: parseInt(String(p.medium), 10) || 0,
      low: parseInt(String(p.low), 10) || 0,
      avgScore: parseFloat(String(p.avgScore)) || 0,
      // minScore/maxScore can legitimately be null (province has no scored schools yet)
      minScore: p.minScore != null ? parseFloat(String(p.minScore)) : null,
      maxScore: p.maxScore != null ? parseFloat(String(p.maxScore)) : null,
    }));

    // Extract critical count before the reduce collapses the byPriority array
    const criticalRow = byPriority.find(
      (r) => r.priority === PriorityLevel.CRITICAL,
    );
    const criticalCount = parseInt(String(criticalRow?.count), 10) || 0;

    const nationalRecommendations = this.generateNationalRecommendations(
      criticalCount,
      provinceStats,
    );

    return {
      totalSchools,
      nationalAvgScore,
      scoredSchoolCount,
      nationalAvgInfraScore,
      nationalAvgPopScore,
      nationalAvgAgeScore,
      nationalAvgAccessScore,
      nationalAvgComplianceScore,
      nationalCapacityUtilisation,
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
    // Only active schools are exported; the `schoolMap.has` filter below then
    // also drops assessments whose school was deleted or deactivated.
    const [assessments, schools] = await Promise.all([
      this.assessmentRepository.find({ order: { overallScore: 'ASC' } }),
      this.schoolRepository.find({
        where: { status: ACTIVE_SCHOOL_STATUS as any },
      }),
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

    const rows = assessments
      // Skip assessments whose school no longer exists (hard-deleted).
      .filter((a) => schoolMap.has(a.schoolId))
      .map((a) => {
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

  async getScoreHistory(
    schoolId: string,
    months = 12,
  ): Promise<ScoreHistory[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    return this.scoreHistoryRepository.find({
      where: { schoolId, recordedAt: MoreThanOrEqual(since) },
      order: { recordedAt: 'ASC' },
    });
  }

  // ── Hierarchy Drill-down ─────────────────────────────────────────────────

  async getHierarchy(
    province?: string,
    district?: string,
    scope?: AccessScope,
  ) {
    const scoped = <T extends { andWhere: (...a: any[]) => T }>(qb: T) => {
      whereActiveSchool(qb, 's');
      return scope ? applySchoolScope(qb, scope, 's') : qb;
    };
    // Parse every raw numeric field — pg driver returns counts/averages as strings.
    const parseRow = (r: any, labelKey: string) => ({
      label: r[labelKey] as string,
      total: parseInt(String(r.total), 10) || 0,
      critical: parseInt(String(r.critical), 10) || 0,
      high: parseInt(String(r.high), 10) || 0,
      medium: parseInt(String(r.medium), 10) || 0,
      low: parseInt(String(r.low), 10) || 0,
      avgScore: parseFloat(String(r.avgScore)) || 0,
    });

    const prioritySelects = (qb: any) =>
      qb
        .addSelect(
          "SUM(CASE WHEN s.priorityLevel = 'critical' THEN 1 ELSE 0 END)",
          'critical',
        )
        .addSelect(
          "SUM(CASE WHEN s.priorityLevel = 'high'     THEN 1 ELSE 0 END)",
          'high',
        )
        .addSelect(
          "SUM(CASE WHEN s.priorityLevel = 'medium'   THEN 1 ELSE 0 END)",
          'medium',
        )
        .addSelect(
          "SUM(CASE WHEN s.priorityLevel = 'low'      THEN 1 ELSE 0 END)",
          'low',
        )
        .addSelect('ROUND(AVG(s.overallScore)::numeric, 1)', 'avgScore');

    if (!province) {
      const qb = this.schoolRepository
        .createQueryBuilder('s')
        .select('s.province', 'province')
        .addSelect('COUNT(*)', 'total');
      prioritySelects(qb);
      scoped(qb);
      const rows = await qb
        .groupBy('s.province')
        .orderBy('total', 'DESC')
        .getRawMany();
      return {
        level: 'national',
        items: rows.map((r) => parseRow(r, 'province')),
      };
    }

    if (!district) {
      const qb = this.schoolRepository
        .createQueryBuilder('s')
        .select('s.district', 'district')
        .addSelect('COUNT(*)', 'total');
      prioritySelects(qb);
      qb.where('s.province = :province', { province });
      scoped(qb);
      const rows = await qb
        .groupBy('s.district')
        .orderBy('total', 'DESC')
        .getRawMany();
      return {
        level: 'province',
        province,
        items: rows.map((r) => parseRow(r, 'district')),
      };
    }

    // Province + district → individual school rows
    const schoolsQb = this.schoolRepository
      .createQueryBuilder('s')
      .select([
        's.id',
        's.name',
        's.code',
        's.priorityLevel',
        's.overallScore',
        's.kmzStatus',
      ])
      .where('s.province = :province', { province })
      .andWhere('s.district = :district', { district })
      .orderBy('s.overallScore', 'ASC');
    scoped(schoolsQb);
    const schools = await schoolsQb.getMany();
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
    patch: {
      status?: ActionStatus;
      assignedTo?: string | null;
      dueDate?: string | null;
    },
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
      recs.push(
        '[INFO] All schools are within acceptable performance bands. Continue routine monitoring.',
      );
    }

    return recs;
  }

  async getDecisions(
    query?: { province?: string; priority?: string },
    scope?: AccessScope,
  ) {
    // Join schools on schoolId (varchar) rather than the broken school_id FK column
    const qb = this.assessmentRepository
      .createQueryBuilder('da')
      .innerJoinAndMapOne(
        'da.school',
        'School',
        's',
        'CAST(s.id AS text) = da.schoolId',
      )
      // Intervention queue → most urgent (lowest score) first.
      .orderBy('da.overallScore', 'ASC')
      .addOrderBy('da.urgencyMonths', 'ASC');

    // Operating schools only — no orphaned, inactive or under-renovation rows.
    whereActiveSchool(qb, 's');

    if (query?.province)
      qb.andWhere('s.province = :province', { province: query.province });
    if (query?.priority)
      qb.andWhere('da.priorityLevel = :priority', { priority: query.priority });

    if (scope) applySchoolScope(qb, scope, 's');

    return qb.getMany();
  }

  async recalculateAllScores(
    actor?: AuditActor,
  ): Promise<{ processed: number }> {
    const schools = await this.schoolRepository.find({
      where: { status: ACTIVE_SCHOOL_STATUS as any },
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

  async recalculateSchoolScore(schoolId: string): Promise<DecisionAssessment> {
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
      this.logger.debug(
        `Score recalculated for school ${event.schoolId} after school.updated event`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Background recalculation failed for school ${event.schoolId}: ${message}`,
      );
    }
  }

  /**
   * A school row was hard-deleted. The assessment / history / action tables key
   * off the `schoolId` varchar column and have no working FK cascade, so clean
   * them up here — otherwise the orphaned rows keep feeding national averages,
   * budget totals, the recent-assessments feed and the decision queue.
   */
  @OnEvent('school.deleted')
  async handleSchoolDeleted(event: { schoolId: string }): Promise<void> {
    const { schoolId } = event;
    try {
      await Promise.all([
        this.assessmentRepository.delete({ schoolId }),
        this.scoreHistoryRepository.delete({ schoolId }),
        this.actionRepository.delete({ schoolId }),
      ]);
      this.logger.debug(`Purged analytics rows for deleted school ${schoolId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to purge analytics rows for deleted school ${schoolId}: ${message}`,
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
    const buildings = school.buildings ?? [];
    const programs = (school.educationPrograms as any[]) ?? [];

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
    const ageScore = parseFloat(String(assessment.buildingAgeScore));
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
      parseFloat(String((school as any).latrineCount ?? 0)) || 0;
    const studentToLatrineRatio =
      latrineCount > 0
        ? parseFloat((totalStudents / latrineCount).toFixed(1))
        : null;

    // ── Utility / connectivity fields (future schema columns; null until added) ──
    const hasElectricity: boolean | null =
      (school as any).hasElectricity ?? null;
    const waterSourceType: string | null =
      (school as any).waterSourceType ?? null;
    const hasInternet: boolean | null = (school as any).hasInternet ?? null;

    // ── Latest facility survey (used for date + data-completeness check) ───────
    const latestSurvey = await this.surveyRepository.findOne({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });

    // ── Parallel peer-benchmarking queries ────────────────────────────────────
    // Exclude the current school from both averages so it doesn't skew its own peer group.
    const [districtAvgRow, provinceAvgRow, allReports] = await Promise.all([
      whereActiveSchool(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
          .where('s.district = :d', { d: school.district })
          .andWhere('s.id != :id', { id: school.id })
          .andWhere('s.overallScore IS NOT NULL'),
        's',
      ).getRawOne(),

      whereActiveSchool(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
          .where('s.province = :p', { p: school.province })
          .andWhere('s.id != :id', { id: school.id })
          .andWhere('s.overallScore IS NOT NULL'),
        's',
      ).getRawOne(),

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
      buildings.length > 0, // GIS building data
      totalStudents > 0, // enrolment data
      totalTeachers > 0, // staffing data
      school.province != null && school.province !== '', // location: province
      school.district != null && school.district !== '', // location: district
      school.roadStatusPercentage != null, // accessibility data
      establishedYearParsed != null, // school age data
      latestSurvey != null, // facility survey done
      (school.populationData?.length ?? 0) > 0, // population data
      school.kmzStatus === KmzProcessingStatus.COMPLETED, // GIS mapping completed
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
    const urgencyMo = assessment.urgencyMonths ?? 36;

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
          (daysSinceLastSurvey > 365
            ? 80
            : daysSinceLastSurvey > 180
              ? 50
              : 20) *
            0.25,
      ),
    );

    // ── Assemble DTO ──────────────────────────────────────────────────────────
    const dto = new SchoolMetricsDto();

    // Metadata
    dto.schoolId = school.id;
    dto.schoolName = school.name;
    dto.schoolCode = school.code;
    dto.calculatedAt = new Date().toISOString();

    // Population / staff
    dto.totalStudents = totalStudents;
    dto.totalCapacity = totalCapacity;
    dto.totalTeachers = totalTeachers;
    dto.totalStaff = totalStaff;
    dto.maleTeacherRatio = maleTeacherRatio;
    dto.studentToTeacherRatio = studentToTeacherRatio;
    dto.studentToLatrineRatio = studentToLatrineRatio;
    dto.latrineCount = latrineCount > 0 ? latrineCount : null;

    // Utilities
    dto.hasElectricity = hasElectricity;
    dto.waterSourceType = waterSourceType;
    dto.hasInternet = hasInternet;

    // Buildings
    dto.buildingCount = buildings.length;
    dto.avgBuildingAge = avgBuildingAge;
    dto.avgBuildingYear = avgBuildingYear;

    // School profile
    dto.establishedYear = establishedYearParsed;
    dto.schoolAge = schoolAge;

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
    dto.overallScore = overallScoreParsed;
    dto.infrastructureScore = parseFloat(
      String(assessment.infrastructureScore),
    );
    dto.buildingAgeScore = ageScore;
    dto.accessibilityScore = parseFloat(String(assessment.accessibilityScore));
    dto.populationPressureScore = parseFloat(
      String(assessment.populationPressureScore),
    );
    dto.facilityComplianceScore = facilityComplianceScore;
    dto.depreciation = depreciation;
    dto.resolutionRateScore =
      assessment.resolutionRateScore != null
        ? parseFloat(String(assessment.resolutionRateScore))
        : null;
    dto.hasInfraDataGap = assessment.hasInfraDataGap ?? null;
    dto.hasPopDataGap = assessment.hasPopDataGap ?? null;

    // Decision data
    dto.priorityLevel = assessment.priorityLevel;
    dto.urgencyMonths = assessment.urgencyMonths ?? null;
    dto.recommendations = assessment.recommendations ?? [];
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
    dto.districtAvgScore = districtAvg;
    dto.provinceAvgScore = provinceAvg;
    dto.scoreDeltaFromDistrict = scoreDeltaFromDistrict;
    dto.scoreDeltaFromProvince = scoreDeltaFromProvince;

    // Data quality
    dto.dataCompletenessScore = dataCompletenessScore;
    dto.kmzStatus = school.kmzStatus ?? null;

    // Risk matrix
    dto.riskImpactScore = riskImpactScore;
    dto.riskProbabilityScore = riskProbabilityScore;

    // Reporting summary
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

    // Facility survey compliance score (15% weight)
    const facilityScore = await this.calculateFacilityComplianceScore(
      school.id,
    );

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
    const accessScore = clamp0to100(
      safeScore(school.roadStatusPercentage, NEUTRAL_SCORE),
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

    // Weighted composite — the one formula (see scoring.constants.ts)
    const overallScore = computeOverallScore({
      infrastructure: infraScore,
      buildingAge: ageScore,
      accessibility: accessScore,
      population: popScore,
      facilityCompliance: facilityScore,
      resolution: resolutionRateScore,
    });

    const urgencyMonths = urgencyMonthsFromScore(overallScore);
    const priorityLevel = scoreToPriorityLevel(overallScore);
    const components = {
      infra: infraScore,
      age: ageScore,
      access: accessScore,
      pop: popScore,
      facility: facilityScore,
      resolution: resolutionRateScore,
    };
    const recommendations = this.generateRecommendations(school, {
      ...components,
      hasInfraDataGap,
      hasPopDataGap,
    });
    const estimatedBudgetRwf = this.estimateBudgetRwf(school, components);
    const primaryRecommendation = recommendations[0] ?? null;

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
      primaryRecommendation: primaryRecommendation ?? undefined,
      estimatedBudgetRwf: estimatedBudgetRwf ?? undefined,
    };

    const assessment = existing
      ? Object.assign(existing, fields)
      : this.assessmentRepository.create({ schoolId: school.id, ...fields });

    const saved = await this.assessmentRepository.save(assessment);

    // Update school priority and overall score
    await this.schoolRepository.update(school.id, {
      priorityLevel: priorityLevel,
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
      schoolId: school.id,
      overallScore: parseFloat(String(overallScore)),
      infrastructureScore: parseFloat(String(infraScore)),
      buildingAgeScore: parseFloat(String(ageScore)),
      accessibilityScore: parseFloat(String(accessScore)),
      populationPressureScore: parseFloat(String(popScore)),
      facilityComplianceScore: parseFloat(String(facilityScore)),
      resolutionRateScore: parseFloat(String(resolutionRateScore)),
    });

    return saved;
  }

  private calculateInfrastructureScore(buildings: SchoolBuilding[]): number {
    // No building data → neutral (50). The missing-data risk is surfaced
    // separately via `hasInfraDataGap`, not by tanking the condition score.
    if (!buildings || buildings.length === 0) return NEUTRAL_SCORE;
    const avg =
      buildings.reduce(
        (s, b) => s + (CONDITION_SCORE_MAP[b.condition] ?? NEUTRAL_SCORE),
        0,
      ) / buildings.length;
    return clamp0to100(Math.round(avg));
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
      return NEUTRAL_SCORE; // no age data — neutral; flagged via hasInfraDataGap
    }

    return ageToScore(avgAge);
  }

  private calculatePopulationScore(
    population?: PopulationData,
    currentStudents?: number,
  ): { score: number; hasPopDataGap: boolean } {
    if (!population) return { score: NEUTRAL_SCORE, hasPopDataGap: true };
    const capacity = Math.max(
      1,
      parseFloat(String(currentStudents)) || DEFAULT_CATCHMENT_CAPACITY,
    );
    const demand = parseFloat(String(population.schoolAgePopulation2km)) || 0;
    // Higher score = more capacity headroom = better (label: "Capacity Resilience")
    return {
      score: demandRatioToScore(demand / capacity),
      hasPopDataGap: false,
    };
  }

  /** Total enrolment vs total programme capacity (0 when either is unknown). */
  private capacityGap(school: School): {
    totalStudents: number;
    totalCapacity: number;
    classroomsNeeded: number;
    overCapacityPct: number;
  } {
    const programs = school.educationPrograms ?? [];
    const totalCapacity = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
      0,
    );
    const fromPrograms = programs.reduce(
      (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
      0,
    );
    const totalStudents =
      fromPrograms > 0
        ? fromPrograms
        : parseFloat(String(school.totalStudents)) || 0;
    const over =
      totalCapacity > 0 && totalStudents > totalCapacity * 1.1
        ? totalStudents - totalCapacity
        : 0;
    return {
      totalStudents,
      totalCapacity,
      classroomsNeeded: over > 0 ? Math.ceil(over / 40) : 0, // 40 learners / classroom
      overCapacityPct:
        totalCapacity > 0
          ? Math.round((totalStudents / totalCapacity - 1) * 100)
          : 0,
    };
  }

  /**
   * Severity-ordered, tagged recommendations. Every weak sub-dimension and every
   * data gap produces an actionable line — a school is never told "all good"
   * while it sits in a high-priority band.
   */
  private generateRecommendations(
    school: School,
    ctx: {
      infra: number;
      age: number;
      access: number;
      pop: number;
      facility: number;
      resolution: number;
      hasInfraDataGap: boolean;
      hasPopDataGap: boolean;
    },
  ): string[] {
    const recs: string[] = [];
    const buildings = school.buildings || [];
    const criticalBuildings = buildings.filter(
      (b) =>
        b.condition === BuildingCondition.CRITICAL ||
        b.condition === BuildingCondition.POOR,
    );
    const cap = this.capacityGap(school);

    // ── Urgent: structural & overcrowding ──────────────────────────────────
    if (criticalBuildings.length > 0) {
      recs.push(
        `[URGENT] Structural renovation required for ${criticalBuildings.length} building(s) in poor/critical condition.`,
      );
    } else if (ctx.infra < 35 && !ctx.hasInfraDataGap) {
      recs.push(
        `[URGENT] Building stock scores ${Math.round(ctx.infra)}/100 — commission a structural safety audit.`,
      );
    }
    if (cap.classroomsNeeded > 0) {
      recs.push(
        `[CRITICAL] Over capacity by ${cap.overCapacityPct}% — add ${cap.classroomsNeeded} classroom(s) or introduce shift scheduling.`,
      );
    }

    // ── Data gaps: cannot score accurately without these ───────────────────
    if (ctx.hasInfraDataGap) {
      recs.push(
        '[DATA] No building-condition records on file — dispatch a facility survey / drone KMZ capture to enable accurate scoring.',
      );
    }
    if (ctx.hasPopDataGap) {
      recs.push(
        '[DATA] Catchment demographic data unavailable — request an ArcGIS population pull for this sector.',
      );
    }

    // ── Planned interventions by weak sub-dimension ────────────────────────
    if (ctx.age < 45 && !ctx.hasInfraDataGap) {
      recs.push(
        `[PLAN] Ageing asset portfolio (age score ${Math.round(ctx.age)}/100) — budget for phased renewal.`,
      );
    }
    if (ctx.access < 45) {
      recs.push(
        `[ACCESS] Poor road access (${Math.round(ctx.access)}/100) — coordinate all-season access works with RTDA / district.`,
      );
    }
    if (ctx.pop < 40) {
      recs.push(
        '[CAPACITY] Demographic pressure exceeds capacity headroom — begin an expansion feasibility study.',
      );
    }
    if (ctx.facility < 50) {
      recs.push(
        `[COMPLIANCE] Facility survey shows gaps (${Math.round(ctx.facility)}/100) — remediate WASH, safety and accessibility items.`,
      );
    }
    if (ctx.resolution < 50) {
      recs.push(
        '[OPERATIONS] Low issue-resolution rate — strengthen maintenance follow-through and close outstanding reports.',
      );
    }

    if (recs.length === 0) {
      recs.push(
        '[OK] All indicators within acceptable range — continue routine maintenance and monitoring.',
      );
    }

    return recs.slice(0, 6);
  }

  /**
   * Indicative rehabilitation budget in RWF. Not a bill of quantities — a
   * planning-grade estimate so the decision queue can be sorted/summed by cost.
   */
  private estimateBudgetRwf(
    school: School,
    ctx: {
      infra: number;
      age: number;
      access: number;
      pop: number;
      facility: number;
    },
  ): number | null {
    const UNIT = {
      criticalBlock: 45_000_000, // major rehab of a poor/critical block
      ageingBlock: 12_000_000, // renewal contribution per block
      survey: 3_500_000, // facility survey + KMZ capture
      classroom: 18_000_000, // one new classroom
      access: 20_000_000, // all-season access works
      compliance: 8_000_000, // WASH / safety remediation package
    };
    const buildings = school.buildings || [];
    const criticalBuildings = buildings.filter(
      (b) =>
        b.condition === BuildingCondition.CRITICAL ||
        b.condition === BuildingCondition.POOR,
    ).length;
    const cap = this.capacityGap(school);

    let budget = 0;
    budget += criticalBuildings * UNIT.criticalBlock;
    if (buildings.length === 0) budget += UNIT.survey;
    if (ctx.age < 40 && buildings.length > 0)
      budget += buildings.length * UNIT.ageingBlock;
    budget += cap.classroomsNeeded * UNIT.classroom;
    if (ctx.access < 45) budget += UNIT.access;
    if (ctx.facility < 50) budget += UNIT.compliance;

    return budget > 0 ? budget : null;
  }

  private async calculateFacilityComplianceScore(
    schoolId: string,
  ): Promise<number> {
    const surveys = await this.surveyRepository.find({
      where: { schoolId },
    });

    if (surveys.length === 0) return NEUTRAL_SCORE; // Default if no surveys

    // `?? NEUTRAL_SCORE` (not `||`) so NON_COMPLIANT → 0 is not silently coerced to 50.
    const totalScore = surveys.reduce(
      (sum, survey) =>
        sum + (COMPLIANCE_SCORE_MAP[survey.compliance] ?? NEUTRAL_SCORE),
      0,
    );

    return Math.round(totalScore / surveys.length);
  }
}
