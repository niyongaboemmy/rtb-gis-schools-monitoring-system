/**
 * Partner API and embedded views — e2e (docs/TDMP_INTEGRATION_PLAN.md §14).
 *
 * Run against a throw-away TEST database (never the dev DB):
 *   DB_NAME=rtb_gis_test SEED_ON_STARTUP=true SCOPE_ENFORCEMENT=true \
 *     npm run test:e2e -- partner
 *
 * Covers: partner keys (create, scopes, revoke), both auth headers, the
 * coordinates feed (JSON, GeoJSON, updatedSince), schools list / detail,
 * signed embed links → read-only embed sessions limited to the link's school
 * or area, partner accounts never signing in, and revocation ending sessions.
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
import { PartnerApiKey } from '../src/modules/partner/entities/partner-api-key.entity';

process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';

const PREFIX = '/api/v1';
const RUN = Date.now().toString(36);

let app: INestApplication;
let ds: DataSource;
let home: School;
let other: School;
let adminToken: string;
let adminId: string;
let fullKey: { id: string; apiKey: string };
let coordsOnlyKey: { id: string; apiKey: string };
const http = () => request(app.getHttpServer());
const asAdmin = { Authorization: '' };
const withKey = (k: string) => ({ Authorization: `ApiKey ${k}` });

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
  ds = app.get(DataSource);

  const schools = await ds.getRepository(School).find();
  home = schools.find((s) => s.code === 'TSS-KGL-001') ?? schools[0];
  other = schools.find((s) => s.district !== home.district)!;
  if (!home || !other)
    throw new Error('Seeded schools missing — run with SEED_ON_STARTUP=true.');

  const role = await ds
    .getRepository(Role)
    .findOneByOrFail({ name: 'super_admin' });
  const users = ds.getRepository(User);
  const admin = await users.save(
    users.create({
      firstName: 'E2E',
      lastName: 'partner',
      email: `e2e.partner.${RUN}@test.rtb.rw`,
      password: `E2e!${RUN}Aa1`,
      isActive: true,
      role,
    }),
  );
  adminId = admin.id;
  adminToken = await app
    .get(JwtService, { strict: false })
    .signAsync({ sub: admin.id, email: admin.email, role: role.name });
  asAdmin.Authorization = `Bearer ${adminToken}`;
}, 120_000);

afterAll(async () => {
  if (ds?.isInitialized) {
    const keys = await ds.getRepository(PartnerApiKey).find();
    const serviceIds = keys.map((k) => k.serviceUserId);
    await ds
      .getRepository(PartnerApiKey)
      .createQueryBuilder()
      .delete()
      .execute();
    if (serviceIds.length) await ds.getRepository(User).delete(serviceIds);
    await ds.getRepository(User).delete(adminId);
  }
  await app?.close();
});

describe('Partner keys (admin)', () => {
  it('creates a key, shows it once, and never lists the key itself', async () => {
    const res = await http()
      .post(`${PREFIX}/partner-keys`)
      .set(asAdmin)
      .send({
        name: 'TDMP e2e',
        partner: 'TDMP',
        allowedOrigins: ['https://tdmp.rtb.gov.rw'],
      })
      .expect(201);
    expect(res.body.apiKey).toMatch(/^rtbgis_pk_[0-9a-f]{64}$/);
    expect(res.body.scopes).toEqual([
      'schools:read',
      'coordinates:read',
      'embed:create',
    ]);
    fullKey = { id: res.body.id, apiKey: res.body.apiKey };

    const list = await http()
      .get(`${PREFIX}/partner-keys`)
      .set(asAdmin)
      .expect(200);
    const row = list.body.find((k: { id: string }) => k.id === fullKey.id);
    expect(row).toBeTruthy();
    expect(JSON.stringify(list.body)).not.toContain(fullKey.apiKey);
    expect(row).not.toHaveProperty('keyHash');

    const limited = await http()
      .post(`${PREFIX}/partner-keys`)
      .set(asAdmin)
      .send({
        name: 'Coords only',
        partner: 'TDMP',
        scopes: ['coordinates:read'],
      })
      .expect(201);
    coordsOnlyKey = { id: limited.body.id, apiKey: limited.body.apiKey };
  });

  it('rejects bad scopes and origins', async () => {
    await http()
      .post(`${PREFIX}/partner-keys`)
      .set(asAdmin)
      .send({ name: 'x1', partner: 'TDMP', scopes: ['write:all'] })
      .expect(400);
    await http()
      .post(`${PREFIX}/partner-keys`)
      .set(asAdmin)
      .send({
        name: 'x2',
        partner: 'TDMP',
        allowedOrigins: ['javascript:alert(1)'],
      })
      .expect(400);
  });
});

describe('Partner API', () => {
  it('needs a valid key, in either header', async () => {
    const none = await http().get(`${PREFIX}/partner/ping`).expect(401);
    expect(none.body.code).toBe('PARTNER_KEY_INVALID');
    await http()
      .get(`${PREFIX}/partner/ping`)
      .set(withKey('rtbgis_pk_nope'))
      .expect(401);
    await http()
      .get(`${PREFIX}/partner/ping`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(401);
    const ping = await http()
      .get(`${PREFIX}/partner/ping`)
      .set(withKey(fullKey.apiKey))
      .expect(200);
    expect(ping.body).toMatchObject({
      partner: 'TDMP',
      scopes: ['schools:read', 'coordinates:read', 'embed:create'],
    });
    await http()
      .get(`${PREFIX}/partner/ping`)
      .set({ 'X-API-Key': fullKey.apiKey })
      .expect(200);
  });

  it('serves the coordinates feed as JSON and GeoJSON', async () => {
    const res = await http()
      .get(`${PREFIX}/partner/schools/coordinates?limit=500`)
      .set(withKey(fullKey.apiKey))
      .expect(200);
    expect(res.body.page.total).toBeGreaterThan(0);
    const row = res.body.data.find(
      (d: { rtbGisId: string }) => d.rtbGisId === home.id,
    );
    expect(row).toMatchObject({
      schoolCode: home.tdmpSchoolCode ?? home.code,
      latitude: Number(home.latitude),
      longitude: Number(home.longitude),
    });
    expect(['surveyed', 'manual', 'tdmp', 'unverified']).toContain(row.quality);
    expect(res.body.generatedAt).toBeTruthy();

    const geo = await http()
      .get(`${PREFIX}/partner/schools/coordinates?format=geojson&limit=500`)
      .set(withKey(fullKey.apiKey))
      .expect(200);
    expect(geo.body.type).toBe('FeatureCollection');
    const f = geo.body.features.find(
      (x: { properties: { rtbGisId: string } }) =>
        x.properties.rtbGisId === home.id,
    );
    expect(f.geometry).toEqual({
      type: 'Point',
      coordinates: [Number(home.longitude), Number(home.latitude)],
    });
  });

  it('updatedSince returns only schools whose location changed since', async () => {
    const before = new Date().toISOString();
    await ds
      .getRepository(School)
      .update(home.id, { locationUpdatedAt: new Date(Date.now() + 1000) });
    const res = await http()
      .get(`${PREFIX}/partner/schools/coordinates`)
      .query({ updatedSince: before })
      .set(withKey(fullKey.apiKey))
      .expect(200);
    expect(res.body.data.map((d: { rtbGisId: string }) => d.rtbGisId)).toEqual([
      home.id,
    ]);
    await http()
      .get(`${PREFIX}/partner/schools/coordinates?updatedSince=yesterday`)
      .set(withKey(fullKey.apiKey))
      .expect(400);
  });

  it('lists schools and returns one school by code', async () => {
    const list = await http()
      .get(`${PREFIX}/partner/schools?limit=500`)
      .set(withKey(fullKey.apiKey))
      .expect(200);
    const row = list.body.data.find(
      (d: { rtbGisId: string }) => d.rtbGisId === home.id,
    );
    expect(row.views).toMatchObject({ dashboard: true, map2d: true });
    const one = await http()
      .get(`${PREFIX}/partner/schools/${home.tdmpSchoolCode ?? home.code}`)
      .set(withKey(fullKey.apiKey))
      .expect(200);
    expect(one.body).toMatchObject({ rtbGisId: home.id, name: home.name });
    expect(Array.isArray(one.body.boundaries)).toBe(true);
    await http()
      .get(`${PREFIX}/partner/schools/NO-SUCH-CODE`)
      .set(withKey(fullKey.apiKey))
      .expect(404);
  });

  it('a key only reaches what its scopes allow', async () => {
    await http()
      .get(`${PREFIX}/partner/schools/coordinates`)
      .set(withKey(coordsOnlyKey.apiKey))
      .expect(200);
    const res = await http()
      .get(`${PREFIX}/partner/schools`)
      .set(withKey(coordsOnlyKey.apiKey))
      .expect(403);
    expect(res.body.code).toBe('PARTNER_SCOPE_MISSING');
    await http()
      .post(`${PREFIX}/partner/embed-links`)
      .set(withKey(coordsOnlyKey.apiKey))
      .send({ view: 'national-map' })
      .expect(403);
  });
});

describe('Embedded views', () => {
  let session: string;

  async function openSession(body: object) {
    const link = await http()
      .post(`${PREFIX}/partner/embed-links`)
      .set(withKey(fullKey.apiKey))
      .send(body)
      .expect(201);
    const token = new URL(link.body.url).hash.replace('#token=', '');
    const s = await http()
      .post(`${PREFIX}/embed/session`)
      .send({ token })
      .expect(200);
    return { link: link.body, s: s.body };
  }

  it('mints a signed link with the token in the URL fragment', async () => {
    const res = await http()
      .post(`${PREFIX}/partner/embed-links`)
      .set(withKey(fullKey.apiKey))
      .send({
        view: 'school-dashboard',
        schoolCode: home.tdmpSchoolCode ?? home.code,
        ttlSeconds: 120,
      })
      .expect(201);
    expect(res.body.url).toMatch(
      new RegExp(`/embed/schools/${home.id}/dashboard#token=`),
    );
    expect(res.body.scope).toMatchObject({ tier: 'school', schoolId: home.id });
    await http()
      .post(`${PREFIX}/partner/embed-links`)
      .set(withKey(fullKey.apiKey))
      .send({ view: 'school-dashboard' })
      .expect(400);
    await http()
      .post(`${PREFIX}/partner/embed-links`)
      .set(withKey(fullKey.apiKey))
      .send({ view: 'admin-panel' })
      .expect(400);
  });

  it('a school link opens a read-only session limited to that school', async () => {
    const { s } = await openSession({
      view: 'school-dashboard',
      schoolCode: home.tdmpSchoolCode ?? home.code,
    });
    session = s.accessToken;
    expect(s).toMatchObject({
      view: 'school-dashboard',
      schoolId: home.id,
      partner: 'TDMP',
    });
    expect(s.user.location).toMatchObject({
      tier: 'school',
      schoolId: home.id,
    });
    const auth = { Authorization: `Bearer ${session}` };

    await http().get(`${PREFIX}/schools/${home.id}`).set(auth).expect(200);
    const blocked = await http().get(`${PREFIX}/schools/${other.id}`).set(auth);
    expect([403, 404]).toContain(blocked.status);
    const list = await http()
      .get(`${PREFIX}/schools?limit=100`)
      .set(auth)
      .expect(200);
    expect(list.body.data.map((x: { id: string }) => x.id)).toEqual([home.id]);

    const write = await http()
      .patch(`${PREFIX}/schools/${home.id}`)
      .set(auth)
      .send({ phone: '0788000000' })
      .expect(403);
    expect(write.body.code).toBe('EMBED_READ_ONLY');
  });

  it('the national map link can be limited to one district', async () => {
    const { s } = await openSession({
      view: 'national-map',
      province: home.province,
      district: home.district,
    });
    const list = await http()
      .get(`${PREFIX}/schools?limit=500`)
      .set({ Authorization: `Bearer ${s.accessToken}` })
      .expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(
      list.body.data.every(
        (x: { district: string }) => x.district === home.district,
      ),
    ).toBe(true);
  });

  it('rejects a forged or wrong-purpose token', async () => {
    const bad = await http()
      .post(`${PREFIX}/embed/session`)
      .send({ token: adminToken })
      .expect(401);
    expect(bad.body.code).toBe('EMBED_LINK_INVALID');
  });

  it('the partner account can never sign in or act without an embed claim', async () => {
    const key = await ds
      .getRepository(PartnerApiKey)
      .findOneByOrFail({ id: fullKey.id });
    const svc = await ds
      .getRepository(User)
      .findOneByOrFail({ id: key.serviceUserId });
    expect(svc.authSource).toBe('partner');
    expect(svc.email).toMatch(/@partner\.rtb-gis\.invalid$/);
    await http()
      .post(`${PREFIX}/auth/login`)
      .send({ email: svc.email, password: 'whatever-Aa1!' })
      .expect(401);
    const plain = await app
      .get(JwtService, { strict: false })
      .signAsync({ sub: svc.id, email: svc.email, role: 'partner_viewer' });
    await http()
      .get(`${PREFIX}/schools`)
      .set({ Authorization: `Bearer ${plain}` })
      .expect(401);
  });

  it('revoking the key ends open sessions and refuses new ones', async () => {
    await http()
      .post(`${PREFIX}/partner-keys/${fullKey.id}/revoke`)
      .set(asAdmin)
      .expect(200);
    await http()
      .get(`${PREFIX}/partner/ping`)
      .set(withKey(fullKey.apiKey))
      .expect(401);
    await http()
      .get(`${PREFIX}/schools/${home.id}`)
      .set({ Authorization: `Bearer ${session}` })
      .expect(401);
  });

  it('a district officer cannot manage partner keys', async () => {
    const role = await ds
      .getRepository(Role)
      .findOneByOrFail({ name: 'district_officer' });
    const users = ds.getRepository(User);
    const u = await users.save(
      users.create({
        firstName: 'E2E',
        lastName: 'do',
        email: `e2e.partner.do.${RUN}@test.rtb.rw`,
        password: `E2e!${RUN}Aa1`,
        isActive: true,
        role,
        location: { province: home.province, district: home.district },
      }),
    );
    const t = await app
      .get(JwtService, { strict: false })
      .signAsync({ sub: u.id, email: u.email, role: role.name });
    await http()
      .get(`${PREFIX}/partner-keys`)
      .set({ Authorization: `Bearer ${t}` })
      .expect(403);
    await users.delete(u.id);
  });
});
