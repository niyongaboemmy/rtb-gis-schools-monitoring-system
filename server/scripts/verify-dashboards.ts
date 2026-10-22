/**
 * verify-dashboards.ts (WS1.3)
 *
 * Recomputes every national KPI with raw SQL and diffs it against
 * AnalyticsService.getOverview() (the code behind GET /api/v1/analytics/overview).
 * National view only (no scope) — scope filtering is covered by unit tests.
 *
 * Then runs SEMANTIC checks — not just "service = SQL": every active school
 * is rescored in memory with the scoring engine and diffed against its stored
 * assessment (stale rows), and duplicate assessments, outdated scoring
 * versions, score cache drift, zero-population rows, reopened reports with a
 * resolution date and repeated history snapshots must all be 0.
 *
 * READ-ONLY: the connection is opened with default_transaction_read_only=on;
 * only SELECT paths are used (getOverview, getDecisions, previewSchoolScore).
 *
 * Run from /server:
 *   npx ts-node --transpile-only scripts/verify-dashboards.ts
 * Connection: DATABASE_URL, or DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME,
 * read from the environment or from server/.env.
 * Exit code 0 = zero diffs and zero integrity failures, 1 = at least one,
 * 2 = could not run.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { DecisionAssessment } from '../src/modules/analytics/entities/decision-assessment.entity';
import { ScoreHistory } from '../src/modules/analytics/entities/score-history.entity';
import { RecommendationAction } from '../src/modules/analytics/entities/recommendation-action.entity';
import { School } from '../src/modules/schools/entities/school.entity';
import { SchoolBuilding } from '../src/modules/schools/entities/school-building.entity';
import { PopulationData } from '../src/modules/population/entities/population-data.entity';
import { SchoolFacilitySurvey } from '../src/modules/schools/entities/school-facility-survey.entity';
import { IssueReport } from '../src/modules/reports/entities/issue-report.entity';
import { assessmentChanged } from '../src/modules/analytics/scoring-engine';
import { SCORING_VERSION } from '../src/modules/analytics/scoring.constants';
import type { AuditService } from '../src/modules/audit/audit.service';

function loadEnv(): void {
  const file = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

type Row = Record<string, unknown>;
const n = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const x = typeof v === 'number' ? v : parseFloat(String(v as string));
  return Number.isFinite(x) ? x : null;
};

// Raw-SQL reference for each KPI. ACTIVE schools only, matching the service.
const ACTIVE = `s.status = 'active'`;
const SCORED = `FROM decision_assessments da
    JOIN schools s ON CAST(s.id AS text) = da."schoolId" WHERE ${ACTIVE}`;
// Per-school programme roll-up (school-metrics.helpers: programmeTotals /
// capacityInputs) — enrolment falls back to schools.totalStudents only when
// the programmes record no students.
const PER_SCHOOL = `SELECT s.id,
      COALESCE((SELECT SUM(COALESCE(NULLIF(p->>'capacity','')::numeric,0))
                FROM jsonb_array_elements(COALESCE(s."educationPrograms",'[]'::jsonb)) p),0) AS cap,
      COALESCE((SELECT SUM(COALESCE(NULLIF(p->>'totalStudents','')::numeric,0))
                FROM jsonb_array_elements(COALESCE(s."educationPrograms",'[]'::jsonb)) p),0) AS prog_students,
      COALESCE(s."totalStudents",0) AS school_students
    FROM schools s WHERE ${ACTIVE}`;
const SQL = {
  totalSchools: `SELECT COUNT(*) AS v FROM schools s WHERE ${ACTIVE}`,
  scored: `SELECT ROUND(AVG(da."overallScore")::numeric,1) AS avg,
      COUNT(DISTINCT da."schoolId") AS cnt,
      ROUND(AVG(da."infrastructureScore")::numeric,1) AS infra,
      ROUND(AVG(da."populationPressureScore")::numeric,1) AS pop,
      ROUND(AVG(da."buildingAgeScore")::numeric,1) AS age,
      ROUND(AVG(da."accessibilityScore")::numeric,1) AS access,
      ROUND(AVG(COALESCE(da."facilityComplianceScore",50))::numeric,1) AS compliance,
      ROUND(AVG(COALESCE(da."resolutionRateScore",50))::numeric,1) AS resolution,
      SUM(CASE WHEN da."hasInfraDataGap" THEN 1 ELSE 0 END) AS infra_gaps,
      SUM(CASE WHEN da."hasPopDataGap" THEN 1 ELSE 0 END) AS pop_gaps,
      COALESCE(SUM(da."estimatedBudgetRwf"),0) AS budget
    ${SCORED}`,
  students: `WITH per AS (${PER_SCHOOL})
    SELECT COALESCE(SUM(CASE WHEN prog_students > 0 THEN prog_students ELSE school_students END),0) AS v FROM per`,
  teachers: `SELECT COALESCE(SUM(CASE WHEN s."maleTeachers" IS NOT NULL OR s."femaleTeachers" IS NOT NULL
      THEN COALESCE(s."maleTeachers",0)+COALESCE(s."femaleTeachers",0)
      ELSE COALESCE(s."totalTeachers",0) END),0) AS v FROM schools s WHERE ${ACTIVE}`,
  kmz: `SELECT COUNT(*) AS v FROM schools s WHERE ${ACTIVE} AND s."kmzStatus" = 'completed'`,
  survey: `SELECT COUNT(DISTINCT sv."schoolId") AS v FROM school_facility_surveys sv
      JOIN schools s ON CAST(s.id AS text) = sv."schoolId" WHERE ${ACTIVE}`,
  priority: `SELECT COALESCE(da."priorityLevel"::text,'unassessed') AS p, COUNT(*) AS c
      FROM schools s LEFT JOIN decision_assessments da ON CAST(s.id AS text) = da."schoolId"
      WHERE ${ACTIVE} GROUP BY 1`,
  // Σ programme students ÷ Σ programme capacity over schools whose programmes
  // record both (capacityInputs).
  capacity: `WITH per AS (${PER_SCHOOL})
    SELECT SUM(prog_students) AS students, SUM(cap) AS seats
    FROM per WHERE cap > 0 AND prog_students > 0`,
  provinces: `SELECT COUNT(DISTINCT s.province) AS v FROM schools s WHERE ${ACTIVE}`,
  // ── Integrity / semantic checks (each must be 0) ──────────────────────────
  drift: `SELECT COUNT(*) AS v FROM schools s
      JOIN decision_assessments da ON CAST(s.id AS text) = da."schoolId"
      WHERE ${ACTIVE} AND (ROUND(s."overallScore"::numeric) IS DISTINCT FROM ROUND(da."overallScore"::numeric)
        OR s."priorityLevel"::text IS DISTINCT FROM da."priorityLevel"::text)`,
  orphans: `SELECT COUNT(*) AS v FROM decision_assessments da
      LEFT JOIN schools s ON CAST(s.id AS text) = da."schoolId" WHERE s.id IS NULL`,
  unscored: `SELECT COUNT(*) AS v FROM schools s
      LEFT JOIN decision_assessments da ON CAST(s.id AS text) = da."schoolId"
      WHERE ${ACTIVE} AND da.id IS NULL`,
  duplicates: `SELECT COUNT(*) AS v FROM (SELECT "schoolId" FROM decision_assessments
      GROUP BY 1 HAVING COUNT(*) > 1) d`,
  zeroPopulation: `SELECT COUNT(*) AS v FROM population_data
      WHERE "schoolAgePopulation2km" IS NOT NULL AND "schoolAgePopulation2km" <= 0`,
  reopenedWithDate: `SELECT COUNT(*) AS v FROM issue_reports
      WHERE status <> 'SOLVED' AND "resolvedAt" IS NOT NULL`,
  historyRepeats: `SELECT COUNT(*) AS v FROM (
      SELECT concat_ws('|',"overallScore","infrastructureScore","buildingAgeScore","accessibilityScore",
               "populationPressureScore","facilityComplianceScore","resolutionRateScore") AS s,
             LAG(concat_ws('|',"overallScore","infrastructureScore","buildingAgeScore","accessibilityScore",
               "populationPressureScore","facilityComplianceScore","resolutionRateScore"))
               OVER (PARTITION BY "schoolId" ORDER BY "recordedAt", id) AS prev
      FROM score_history) h WHERE s = prev`,
};

async function main(): Promise<number> {
  loadEnv();
  const env = process.env;
  const readOnly = { options: '-c default_transaction_read_only=on' };
  const ds = new DataSource({
    type: 'postgres',
    ...(env.DATABASE_URL
      ? { url: env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: env.DB_HOST ?? 'localhost',
          port: Number(env.DB_PORT ?? 5432),
          username: env.DB_USERNAME,
          password: env.DB_PASSWORD,
          database: env.DB_NAME,
        }),
    entities: [path.resolve(__dirname, '../src/**/*.entity.ts')],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: readOnly,
  });
  await ds.initialize();

  try {
    // Schema drift guard: an entity column that is not in this database yet
    // (pending migration / other in-progress work) would make every SELECT
    // fail. Drop it from the in-memory metadata only and report it.
    const schemaDrift: string[] = [];
    for (const meta of ds.entityMetadatas) {
      const rows = await ds.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [meta.tableName],
      );
      if (rows.length === 0) continue;
      const have = new Set(rows.map((r) => r.column_name));
      const missing = meta.columns.filter((c) => !have.has(c.databaseName));
      for (const c of missing) {
        schemaDrift.push(`${meta.tableName}.${c.databaseName}`);
        meta.columns.splice(meta.columns.indexOf(c), 1);
        const nc = meta.nonVirtualColumns.indexOf(c);
        if (nc >= 0) meta.nonVirtualColumns.splice(nc, 1);
      }
    }
    if (schemaDrift.length)
      console.log(
        `Schema drift (entity columns missing in DB, ignored for this run): ${schemaDrift.join(', ')}`,
      );

    const q = async (sql: string): Promise<Row[]> => await ds.query(sql);
    const one = async (sql: string): Promise<Row> => (await q(sql))[0] ?? {};

    const noAudit = { log: () => undefined } as unknown as AuditService;
    const service = new AnalyticsService(
      ds.getRepository(DecisionAssessment),
      ds.getRepository(ScoreHistory),
      ds.getRepository(RecommendationAction),
      ds.getRepository(School),
      ds.getRepository(SchoolBuilding),
      ds.getRepository(PopulationData),
      ds.getRepository(SchoolFacilitySurvey),
      ds.getRepository(IssueReport),
      noAudit,
    );
    const api = await service.getOverview();
    const decisions = await service.getDecisions();

    const total = n((await one(SQL.totalSchools)).v) ?? 0;
    const scored = await one(SQL.scored);
    const scoredCount = n(scored.cnt) ?? 0;
    // Averages are null (not 0) when nothing is scored.
    const avgOf = (v: unknown) => (scoredCount > 0 ? n(v) : null);
    const kmz = n((await one(SQL.kmz)).v) ?? 0;
    const survey = n((await one(SQL.survey)).v) ?? 0;
    const cap = await one(SQL.capacity);
    const seats = n(cap.seats) ?? 0;
    const prio: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unassessed: 0,
    };
    for (const r of await q(SQL.priority)) prio[String(r.p)] = n(r.c) ?? 0;

    const checks: Array<[string, unknown, unknown]> = [
      ['totalSchools', total, api.totalSchools],
      ['scoredSchoolCount', scoredCount, api.scoredSchoolCount],
      [
        'nationalAvgScore (School Condition Score)',
        avgOf(scored.avg),
        api.nationalAvgScore,
      ],
      ['nationalAvgInfraScore', avgOf(scored.infra), api.nationalAvgInfraScore],
      [
        'nationalAvgAgeScore (Building Age Score)',
        avgOf(scored.age),
        api.nationalAvgAgeScore,
      ],
      [
        'nationalAvgAccessScore',
        avgOf(scored.access),
        api.nationalAvgAccessScore,
      ],
      ['nationalAvgPopScore', avgOf(scored.pop), api.nationalAvgPopScore],
      [
        'nationalAvgComplianceScore',
        avgOf(scored.compliance),
        api.nationalAvgComplianceScore,
      ],
      [
        'nationalAvgResolutionScore',
        avgOf(scored.resolution),
        api.nationalAvgResolutionScore,
      ],
      [
        'nationalCapacityUtilisation',
        seats > 0 ? Math.round(((n(cap.students) ?? 0) / seats) * 100) : null,
        api.nationalCapacityUtilisation,
      ],
      ['totalStudents', n((await one(SQL.students)).v) ?? 0, api.totalStudents],
      ['totalTeachers', n((await one(SQL.teachers)).v) ?? 0, api.totalTeachers],
      [
        'kmzCoverageRate %',
        total > 0 ? Math.round((kmz / total) * 100) : null,
        api.kmzCoverageRate,
      ],
      [
        'surveyCompletionRate %',
        total > 0 ? Math.round((survey / total) * 100) : null,
        api.surveyCompletionRate,
      ],
      [
        'totalEstimatedBudgetRwf',
        n(scored.budget) ?? 0,
        api.totalEstimatedBudgetRwf,
      ],
      [
        'dataGaps.infrastructure',
        n(scored.infra_gaps) ?? 0,
        api.dataGaps.infrastructure,
      ],
      ['dataGaps.population', n(scored.pop_gaps) ?? 0, api.dataGaps.population],
      [
        'decision queue rows (= scored active schools)',
        scoredCount,
        decisions.length,
      ],
      [
        'decision rows carrying dataGaps',
        decisions.length,
        decisions.filter((d) => d.dataGaps).length,
      ],
      [
        'provinceStats rows',
        n((await one(SQL.provinces)).v) ?? 0,
        api.provinceStats.length,
      ],
      [
        'byPriority',
        JSON.stringify(sortKeys(prio)),
        JSON.stringify(sortKeys(api.byPriority as Record<string, number>)),
      ],
    ];

    let diffs = 0;
    const pad = (s: string, w: number) => s.padEnd(w);
    console.log(
      `\n${pad('KPI', 48)}${pad('SQL', 22)}${pad('Service', 22)}Result`,
    );
    console.log('-'.repeat(100));
    for (const [name, sqlV, apiV] of checks) {
      const ok = String(sqlV) === String(apiV);
      if (!ok) diffs++;
      console.log(
        `${pad(name, 48)}${pad(String(sqlV), 22)}${pad(String(apiV), 22)}${ok ? 'OK' : 'DIFF'}`,
      );
    }

    // ── Semantic integrity: every count must be 0 ─────────────────────────
    // Stale assessments: rescore each active school in memory (read-only) and
    // compare with what is stored and shown on the dashboards.
    const stored = new Map(
      (await ds.getRepository(DecisionAssessment).find()).map((a) => [
        a.schoolId,
        a,
      ]),
    );
    const activeSchools = await ds
      .getRepository(School)
      .find({ where: { status: 'active' as never }, relations: ['buildings'] });
    const stale: string[] = [];
    let outdated = 0;
    for (const school of activeSchools) {
      const a = stored.get(school.id);
      if (!a) continue; // counted as "never scored"
      if ((a.scoringVersion ?? 0) < SCORING_VERSION) outdated++;
      const fresh = await service.previewSchoolScore(school);
      if (assessmentChanged(a as unknown as Record<string, unknown>, fresh)) {
        stale.push(
          `${school.name}: stored ${n(a.overallScore)} (${a.priorityLevel}) → now ${fresh.overallScore} (${fresh.priorityLevel})`,
        );
      }
    }

    const integrity: Array<[string, number]> = [
      ['active schools never scored', n((await one(SQL.unscored)).v) ?? 0],
      [`assessments older than scoring v${SCORING_VERSION}`, outdated],
      ['stale assessments (stored ≠ recomputed now)', stale.length],
      [
        'duplicate assessments (schools with >1 row)',
        n((await one(SQL.duplicates)).v) ?? 0,
      ],
      [
        'schools.overallScore/priority ≠ assessment',
        n((await one(SQL.drift)).v) ?? 0,
      ],
      [
        'assessment rows with no school (orphans)',
        n((await one(SQL.orphans)).v) ?? 0,
      ],
      [
        'population rows with school-age pop ≤ 0',
        n((await one(SQL.zeroPopulation)).v) ?? 0,
      ],
      [
        'non-solved reports carrying resolvedAt',
        n((await one(SQL.reopenedWithDate)).v) ?? 0,
      ],
      [
        'repeated score_history snapshots',
        n((await one(SQL.historyRepeats)).v) ?? 0,
      ],
    ];
    let failures = 0;
    console.log('\nIntegrity (each must be 0)');
    for (const [label, count] of integrity) {
      if (count > 0) failures++;
      console.log(
        `  ${label.padEnd(50)}${String(count).padEnd(8)}${count > 0 ? 'FAIL' : 'OK'}`,
      );
    }
    for (const line of stale) console.log(`    · ${line}`);

    console.log(
      `\n${diffs === 0 ? 'ZERO DIFFS' : `${diffs} DIFF(S)`} across ${checks.length} KPIs; ` +
        `${failures === 0 ? 'integrity OK' : `${failures} integrity failure(s)`}.`,
    );
    return diffs === 0 && failures === 0 ? 0 : 1;
  } finally {
    await ds.destroy();
  }
}

function sortKeys(o: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(o).sort(([a], [b]) => a.localeCompare(b)),
  );
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(
      'verify-dashboards failed:',
      err instanceof Error ? err.message : err,
    );
    process.exit(2);
  });
