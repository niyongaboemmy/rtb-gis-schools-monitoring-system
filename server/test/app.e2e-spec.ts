/**
 * RTB GIS Schools Monitoring — End-to-End API Test Suite
 *
 * Prerequisites: `docker-compose up -d` (PostgreSQL+PostGIS, Redis, MinIO)
 * Run: npm run test:e2e
 *
 * The suite bootstraps the full NestJS application once via beforeAll,
 * bypasses the throttle guard so rate limits don't interfere, and exercises
 * three critical flows in order:
 *   Auth → Schools CRUD → Analytics (with RBAC checks)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module';

// ---------------------------------------------------------------------------
// Shared test state (populated in beforeAll, used across all describe blocks)
// ---------------------------------------------------------------------------

let app: INestApplication;

/** Credentials matching the seeded super-admin account (seed.service.ts). */
const ADMIN_CREDS = { email: 'admin@rtb.gov.rw', password: 'Admin@123' };

/** Viewer user created in beforeAll — unique per test run to avoid conflicts. */
const VIEWER_EMAIL = `e2e.viewer.${Date.now()}@test.rtb.rw`;
const VIEWER_PASSWORD = 'Viewer@E2E!1';

/** Unique school code so parallel CI runs don't clash. */
const TEST_SCHOOL_CODE = `E2E-${Date.now().toString(36).toUpperCase()}`;

let adminToken: string;
let adminUserId: string;
let adminRefreshToken: string;

let viewerToken: string;
let viewerUserId: string;

/** ID of the first seeded school — used for analytics metrics (stable, not deleted). */
let seededSchoolId: string;

/** ID of the school created during the Schools Flow tests. */
let createdSchoolId: string;

// ---------------------------------------------------------------------------
// One-time setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Bypass global throttle guard — auth endpoints have a 5-req/min limit
    // which would fail fast when several login calls run in sequence.
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  app = moduleFixture.createNestApplication();

  // Mirror main.ts configuration so guards, pipes, and routes work identically.
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  // --- Admin login (needed for all subsequent setup calls) ---------------
  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send(ADMIN_CREDS)
    .expect(200);

  adminToken = loginRes.body.accessToken;
  adminUserId = loginRes.body.user.id;
  adminRefreshToken = loginRes.body.refreshToken;

  // --- Grab the first seeded school for analytics tests ------------------
  const schoolsRes = await request(app.getHttpServer())
    .get('/api/v1/schools?page=1&limit=1')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  seededSchoolId = schoolsRes.body.data?.[0]?.id;

  // --- Find the viewer role ID (seeded by SeedService) -------------------
  const rolesRes = await request(app.getHttpServer())
    .get('/api/v1/roles')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  const viewerRole = (rolesRes.body as Array<{ id: string; name: string }>).find(
    (r) => r.name === 'viewer',
  );

  // --- Create a viewer user for RBAC tests --------------------------------
  const createViewerRes = await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'E2E',
      lastName: 'Viewer',
      email: VIEWER_EMAIL,
      password: VIEWER_PASSWORD,
      roleId: viewerRole?.id,
    })
    .expect(201);

  viewerUserId = createViewerRes.body.id;

  // --- Viewer login -------------------------------------------------------
  const viewerLoginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD })
    .expect(200);

  viewerToken = viewerLoginRes.body.accessToken;
}, 60_000); // allow up to 60 s for DB startup + seed on cold runs

afterAll(async () => {
  // Best-effort cleanup — don't fail the suite if cleanup itself errors.
  if (viewerUserId && adminToken) {
    await request(app.getHttpServer())
      .delete(`/api/v1/users/${viewerUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .catch(() => {});
  }
  await app?.close();
});

// ===========================================================================
// §1 — Auth Flow
// ===========================================================================

describe('Auth Flow', () => {
  it('POST /auth/login with valid credentials → 200 and returns accessToken + refreshToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(ADMIN_CREDS)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.refreshToken).toBeDefined();
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(ADMIN_CREDS.email);
    // password must never be returned
    expect(res.body.user.password).toBeUndefined();
  });

  it('GET /auth/me with valid Bearer token → 200 and returns current user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.id).toBe(adminUserId);
    expect(res.body.email).toBe(ADMIN_CREDS.email);
  });

  it('GET /auth/me without token → 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('GET /auth/me with malformed token → 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(401);
  });

  it('POST /auth/refresh with valid refresh token → 200 and returns new token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ userId: adminUserId, refreshToken: adminRefreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Rotated tokens must differ from the originals
    expect(res.body.accessToken).not.toBe(adminToken);

    // Update shared state so subsequent tests use the fresh tokens
    adminToken = res.body.accessToken;
    adminRefreshToken = res.body.refreshToken;
  });

  it('POST /auth/refresh with a wrong refresh token → 401 (SEC-01 regression)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ userId: adminUserId, refreshToken: 'completely-wrong-token' })
      .expect(401);
  });

  it('POST /auth/login with wrong password → 401 Invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_CREDS.email, password: 'WrongPassword!' })
      .expect(401);

    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('POST /auth/login with non-existent email → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@rtb.gov.rw', password: 'anything' })
      .expect(401);
  });
});

// ===========================================================================
// §2 — Schools CRUD Flow
// ===========================================================================

describe('Schools Flow', () => {
  const schoolPayload = {
    code: TEST_SCHOOL_CODE,
    name: 'E2E Test School',
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Kacyiru',
    latitude: -1.9355,
    longitude: 30.0928,
  };

  it('POST /schools → 201 and returns the created school with an id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(schoolPayload)
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.code).toBe(TEST_SCHOOL_CODE);
    expect(res.body.name).toBe('E2E Test School');

    createdSchoolId = res.body.id;
  });

  it('POST /schools with duplicate code → 409 Conflict', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(schoolPayload)
      .expect(409);
  });

  it('GET /schools → 200 with pagination envelope (data + total + page + limit)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/schools?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /schools?limit=2 respects the limit param', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/schools?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
  });

  it('GET /schools without token → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/schools')
      .expect(401);
  });

  it('PATCH /schools/:id → 200 and reflects the updated field', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/schools/${createdSchoolId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Test School (Updated)' })
      .expect(200);

    expect(res.body.name).toBe('E2E Test School (Updated)');
    expect(res.body.id).toBe(createdSchoolId);
  });

  it('GET /schools/:id → 200 and returns the updated name', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/schools/${createdSchoolId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.name).toBe('E2E Test School (Updated)');
  });

  it('DELETE /schools/:id → 204 No Content', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/schools/${createdSchoolId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('GET /schools/:id after deletion → 404 Not Found', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/schools/${createdSchoolId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});

// ===========================================================================
// §3 — Analytics Flow (with RBAC)
// ===========================================================================

describe('Analytics Flow', () => {
  it('POST /analytics/recalculate as viewer role → 403 Forbidden (missing MANAGE_DECISIONS)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/analytics/recalculate')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('POST /analytics/recalculate as admin → 200 and returns processed count', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/analytics/recalculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(typeof res.body.processed).toBe('number');
    expect(res.body.processed).toBeGreaterThanOrEqual(0);
  });

  it('POST /analytics/recalculate without token → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/analytics/recalculate')
      .expect(401);
  });

  it('GET /analytics/schools/:id/metrics → 200 and all scores are numeric and bounded [0, 100]', async () => {
    // Skip gracefully if no seeded schools exist (fresh empty DB)
    if (!seededSchoolId) {
      console.warn('[e2e] No seeded school found — skipping metrics bounds check');
      return;
    }

    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/schools/${seededSchoolId}/metrics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const scoreFields = [
      'overallScore',
      'infrastructureScore',
      'buildingAgeScore',
      'accessibilityScore',
      'populationPressureScore',
      'facilityComplianceScore',
    ] as const;

    for (const field of scoreFields) {
      const score = res.body[field];
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }

    // Structural presence checks
    expect(res.body.schoolId).toBe(seededSchoolId);
    expect(typeof res.body.priorityLevel).toBe('string');
    expect(['critical', 'high', 'medium', 'low']).toContain(res.body.priorityLevel);
  });

  it('GET /analytics/schools/:id/metrics as viewer role → 200 (viewer has SCHOOL_LEVEL_DASHBOARD)', async () => {
    if (!seededSchoolId) return;

    await request(app.getHttpServer())
      .get(`/api/v1/analytics/schools/${seededSchoolId}/metrics`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
  });

  it('GET /analytics/overview as viewer → 200 (viewer has VIEW_ANALYTICS)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
  });

  it('GET /analytics/overview without token → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .expect(401);
  });
});
