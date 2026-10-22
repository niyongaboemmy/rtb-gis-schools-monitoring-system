import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
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
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { SchoolFacilitySurvey } from '../schools/entities/school-facility-survey.entity';
import { SchoolMetricsDto } from './dto/school-metrics.dto';
import { IssueReport } from '../reports/entities/issue-report.entity';
import { AccessScope, applySchoolScope } from '../../common/scope/access-scope';
import {
  ACTIVE_SCHOOL_STATUS,
  whereActiveSchool,
} from '../../common/school/active-school';
import {
  NEUTRAL_SCORE,
  SCORE_WEIGHTS,
  SCORING_MODEL,
  SCORING_VERSION,
} from './scoring.constants';
import { AuditService, AuditActor } from '../audit/audit.service';
import {
  ComponentDataGaps,
  assessedBuildings,
  capacityInputs,
  capacityUtilisationPct,
  landSummary,
  maleTeacherSharePct,
  measuredSchoolAgePopulation,
  nationalCapacityUtilisation as computeNationalCapacityUtilisation,
  programmeTotals,
  staffCount,
  studentTeacherRatio,
  teacherCount,
} from './school-metrics.helpers';
import { computeRiskAssessment } from './risk-assessment';
import {
  AssessmentResult,
  ScoringInputs,
  assessmentChanged,
  computeAssessment,
} from './scoring-engine';
import {
  OverviewReportRow,
  OverviewSchool,
  ReportRow,
  summariseIssueReports,
} from './report-stats';
import { EventsGateway } from '../events/events.gateway';

const DAY_MS = 86_400_000;

/** Minimum peers before a district/province benchmark is shown. */
export const MIN_PEER_COUNT = 3;

/** Postgres unique_violation. */
const isUniqueViolation = (err: unknown): boolean =>
  err instanceof QueryFailedError &&
  (err as QueryFailedError & { driverError?: { code?: string } }).driverError
    ?.code === '23505';

/** pg returns numeric/decimal as strings; null/'' / NaN → null. */
const numOrNull = (v: unknown): number | null => {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string' && v.trim() !== ''
        ? parseFloat(v)
        : NaN;
  return Number.isFinite(n) ? n : null;
};
const intOr0 = (v: unknown): number => Math.trunc(numOrNull(v) ?? 0);

@Injectable()
export class AnalyticsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AnalyticsService.name);
  /** Per-school recalculation in flight, so bursts of writes coalesce. */
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly dirty = new Set<string>();

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

  // ── Lifecycle: keep stored scores current ──────────────────────────────────

  /**
   * On boot, rescore every active school whose assessment is missing or was
   * computed with older rules (SCORING_VERSION). Runs in the background so it
   * never delays startup; skipped under Jest.
   */
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    void this.recalculateOutdated().catch((err: unknown) =>
      this.logger.error(
        `Boot-time score refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  /** Active schools with no assessment or an outdated scoring version. */
  async findOutdatedSchoolIds(): Promise<string[]> {
    const rows = await whereActiveSchool(
      this.schoolRepository
        .createQueryBuilder('s')
        .leftJoin(DecisionAssessment, 'da', 'da.schoolId = CAST(s.id AS text)')
        .select('s.id', 'id')
        .where('(da.id IS NULL OR da.scoringVersion < :v)', {
          v: SCORING_VERSION,
        }),
      's',
    ).getRawMany<{ id: string }>();
    return rows.map((r) => String(r.id));
  }

  async recalculateOutdated(): Promise<{ processed: number }> {
    const ids = await this.findOutdatedSchoolIds();
    if (ids.length === 0) return { processed: 0 };
    this.logger.log(
      `Rescoring ${ids.length} school(s) with missing or pre-v${SCORING_VERSION} assessments`,
    );
    for (const id of ids) await this.recalculateSchoolScore(id);
    return { processed: ids.length };
  }

  /**
   * Nightly full rescore: the building-age component depends on the calendar
   * and any input change that slipped past an event is caught here.
   */
  @Cron('15 3 * * *', {
    name: 'nightly-score-recalculation',
    timeZone: 'Africa/Kigali',
  })
  async nightlyRecalculation(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    const { processed } = await this.recalculateAllScores();
    this.logger.log(`Nightly rescore complete: ${processed} school(s)`);
  }

  // ── National overview ──────────────────────────────────────────────────────

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

    // Operating schools only: every aggregate excludes `inactive` and
    // `under_renovation` rows so national KPIs reflect the live network.
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

    // The assessment row is the single source of every score figure; schools
    // without one count as "unassessed". `s` = School, `da` = assessment.
    const schoolsWithAssessment = () =>
      this.schoolRepository
        .createQueryBuilder('s')
        .leftJoin(DecisionAssessment, 'da', 'da.schoolId = CAST(s.id AS text)');
    const assessmentsOfActive = () =>
      this.assessmentRepository
        .createQueryBuilder('da')
        .innerJoin('School', 's', 'CAST(s.id AS text) = da.schoolId');

    const [
      totalSchools,
      byPriorityRaw,
      criticalSchools,
      recentAssessments,
      scoreAvgResult,
      teachersResult,
      kmzResult,
      surveyResult,
      budgetResult,
      lastCalcResult,
      provinceStatsRaw,
      capacityRows,
      dataGapRow,
    ] = await Promise.all([
      // 1. total active school count
      activeInScope(
        this.schoolRepository.createQueryBuilder('s'),
        's.id',
      ).getCount(),

      // 2. counts per Intervention Priority (null = unassessed)
      activeInScope(
        schoolsWithAssessment()
          .select('da.priorityLevel', 'priority')
          .addSelect('COUNT(*)', 'count'),
        's.id',
      )
        .groupBy('da.priorityLevel')
        .getRawMany(),

      // 3. critical spotlight — the five LOWEST scores first
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .innerJoin(
            DecisionAssessment,
            'da',
            'da.schoolId = CAST(s.id AS text)',
          )
          .where('da.priorityLevel = :crit', { crit: PriorityLevel.CRITICAL }),
        's.id',
      )
        .orderBy('da.overallScore', 'ASC')
        // limit, not take: take() wraps the query in a DISTINCT sub-select
        // that cannot see the joined (non-relation) `da` alias.
        .limit(5)
        .getMany(),

      // 4. recent assessments feed
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
        .orderBy('da.updatedAt', 'DESC')
        .take(10)
        .getMany(),

      // 5. score + component averages over scored active schools
      activeInScope(
        assessmentsOfActive()
          .select('ROUND(AVG(da.overallScore)::numeric, 1)', 'nationalAvgScore')
          .addSelect('COUNT(DISTINCT da.schoolId)', 'scoredCount'),
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
          `ROUND(AVG(COALESCE(da.facilityComplianceScore, ${NEUTRAL_SCORE}))::numeric, 1)`,
          'nationalAvgComplianceScore',
        )
        .addSelect(
          `ROUND(AVG(COALESCE(da.resolutionRateScore, ${NEUTRAL_SCORE}))::numeric, 1)`,
          'nationalAvgResolutionScore',
        )
        .addSelect('ROUND(AVG(da.dataCoverage)::numeric, 2)', 'avgDataCoverage')
        .getRawOne(),

      // 6. total teaching staff — gender breakdown when recorded, else column
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

      // 7. KMZ coverage — only COMPLETED uploads count as "mapped"
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select('COUNT(*)', 'withKmz')
          .where('s.kmzStatus = :status', {
            status: KmzProcessingStatus.COMPLETED,
          }),
        's.id',
      ).getRawOne(),

      // 8. survey coverage — distinct active schools with ≥1 surveyed item
      activeInScope(
        this.surveyRepository
          .createQueryBuilder('sv')
          .innerJoin('School', 's', 'CAST(s.id AS text) = sv.schoolId')
          .select('COUNT(DISTINCT sv.schoolId)', 'withSurvey'),
        'sv.schoolId',
      ).getRawOne(),

      // 9. total estimated rehabilitation budget
      activeInScope(
        assessmentsOfActive()
          .select('COALESCE(SUM(da.estimatedBudgetRwf), 0)', 'totalBudget')
          .where('da.estimatedBudgetRwf IS NOT NULL'),
        'da.schoolId',
      ).getRawOne(),

      // 10. last score change (assessments are only rewritten on change)
      activeInScope(
        assessmentsOfActive().select('MAX(da.updatedAt)', 'lastCalculatedAt'),
        'da.schoolId',
      ).getRawOne(),

      // 11. province stats — priority bands + avg/min/max over assessments
      activeInScope(
        schoolsWithAssessment()
          .select('s.province', 'province')
          .addSelect('COUNT(*)', 'total'),
        's.id',
      )
        .addSelect('COUNT(da.id)', 'scored')
        .addSelect(
          "SUM(CASE WHEN da.priorityLevel = 'critical' THEN 1 ELSE 0 END)",
          'critical',
        )
        .addSelect(
          "SUM(CASE WHEN da.priorityLevel = 'high' THEN 1 ELSE 0 END)",
          'high',
        )
        .addSelect(
          "SUM(CASE WHEN da.priorityLevel = 'medium' THEN 1 ELSE 0 END)",
          'medium',
        )
        .addSelect(
          "SUM(CASE WHEN da.priorityLevel = 'low' THEN 1 ELSE 0 END)",
          'low',
        )
        .addSelect('ROUND(AVG(da.overallScore)::numeric, 1)', 'avgScore')
        .addSelect('MIN(da.overallScore)', 'minScore')
        .addSelect('MAX(da.overallScore)', 'maxScore')
        .groupBy('s.province')
        .orderBy('total', 'DESC')
        .getRawMany(),

      // 12. enrolment + capacity inputs — programme roll-up done in JS
      //     (educationPrograms is a jsonb array; SQL aggregation is brittle).
      activeInScope(
        this.schoolRepository
          .createQueryBuilder('s')
          .select(['s.id', 's.totalStudents', 's.educationPrograms']),
        's.id',
      ).getMany(),

      // 13. data-gap counts per component (WS1.7)
      activeInScope(
        assessmentsOfActive()
          .select(
            'SUM(CASE WHEN da.hasInfraDataGap = true THEN 1 ELSE 0 END)',
            'infraGaps',
          )
          .addSelect(
            'SUM(CASE WHEN da.hasPopDataGap = true THEN 1 ELSE 0 END)',
            'popGaps',
          )
          .addSelect(
            `SUM(CASE WHEN (da."dataGaps"->>'buildingAge')::boolean THEN 1 ELSE 0 END)`,
            'ageGaps',
          )
          .addSelect(
            `SUM(CASE WHEN (da."dataGaps"->>'accessibility')::boolean THEN 1 ELSE 0 END)`,
            'accessGaps',
          )
          .addSelect(
            `SUM(CASE WHEN (da."dataGaps"->>'facilityCompliance')::boolean THEN 1 ELSE 0 END)`,
            'complianceGaps',
          )
          .addSelect(
            `SUM(CASE WHEN (da."dataGaps"->>'resolution')::boolean THEN 1 ELSE 0 END)`,
            'resolutionGaps',
          ),
        'da.schoolId',
      ).getRawOne(),
    ]);

    // ── Parse — pg returns numerics as strings; no data → null, never 0 ──────
    const scoredSchoolCount = intOr0(scoreAvgResult?.scoredCount);
    const avg = (k: string) =>
      scoredSchoolCount > 0 ? numOrNull(scoreAvgResult?.[k]) : null;

    // Enrolment uses the same programme roll-up as the school dashboard
    // (programmeTotals), so national = Σ school figures.
    const totalStudents = capacityRows.reduce(
      (sum, s) => sum + programmeTotals(s).students,
      0,
    );
    const nationalCapacityUtilisation =
      computeNationalCapacityUtilisation(capacityRows);
    const totalTeachers = intOr0(teachersResult?.totalTeachers);
    const withKmz = intOr0(kmzResult?.withKmz);
    const withSurvey = intOr0(surveyResult?.withSurvey);
    const pct = (n: number) =>
      totalSchools > 0 ? Math.round((n / totalSchools) * 100) : null;

    const provinceStats = provinceStatsRaw.map((p) => ({
      province: p.province as string,
      total: intOr0(p.total),
      scored: intOr0(p.scored),
      critical: intOr0(p.critical),
      high: intOr0(p.high),
      medium: intOr0(p.medium),
      low: intOr0(p.low),
      // null when the province has no scored schools — never a fake 0.
      avgScore: numOrNull(p.avgScore),
      minScore: numOrNull(p.minScore),
      maxScore: numOrNull(p.maxScore),
    }));

    const byPriority = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unassessed: 0,
    } as Record<PriorityLevel | 'unassessed', number>;
    for (const r of byPriorityRaw) {
      const key = (r.priority || 'unassessed') as keyof typeof byPriority;
      if (key in byPriority) byPriority[key] += intOr0(r.count);
    }

    const dataGaps = {
      scoredSchools: scoredSchoolCount,
      infrastructure: intOr0(dataGapRow?.infraGaps),
      population: intOr0(dataGapRow?.popGaps),
      buildingAge: intOr0(dataGapRow?.ageGaps),
      accessibility: intOr0(dataGapRow?.accessGaps),
      facilityCompliance: intOr0(dataGapRow?.complianceGaps),
      resolution: intOr0(dataGapRow?.resolutionGaps),
    };

    const componentAverages = {
      infrastructure: avg('nationalAvgInfraScore'),
      buildingAge: avg('nationalAvgAgeScore'),
      accessibility: avg('nationalAvgAccessScore'),
      population: avg('nationalAvgPopScore'),
      facilityCompliance: avg('nationalAvgComplianceScore'),
      resolution: avg('nationalAvgResolutionScore'),
    };
    const avgDataCoverage = avg('avgDataCoverage');

    return {
      totalSchools,
      scoredSchoolCount,
      nationalAvgScore: avg('nationalAvgScore'),
      nationalAvgInfraScore: componentAverages.infrastructure,
      nationalAvgPopScore: componentAverages.population,
      nationalAvgAgeScore: componentAverages.buildingAge,
      nationalAvgAccessScore: componentAverages.accessibility,
      nationalAvgComplianceScore: componentAverages.facilityCompliance,
      nationalAvgResolutionScore: componentAverages.resolution,
      avgDataCoverage,
      nationalCapacityUtilisation,
      dataGaps,
      totalStudents,
      totalTeachers,
      kmzCoverageRate: pct(withKmz),
      surveyCompletionRate: pct(withSurvey),
      totalEstimatedBudgetRwf: numOrNull(budgetResult?.totalBudget) ?? 0,
      lastCalculatedAt: lastCalcResult?.lastCalculatedAt ?? null,
      byPriority,
      criticalSchools,
      recentAssessments,
      provinceStats,
      scoringModel: SCORING_MODEL,
      nationalRecommendations: this.generateNationalRecommendations({
        criticalCount: byPriority.critical,
        unassessed: byPriority.unassessed,
        scoredSchoolCount,
        provinceStats,
        dataGaps,
        componentAverages,
        avgDataCoverage,
      }),
    };
  }

  async exportNationalCsv(): Promise<string> {
    // Join on the `schoolId` varchar (the school_id FK is NULL on old rows).
    // Only active schools are exported; assessments whose school was deleted
    // or deactivated are dropped by the `schoolMap.has` filter.
    const [assessments, schools] = await Promise.all([
      this.assessmentRepository.find({ order: { overallScore: 'ASC' } }),
      this.schoolRepository.find({
        where: { status: ACTIVE_SCHOOL_STATUS as any },
      }),
    ]);
    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    const csvCell = (v: unknown) => {
      const s =
        v == null
          ? ''
          : typeof v === 'object'
            ? JSON.stringify(v)
            : `${v as string | number | boolean}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmt0 = (v: unknown, fallback: number | null = null) => {
      const n = numOrNull(v) ?? fallback;
      return n == null ? '' : n.toFixed(0);
    };
    const gap = (a: DecisionAssessment, k: keyof ComponentDataGaps) =>
      a.dataGaps?.[k] ? 'estimated' : '';

    const header = [
      'Name',
      'Code',
      'Province',
      'District',
      'School Condition Score',
      'Intervention Priority',
      'Data Coverage %',
      'Infrastructure Score',
      'Infrastructure Data',
      'Building Age Score',
      'Accessibility Score',
      'Population Pressure Score',
      'Population Data',
      'Facility Compliance Score',
      'Resolution Rate Score',
      'Total Students',
      'Urgency (months)',
      'Estimated Budget (RWF)',
      'Last Changed',
    ].join(',');

    const rows = assessments
      .filter((a) => schoolMap.has(a.schoolId))
      .map((a) => {
        const s = schoolMap.get(a.schoolId)!;
        const coverage = numOrNull(a.dataCoverage);
        return [
          csvCell(s.name),
          csvCell(s.code),
          csvCell(s.province),
          csvCell(s.district),
          fmt0(a.overallScore),
          a.priorityLevel ?? '',
          coverage == null ? '' : Math.round(coverage * 100),
          fmt0(a.infrastructureScore),
          a.hasInfraDataGap ? 'estimated' : '',
          fmt0(a.buildingAgeScore),
          fmt0(a.accessibilityScore),
          fmt0(a.populationPressureScore),
          a.hasPopDataGap ? 'estimated' : gap(a, 'population'),
          fmt0(a.facilityComplianceScore, NEUTRAL_SCORE),
          fmt0(a.resolutionRateScore, NEUTRAL_SCORE),
          programmeTotals(s).students,
          a.urgencyMonths ?? '',
          fmt0(a.estimatedBudgetRwf),
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
    const parseRow = (r: any, labelKey: string) => ({
      label: r[labelKey] as string,
      total: intOr0(r.total),
      scored: intOr0(r.scored),
      critical: intOr0(r.critical),
      high: intOr0(r.high),
      medium: intOr0(r.medium),
      low: intOr0(r.low),
      // null when nothing in the group is scored — never a fake 0.
      avgScore: numOrNull(r.avgScore),
    });

    const grouped = (labelCol: string, label: string) => {
      const qb = this.schoolRepository
        .createQueryBuilder('s')
        .leftJoin(DecisionAssessment, 'da', 'da.schoolId = CAST(s.id AS text)')
        .select(labelCol, label)
        .addSelect('COUNT(*)', 'total')
        .addSelect('COUNT(da.id)', 'scored');
      for (const band of ['critical', 'high', 'medium', 'low'])
        qb.addSelect(
          `SUM(CASE WHEN da.priorityLevel = '${band}' THEN 1 ELSE 0 END)`,
          band,
        );
      return qb.addSelect(
        'ROUND(AVG(da.overallScore)::numeric, 1)',
        'avgScore',
      );
    };

    if (!province) {
      const qb = grouped('s.province', 'province');
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
      const qb = grouped('s.district', 'district').where(
        's.province = :province',
        { province },
      );
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

    // Province + district → individual school rows (score from the assessment)
    const schoolsQb = this.schoolRepository
      .createQueryBuilder('s')
      .leftJoin(DecisionAssessment, 'da', 'da.schoolId = CAST(s.id AS text)')
      .select('s.id', 'id')
      .addSelect('s.name', 'name')
      .addSelect('s.code', 'code')
      .addSelect('s.kmzStatus', 'kmzStatus')
      .addSelect('da.priorityLevel', 'priorityLevel')
      .addSelect('da.overallScore', 'overallScore')
      .addSelect('da.dataCoverage', 'dataCoverage')
      .where('s.province = :province', { province })
      .andWhere('s.district = :district', { district })
      .orderBy('da.overallScore', 'ASC', 'NULLS LAST');
    scoped(schoolsQb);
    const schools = (await schoolsQb.getRawMany()).map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      kmzStatus: r.kmzStatus,
      priorityLevel: r.priorityLevel ?? null,
      overallScore: numOrNull(r.overallScore),
      dataCoverage: numOrNull(r.dataCoverage),
    }));
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
      recommendation: recommendation.trim(),
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

  /**
   * National recommendations derived from the aggregates — one line per
   * finding, no duplicates, and data gaps called out as "collect" actions.
   */
  generateNationalRecommendations(c: {
    criticalCount: number;
    unassessed: number;
    scoredSchoolCount: number;
    provinceStats: Array<{
      province: string;
      avgScore: number | null;
      scored: number;
    }>;
    dataGaps: Record<string, number>;
    componentAverages: Record<keyof typeof SCORE_WEIGHTS, number | null>;
    avgDataCoverage: number | null;
  }): string[] {
    const recs: string[] = [];
    const plural = (n: number, word: string) =>
      `${n} ${word}${n === 1 ? '' : 's'}`;

    if (c.criticalCount > 0) {
      recs.push(
        `[URGENT] ${plural(c.criticalCount, 'school')} in the Critical band need immediate intervention — start with the lowest scores on the Decisions page.`,
      );
    }

    const rated = c.provinceStats.filter(
      (p) => p.province && p.avgScore != null && p.scored > 0,
    );
    if (rated.length > 1) {
      const lowest = [...rated].sort(
        (a, b) => (a.avgScore as number) - (b.avgScore as number),
      )[0];
      recs.push(
        `[STRATEGIC] ${lowest.province} has the lowest average condition score (${Math.round(lowest.avgScore as number)}) — prioritise it in the next intervention cycle.`,
      );
    }

    // Weakest MEASURED national component (skip components that are mostly
    // estimated — their average is dominated by the neutral 50).
    const labels: Record<string, string> = {
      infrastructure: 'building condition',
      buildingAge: 'building age',
      accessibility: 'road access',
      population: 'capacity headroom',
      facilityCompliance: 'facility compliance',
      resolution: 'issue resolution',
    };
    const gapKey: Record<string, string> = {
      infrastructure: 'infrastructure',
      buildingAge: 'buildingAge',
      accessibility: 'accessibility',
      population: 'population',
      facilityCompliance: 'facilityCompliance',
      resolution: 'resolution',
    };
    const measured = (
      Object.keys(c.componentAverages) as Array<keyof typeof SCORE_WEIGHTS>
    ).filter(
      (k) =>
        c.componentAverages[k] != null &&
        c.scoredSchoolCount > 0 &&
        (c.dataGaps[gapKey[k]] ?? 0) / c.scoredSchoolCount < 0.5,
    );
    if (measured.length > 0) {
      const weakest = measured.sort(
        (a, b) =>
          (c.componentAverages[a] as number) -
          (c.componentAverages[b] as number),
      )[0];
      const v = c.componentAverages[weakest] as number;
      if (v < 55) {
        recs.push(
          `[FOCUS] Weakest measured factor nationally: ${labels[weakest]} (average ${Math.round(v)}/100).`,
        );
      }
    }

    if (c.dataGaps.infrastructure > 0) {
      recs.push(
        `[DATA] ${c.dataGaps.infrastructure} of ${plural(c.scoredSchoolCount, 'scored school')} have no assessed building records — schedule facility surveys.`,
      );
    }
    if (c.dataGaps.population > 0) {
      recs.push(
        `[DATA] Population data missing for ${plural(c.dataGaps.population, 'school')} — run a population sync.`,
      );
    }
    if (c.avgDataCoverage != null && c.avgDataCoverage < 0.5) {
      recs.push(
        `[DATA] On average only ${Math.round(c.avgDataCoverage * 100)}% of each score is measured — treat priorities as provisional until data is collected.`,
      );
    }
    if (c.unassessed > 0) {
      recs.push(
        `[DATA] ${plural(c.unassessed, 'active school')} not yet scored.`,
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

    const rows = await qb.getMany();
    return this.attachDataGaps(rows);
  }

  /**
   * Every decision row carries `dataGaps` (which components used the neutral
   * 50 — WS1.7). Stored on the assessment since scoring v2; pre-v2 rows (only
   * until the boot-time rescore finishes) fall back to the two stored flags.
   */
  private attachDataGaps(
    rows: DecisionAssessment[],
  ): Array<DecisionAssessment & { dataGaps: ComponentDataGaps }> {
    return rows.map((r) =>
      Object.assign(r, {
        dataGaps: r.dataGaps ?? {
          infrastructure: !!r.hasInfraDataGap,
          buildingAge: false,
          accessibility: false,
          population: !!r.hasPopDataGap,
          facilityCompliance: r.facilityComplianceScore == null,
          resolution: r.resolutionRateScore == null,
        },
      }),
    );
  }

  // ── Recalculation ──────────────────────────────────────────────────────────

  async recalculateAllScores(
    actor?: AuditActor,
  ): Promise<{ processed: number }> {
    const schools = await this.schoolRepository.find({
      where: { status: ACTIVE_SCHOOL_STATUS as any },
      relations: ['buildings'],
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
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: ['buildings'],
    });
    if (!school) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }
    return this.calculateSchoolScore(school);
  }

  /**
   * Any write that feeds a score emits `school.updated` (school profile,
   * buildings, surveys, issue reports, population sync, KMZ import). Bursts
   * for the same school coalesce into one trailing recalculation.
   */
  @OnEvent('school.updated')
  handleSchoolUpdated(event: { schoolId: string }): Promise<void> {
    const id = event?.schoolId;
    if (!id) return Promise.resolve();
    const running = this.inflight.get(id);
    if (running) {
      this.dirty.add(id);
      return running;
    }
    const run = (async () => {
      do {
        this.dirty.delete(id);
        try {
          await this.recalculateSchoolScore(id);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Background recalculation failed for school ${id}: ${message}`,
          );
        }
      } while (this.dirty.has(id));
    })().finally(() => this.inflight.delete(id));
    this.inflight.set(id, run);
    return run;
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

  // ── Scoring: load → compute (pure) → persist ───────────────────────────────

  /** Every input the score needs, plus the report rows the dashboard reuses. */
  private async loadScoringInputs(
    school: School,
    now = new Date(),
  ): Promise<{
    inputs: ScoringInputs;
    reports: ReportRow[];
    population: PopulationData | null;
    latestSurveyAt: Date | null;
  }> {
    // Population is loaded by the `schoolId` varchar column: the
    // `populationData` relation joins on the `school_id` FK, which the ArcGIS
    // sync never populates, so the relation is always empty.
    const [population, surveys, reports] = await Promise.all([
      this.populationRepository.findOne({
        where: { schoolId: school.id },
        order: { syncedAt: 'DESC' },
      }),
      this.surveyRepository.find({ where: { schoolId: school.id } }),
      // Uncapped, minimal columns: the score, the overview card and the
      // Issue Reports tab all count the same rows.
      this.findReportRows(school.id),
    ]);
    const latestSurveyAt = surveys.reduce<Date | null>((latest, s) => {
      const t = s.inspectedAt ?? s.updatedAt ?? s.createdAt;
      if (!t) return latest;
      const d = new Date(t);
      return !latest || d > latest ? d : latest;
    }, null);
    return {
      inputs: {
        school: {
          id: school.id,
          buildings: school.buildings ?? [],
          educationPrograms: school.educationPrograms,
          totalStudents: school.totalStudents,
          establishedYear: school.establishedYear,
          roadStatusPercentage: school.roadStatusPercentage,
        },
        population: population ?? null,
        surveys,
        reports: reports as unknown as ReportRow[],
        now,
      },
      reports: reports as unknown as ReportRow[],
      population: population ?? null,
      latestSurveyAt,
    };
  }

  /** Compute a school's assessment without writing anything. */
  async previewSchoolScore(school: School): Promise<AssessmentResult> {
    const { inputs } = await this.loadScoringInputs(school);
    return computeAssessment(inputs);
  }

  /**
   * Compute and persist. Writes only when something changed: the assessment
   * row (one per school), the school's cached score columns, one history
   * snapshot and one `scores:updated` socket event.
   */
  async calculateSchoolScore(school: School): Promise<DecisionAssessment> {
    const { inputs } = await this.loadScoringInputs(school);
    const result = computeAssessment(inputs);
    return this.persistAssessment(school, result);
  }

  private async persistAssessment(
    school: School,
    result: AssessmentResult,
    retried = false,
  ): Promise<DecisionAssessment> {
    const existing = await this.assessmentRepository.findOne({
      where: { schoolId: school.id },
    });
    if (
      existing &&
      !assessmentChanged(existing as unknown as Record<string, unknown>, result)
    ) {
      return existing;
    }

    const fields: Partial<DecisionAssessment> = {
      infrastructureScore: result.infrastructureScore,
      buildingAgeScore: result.buildingAgeScore,
      accessibilityScore: result.accessibilityScore,
      populationPressureScore: result.populationPressureScore,
      facilityComplianceScore: result.facilityComplianceScore,
      resolutionRateScore: result.resolutionRateScore,
      hasInfraDataGap: result.hasInfraDataGap,
      hasPopDataGap: result.hasPopDataGap,
      dataGaps: result.dataGaps,
      dataCoverage: result.dataCoverage,
      scoringVersion: result.scoringVersion,
      overallScore: result.overallScore,
      urgencyMonths: result.urgencyMonths,
      priorityLevel: result.priorityLevel,
      recommendations: result.recommendations,
      primaryRecommendation: result.primaryRecommendation ?? undefined,
      // null clears a previous budget when nothing needs funding anymore.
      estimatedBudgetRwf: result.estimatedBudgetRwf as number,
    };

    const entity = existing
      ? Object.assign(existing, fields)
      : this.assessmentRepository.create({ schoolId: school.id, ...fields });

    let saved: DecisionAssessment;
    try {
      saved = await this.assessmentRepository.save(entity);
    } catch (err) {
      // Two first-time calculations raced; the unique index kept one row.
      if (!existing && !retried && isUniqueViolation(err)) {
        return this.persistAssessment(school, result, true);
      }
      throw err;
    }

    // Denormalised cache on `schools` (map, list sorting). Derived data, so it
    // is written directly; the audited record of the change is the assessment.
    if (
      numOrNull(school.overallScore) !== result.overallScore ||
      // schools.priorityLevel and the assessment use two enums with the same values
      String(school.priorityLevel) !== String(result.priorityLevel)
    ) {
      await this.schoolRepository.update(school.id, {
        priorityLevel:
          result.priorityLevel as unknown as School['priorityLevel'],
        overallScore: result.overallScore,
      });
    }

    await this.scoreHistoryRepository.save({
      schoolId: school.id,
      overallScore: result.overallScore,
      infrastructureScore: result.infrastructureScore,
      buildingAgeScore: result.buildingAgeScore,
      accessibilityScore: result.accessibilityScore,
      populationPressureScore: result.populationPressureScore,
      facilityComplianceScore: result.facilityComplianceScore,
      resolutionRateScore: result.resolutionRateScore,
    });

    this.eventsGateway?.emitScoresRecalculated(school.id, {
      schoolId: school.id,
      overallScore: result.overallScore,
      infrastructureScore: result.infrastructureScore,
      buildingAgeScore: result.buildingAgeScore,
      accessibilityScore: result.accessibilityScore,
      populationPressureScore: result.populationPressureScore,
      facilityComplianceScore: result.facilityComplianceScore,
      resolutionRateScore: result.resolutionRateScore,
      priorityLevel: result.priorityLevel,
      dataGaps: result.dataGaps,
      dataCoverage: result.dataCoverage,
      calculatedAt: new Date().toISOString(),
    });

    return saved;
  }

  // ── School dashboard (read-only) ───────────────────────────────────────────

  /**
   * Inputs of the Issue Reports tab: every report row (uncapped, minimal
   * columns, reporter name) and the school's buildings; 404 when unknown.
   */
  /**
   * Reporting overview inputs: active schools in the caller's scope and their
   * Issue Report rows (no row cap — the figures must match the school view).
   */
  async getScopedReportingInputs(scope?: AccessScope): Promise<{
    schools: OverviewSchool[];
    rows: OverviewReportRow[];
  }> {
    let qb = whereActiveSchool(
      this.schoolRepository
        .createQueryBuilder('s')
        .select(['s.id', 's.name', 's.code', 's.district', 's.province']),
      's',
    );
    if (scope) qb = applySchoolScope(qb, scope, 's');
    const schools = await qb.getMany();
    if (schools.length === 0) return { schools: [], rows: [] };
    const rows = await this.issueReportRepository.find({
      where: { schoolId: In(schools.map((s) => s.id)) },
      select: {
        id: true,
        schoolId: true,
        status: true,
        type: true,
        createdAt: true,
        resolvedAt: true,
        facilityId: true,
        description: true,
      },
    });
    return {
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        district: s.district,
        province: s.province,
      })),
      rows: rows as unknown as OverviewReportRow[],
    };
  }

  async getSchoolReportingInputs(schoolId: string): Promise<{
    rows: ReportRow[];
    buildings: SchoolBuilding[];
  }> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const exists = await this.schoolRepository.exists({
      where: { id: schoolId },
    });
    if (!exists) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }
    const [rows, buildings] = await Promise.all([
      this.findReportRows(schoolId, true),
      this.buildingRepository.find({
        where: { schoolId },
        select: ['id', 'name', 'yearBuilt', 'condition'],
      }),
    ]);
    return { rows, buildings };
  }

  private async findReportRows(
    schoolId: string,
    withReporter = false,
  ): Promise<ReportRow[]> {
    const rows = await this.issueReportRepository.find({
      where: { schoolId },
      select: {
        id: true,
        status: true,
        type: true,
        createdAt: true,
        resolvedAt: true,
        issueCategory: true,
        facilityId: true,
        buildingId: true,
        description: true,
        ...(withReporter
          ? {
              reporter: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            }
          : {}),
      },
      ...(withReporter ? { relations: { reporter: true } } : {}),
      order: { createdAt: 'DESC' },
    });
    return rows as unknown as ReportRow[];
  }

  /**
   * Everything the school dashboard shows. READ-ONLY: the score comes from the
   * stored assessment; only when none exists (or it predates the current
   * scoring rules) is it computed in memory — never persisted from a GET.
   */
  async getSchoolMetrics(schoolId: string): Promise<SchoolMetricsDto> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      relations: ['buildings'],
    });
    if (!school) {
      throw new NotFoundException(`School with id "${schoolId}" not found`);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const { inputs, reports, population, latestSurveyAt } =
      await this.loadScoringInputs(school, now);
    const computed = computeAssessment(inputs);

    const stored = await this.assessmentRepository.findOne({
      where: { schoolId },
    });
    const useStored =
      !!stored && (stored.scoringVersion ?? 0) >= SCORING_VERSION;
    const a = {
      overallScore: useStored
        ? numOrNull(stored.overallScore)!
        : computed.overallScore,
      infrastructureScore: useStored
        ? numOrNull(stored.infrastructureScore)!
        : computed.infrastructureScore,
      buildingAgeScore: useStored
        ? numOrNull(stored.buildingAgeScore)!
        : computed.buildingAgeScore,
      accessibilityScore: useStored
        ? numOrNull(stored.accessibilityScore)!
        : computed.accessibilityScore,
      populationPressureScore: useStored
        ? numOrNull(stored.populationPressureScore)!
        : computed.populationPressureScore,
      facilityComplianceScore: useStored
        ? (numOrNull(stored.facilityComplianceScore) ?? NEUTRAL_SCORE)
        : computed.facilityComplianceScore,
      resolutionRateScore: useStored
        ? (numOrNull(stored.resolutionRateScore) ?? NEUTRAL_SCORE)
        : computed.resolutionRateScore,
      priorityLevel: useStored ? stored.priorityLevel : computed.priorityLevel,
      urgencyMonths: useStored
        ? (stored.urgencyMonths ?? null)
        : computed.urgencyMonths,
      recommendations: useStored
        ? (stored.recommendations ?? [])
        : computed.recommendations,
      primaryRecommendation: useStored
        ? (stored.primaryRecommendation ?? null)
        : computed.primaryRecommendation,
      estimatedBudgetRwf: useStored
        ? numOrNull(stored.estimatedBudgetRwf)
        : computed.estimatedBudgetRwf,
      dataGaps: (useStored && stored.dataGaps) || computed.dataGaps,
      dataCoverage: useStored
        ? (numOrNull(stored.dataCoverage) ?? computed.dataCoverage)
        : computed.dataCoverage,
      calculatedAt: useStored ? stored.updatedAt : null,
    };

    // ── Students / capacity / staff (school-metrics.helpers.ts) ──────────────
    const { students: totalStudents, capacity: totalCapacity } =
      programmeTotals(school);
    const cap = capacityInputs(school);
    const totalTeachers = teacherCount(school);
    const land = landSummary(school);
    const assessed = assessedBuildings(school.buildings ?? []);
    const avgBuildingAge = computed.basis.avgBuildingAge;

    const establishedYearParsed = school.establishedYear
      ? parseInt(String(school.establishedYear), 10)
      : null;

    // ── Peer benchmarking: other active, scored schools in the same area ──────
    const peerAvg = (col: 'district' | 'province', value: string) =>
      whereActiveSchool(
        this.assessmentRepository
          .createQueryBuilder('da')
          .innerJoin('School', 's', 'CAST(s.id AS text) = da.schoolId')
          .select('ROUND(AVG(da.overallScore)::numeric, 1)', 'avg')
          .addSelect('COUNT(*)', 'n')
          .where(`s.${col} = :v`, { v: value })
          .andWhere('s.id != :id', { id: school.id }),
        's',
      ).getRawOne();
    const [districtRow, provinceRow] = await Promise.all([
      peerAvg('district', school.district),
      peerAvg('province', school.province),
    ]);
    const peer = (row: any) => {
      const n = intOr0(row?.n);
      return { avg: n >= MIN_PEER_COUNT ? numOrNull(row?.avg) : null, n };
    };
    const district = peer(districtRow);
    const province = peer(provinceRow);
    const delta = (avg: number | null) =>
      avg == null ? null : Math.round((a.overallScore - avg) * 10) / 10;

    // ── Data completeness: the same facts as the data-gap flags ──────────────
    const completenessChecks = [
      assessed.length > 0, // assessed building records
      totalStudents > 0, // enrolment
      totalTeachers > 0, // teaching staff
      !!school.province,
      !!school.district,
      school.roadStatusPercentage != null, // accessibility
      establishedYearParsed != null, // school age
      latestSurveyAt != null, // facility survey
      measuredSchoolAgePopulation(population) !== null, // population
      school.kmzStatus === KmzProcessingStatus.COMPLETED, // site map
    ];
    const dataCompletenessScore = Math.round(
      (completenessChecks.filter(Boolean).length / completenessChecks.length) *
        100,
    );

    const reportSummary = summariseIssueReports(reports, now);

    const riskAssessment = computeRiskAssessment({
      overallScore: a.overallScore,
      infrastructureScore: a.infrastructureScore,
      populationScore: a.populationPressureScore,
      urgencyMonths: a.urgencyMonths,
      buildingCount: assessed.length,
      poorOrCriticalBuildingCount: computed.basis.poorOrCriticalBuildingCount,
      avgBuildingAge,
      hasPopDataGap: a.dataGaps.population,
      hasInfraDataGap: a.dataGaps.infrastructure,
      daysSinceLastSurvey: latestSurveyAt
        ? (now.getTime() - latestSurveyAt.getTime()) / DAY_MS
        : null,
      needsInterventionCount: reportSummary.critical,
      failedCount: reportSummary.failed,
      avgResolutionDays: reportSummary.avgResolutionDays,
      oldestOpenDays: reportSummary.oldestOpenDays,
    });

    // ── Assemble DTO ──────────────────────────────────────────────────────────
    const dto = new SchoolMetricsDto();
    dto.schoolId = school.id;
    dto.schoolName = school.name;
    dto.schoolCode = school.code;
    dto.calculatedAt = (a.calculatedAt ?? now).toISOString();
    dto.provisional = !useStored;

    dto.totalStudents = totalStudents;
    dto.totalCapacity = totalCapacity;
    dto.totalTeachers = totalTeachers;
    dto.totalStaff = staffCount(school);
    dto.capacityUtilisation = cap
      ? capacityUtilisationPct(cap.students, cap.capacity)
      : null;
    dto.maleTeacherShare = maleTeacherSharePct(school);
    dto.studentToTeacherRatio = studentTeacherRatio(
      totalStudents,
      totalTeachers,
    );

    // Utility columns are not collected yet — null, never a made-up value.
    dto.hasElectricity = null;
    dto.waterSourceType = null;
    dto.hasInternet = null;

    dto.buildingCount = (school.buildings ?? []).length;
    dto.assessedBuildingCount = assessed.length;
    dto.avgBuildingAge = avgBuildingAge;
    dto.avgBuildingYear =
      avgBuildingAge !== null ? currentYear - avgBuildingAge : null;

    dto.establishedYear = establishedYearParsed;
    dto.schoolAge =
      establishedYearParsed != null
        ? currentYear - establishedYearParsed
        : null;

    dto.educationProgramsCount = (school.educationPrograms ?? []).length;
    dto.usedLandArea = land.usedHa;
    dto.unusedLandArea = land.unusedHa;
    dto.totalLandArea = land.totalHa;
    dto.usedLandPct = land.usedPct;
    dto.roadStatusPercentage = numOrNull(school.roadStatusPercentage);

    dto.overallScore = a.overallScore;
    dto.infrastructureScore = a.infrastructureScore;
    dto.buildingAgeScore = a.buildingAgeScore;
    dto.accessibilityScore = a.accessibilityScore;
    dto.populationPressureScore = a.populationPressureScore;
    dto.facilityComplianceScore = a.facilityComplianceScore;
    dto.resolutionRateScore = a.resolutionRateScore;
    dto.hasInfraDataGap = a.dataGaps.infrastructure;
    dto.hasPopDataGap = a.dataGaps.population;
    dto.dataGaps = a.dataGaps;
    dto.dataCoverage = a.dataCoverage;
    dto.scoringModel = SCORING_MODEL;

    dto.priorityLevel = a.priorityLevel;
    dto.urgencyMonths = a.urgencyMonths;
    dto.recommendations = a.recommendations;
    dto.primaryRecommendation = a.primaryRecommendation;
    dto.estimatedBudgetRwf = a.estimatedBudgetRwf;

    dto.lastSurveyDate = latestSurveyAt ? latestSurveyAt.toISOString() : null;

    dto.districtAvgScore = district.avg;
    dto.provinceAvgScore = province.avg;
    dto.districtPeerCount = district.n;
    dto.provincePeerCount = province.n;
    dto.scoreDeltaFromDistrict = delta(district.avg);
    dto.scoreDeltaFromProvince = delta(province.avg);

    dto.dataCompletenessScore = dataCompletenessScore;
    dto.kmzStatus = school.kmzStatus ?? null;

    dto.riskImpactScore = riskAssessment.impactScore;
    dto.riskProbabilityScore = riskAssessment.probabilityScore;
    dto.riskAssessment = riskAssessment;

    dto.reportSummary = reportSummary;
    return dto;
  }
}
