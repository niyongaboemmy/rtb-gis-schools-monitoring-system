/**
 * TDMP school sync — e2e (docs/TDMP_INTEGRATION_PLAN.md §5, §10).
 *
 * Run against a throw-away TEST database (never the dev DB):
 *   DB_NAME=rtb_gis_test SEED_ON_STARTUP=true SCOPE_ENFORCEMENT=true \
 *     npm run test:e2e -- tdmp
 *
 * Boots the real AppModule; TDMP itself is replaced at the `fetch` level by a
 * fake that answers like the live API (same shapes, 100-row page cap, 403 on
 * the endpoints TDMP has not granted yet). Covers: dry run writes nothing,
 * link by code, TDMP-only school placed at TDMP GPS, no-GPS school reported,
 * test rows skipped, hash skip on the next run, admin settings, connection
 * check, national-only routes, one run at a time, audit trail.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { School } from '../src/modules/schools/entities/school.entity';
import { TdmpSyncRun } from '../src/modules/tdmp/entities/tdmp-sync-run.entity';
import { TdmpSettings } from '../src/modules/tdmp/entities/tdmp-settings.entity';
import type { TdmpSchool } from '../src/modules/tdmp/tdmp.types';

process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';
const TDMP = 'https://tdmp.e2e.test/api/v1';
process.env.TDMP_BASE_URL = TDMP;
process.env.TDMP_API_KEY = 'fortress_sk_e2e_fake';
process.env.TDMP_SYNC_ENABLED = 'true';

const PREFIX = '/api/v1';
const RUN = Date.now().toString(36);
const NEW_CODE = `E2E${RUN}`.slice(0, 12).toUpperCase();
const NOGPS_CODE = `${NEW_CODE}N`;

let app: INestApplication;
let dataSource: DataSource;
let home: School;
let homeBefore: Partial<School>;
const tokens: Record<string, string> = {};
const userIds: string[] = [];
const realFetch = global.fetch;
const tdmpCalls: string[] = [];

const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
const http = () => request(app.getHttpServer());

/** The fake TDMP's school list, built from the seeded home school. */
let tdmpRows: TdmpSchool[] = [];
const bands: Record<string, 'TSS' | 'VTC'> = {};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Answers like https://tdmp.rtb.gov.rw/api/v1 for the routes the sync uses. */
function fakeTdmp(url: URL, headers: Headers): Response {
  if (url.pathname.endsWith('/oauth/.well-known/openid-configuration'))
    return json(200, {
      issuer: TDMP,
      claims_supported: ['sub', 'email', 'name'],
    });
  if (headers.get('authorization') !== 'ApiKey fortress_sk_e2e_fake')
    return json(401, {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid credentials',
      statusCode: 401,
    });

  const path = url.pathname.replace('/api/v1', '');
  const detail = /^\/schools\/([^/]+)$/.exec(path);
  if (detail) {
    const row = tdmpRows.find(
      (r) => r.schoolCode === decodeURIComponent(detail[1]),
    );
    return row
      ? json(200, { data: row, meta: { strategy: 'canonical' } })
      : json(404, { error: 'Not found' });
  }
  if (path === '/schools') {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    if (limit > 100)
      return json(422, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 422,
      });
    const page = Number(url.searchParams.get('page') ?? 1);
    const band = url.searchParams.get('categoryBand');
    const category = url.searchParams.get('schoolCategory');
    const rows = tdmpRows.filter(
      (r) =>
        (!band || bands[r.schoolCode] === band) &&
        (!category ||
          (r.schoolCategory ?? '').toLowerCase() === category.toLowerCase()),
    );
    // List rows carry no detail-only fields.
    const list = rows.slice((page - 1) * limit, page * limit).map((r) => {
      const {
        establishmentDate,
        gpsLat,
        gpsLong,
        currentAcademicYear,
        ...rest
      } = r;
      void establishmentDate;
      void gpsLat;
      void gpsLong;
      void currentAcademicYear;
      return rest;
    });
    return json(200, {
      data: list,
      meta: {
        strategy: 'canonical',
        lastMaterialisedAt: '2026-11-12T06:00:34.819+02:00',
        page: { current: page, limit, total: rows.length },
      },
    });
  }
  return json(403, {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
    statusCode: 403,
  });
}

async function waitForRun(id: string): Promise<TdmpSyncRun> {
  const start = Date.now();
  for (;;) {
    const res = await http()
      .get(`${PREFIX}/tdmp/sync/runs/${id}`)
      .set(auth('super_admin'));
    if (res.body?.status && res.body.status !== 'running') return res.body;
    if (Date.now() - start > 20_000) throw new Error('sync did not finish');
    await new Promise((r) => setTimeout(r, 100));
  }
}

const startSync = (dryRun = false) =>
  http().post(`${PREFIX}/tdmp/sync`).set(auth('super_admin')).send({ dryRun });

beforeAll(async () => {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.href.startsWith(TDMP)) {
      tdmpCalls.push(`${url.pathname}${url.search}`);
      return fakeTdmp(url, new Headers(init?.headers));
    }
    return realFetch(input, init);
  }) as typeof fetch;

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

  const schools = dataSource.getRepository(School);
  const found = await schools.findOne({ where: { code: 'TSS-KGL-001' } });
  if (!found)
    throw new Error(
      'Seeded school TSS-KGL-001 missing — run with SEED_ON_STARTUP=true.',
    );
  home = found;
  homeBefore = { ...found };
  // Start from an unlinked school even if an earlier run linked it.
  await schools.update(home.id, {
    tdmpSchoolCode: null,
    tdmpSchoolId: null,
    tdmpData: null,
    tdmpSyncedAt: null,
  });

  const loc = (over: Partial<TdmpSchool['location']> = {}) => ({
    provinceId: 1,
    provinceName: home.province,
    districtId: 3,
    districtName: home.district,
    sectorId: 30,
    sectorName: home.sector,
    cellId: 300,
    cellName: 'Kibagabaga',
    villageId: 3000,
    villageName: 'Nyirabwana',
    ...over,
  });
  tdmpRows = [
    {
      id: 900001,
      schoolCode: 'TSS-KGL-001',
      tmisSchoolCode: '11010101-01',
      schoolName: `${home.name} (TDMP)`,
      institutionType: 'training_institute',
      schoolCategory: 'TVET',
      schoolStatus: 'PUBLIC',
      isActive: 'ACTIVE',
      ownership: 'Public',
      enrollmentActive: true,
      location: loc(),
      counts: { students: 812, teachers: 41, trades: 4 },
      tradeNames: ['SOD', 'NIT', 'CSA'],
      authoritativeSource: 'sdms',
      establishmentDate: '1998-01-12',
      currentAcademicYear: '2026/2027',
      gpsLat: -1.0,
      gpsLong: 30.0,
    },
    {
      id: 900002,
      schoolCode: NEW_CODE,
      schoolName: 'E2E New TVET School',
      schoolCategory: 'TVET',
      schoolStatus: 'PRIVATE',
      isActive: 'ACTIVE',
      ownership: 'Private',
      location: loc(),
      counts: { students: 120, teachers: 9 },
      tradeNames: ['WOT'],
      authoritativeSource: 'sdms',
      establishmentDate: '2015-03-01',
      gpsLat: -1.9441,
      gpsLong: 30.0619,
    },
    {
      id: 900003,
      schoolCode: NOGPS_CODE,
      schoolName: 'E2E School Without GPS',
      schoolCategory: 'TVET',
      schoolStatus: 'Private',
      isActive: 'ACTIVE',
      ownership: 'Private',
      location: loc(),
      counts: { students: 50, teachers: 4 },
      tradeNames: [],
      authoritativeSource: 'sdms',
      gpsLat: null,
      gpsLong: null,
    },
    {
      id: 900004,
      schoolCode: 'SCOPE-DIST-GASABO',
      schoolName: 'Scope test',
      schoolCategory: null,
      isActive: null,
      location: loc(),
      authoritativeSource: 'access_scope_test',
    },
  ];
  bands['TSS-KGL-001'] = 'TSS';
  bands[NEW_CODE] = 'VTC';

  const jwt = app.get(JwtService, { strict: false });
  for (const name of ['super_admin', 'district_officer']) {
    const role = await dataSource
      .getRepository(Role)
      .findOne({ where: { name } });
    if (!role) throw new Error(`Seeded role "${name}" missing.`);
    const users = dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        firstName: 'E2E',
        lastName: name,
        email: `e2e.tdmp.${name}.${RUN}@test.rtb.rw`,
        password: `E2e!${RUN}Aa1`,
        isActive: true,
        role,
        ...(name === 'district_officer'
          ? { location: { province: home.province, district: home.district } }
          : {}),
      }),
    );
    userIds.push(user.id);
    tokens[name] = await jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: role.name,
    });
  }
}, 120_000);

afterAll(async () => {
  global.fetch = realFetch;
  if (dataSource?.isInitialized) {
    const schools = dataSource.getRepository(School);
    const created = await schools.find({
      where: { code: In([NEW_CODE, NOGPS_CODE]) },
    });
    for (const s of created)
      await http().delete(`${PREFIX}/schools/${s.id}`).set(auth('super_admin'));
    // Put the seeded school back the way other suites expect it.
    const restore = await schools.findOne({ where: { id: home.id } });
    if (restore) {
      Object.assign(restore, homeBefore, {
        tdmpSchoolCode: null,
        tdmpSchoolId: null,
        tdmpData: null,
        tdmpSyncedAt: null,
        ownership: null,
        provinceId: null,
        districtId: null,
        sectorId: null,
        cellId: null,
        villageId: null,
      });
      await schools.save(restore);
    }
    await dataSource
      .getRepository(TdmpSyncRun)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(TdmpSettings)
      .createQueryBuilder()
      .delete()
      .execute();
    if (userIds.length)
      await dataSource
        .query(`DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])`, [
          userIds,
        ])
        .catch(() => undefined);
    if (userIds.length) await dataSource.getRepository(User).delete(userIds);
  }
  await app?.close();
});

describe('TDMP admin routes', () => {
  it('status: sync configured, schedule defaults, nothing linked yet', async () => {
    const res = await http()
      .get(`${PREFIX}/tdmp/status`)
      .set(auth('super_admin'))
      .expect(200);
    expect(res.body.enabled.sync).toBe(true);
    expect(res.body.running).toBe(false);
    expect(res.body.settings).toMatchObject({
      autoSync: true,
      probeIntervalMinutes: 60,
      dailyRunAt: '07:15',
    });
    expect(res.body.settings.probeIntervals).toEqual([15, 30, 60, 180, 360]);
  });

  it('is national-only: a district officer is refused', async () => {
    await http()
      .get(`${PREFIX}/tdmp/status`)
      .set(auth('district_officer'))
      .expect(403);
    await http()
      .post(`${PREFIX}/tdmp/sync`)
      .set(auth('district_officer'))
      .send({})
      .expect(403);
    await http()
      .patch(`${PREFIX}/tdmp/settings`)
      .set(auth('district_officer'))
      .send({ autoSync: false })
      .expect(403);
  });

  it('dry run reports the first link and writes nothing', async () => {
    const res = await startSync(true).expect(202);
    expect(res.body).toMatchObject({ started: true, dryRun: true });
    const run = await waitForRun(res.body.runId);

    expect(run.status).toBe('completed');
    expect(run.dryRun).toBe(true);
    expect(run.totals).toMatchObject({
      fetched: 4,
      linked: 1,
      created: 1,
      skippedNoGps: 1,
      skipped: 1,
      failed: 0,
    });
    expect(run.report?.newLinks.map((s) => s.code)).toEqual(['TSS-KGL-001']);
    expect(run.report?.needsLocation.map((s) => s.code)).toEqual([NOGPS_CODE]);
    expect(run.report?.skipped.map((s) => s.code)).toEqual([
      'SCOPE-DIST-GASABO',
    ]);

    const after = await dataSource
      .getRepository(School)
      .findOneByOrFail({ id: home.id });
    expect(after.tdmpSchoolCode).toBeNull();
    expect(after.name).toBe(homeBefore.name);
    expect(
      await dataSource.getRepository(School).countBy({ code: NEW_CODE }),
    ).toBe(0);
  });

  it('sync now: links by code, keeps our GIS location, adds the TDMP-only school', async () => {
    const res = await startSync().expect(202);
    const run = await waitForRun(res.body.runId);
    expect(run.status).toBe('completed');
    expect(run.totals).toMatchObject({
      linked: 1,
      created: 1,
      skippedNoGps: 1,
      skipped: 1,
      failed: 0,
    });

    const schools = dataSource.getRepository(School);
    const linked = await schools.findOneByOrFail({ id: home.id });
    expect(linked).toMatchObject({
      tdmpSchoolCode: 'TSS-KGL-001',
      tdmpSchoolId: 900001,
      name: `${homeBefore.name} (TDMP)`,
      establishedYear: 1998,
      ownership: 'Public',
      districtId: 3,
      totalStudents: 812,
      totalTeachers: 41,
      type: 'TSS',
    });
    // TDMP GPS (-1.0, 30.0) must not move a school RTB GIS already placed.
    expect(Number(linked.latitude)).toBeCloseTo(Number(homeBefore.latitude), 6);
    expect(Number(linked.longitude)).toBeCloseTo(
      Number(homeBefore.longitude),
      6,
    );
    expect(linked.tdmpData).toMatchObject({
      band: 'TSS',
      trades: ['CSA', 'NIT', 'SOD'],
      tmisSchoolCode: '11010101-01',
    });
    expect(linked.tdmpData).not.toHaveProperty('infrastructure');

    const created = await schools.findOneByOrFail({ code: NEW_CODE });
    expect(created).toMatchObject({
      type: 'VTC',
      locationSource: 'tdmp',
      ownership: 'Private',
      establishedYear: 2015,
    });
    expect(Number(created.latitude)).toBeCloseTo(-1.9441, 4);
    expect(await schools.countBy({ code: NOGPS_CODE })).toBe(0);

    // "Sync now" is in the audit trail.
    const audit = await dataSource.query(
      `SELECT action, outcome FROM audit_logs WHERE action = 'tdmp.sync' AND actor_email = $1`,
      [`e2e.tdmp.super_admin.${RUN}@test.rtb.rw`],
    );
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('the next run writes nothing when TDMP did not change', async () => {
    const before = await dataSource
      .getRepository(School)
      .findOneByOrFail({ id: home.id });
    tdmpCalls.length = 0;
    const res = await startSync().expect(202);
    const run = await waitForRun(res.body.runId);
    expect(run.totals).toMatchObject({
      unchanged: 2,
      updated: 0,
      created: 0,
      linked: 0,
    });
    // Fresh details are not re-read: list pages and band sweeps only.
    expect(
      tdmpCalls.filter((c) => /^\/api\/v1\/schools\/[^?]/.test(c)),
    ).toEqual([`/api/v1/schools/${NOGPS_CODE}`]);
    const after = await dataSource
      .getRepository(School)
      .findOneByOrFail({ id: home.id });
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.tdmpSyncedAt!.getTime()).toBeGreaterThan(
      before.tdmpSyncedAt!.getTime(),
    );
  });

  it('a TDMP change to learners updates only that school', async () => {
    tdmpRows[0] = {
      ...tdmpRows[0],
      counts: { students: 900, teachers: 41, trades: 4 },
    };
    const res = await startSync().expect(202);
    const run = await waitForRun(res.body.runId);
    expect(run.totals).toMatchObject({ updated: 1, unchanged: 1 });
    expect(run.report?.changes[0]).toMatchObject({
      code: 'TSS-KGL-001',
      fields: ['totalStudents'],
    });
    expect(
      (await dataSource.getRepository(School).findOneByOrFail({ id: home.id }))
        .totalStudents,
    ).toBe(900);
  });

  it('linked fields are locked for editing in RTB GIS', async () => {
    const res = await http()
      .patch(`${PREFIX}/schools/${home.id}`)
      .set(auth('super_admin'))
      .send({ name: 'Renamed in GIS' });
    expect(res.status).toBe(403);
  });

  it('only one run at a time', async () => {
    const [a, b] = await Promise.all([startSync(true), startSync(true)]);
    expect([a.status, b.status].sort()).toEqual([202, 409]);
    await waitForRun((a.status === 202 ? a : b).body.runId);
  });

  it('settings: pause, reschedule, and reject bad values', async () => {
    const ok = await http()
      .patch(`${PREFIX}/tdmp/settings`)
      .set(auth('super_admin'))
      .send({ autoSync: false, probeIntervalMinutes: 30, dailyRunAt: '06:30' })
      .expect(200);
    expect(ok.body).toMatchObject({
      autoSync: false,
      probeIntervalMinutes: 30,
      dailyRunAt: '06:30',
      updatedBy: `e2e.tdmp.super_admin.${RUN}@test.rtb.rw`,
    });
    await http()
      .patch(`${PREFIX}/tdmp/settings`)
      .set(auth('super_admin'))
      .send({ probeIntervalMinutes: 7 })
      .expect(400);
    await http()
      .patch(`${PREFIX}/tdmp/settings`)
      .set(auth('super_admin'))
      .send({ dailyRunAt: '25:00' })
      .expect(400);

    const status = await http()
      .get(`${PREFIX}/tdmp/status`)
      .set(auth('super_admin'))
      .expect(200);
    expect(status.body.settings).toMatchObject({
      autoSync: false,
      nextDailyRunAt: null,
    });
  });

  it('connection check: key accepted, pending TDMP grants reported', async () => {
    const res = await http()
      .get(`${PREFIX}/tdmp/connection?refresh=1`)
      .set(auth('super_admin'))
      .expect(200);
    expect(res.body).toMatchObject({
      authorised: true,
      reachable: true,
      tvetSchools: 4,
    });
    const byKey = Object.fromEntries(
      res.body.endpoints.map((e: { key: string; status: number }) => [
        e.key,
        e.status,
      ]),
    );
    expect(byKey).toMatchObject({
      schools: 200,
      trades: 403,
      tradesStudents: 403,
      performance: 403,
      discovery: 200,
    });
    const r1 = res.body.requests.find((r: { id: string }) => r.id === 'R1');
    expect(r1).toMatchObject({ state: 'waiting' });
  });

  it('unlinked list carries a suggestion field', async () => {
    const res = await http()
      .get(`${PREFIX}/tdmp/schools/unlinked`)
      .set(auth('super_admin'))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const s of res.body) expect(s).toHaveProperty('suggestion');
    expect(
      res.body.find((s: { id: string }) => s.id === home.id),
    ).toBeUndefined();
  });

  it('adds a TDMP school without GPS at a location an admin gives', async () => {
    await http()
      .post(`${PREFIX}/tdmp/schools/import`)
      .set(auth('super_admin'))
      .send({ schoolCode: NOGPS_CODE, latitude: 48.85, longitude: 2.35 })
      .expect(400);
    const res = await http()
      .post(`${PREFIX}/tdmp/schools/import`)
      .set(auth('super_admin'))
      .send({ schoolCode: NOGPS_CODE, latitude: -1.95, longitude: 30.06 })
      .expect(201);
    expect(res.body).toMatchObject({
      tdmpSchoolCode: NOGPS_CODE,
      name: 'E2E School Without GPS',
      locationSource: 'manual',
      ownership: 'Private',
    });
    await http()
      .post(`${PREFIX}/tdmp/schools/import`)
      .set(auth('super_admin'))
      .send({ schoolCode: NOGPS_CODE, latitude: -1.95, longitude: 30.06 })
      .expect(409);
    await http()
      .post(`${PREFIX}/tdmp/schools/import`)
      .set(auth('district_officer'))
      .send({ schoolCode: NOGPS_CODE, latitude: -1.95, longitude: 30.06 })
      .expect(403);
  });

  it('run history lists every run, newest first', async () => {
    const res = await http()
      .get(`${PREFIX}/tdmp/sync/runs?limit=50`)
      .set(auth('super_admin'))
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    expect(res.body[0].startedAt >= res.body[1].startedAt).toBe(true);
  });
});
