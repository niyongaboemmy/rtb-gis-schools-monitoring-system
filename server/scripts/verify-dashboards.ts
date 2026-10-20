/**
 * verify-dashboards.ts (WS1.3)
 *
 * Recomputes every national KPI with raw SQL and diffs it against
 * AnalyticsService.getOverview() (the code behind GET /api/v1/analytics/overview).
 * National view only (no scope) — scope filtering is covered by unit tests.
 *
 * READ-ONLY: the connection is opened with default_transaction_read_only=on,
 * and only getOverview() (SELECTs) is called — never getSchoolMetrics() or a
 * recalculation, which write.
 *
 * Run from /server:
 *   npx ts-node --transpile-only scripts/verify-dashboards.ts
 * Connection: DATABASE_URL, or DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME,
 * read from the environment or from server/.env.
 * Exit code 0 = zero diffs, 1 = at least one diff, 2 = could not run.
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
const SQL = {
  totalSchools: `SELECT COUNT(*) AS v FROM schools s WHERE ${ACTIVE}`,
  scored: `SELECT ROUND(AVG(da."overallScore")::numeric,1) AS avg,
      COUNT(da.id) AS cnt,
      ROUND(AVG(da."infrastructureScore")::numeric,1) AS infra,
      ROUND(AVG(da."populationPressureScore")::numeric,1) AS pop,
      ROUND(AVG(da."buildingAgeScore")::numeric,1) AS age,
      ROUND(AVG(da."accessibilityScore")::numeric,1) AS access,
      ROUND(AVG(da."facilityComplianceScore")::numeric,1) AS compliance,
      SUM(CASE WHEN da."hasInfraDataGap" THEN 1 ELSE 0 END) AS infra_gaps,
      SUM(CASE WHEN da."hasPopDataGap" THEN 1 ELSE 0 END) AS pop_gaps,
      COALESCE(SUM(da."estimatedBudgetRwf"),0) AS budget
    FROM decision_assessments da
    JOIN schools s ON CAST(s.id AS text) = da."schoolId" WHERE ${ACTIVE}`,
  students: `SELECT COALESCE(SUM(s."totalStudents"),0) AS v FROM schools s WHERE ${ACTIVE}`,
  teachers: `SELECT COALESCE(SUM(CASE WHEN s."maleTeachers" IS NOT NULL OR s."femaleTeachers" IS NOT NULL
      THEN COALESCE(s."maleTeachers",0)+COALESCE(s."femaleTeachers",0)
      ELSE COALESCE(s."totalTeachers",0) END),0) AS v FROM schools s WHERE ${ACTIVE}`,
  kmz: `SELECT COUNT(*) AS v FROM schools s WHERE ${ACTIVE} AND s."kmzStatus" = 'completed'`,
  survey: `SELECT COUNT(DISTINCT sv."schoolId") AS v FROM school_facility_surveys sv
      JOIN schools s ON CAST(s.id AS text) = sv."schoolId" WHERE ${ACTIVE}`,
  priority: `SELECT COALESCE(s."priorityLevel"::text,'unassessed') AS p, COUNT(*) AS c
      FROM schools s WHERE ${ACTIVE} GROUP BY 1`,
  // Σ students ÷ Σ capacity over schools with programme capacity > 0.
  // Enrolment = Σ programme.totalStudents when > 0, else schools.totalStudents.
  capacity: `WITH per AS (
      SELECT s.id,
        COALESCE((SELECT SUM(COALESCE(NULLIF(p->>'capacity','')::numeric,0))
                  FROM jsonb_array_elements(COALESCE(s."educationPrograms",'[]'::jsonb)) p),0) AS cap,
        COALESCE((SELECT SUM(COALESCE(NULLIF(p->>'totalStudents','')::numeric,0))
                  FROM jsonb_array_elements(COALESCE(s."educationPrograms",'[]'::jsonb)) p),0) AS prog_students,
        COALESCE(s."totalStudents",0) AS school_students
      FROM schools s WHERE ${ACTIVE})
    SELECT SUM(CASE WHEN prog_students > 0 THEN prog_students ELSE school_students END) AS students,
           SUM(cap) AS seats
    FROM per WHERE cap > 0`,
  provinces: `SELECT COUNT(DISTINCT s.province) AS v FROM schools s WHERE ${ACTIVE}`,
  // Consistency: the score stored on schools must equal the assessment row.
  drift: `SELECT COUNT(*) AS v FROM schools s
      JOIN decision_assessments da ON CAST(s.id AS text) = da."schoolId"
      WHERE ${ACTIVE} AND ROUND(s."overallScore"::numeric) <> ROUND(da."overallScore"::numeric)`,
  orphans: `SELECT COUNT(*) AS v FROM decision_assessments da
      LEFT JOIN schools s ON CAST(s.id AS text) = da."schoolId" WHERE s.id IS NULL`,
  unscored: `SELECT COUNT(*) AS v FROM schools s
      LEFT JOIN decision_assessments da ON CAST(s.id AS text) = da."schoolId"
      WHERE ${ACTIVE} AND da.id IS NULL`,
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
    const kmz = n((await one(SQL.kmz)).v) ?? 0;
    const survey = n((await one(SQL.survey)).v) ?? 0;
    const cap = await one(SQL.capacity);
    const seats = n(cap.seats) ?? 0;
    const prio: Record<string, number> = {};
    for (const r of await q(SQL.priority)) prio[String(r.p)] = n(r.c) ?? 0;

    const checks: Array<[string, unknown, unknown]> = [
      ['totalSchools', total, api.totalSchools],
      ['scoredSchoolCount', n(scored.cnt) ?? 0, api.scoredSchoolCount],
      [
        'nationalAvgScore (School Condition Score)',
        n(scored.avg) ?? 0,
        api.nationalAvgScore,
      ],
      [
        'nationalAvgInfraScore',
        n(scored.infra) ?? 0,
        api.nationalAvgInfraScore,
      ],
      [
        'nationalAvgAgeScore (Building Age Score)',
        n(scored.age) ?? 0,
        api.nationalAvgAgeScore,
      ],
      [
        'nationalAvgAccessScore',
        n(scored.access) ?? 0,
        api.nationalAvgAccessScore,
      ],
      ['nationalAvgPopScore', n(scored.pop) ?? 0, api.nationalAvgPopScore],
      [
        'nationalAvgComplianceScore',
        n(scored.compliance) ?? 0,
        api.nationalAvgComplianceScore,
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
        total > 0 ? Math.round((kmz / total) * 100) : 0,
        api.kmzCoverageRate,
      ],
      [
        'surveyCompletionRate %',
        total > 0 ? Math.round((survey / total) * 100) : 0,
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
        n(scored.cnt) ?? 0,
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

    // Data-integrity warnings (not KPI diffs, but they explain odd numbers).
    const drift = n((await one(SQL.drift)).v) ?? 0;
    const orphans = n((await one(SQL.orphans)).v) ?? 0;
    const unscored = n((await one(SQL.unscored)).v) ?? 0;
    console.log('\nIntegrity');
    console.log(
      `  active schools whose stored score ≠ assessment score: ${drift}`,
    );
    console.log(
      `  assessment rows with no school (orphans):             ${orphans}`,
    );
    console.log(
      `  active schools never scored:                          ${unscored}`,
    );
    console.log(
      `\n${diffs === 0 ? 'ZERO DIFFS' : `${diffs} DIFF(S)`} across ${checks.length} KPIs.`,
    );
    return diffs === 0 ? 0 : 1;
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
