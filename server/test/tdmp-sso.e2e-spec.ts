/**
 * "Sign in with TDMP" — e2e, against a fake TDMP that behaves as the TDMP SSO
 * integration guide (12 Nov 2026) describes.
 *
 * Run against a throw-away TEST database (never the dev DB):
 *   DB_NAME=rtb_gis_test SEED_ON_STARTUP=true SCOPE_ENFORCEMENT=true \
 *     npm run test:e2e -- tdmp-sso
 *
 * The fake (at the `fetch` level) signs RS256 ID tokens with a key it
 * publishes as JWKS, checks PKCE and client credentials, rotates refresh
 * tokens and cancels all of a user's tokens when an old one is reused, and —
 * like the real TDMP — refuses sign-in tokens everywhere except the profile
 * address. The browser legs (start → TDMP → callback) are driven by hand.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { School } from '../src/modules/schools/entities/school.entity';

const TDMP = 'https://tdmp-sso.e2e.test/api/v1';
const APP = 'https://app.e2e.test';
const CLIENT_ID = 'rtb-gis-e2e';
const CLIENT_SECRET = 'e2e-client-secret';
process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';
process.env.AUTH_MODE = 'both';
process.env.TDMP_BASE_URL = TDMP;
process.env.TDMP_OAUTH_CLIENT_ID = CLIENT_ID;
process.env.TDMP_OAUTH_CLIENT_SECRET = CLIENT_SECRET;
process.env.TDMP_OAUTH_REDIRECT_URI = `${APP}/api/v1/auth/tdmp/callback`;
process.env.APP_PUBLIC_URL = APP;
process.env.TDMP_ACCESS_SOURCE = 'local';
process.env.TDMP_DEFAULT_ROLE = '';
process.env.TDMP_SESSION_MAX_HOURS = '24';
process.env.MFA_ENFORCE_PRIVILEGED = 'true';
process.env.COOKIE_SECURE = 'false';
delete process.env.TDMP_API_KEY;

const PREFIX = '/api/v1';
const RUN = Date.now().toString(36);
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

let app: INestApplication;
let dataSource: DataSource;
let adminToken: string;
let home: School;
const realFetch = global.fetch;
const createdEmails: string[] = [];
const tdmpCalls: string[] = [];

const http = () => request(app.getHttpServer());
const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

// ── Fake TDMP ────────────────────────────────────────────────────────────

const signingKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const strangerKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'tdmp-e2e-1';

interface TdmpPerson {
  sub: string;
  email: string;
  name: string;
  given: string;
  family: string;
}
interface PendingCode {
  person: TdmpPerson;
  challenge: string;
  nonce: string;
  redirect: string;
  forgeSignature?: boolean;
}

const codes = new Map<string, PendingCode>();
const accessTokens = new Map<string, TdmpPerson>();
/** refresh token → owner, and whether it still works. */
const refreshTokens = new Map<string, { person: TdmpPerson; live: boolean }>();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function idToken(person: TdmpPerson, nonce: string, forge = false): string {
  const now = Math.floor(Date.now() / 1000);
  const input = [
    { alg: 'RS256', kid: KID, typ: 'JWT' },
    {
      iss: TDMP,
      aud: CLIENT_ID,
      sub: person.sub,
      iat: now,
      exp: now + 3600,
      nonce,
      email: person.email,
      email_verified: true,
      name: person.name,
      given_name: person.given,
      family_name: person.family,
    },
  ]
    .map((p) => Buffer.from(JSON.stringify(p)).toString('base64url'))
    .join('.');
  const key = forge ? strangerKey.privateKey : signingKey.privateKey;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), key);
  return `${input}.${sig.toString('base64url')}`;
}

function issueTokens(person: TdmpPerson, nonce?: string, forge = false) {
  const access = `at-${crypto.randomBytes(8).toString('hex')}`;
  const refresh = `rt-${crypto.randomBytes(8).toString('hex')}`;
  accessTokens.set(access, person);
  refreshTokens.set(refresh, { person, live: true });
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: 300,
    refresh_token: refresh,
    ...(nonce !== undefined ? { id_token: idToken(person, nonce, forge) } : {}),
    scope: 'openid email profile',
  };
}

/** Cancels every token of a person (TDMP's answer to a reused refresh token). */
function cancelAll(person: TdmpPerson) {
  for (const t of refreshTokens.values())
    if (t.person.sub === person.sub) t.live = false;
}

async function fakeTdmp(url: URL, init?: RequestInit): Promise<Response> {
  const path = url.pathname.replace('/api/v1', '');
  const headers = new Headers(init?.headers);
  tdmpCalls.push(`${init?.method ?? 'GET'} ${path}`);

  if (path === '/oauth/.well-known/jwks.json')
    return json(200, {
      keys: [
        {
          ...signingKey.publicKey.export({ format: 'jwk' }),
          kid: KID,
          alg: 'RS256',
          use: 'sig',
        },
      ],
    });

  if (path === '/oauth/token' || path === '/oauth/revoke') {
    const basic = Buffer.from(
      (headers.get('authorization') ?? '').replace(/^Basic /, ''),
      'base64',
    ).toString();
    if (basic !== `${CLIENT_ID}:${CLIENT_SECRET}`)
      return json(401, { error: 'invalid_client' });
    if (!/x-www-form-urlencoded/.test(headers.get('content-type') ?? ''))
      return json(400, { error: 'unsupported_grant_type' });
    const form = new URLSearchParams(
      typeof init?.body === 'string' ? init.body : '',
    );

    if (path === '/oauth/revoke') {
      const t = refreshTokens.get(form.get('token') ?? '');
      if (t) t.live = false;
      return json(200, {});
    }
    if (form.get('grant_type') === 'authorization_code') {
      const pending = codes.get(form.get('code') ?? '');
      codes.delete(form.get('code') ?? '');
      if (!pending) return json(400, { error: 'invalid_grant' });
      const challenge = crypto
        .createHash('sha256')
        .update(form.get('code_verifier') ?? '')
        .digest('base64url');
      if (
        challenge !== pending.challenge ||
        form.get('redirect_uri') !== pending.redirect
      )
        return json(400, { error: 'invalid_grant' });
      return json(
        200,
        issueTokens(pending.person, pending.nonce, pending.forgeSignature),
      );
    }
    if (form.get('grant_type') === 'refresh_token') {
      const t = refreshTokens.get(form.get('refresh_token') ?? '');
      if (!t) return json(400, { error: 'invalid_grant' });
      if (!t.live) {
        // Reuse detected: TDMP assumes theft and cancels everything.
        cancelAll(t.person);
        return json(400, {
          error: 'invalid_grant',
          error_description: 'Refresh token reuse detected',
        });
      }
      t.live = false;
      return json(200, issueTokens(t.person));
    }
    return json(400, { error: 'unsupported_grant_type' });
  }

  const bearer = (headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const person = accessTokens.get(bearer);
  if (path === '/oauth/userinfo')
    return person
      ? json(200, {
          sub: person.sub,
          email: person.email,
          email_verified: true,
          name: person.name,
          given_name: person.given,
          family_name: person.family,
        })
      : json(401, { error: 'invalid_token' });

  // Sign-in tokens are only accepted at the profile address (guide §8).
  return json(401, {
    code: 'UNAUTHORIZED',
    message: 'Missing or invalid credentials',
    statusCode: 401,
  });
}

// ── Browser legs ─────────────────────────────────────────────────────────

/** `name=value` pairs from Set-Cookie headers, for the next request. */
function cookiesFrom(res: request.Response, jar: Map<string, string>) {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  for (const line of raw ?? []) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i);
    const value = pair.slice(i + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}
const cookieHeader = (jar: Map<string, string>) =>
  [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

/**
 * Start → (TDMP signs the person in) → callback. Returns where the callback
 * sent the browser and the cookie jar.
 */
async function signInWithTdmp(
  person: TdmpPerson,
  opts: { forgeSignature?: boolean; query?: string } = {},
) {
  const jar = new Map<string, string>();
  const start = await http().get(
    `${PREFIX}/auth/tdmp/start${opts.query ?? ''}`,
  );
  expect(start.status).toBe(302);
  cookiesFrom(start, jar);
  const authorize = new URL(start.headers.location);
  expect(authorize.href.startsWith(`${TDMP}/oauth/authorize`)).toBe(true);
  const q = authorize.searchParams;
  expect(q.get('code_challenge_method')).toBe('S256');
  expect(q.get('scope')).toBe('openid email profile');

  const code = crypto.randomBytes(8).toString('hex');
  codes.set(code, {
    person,
    challenge: q.get('code_challenge')!,
    nonce: q.get('nonce')!,
    redirect: q.get('redirect_uri')!,
    forgeSignature: opts.forgeSignature,
  });
  const callback = await http()
    .get(
      `${PREFIX}/auth/tdmp/callback?code=${code}&state=${encodeURIComponent(q.get('state')!)}`,
    )
    .set('Cookie', cookieHeader(jar));
  expect(callback.status).toBe(302);
  cookiesFrom(callback, jar);
  return { location: callback.headers.location, jar };
}

async function refresh(jar: Map<string, string>) {
  const res = await http()
    .post(`${PREFIX}/auth/refresh`)
    .set(CSRF)
    .set('Cookie', cookieHeader(jar))
    .send({});
  cookiesFrom(res, jar);
  return res;
}

const person = (key: string, given = 'Aline', family = 'Mukamana') => {
  const email = `e2e.sso.${key}.${RUN}@test.rtb.rw`;
  createdEmails.push(email);
  return {
    sub: `${RUN}-${key}`,
    email,
    name: `${given} ${family}`,
    given,
    family,
  };
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.href.startsWith(TDMP)) return fakeTdmp(url, init);
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

  const found = await dataSource
    .getRepository(School)
    .findOne({ where: { code: 'TSS-KGL-001' } });
  if (!found)
    throw new Error(
      'Seeded school TSS-KGL-001 missing — run with SEED_ON_STARTUP=true.',
    );
  home = found;

  const role = await dataSource
    .getRepository(Role)
    .findOneOrFail({ where: { name: 'super_admin' } });
  const adminEmail = `e2e.sso.admin.${RUN}@test.rtb.rw`;
  createdEmails.push(adminEmail);
  const admin = await dataSource.getRepository(User).save(
    dataSource.getRepository(User).create({
      firstName: 'E2E',
      lastName: 'Admin',
      email: adminEmail,
      password: `E2e!${RUN}Aa1`,
      isActive: true,
      role,
    }),
  );
  adminToken = await app.get(JwtService).signAsync({
    sub: admin.id,
    email: admin.email,
    role: role.name,
  });
}, 120_000);

afterAll(async () => {
  global.fetch = realFetch;
  if (dataSource?.isInitialized && createdEmails.length) {
    const users = await dataSource
      .getRepository(User)
      .find({ where: { email: In(createdEmails) } });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await dataSource
        .query(`DELETE FROM user_sessions WHERE user_id = ANY($1::uuid[])`, [
          ids,
        ])
        .catch(() => undefined);
      await dataSource.getRepository(User).delete(ids);
    }
  }
  await app?.close();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('TDMP sign-in (SSO guide)', () => {
  it('lists TDMP sign-in and local access on the login page settings', async () => {
    const res = await http().get(`${PREFIX}/auth/providers`).expect(200);
    expect(res.body).toMatchObject({
      authMode: 'both',
      tdmp: true,
      tdmpAccess: 'local',
    });
  });

  it('puts someone nobody pre-registered on the waiting list', async () => {
    const aline = person('waiting');
    const { location, jar } = await signInWithTdmp(aline);
    expect(location).toBe(`${APP}/sso/tdmp/complete?next=%2F`);

    const r = await refresh(jar);
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({
      email: aline.email,
      firstName: 'Aline',
      lastName: 'Mukamana',
      authSource: 'tdmp',
      tdmpUserId: aline.sub,
      accessPending: true,
      role: null,
    });
    const token = r.body.accessToken as string;

    // Only their own profile until an admin gives access.
    const me = await http()
      .get(`${PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    const schools = await http()
      .get(`${PREFIX}/schools`)
      .set('Authorization', `Bearer ${token}`);
    expect(schools.status).toBe(403);
    expect(schools.body.code).toBe('ACCESS_PENDING');

    // Role and area never came from TDMP's access-scope route.
    expect(tdmpCalls).not.toContain('GET /auth/me/access-scope');

    // Audit rows are written in the background.
    let audit: unknown[] = [];
    for (let i = 0; i < 30 && !audit.length; i++) {
      audit = await dataSource.query(
        `SELECT 1 FROM audit_logs WHERE action = 'auth.tdmp_access_requested' AND target_label = $1`,
        [aline.email],
      );
      if (!audit.length)
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
        });
    }
    expect(audit.length).toBe(1);

    // An admin gives access: the same session works at once.
    const viewer = await dataSource
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'viewer' } });
    const users = await http().get(`${PREFIX}/users`).set(asAdmin());
    const row = users.body.find((u: User) => u.email === aline.email);
    expect(row.accessPending).toBe(true);
    await http()
      .patch(`${PREFIX}/users/${row.id}`)
      .set(asAdmin())
      .send({ roleId: viewer.id })
      .expect(200);
    const after = await http()
      .get(`${PREFIX}/schools`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);

    // Name and email stay TDMP's.
    const rename = await http()
      .patch(`${PREFIX}/users/${row.id}`)
      .set(asAdmin())
      .send({ firstName: 'Someone' });
    expect(rename.status).toBe(403);
    expect(rename.body.code).toBe('TDMP_MANAGED');
  });

  it('applies a pre-registered role and area at the first sign-in', async () => {
    const jean = person('district', 'Jean', 'Habimana');
    const officer = await dataSource
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'district_officer' } });
    const created = await http()
      .post(`${PREFIX}/users/tdmp`)
      .set(asAdmin())
      .send({
        email: jean.email,
        roleId: officer.id,
        location: { province: home.province, district: home.district },
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      authSource: 'tdmp',
      accessPending: false,
    });
    const dup = await http()
      .post(`${PREFIX}/users/tdmp`)
      .set(asAdmin())
      .send({ email: jean.email, roleId: officer.id });
    expect(dup.status).toBe(409);

    const { jar } = await signInWithTdmp(jean);
    const r = await refresh(jar);
    expect(r.body.user).toMatchObject({
      id: created.body.id,
      tdmpUserId: jean.sub,
      firstName: 'Jean',
      accessPending: false,
      role: { name: 'district_officer' },
      location: { district: home.district },
    });
    const list = await http()
      .get(`${PREFIX}/schools?limit=100`)
      .set('Authorization', `Bearer ${r.body.accessToken}`)
      .expect(200);
    const districts = new Set(
      (list.body.data ?? list.body).map((s: School) => s.district),
    );
    expect([...districts]).toEqual([home.district]);
  });

  it('caps a TDMP session at TDMP_SESSION_MAX_HOURS and re-checks with TDMP', async () => {
    const grace = person('session', 'Grace', 'Uwase');
    const viewer = await dataSource
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'viewer' } });
    await http()
      .post(`${PREFIX}/users/tdmp`)
      .set(asAdmin())
      .send({ email: grace.email, roleId: viewer.id })
      .expect(201);
    const { jar } = await signInWithTdmp(grace);
    expect((await refresh(jar)).status).toBe(200);

    const [session] = await dataSource.query(
      `SELECT s.id, s.expires_at, s.created_at, s.external_refresh_token_enc
         FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE u.email = $1 AND s.method = 'tdmp' AND s.revoked_at IS NULL`,
      [grace.email],
    );
    expect(session.external_refresh_token_enc).toBeTruthy();
    const hours =
      (new Date(session.expires_at).getTime() -
        new Date(session.created_at).getTime()) /
      3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24.01);

    // Two re-checks in a row: each presents the newest TDMP token, so TDMP
    // never sees a reused one (which would cancel all her tokens).
    for (let i = 0; i < 2; i++) {
      await dataSource.query(
        `UPDATE user_sessions SET external_checked_at = now() - interval '1 hour' WHERE id = $1`,
        [session.id],
      );
      const r = await refresh(jar);
      expect(r.status).toBe(200);
    }
    expect(
      tdmpCalls.filter((c) => c === 'POST /oauth/token').length,
    ).toBeGreaterThanOrEqual(3);

    // TDMP cancels her tokens → our next re-check ends the session.
    cancelAll(grace);
    await dataSource.query(
      `UPDATE user_sessions SET external_checked_at = now() - interval '1 hour' WHERE id = $1`,
      [session.id],
    );
    expect((await refresh(jar)).status).toBe(401);
    const [ended] = await dataSource.query(
      `SELECT revoked_reason FROM user_sessions WHERE id = $1`,
      [session.id],
    );
    expect(ended.revoked_reason).toBe('tdmp_revoked');

    // After the cap the session is over, whatever TDMP says.
    const second = await signInWithTdmp(grace);
    expect((await refresh(second.jar)).status).toBe(200);
    await dataSource.query(
      `UPDATE user_sessions SET expires_at = now() - interval '1 minute'
        WHERE user_id = (SELECT id FROM users WHERE email = $1) AND revoked_at IS NULL`,
      [grace.email],
    );
    expect((await refresh(second.jar)).status).toBe(401);
  });

  it('asks privileged TDMP users for our second factor', async () => {
    const eric = person('privileged', 'Eric', 'Tuyishimire');
    const adminRole = await dataSource
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'admin' } });
    await http()
      .post(`${PREFIX}/users/tdmp`)
      .set(asAdmin())
      .send({ email: eric.email, roleId: adminRole.id })
      .expect(201);

    const { location, jar } = await signInWithTdmp(eric);
    expect(location).toBe(`${APP}/login?sso_mfa=1&next=%2F`);
    expect(jar.has('rtb_rt')).toBe(false);
    expect(jar.has('rtb_tdmp_pending')).toBe(true);

    // Without the pending cookie there is nothing to continue.
    await http().post(`${PREFIX}/auth/tdmp/mfa`).set(CSRF).send({}).expect(401);

    const step = await http()
      .post(`${PREFIX}/auth/tdmp/mfa`)
      .set(CSRF)
      .set('Cookie', cookieHeader(jar))
      .send({});
    expect(step.status).toBe(200);
    expect(step.body.mfaEnrollmentRequired).toBe(true);
    const mfaToken = step.body.mfaToken as string;

    const enrol = await http()
      .post(`${PREFIX}/auth/2fa/enroll/start`)
      .send({ mfaToken })
      .expect(200);
    const code = authenticator.generate(enrol.body.secret);

    // The 2FA step only finishes a TDMP sign-in with its pending cookie.
    await http()
      .post(`${PREFIX}/auth/2fa/enroll/confirm`)
      .send({ mfaToken, code })
      .expect(401);

    const done = await http()
      .post(`${PREFIX}/auth/2fa/enroll/confirm`)
      .set('Cookie', cookieHeader(jar))
      .send({ mfaToken, code });
    expect(done.status).toBe(200);
    expect(done.body.user).toMatchObject({
      authSource: 'tdmp',
      role: { name: 'admin' },
    });
    expect(done.body.recoveryCodes).toHaveLength(10);
    cookiesFrom(done, jar);
    expect(jar.has('rtb_rt')).toBe(true);
    expect(jar.has('rtb_tdmp_pending')).toBe(false);

    const [session] = await dataSource.query(
      `SELECT s.method, s.external_refresh_token_enc
         FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE u.email = $1 AND s.revoked_at IS NULL`,
      [eric.email],
    );
    expect(session.method).toBe('tdmp');
    expect(session.external_refresh_token_enc).toBeTruthy();
  });

  it('refuses an ID token not signed by TDMP', async () => {
    const { location } = await signInWithTdmp(person('forged'), {
      forgeSignature: true,
    });
    expect(location).toBe(`${APP}/login?sso_error=failed`);
  });

  it('refuses a callback that did not start here', async () => {
    const res = await http()
      .get(`${PREFIX}/auth/tdmp/callback?code=x&state=y`)
      .expect(302);
    expect(res.headers.location).toBe(`${APP}/login?sso_error=state`);
  });

  it('cancels the TDMP refresh token at sign-out', async () => {
    const paul = person('logout', 'Paul', 'Nkurunziza');
    const viewer = await dataSource
      .getRepository(Role)
      .findOneOrFail({ where: { name: 'viewer' } });
    await http()
      .post(`${PREFIX}/users/tdmp`)
      .set(asAdmin())
      .send({ email: paul.email, roleId: viewer.id })
      .expect(201);
    const { jar } = await signInWithTdmp(paul);
    const before = tdmpCalls.filter((c) => c === 'POST /oauth/revoke').length;
    await http()
      .post(`${PREFIX}/auth/logout`)
      .set(CSRF)
      .set('Cookie', cookieHeader(jar))
      .expect(200);
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 200);
    });
    expect(tdmpCalls.filter((c) => c === 'POST /oauth/revoke').length).toBe(
      before + 1,
    );
  });
});
