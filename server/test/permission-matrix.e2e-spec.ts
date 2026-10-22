/**
 * WS7.6 — Permission-matrix e2e test.
 *
 * HOW TO RUN (against a throw-away TEST database, never the shared dev DB):
 *
 *   createdb rtb_gis_test && psql rtb_gis_test -c 'CREATE EXTENSION postgis'
 *   cd server
 *   DB_NAME=rtb_gis_test DB_SYNC=true SEED_ON_STARTUP=true SCOPE_ENFORCEMENT=true \
 *     npm run test:e2e -- permission-matrix
 *
 * The app boots with the normal AppModule; SEED_ON_STARTUP=true seeds the
 * built-in roles, the scoped presets (district_officer, school_leader) and the
 * sample schools. The DB must be FRESH so the seeded roles still carry their
 * code-defined permissions (the first test checks this and reports drift).
 *
 * What it does
 *  1. Builds the expected 200/403 matrix FROM CODE: the role definitions
 *     (DefaultRolePermissions + ScopedRolePresets) × every route found by
 *     introspecting the registered controllers' metadata
 *     (@RequirePermissions / @RequireAnyPermission at handler or class level,
 *     resolved exactly like PermissionsGuard, plus @RequireNationalScope
 *     when ScopeGuard is on the route). New routes are covered automatically.
 *  2. Creates one user per role (school_leader bound to a seeded school,
 *     district_officer to that school's district), signs a token for each, and
 *     calls every permission-protected route with a non-existent UUID for path
 *     params and an empty body. Guards run before pipes and handlers, so a
 *     denied call is always a 403 and an allowed one is never a 403 (it is
 *     usually 400/404 because of the empty body / unknown id).
 *     Allowed calls to mutating routes WITHOUT a path param are not executed
 *     (they could do real work, e.g. recalculate or bulk import); they are
 *     listed as "allowed (not executed)". Denied ones are always executed.
 *  3. Scope: a school_leader gets 403 on another school's /schools/:id, sees
 *     only their school in GET /schools, and the WebSocket gateway refuses
 *     their join of another school's room ({ ok: false }).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, RequestMethod, Type } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  DefaultRolePermissions,
  Permission,
  ScopedRolePresets,
} from '../src/common/constants/permissions.constant';
import {
  PERMISSIONS_ANY_KEY,
  PERMISSIONS_KEY,
} from '../src/common/decorators/permissions.decorator';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { ScopeGuard } from '../src/common/scope/scope.guard';
import {
  NATIONAL_ONLY_KEY,
  SCOPED_RESOURCE_KEY,
  ScopedResourceConfig,
} from '../src/common/scope/scope.decorator';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { School } from '../src/modules/schools/entities/school.entity';
import { EventsGateway } from '../src/modules/events/events.gateway';
import { AuthService } from '../src/modules/auth/auth.service';

process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';

const PREFIX = '/api/v1';
const MISSING_UUID = '7f3c9a10-0000-4000-8000-00000000e2e0';
const RUN = Date.now().toString(36);

// ── Route discovery ────────────────────────────────────────────────────────

interface RouteSpec {
  controller: string;
  handler: string;
  method: RequestMethod;
  verb: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string; // with :params
  requireAll: Permission[];
  requireAny: Permission[];
  nationalOnly: boolean;
  /** A school id the route reads from the query string (ScopeGuard fails closed without it). */
  scopedQueryParam?: string;
}

const VERBS: Partial<Record<RequestMethod, RouteSpec['verb']>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

function joinPath(...parts: (string | undefined)[]) {
  const p = parts
    .filter((x) => x !== undefined && x !== '' && x !== '/')
    .map((x) => String(x).replace(/^\/+|\/+$/g, ''))
    .join('/');
  return `/${p}`;
}

function firstPath(meta: unknown): string {
  const value: unknown = Array.isArray(meta) ? meta[0] : meta;
  return typeof value === 'string' ? value : '';
}

function hasGuard(target: object, guard: Type<unknown>): boolean {
  const list = (Reflect.getMetadata(GUARDS_METADATA, target) ??
    []) as unknown[];
  return list.some((g) => g === guard || (g as object)?.constructor === guard);
}

/** Every permission-protected route of the running app, resolved from metadata. */
function discoverRoutes(app: INestApplication): RouteSpec[] {
  const routes: RouteSpec[] = [];
  const container = app.get(ModulesContainer);
  const seen = new Set<unknown>();
  for (const mod of container.values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as Type<unknown> | null;
      if (!ctrl || seen.has(ctrl)) continue;
      seen.add(ctrl);
      const base = firstPath(Reflect.getMetadata(PATH_METADATA, ctrl));
      const proto = ctrl.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        // Skip getters/setters: reading one off the bare prototype runs it.
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (!desc || desc.get || desc.set) continue;
        const fn = desc.value as unknown;
        if (typeof fn !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, fn) as
          | RequestMethod
          | undefined;
        const sub = Reflect.getMetadata(PATH_METADATA, fn);
        if (method === undefined || sub === undefined) continue;
        const verb = VERBS[method];
        if (!verb) continue;

        // Same resolution as PermissionsGuard.getAllAndOverride: handler wins.
        const requireAll = (Reflect.getMetadata(PERMISSIONS_KEY, fn) ??
          Reflect.getMetadata(PERMISSIONS_KEY, ctrl) ??
          []) as Permission[];
        const requireAny = (Reflect.getMetadata(PERMISSIONS_ANY_KEY, fn) ??
          Reflect.getMetadata(PERMISSIONS_ANY_KEY, ctrl) ??
          []) as Permission[];
        const permGuarded =
          hasGuard(ctrl, PermissionsGuard) || hasGuard(fn, PermissionsGuard);
        if (!permGuarded || (!requireAll.length && !requireAny.length))
          continue;

        const scopeGuarded =
          hasGuard(ctrl, ScopeGuard) || hasGuard(fn, ScopeGuard);
        const nationalOnly =
          scopeGuarded &&
          !!(
            Reflect.getMetadata(NATIONAL_ONLY_KEY, fn) ??
            Reflect.getMetadata(NATIONAL_ONLY_KEY, ctrl)
          );

        const scopedCfg = (Reflect.getMetadata(SCOPED_RESOURCE_KEY, fn) ??
          Reflect.getMetadata(SCOPED_RESOURCE_KEY, ctrl)) as
          | ScopedResourceConfig
          | undefined;

        routes.push({
          controller: ctrl.name,
          handler: name,
          method,
          verb,
          path: joinPath(base, firstPath(sub)),
          requireAll,
          requireAny,
          nationalOnly,
          scopedQueryParam:
            scopeGuarded && scopedCfg?.from === 'query'
              ? scopedCfg.param
              : undefined,
        });
      }
    }
  }
  return routes;
}

// ── Expected matrix from the role definitions ──────────────────────────────

interface RoleDef {
  name: string;
  permissions: Permission[];
  scoped: boolean; // bound to a sub-national tier
}

const ROLE_DEFS: RoleDef[] = [
  ...Object.entries(DefaultRolePermissions).map(([name, permissions]) => ({
    name,
    permissions,
    scoped: false,
  })),
  ...Object.entries(ScopedRolePresets).map(([name, p]) => ({
    name,
    permissions: p.permissions,
    scoped: true,
  })),
];

function expectedAllowed(role: RoleDef, route: RouteSpec): boolean {
  if (route.nationalOnly && role.scoped) return false;
  if (role.name === 'super_admin') return true; // PermissionsGuard bypass
  const has = (p: Permission) => role.permissions.includes(p);
  if (route.requireAll.length && !route.requireAll.every(has)) return false;
  if (route.requireAny.length && !route.requireAny.some(has)) return false;
  return true;
}

function concretePath(route: RouteSpec): string {
  const path = PREFIX + route.path.replace(/:[A-Za-z0-9_]+/g, MISSING_UUID);
  // A query-scoped school id is required; send the caller's in-scope school
  // so an allowed role passes ScopeGuard (its absence is tested separately).
  return route.scopedQueryParam
    ? `${path}?${route.scopedQueryParam}=${homeSchool.id}`
    : path;
}

// ── Test state ─────────────────────────────────────────────────────────────

let app: INestApplication;
let dataSource: DataSource;
let routes: RouteSpec[] = [];
const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};
let homeSchool: School;
let otherSchool: School | undefined;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  // Same middleware, body limits, pipes and prefix as main.ts.
  app = moduleFixture.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();

  dataSource = app.get(DataSource);
  routes = discoverRoutes(app);

  const schools = await dataSource
    .getRepository(School)
    .find({ select: ['id', 'name', 'code', 'province', 'district', 'sector'] });
  if (!schools.length)
    throw new Error(
      'No schools seeded — run with SEED_ON_STARTUP=true on a fresh DB.',
    );
  homeSchool = schools.find((s) => s.code === 'TSS-KGL-001') ?? schools[0];
  otherSchool = schools.find((s) => s.district !== homeSchool.district);

  const jwt = app.get(JwtService, { strict: false });
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);

  for (const def of ROLE_DEFS) {
    const role = await roleRepo.findOne({ where: { name: def.name } });
    if (!role) throw new Error(`Seeded role "${def.name}" missing.`);
    const location =
      def.name === 'school_leader'
        ? {
            province: homeSchool.province,
            district: homeSchool.district,
            sector: homeSchool.sector,
            schoolId: homeSchool.id,
            schoolName: homeSchool.name,
          }
        : def.name === 'district_officer'
          ? { province: homeSchool.province, district: homeSchool.district }
          : undefined;
    const user = await userRepo.save(
      userRepo.create({
        firstName: 'E2E',
        lastName: def.name,
        email: `e2e.matrix.${def.name}.${RUN}@test.rtb.rw`,
        password: `E2e!${RUN}Aa1`,
        isActive: true,
        role,
        ...(location ? { location } : {}),
      }),
    );
    userIds[def.name] = user.id;
    tokens[def.name] = await jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: role.name,
    });
  }
}, 120_000);

afterAll(async () => {
  const ids = Object.values(userIds);
  if (ids.length && dataSource?.isInitialized) {
    await dataSource
      .getRepository(User)
      .delete(ids)
      .catch(() => undefined);
  }
  await app?.close();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Permission matrix (generated from role definitions)', () => {
  it('discovers permission-protected routes', () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it('seeded roles carry their code-defined permissions (fresh test DB)', async () => {
    const roleRepo = dataSource.getRepository(Role);
    const drift: string[] = [];
    for (const def of ROLE_DEFS) {
      const role = await roleRepo.findOne({ where: { name: def.name } });
      const stored = new Set(role?.permissions ?? []);
      const missing = def.permissions.filter((p) => !stored.has(p));
      const extra = [...stored].filter(
        (p) => !def.permissions.includes(p as Permission),
      );
      if (missing.length || extra.length)
        drift.push(
          `${def.name}: missing [${missing.join()}] extra [${extra.join()}]`,
        );
    }
    expect(drift).toEqual([]);
  });

  it('every role gets 403 exactly where its permissions say so', async () => {
    const failures: string[] = [];
    const notExecuted: string[] = [];
    const server = app.getHttpServer();

    for (const role of ROLE_DEFS) {
      for (const route of routes) {
        const allowed = expectedAllowed(role, route);
        const hasParam = route.path.includes(':');
        const label = `${role.name} ${route.verb.toUpperCase()} ${route.path} (${route.controller}.${route.handler})`;
        if (allowed && route.verb !== 'get' && !hasParam) {
          notExecuted.push(label);
          continue;
        }
        const req = request(server)
          [route.verb](concretePath(route))
          .set('Authorization', `Bearer ${tokens[role.name]}`);
        const res = route.verb === 'get' ? await req : await req.send({});
        if (res.status === 401) {
          failures.push(`${label}: 401 (token rejected)`);
        } else if (allowed && res.status === 403) {
          failures.push(
            `${label}: expected allowed, got 403 ${JSON.stringify(res.body?.message)}`,
          );
        } else if (!allowed && res.status !== 403) {
          failures.push(
            `${label}: expected 403, got ${res.status} ${JSON.stringify(res.body?.message)}`,
          );
        }
      }
    }

    if (notExecuted.length) {
      console.info(
        `[permission-matrix] ${notExecuted.length} allowed mutating calls without a path param were not executed:\n  ` +
          notExecuted.join('\n  '),
      );
    }
    expect(failures).toEqual([]);
  }, 600_000);
});

describe('Geographic scope', () => {
  const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

  it('school_leader can open their own school', async () => {
    await request(app.getHttpServer())
      .get(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('school_leader'))
      .expect(200);
  });

  it('school_leader gets 403 on another school', async () => {
    if (!otherSchool)
      return console.warn('[scope] only one district seeded — skipped');
    await request(app.getHttpServer())
      .get(`${PREFIX}/schools/${otherSchool.id}`)
      .set(auth('school_leader'))
      .expect(403);
  });

  it('school_leader sees only their school in GET /schools', async () => {
    const res = await request(app.getHttpServer())
      .get(`${PREFIX}/schools?page=1&limit=100`)
      .set(auth('school_leader'))
      .expect(200);
    const ids = (res.body.data as { id: string }[]).map((s) => s.id);
    expect(ids).toEqual([homeSchool.id]);
  });

  it('district_officer sees only schools in their district', async () => {
    const res = await request(app.getHttpServer())
      .get(`${PREFIX}/schools?page=1&limit=500`)
      .set(auth('district_officer'))
      .expect(200);
    const districts = new Set(
      (res.body.data as { district: string }[]).map((s) => s.district),
    );
    expect([...districts]).toEqual([homeSchool.district]);
  });

  it('school_leader cannot file a report or change request for another school', async () => {
    if (!otherSchool) return;
    await request(app.getHttpServer())
      .post(`${PREFIX}/schools/${otherSchool.id}/change-requests`)
      .set(auth('school_leader'))
      .send({
        fields: [{ field: 'latitude', proposedValue: -1.9 }],
        reason: 'e2e scope check',
      })
      .expect(403);
  });

  it('school_leader cannot change locked fields (location) on their own school', async () => {
    await request(app.getHttpServer())
      .patch(`${PREFIX}/schools/${homeSchool.id}`)
      .set(auth('school_leader'))
      .send({ latitude: 0.123456 })
      .expect(403);
  });

  it('WebSocket: joining another school room returns { ok: false }, own room { ok: true }', async () => {
    const gateway = app.get(EventsGateway, { strict: false });
    const authService = app.get(AuthService, { strict: false });
    const user = await authService.validateUser(userIds.school_leader);
    const client = (rooms: string[]) =>
      ({
        id: 'e2e-socket',
        data: { user },
        join: (room: string) => {
          rooms.push(room);
          return Promise.resolve();
        },
      }) as never;

    const joined: string[] = [];
    await expect(
      gateway.handleJoin(`school:${homeSchool.id}`, client(joined)),
    ).resolves.toEqual({ ok: true });
    if (otherSchool) {
      await expect(
        gateway.handleJoin(`school:${otherSchool.id}`, client(joined)),
      ).resolves.toEqual({ ok: false });
    }
    await expect(
      gateway.handleJoin(`user:${userIds.admin}`, client(joined)),
    ).resolves.toEqual({ ok: false });
    expect(joined).toEqual([`school:${homeSchool.id}`]);
  });
});
