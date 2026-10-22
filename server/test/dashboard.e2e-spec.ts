/**
 * Dashboard calculation fixes (docs/DASHBOARD_FIX_PLAN.md) — e2e.
 *
 * Run against a throw-away TEST database (never the dev DB):
 *   DB_NAME=rtb_gis_test SEED_ON_STARTUP=true SCOPE_ENFORCEMENT=true \
 *     npm run test:e2e -- dashboard
 *
 * Covers: missing / malformed / out-of-scope school ids (S-1), read-only
 * dashboard GETs (C-4), event-driven rescoring (C-3), one assessment per
 * school under concurrency (C-4), placeholder buildings as a data gap (H-2),
 * input validation (§7) and the overview payload shape (N-4/N-5/N-6).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { School } from '../src/modules/schools/entities/school.entity';
import { DecisionAssessment } from '../src/modules/analytics/entities/decision-assessment.entity';
import { ScoreHistory } from '../src/modules/analytics/entities/score-history.entity';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { SCORING_VERSION } from '../src/modules/analytics/scoring.constants';

process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';

const PREFIX = '/api/v1';
const RUN = Date.now().toString(36);
const CY = new Date().getFullYear();

let app: INestApplication;
let dataSource: DataSource;
let homeSchool: School;
let otherSchool: School | undefined;
const tokens: Record<string, string> = {};
const userIds: string[] = [];
const createdSchoolIds: string[] = [];

const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
const http = () => request(app.getHttpServer());

/** Poll until `check` returns a truthy value (background rescoring is async). */
async function eventually<T>(
  check: () => Promise<T | null | undefined | false>,
  timeoutMs = 8000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() - start > timeoutMs)
      throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 150));
  }
}

const assessmentOf = (schoolId: string) =>
  dataSource.getRepository(DecisionAssessment).findOne({ where: { schoolId } });
const countRows = async (schoolId: string) => ({
  assessments: await dataSource
    .getRepository(DecisionAssessment)
    .count({ where: { schoolId } }),
  history: await dataSource
    .getRepository(ScoreHistory)
    .count({ where: { schoolId } }),
});

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  app = moduleFixture.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();
  dataSource = app.get(DataSource);

  const schools = await dataSource.getRepository(School).find();
  if (!schools.length)
    throw new Error(
      'No schools seeded — run with SEED_ON_STARTUP=true on a fresh DB.',
    );
  homeSchool = schools.find((s) => s.code === 'TSS-KGL-001') ?? schools[0];
  otherSchool = schools.find((s) => s.district !== homeSchool.district);

  const jwt = app.get(JwtService, { strict: false });
  for (const name of ['super_admin', 'district_officer', 'school_leader']) {
    const role = await dataSource
      .getRepository(Role)
      .findOne({ where: { name } });
    if (!role) throw new Error(`Seeded role "${name}" missing.`);
    const location =
      name === 'school_leader'
        ? {
            province: homeSchool.province,
            district: homeSchool.district,
            sector: homeSchool.sector,
            schoolId: homeSchool.id,
            schoolName: homeSchool.name,
          }
        : name === 'district_officer'
          ? { province: homeSchool.province, district: homeSchool.district }
          : undefined;
    const users = dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        firstName: 'E2E',
        lastName: name,
        email: `e2e.dash.${name}.${RUN}@test.rtb.rw`,
        password: `E2e!${RUN}Aa1`,
        isActive: true,
        role,
        ...(location ? { location } : {}),
      }),
    );
    userIds.push(user.id);
    tokens[name] = await jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: role.name,
    });
  }

  // Make sure the home school has a stored, current assessment.
  await app.get(AnalyticsService).recalculateSchoolScore(homeSchool.id);
}, 120_000);

afterAll(async () => {
  if (dataSource?.isInitialized) {
    for (const id of createdSchoolIds) {
      await http().delete(`${PREFIX}/schools/${id}`).set(auth('super_admin'));
    }
    if (userIds.length)
      await dataSource
        .getRepository(User)
        .delete(userIds)
        .catch(() => undefined);
  }
  await app?.close();
});

describe('School id validation and scope (S-1)', () => {
  it('GET /schools/dashboard/main is retired (404)', async () => {
    await http()
      .get(`${PREFIX}/schools/dashboard/main?schoolId=${homeSchool.id}`)
      .set(auth('super_admin'))
      .expect(404);
  });

  it('reporting without schoolId: national user → 400, scoped user → 403 (never "any school")', async () => {
    await http()
      .get(`${PREFIX}/schools/dashboard/reporting`)
      .set(auth('super_admin'))
      .expect(400);
    await http()
      .get(`${PREFIX}/schools/dashboard/reporting`)
      .set(auth('school_leader'))
      .expect(403);
    await http()
      .get(`${PREFIX}/schools/dashboard/reporting`)
      .set(auth('district_officer'))
      .expect(403);
  });

  it('malformed ids are 400, not 500', async () => {
    await http()
      .get(`${PREFIX}/schools/dashboard/reporting?schoolId=abc`)
      .set(auth('school_leader'))
      .expect(400);
    await http()
      .get(`${PREFIX}/analytics/schools/not-a-uuid/metrics`)
      .set(auth('super_admin'))
      .expect(400);
  });

  it('school_leader: own school 200, another school 403', async () => {
    const own = await http()
      .get(`${PREFIX}/schools/dashboard/reporting?schoolId=${homeSchool.id}`)
      .set(auth('school_leader'))
      .expect(200);
    expect(own.body.data.reports.months).toHaveLength(12);
    if (otherSchool) {
      await http()
        .get(`${PREFIX}/schools/dashboard/reporting?schoolId=${otherSchool.id}`)
        .set(auth('school_leader'))
        .expect(403);
      await http()
        .get(`${PREFIX}/analytics/schools/${otherSchool.id}/metrics`)
        .set(auth('school_leader'))
        .expect(403);
    }
  });

  it('history months must be 1–60', async () => {
    await http()
      .get(`${PREFIX}/analytics/schools/${homeSchool.id}/history?months=abc`)
      .set(auth('super_admin'))
      .expect(400);
    await http()
      .get(`${PREFIX}/analytics/schools/${homeSchool.id}/history?months=6`)
      .set(auth('super_admin'))
      .expect(200);
  });
});

describe('Dashboard reads are read-only (C-4)', () => {
  it('metrics + reporting GETs write no assessment and no history row', async () => {
    const before = await countRows(homeSchool.id);
    const stored = await assessmentOf(homeSchool.id);
    for (let i = 0; i < 3; i++) {
      await http()
        .get(`${PREFIX}/analytics/schools/${homeSchool.id}/metrics`)
        .set(auth('super_admin'))
        .expect(200);
      await http()
        .get(`${PREFIX}/schools/dashboard/reporting?schoolId=${homeSchool.id}`)
        .set(auth('super_admin'))
        .expect(200);
    }
    expect(await countRows(homeSchool.id)).toEqual(before);
    expect((await assessmentOf(homeSchool.id))?.updatedAt).toEqual(
      stored?.updatedAt,
    );
  });

  it('metrics serve the stored, current assessment with coverage and the scoring model', async () => {
    const res = await http()
      .get(`${PREFIX}/analytics/schools/${homeSchool.id}/metrics`)
      .set(auth('super_admin'))
      .expect(200);
    const stored = await assessmentOf(homeSchool.id);
    expect(res.body.provisional).toBe(false);
    expect(res.body.overallScore).toBe(Number(stored?.overallScore));
    expect(res.body.dataCoverage).toBeGreaterThanOrEqual(0);
    expect(res.body.dataCoverage).toBeLessThanOrEqual(1);
    const w = res.body.scoringModel.weights as Record<string, number>;
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(res.body).not.toHaveProperty('depreciation');
    expect(res.body).not.toHaveProperty('maleTeacherRatio');
  });
});

describe('Rescoring is event-driven (C-3)', () => {
  it('editing road access on the school profile rescores it', async () => {
    const original = homeSchool.roadStatusPercentage;
    const target = Number(original) === 37 ? 38 : 37;
    await http()
      .patch(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('super_admin'))
      .send({ roadStatusPercentage: target })
      .expect(200);
    const a = await eventually(async () => {
      const row = await assessmentOf(homeSchool.id);
      return row && Number(row.accessibilityScore) === target ? row : null;
    });
    expect(a.scoringVersion).toBe(SCORING_VERSION);
    expect(a.dataGaps?.accessibility).toBe(false);
    // schools.* cache follows the assessment
    const s = await dataSource
      .getRepository(School)
      .findOne({ where: { id: homeSchool.id } });
    expect(Number(s?.overallScore)).toBe(Number(a.overallScore));
    // restore
    await http()
      .patch(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('super_admin'))
      .send({ roadStatusPercentage: original ?? 50 })
      .expect(200);
  });

  it('a new school with only a KMZ-style placeholder building is an infra data gap', async () => {
    const res = await http()
      .post(`${PREFIX}/schools`)
      .set(auth('super_admin'))
      .send({
        code: `E2E-DASH-${RUN}`.toUpperCase(),
        name: `E2E Dashboard ${RUN}`,
        province: homeSchool.province,
        district: homeSchool.district,
        sector: homeSchool.sector ?? 'Sector',
        latitude: -1.95,
        longitude: 30.06,
        establishedYear: CY - 12,
        buildings: [{ name: 'Block A' }],
      })
      .expect(201);
    const id = res.body.id as string;
    createdSchoolIds.push(id);
    const a = await eventually(() => assessmentOf(id));
    expect(a.hasInfraDataGap).toBe(true);
    expect(Number(a.infrastructureScore)).toBe(50);
    expect(a.dataGaps?.buildingAge).toBe(false); // establishment year is measured
    expect(Number(a.dataCoverage)).toBeCloseTo(0.25);
    const b = await http()
      .get(`${PREFIX}/schools/${id}`)
      .set(auth('super_admin'))
      .expect(200);
    expect(b.body.buildings[0].condition).toBeNull();
  });
});

describe('One assessment per school (C-4)', () => {
  it('concurrent first-time scoring leaves exactly one row', async () => {
    const id = createdSchoolIds[0] ?? homeSchool.id;
    await eventually(() => assessmentOf(id)); // let any event-driven run finish
    await dataSource.getRepository(DecisionAssessment).delete({ schoolId: id });
    const svc = app.get(AnalyticsService);
    await Promise.all(
      [1, 2, 3, 4, 5].map(() => svc.recalculateSchoolScore(id)),
    );
    expect(
      await dataSource
        .getRepository(DecisionAssessment)
        .count({ where: { schoolId: id } }),
    ).toBe(1);
  });
});

describe('Input validation (§7)', () => {
  it('rejects a future establishment year', async () => {
    await http()
      .patch(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('super_admin'))
      .send({ establishedYear: CY + 5 })
      .expect(400);
  });

  it('rejects a future build year and negative / fractional headcounts', async () => {
    await http()
      .post(`${PREFIX}/schools/${homeSchool.id}/buildings`)
      .set(auth('super_admin'))
      .send({ name: 'Future block', yearBuilt: CY + 3 })
      .expect(400);
    await http()
      .patch(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('super_admin'))
      .send({ maleTeachers: -2 })
      .expect(400);
    await http()
      .patch(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('super_admin'))
      .send({ totalTeachers: 10.5 })
      .expect(400);
  });
});

describe('National overview payload (N-4/N-5/N-6)', () => {
  it('byPriority has every band incl. unassessed, and sums to totalSchools', async () => {
    const res = await http()
      .get(`${PREFIX}/analytics/overview`)
      .set(auth('super_admin'))
      .expect(200);
    const bp = res.body.byPriority as Record<string, number>;
    expect(Object.keys(bp).sort()).toEqual(
      ['critical', 'high', 'low', 'medium', 'unassessed'].sort(),
    );
    expect(Object.values(bp).reduce((a, b) => a + b, 0)).toBe(
      res.body.totalSchools,
    );
    expect(res.body).toHaveProperty('nationalAvgResolutionScore');
    expect(res.body.scoringModel.version).toBe(SCORING_VERSION);
    for (const p of res.body.provinceStats as Array<{
      scored: number;
      avgScore: number | null;
    }>) {
      if (p.scored === 0) expect(p.avgScore).toBeNull();
    }
  });

  it('a district officer sees only their district in the overview', async () => {
    const res = await http()
      .get(`${PREFIX}/analytics/overview`)
      .set(auth('district_officer'))
      .expect(200);
    const provinces = (
      res.body.provinceStats as Array<{ province: string }>
    ).map((p) => p.province);
    expect(new Set(provinces)).toEqual(new Set([homeSchool.province]));
  });
});
