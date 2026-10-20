import {
  buildRequestAuditEntry,
  mergeCapturedChanges,
  outcomeFromStatus,
} from './request-entry';
import {
  createAuditContext,
  type AuditRequestContext,
} from './request-context';
import { isSkippedHandler } from './action-registry';

const ADMIN = {
  id: 'u-1',
  email: 'admin@rtb.gov.rw',
  role: { name: 'super_admin', permissions: [] },
};

function ctxFor(opts: {
  method?: string;
  key: string;
  routePath: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  user?: unknown;
  body?: unknown;
  headers?: Record<string, string>;
}): AuditRequestContext {
  const req = {
    method: opts.method ?? 'POST',
    params: opts.params ?? {},
    query: opts.query ?? {},
    user: opts.user,
    headers: {
      'user-agent': 'jest-agent',
      'x-forwarded-for': '41.186.1.2, 10.0.0.1',
      ...(opts.headers ?? {}),
    },
    ip: '10.0.0.1',
  };
  const ctx = createAuditContext(req);
  ctx.handler = { key: opts.key, routePath: opts.routePath };
  ctx.responseBody = opts.body;
  return ctx;
}

describe('outcomeFromStatus', () => {
  it.each([
    [200, 'success'],
    [201, 'success'],
    [204, 'success'],
    [400, 'failure'],
    [404, 'failure'],
    [500, 'failure'],
    [401, 'denied'],
    [403, 'denied'],
    [429, 'denied'],
  ])('%i → %s', (status, outcome) => {
    expect(outcomeFromStatus(status)).toBe(outcome);
  });
});

describe('buildRequestAuditEntry', () => {
  it('records a successful school update from the registry with actor, target, IP, request id', () => {
    const ctx = ctxFor({
      method: 'PATCH',
      key: 'SchoolsController.update',
      routePath: '/schools/:id',
      params: { id: 'school-1' },
      user: ADMIN,
      body: { id: 'school-1', name: 'IPRC Kigali' },
    });
    ctx.changes.push({
      entity: 'School',
      id: 'school-1',
      fields: { name: ['Old', 'IPRC Kigali'] },
    });

    const e = buildRequestAuditEntry(ctx, 200)!;
    expect(e).toMatchObject({
      action: 'school.update',
      outcome: 'success',
      actor: { id: 'u-1', email: 'admin@rtb.gov.rw', role: 'super_admin' },
      targetType: 'school',
      targetId: 'school-1',
      targetLabel: 'IPRC Kigali',
      changes: { name: ['Old', 'IPRC Kigali'] },
      request: {
        ip: '41.186.1.2',
        userAgent: 'jest-agent',
        requestId: ctx.requestId,
      },
    });
    expect(e.meta).toMatchObject({
      status: 200,
      route: '/schools/:id',
      schoolId: 'school-1',
    });
  });

  it('takes the created id and label from the response for creates', () => {
    const ctx = ctxFor({
      key: 'UsersController.create',
      routePath: '/users',
      user: ADMIN,
      body: { id: 'new-user', email: 'jane@rtb.gov.rw', password: 'x' },
    });
    const e = buildRequestAuditEntry(ctx, 201)!;
    expect(e).toMatchObject({
      action: 'user.create',
      targetId: 'new-user',
      targetLabel: 'jane@rtb.gov.rw',
      subjectUserId: 'new-user',
    });
    expect(JSON.stringify(e)).not.toContain('"password"');
  });

  it('records a failure with the error message and no label', () => {
    const ctx = ctxFor({
      method: 'DELETE',
      key: 'SchoolsController.remove',
      routePath: '/schools/:id',
      params: { id: 's-9' },
      user: ADMIN,
    });
    ctx.error = { status: 500, message: 'boom' };
    const e = buildRequestAuditEntry(ctx, 500)!;
    expect(e.outcome).toBe('failure');
    expect(e.meta?.error).toBe('boom');
    expect(e.targetId).toBe('s-9');
  });

  it('records a guard rejection as denied (no user on 401)', () => {
    const ctx = ctxFor({
      method: 'DELETE',
      key: 'UsersController.deactivate',
      routePath: '/users/:id',
      params: { id: 'victim' },
    });
    const e = buildRequestAuditEntry(ctx, 401)!;
    expect(e).toMatchObject({
      action: 'user.deactivate',
      outcome: 'denied',
      actor: null,
      subjectUserId: 'victim',
    });
  });

  it('falls back to METHOD routePath for unregistered handlers', () => {
    const ctx = ctxFor({
      method: 'PUT',
      key: 'FooController.bar',
      routePath: '/widgets/:id',
      params: { id: 'w1' },
      user: ADMIN,
    });
    const e = buildRequestAuditEntry(ctx, 200)!;
    expect(e.action).toBe('PUT /widgets/:id');
    expect(e.targetType).toBe('widget');
    expect(e.targetId).toBe('w1');
  });

  it('prefers the @Audit decorator over the registry', () => {
    const ctx = ctxFor({
      key: 'SchoolsController.update',
      routePath: '/schools/:id',
      user: ADMIN,
    });
    ctx.handler!.decorated = { action: 'school.custom', target: 'thing' };
    expect(buildRequestAuditEntry(ctx, 200)!.action).toBe('school.custom');
  });

  it('skips auth routes that the auth module audits explicitly', () => {
    for (const key of [
      'AuthController.login',
      'AuthController.refresh',
      'AuthController.logout',
      'AuthController.googleLogin',
      'AuthController.verifyTwoFactor',
      'AuthController.resetPassword',
    ]) {
      expect(isSkippedHandler(key)).toBe(true);
      expect(
        buildRequestAuditEntry(ctxFor({ key, routePath: '/auth/x' }), 200),
      ).toBeNull();
    }
    expect(isSkippedHandler('UsersController.update')).toBe(false);
  });

  it('skips @SkipAudit handlers and unmatched routes', () => {
    const ctx = ctxFor({
      key: 'SchoolsController.update',
      routePath: '/schools/:id',
    });
    ctx.handler!.skipped = true;
    expect(buildRequestAuditEntry(ctx, 200)).toBeNull();
    const noHandler = ctxFor({ key: 'x.y', routePath: '/' });
    noHandler.handler = undefined;
    expect(buildRequestAuditEntry(noHandler, 404)).toBeNull();
  });

  it('ignores ordinary GETs but audits exports and sensitive reads', () => {
    expect(
      buildRequestAuditEntry(
        ctxFor({
          method: 'GET',
          key: 'SchoolsController.findAll',
          routePath: '/schools',
          user: ADMIN,
        }),
        200,
      ),
    ).toBeNull();

    const exp = buildRequestAuditEntry(
      ctxFor({
        method: 'GET',
        key: 'SchoolsController.exportExcel',
        routePath: '/schools/export',
        user: ADMIN,
        query: { province: 'Kigali', token: 'abc' },
      }),
      200,
    )!;
    expect(exp.action).toBe('school.export');
    expect(exp.meta?.query).toEqual({
      province: 'Kigali',
      token: '[REDACTED]',
    });

    // Unregistered export route: matched by path.
    expect(
      buildRequestAuditEntry(
        ctxFor({
          method: 'GET',
          key: 'X.y',
          routePath: '/reports/export.xlsx',
          user: ADMIN,
        }),
        200,
      )!.action,
    ).toBe('report.export');

    expect(
      buildRequestAuditEntry(
        ctxFor({
          method: 'GET',
          key: 'UsersController.findAll',
          routePath: '/users',
          user: ADMIN,
        }),
        200,
      )!.action,
    ).toBe('user.list_view');
  });

  it('audits only the first page of the audit log view', () => {
    const first = ctxFor({
      method: 'GET',
      key: 'AuditController.findAll',
      routePath: '/audit-logs',
      user: ADMIN,
    });
    expect(buildRequestAuditEntry(first, 200)!.action).toBe('audit.view');
    const next = ctxFor({
      method: 'GET',
      key: 'AuditController.findAll',
      routePath: '/audit-logs',
      user: ADMIN,
      query: { cursor: 'abc' },
    });
    expect(buildRequestAuditEntry(next, 200)).toBeNull();
  });

  it('masks sensitive route params', () => {
    const ctx = ctxFor({
      key: 'X.reset',
      routePath: '/things/:token',
      params: { token: 'secret-value' },
      user: ADMIN,
    });
    const e = buildRequestAuditEntry(ctx, 200)!;
    expect(e.meta?.params).toEqual({ token: '[REDACTED]' });
  });

  it('defers to an explicit service record on success, but not on failure', () => {
    const ctx = ctxFor({
      method: 'PATCH',
      key: 'RolesController.update',
      routePath: '/roles/:id',
      user: ADMIN,
    });
    ctx.explicitRecords = 1;
    expect(buildRequestAuditEntry(ctx, 200)).toBeNull();
    expect(buildRequestAuditEntry(ctx, 400)!.outcome).toBe('failure');
  });

  it('uses the actor as subject for self-service routes', () => {
    const e = buildRequestAuditEntry(
      ctxFor({
        method: 'PATCH',
        key: 'UsersController.changePassword',
        routePath: '/users/me/password',
        user: ADMIN,
      }),
      200,
    )!;
    expect(e.subjectUserId).toBe('u-1');
    expect(e.action).toBe('user.password_change');
  });
});

describe('mergeCapturedChanges', () => {
  it('keeps plain keys for one row and prefixes for several', () => {
    expect(mergeCapturedChanges([])).toBeNull();
    expect(
      mergeCapturedChanges([
        { entity: 'School', id: '1', fields: { name: ['a', 'b'] } },
      ]),
    ).toEqual({ name: ['a', 'b'] });
    expect(
      mergeCapturedChanges([
        { entity: 'School', id: '1', fields: { name: ['a', 'b'] } },
        { entity: 'SchoolBuilding', id: '2', fields: { floors: [1, 2] } },
      ]),
    ).toEqual({ 'School.name': ['a', 'b'], 'SchoolBuilding.floors': [1, 2] });
  });
});
