import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AuditService,
  AuditActor,
  AUDIT_CHAIN_LOCK_KEY,
} from './audit.service';
import { AuditAlertService } from './audit-alert.service';
import { AuditLog } from './entities/audit-log.entity';
import { computeAuditHash } from '../../common/audit/sanitize';
import {
  auditStorage,
  createAuditContext,
} from '../../common/audit/request-context';
import { verifyRows } from './audit-integrity.service';

const ACTOR: AuditActor = { id: 'user-1', email: 'admin@rtb.gov.rw' };

/** In-memory stand-in for the audit_logs table behind manager.transaction. */
function makeRepo() {
  const rows: AuditLog[] = [];
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      const last = rows[rows.length - 1];
      return last ? [{ hash: last.hash, created_at: last.createdAt }] : [];
    }),
    insert: jest.fn(async (_e: unknown, row: AuditLog) => {
      rows.push({ ...row });
    }),
  };
  const qb: any = {
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getMany: jest.fn(async () => [] as AuditLog[]),
    getCount: jest.fn(async () => 0),
  };
  const repo = {
    rows,
    qb,
    manager: {
      ...manager,
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) =>
        cb(manager),
      ),
    },
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    createQueryBuilder: jest.fn(() => qb),
  };
  return repo;
}

async function setup() {
  const repo = makeRepo();
  const alerts = { evaluate: jest.fn() };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuditService,
      { provide: getRepositoryToken(AuditLog), useValue: repo },
      { provide: AuditAlertService, useValue: alerts },
    ],
  }).compile();
  return { service: module.get<AuditService>(AuditService), repo, alerts };
}

describe('AuditService.log (legacy API)', () => {
  it('writes a row with actor, action, target and meta', async () => {
    const { service, repo } = await setup();
    service.log(ACTOR, 'school.delete', 'school', 'school-1', { name: 'Test' });
    await service.whenIdle();

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({
      actorId: 'user-1',
      actorEmail: 'admin@rtb.gov.rw',
      action: 'school.delete',
      outcome: 'success',
      targetType: 'school',
      targetId: 'school-1',
      meta: { name: 'Test' },
    });
  });

  it('accepts a null actor (system operation)', async () => {
    const { service, repo } = await setup();
    service.log(null, 'analytics.recalculate', 'system', undefined, {
      processed: 5,
    });
    await service.whenIdle();
    expect(repo.rows[0]).toMatchObject({
      actorId: null,
      actorEmail: null,
      targetId: null,
    });
  });

  it('never throws when the write fails', async () => {
    const { service, repo } = await setup();
    repo.manager.transaction.mockRejectedValueOnce(
      new Error('DB connection lost'),
    );
    expect(() =>
      service.log(ACTOR, 'role.update', 'role', 'role-1'),
    ).not.toThrow();
    await expect(service.whenIdle()).resolves.toBeUndefined();
    // The queue keeps working afterwards.
    service.log(ACTOR, 'role.update', 'role', 'role-2');
    await service.whenIdle();
    expect(repo.rows).toHaveLength(1);
  });
});

describe('AuditService.record', () => {
  it('persists the structured columns and masks secrets', async () => {
    const { service, repo, alerts } = await setup();
    service.record({
      action: 'user.update',
      actor: { id: 'a1', email: 'a@rtb.gov.rw', role: 'admin' },
      targetType: 'user',
      targetId: 'u9',
      targetLabel: 'jane@rtb.gov.rw',
      subjectUserId: 'u9',
      changes: { firstName: ['Jane', 'Janet'], password: ['h1', 'h2'] },
      meta: { reason: 'typo', otp: '123456', nested: { refreshToken: 'abc' } },
      request: {
        ip: '41.1.1.1',
        userAgent: 'UA',
        requestId: 'req-1',
        sessionId: 'sess-1',
      },
    });
    await service.whenIdle();
    const row = repo.rows[0];
    expect(row).toMatchObject({
      actorRole: 'admin',
      targetLabel: 'jane@rtb.gov.rw',
      subjectUserId: 'u9',
      changes: {
        firstName: ['Jane', 'Janet'],
        password: ['[REDACTED]', '[REDACTED]'],
      },
      meta: {
        reason: 'typo',
        otp: '[REDACTED]',
        nested: { refreshToken: '[REDACTED]' },
      },
      ip: '41.1.1.1',
      userAgent: 'UA',
      requestId: 'req-1',
      sessionId: 'sess-1',
    });
    expect(alerts.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.update' }),
    );
  });

  it('fills request details and actor from the current request context', async () => {
    const { service, repo } = await setup();
    const ctx = createAuditContext({
      method: 'POST',
      headers: { 'user-agent': 'Firefox', 'x-forwarded-for': '197.243.0.1' },
      user: {
        id: 'u5',
        email: 'gis@rtb.gov.rw',
        role: { name: 'gis_analyst' },
      },
    });
    ctx.changes.push({
      entity: 'Role',
      id: 'r1',
      fields: { permissions: [['A'], ['A', 'B']] },
    });
    auditStorage.run(ctx, () =>
      service.record({
        action: 'role.update',
        targetType: 'role',
        targetId: 'r1',
      }),
    );
    await service.whenIdle();
    expect(repo.rows[0]).toMatchObject({
      actorId: 'u5',
      actorEmail: 'gis@rtb.gov.rw',
      actorRole: 'gis_analyst',
      ip: '197.243.0.1',
      userAgent: 'Firefox',
      requestId: ctx.requestId,
      changes: { permissions: [['A'], ['A', 'B']] },
    });
    // Suppresses the automatic interceptor row for this request.
    expect(ctx.explicitRecords).toBe(1);
  });

  it('builds a linear hash chain under the advisory lock', async () => {
    const { service, repo } = await setup();
    for (let i = 0; i < 5; i += 1) {
      service.record({
        action: `school.update`,
        targetType: 'school',
        targetId: `s${i}`,
      });
    }
    await service.whenIdle();

    expect(repo.manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [AUDIT_CHAIN_LOCK_KEY],
    );
    expect(repo.rows).toHaveLength(5);
    expect(repo.rows[0].prevHash).toBeNull();
    for (let i = 1; i < 5; i += 1) {
      expect(repo.rows[i].prevHash).toBe(repo.rows[i - 1].hash);
      expect(repo.rows[i].createdAt.getTime()).toBeGreaterThan(
        repo.rows[i - 1].createdAt.getTime(),
      );
    }
    for (const r of repo.rows) expect(r.hash).toBe(computeAuditHash(r));
    expect(verifyRows(repo.rows)).toBeNull();
  });
});

describe('AuditService.search', () => {
  it('fetches limit+1 rows and returns a cursor when more exist', async () => {
    const { service, repo } = await setup();
    const mk = (i: number) =>
      ({
        id: `00000000-0000-4000-8000-00000000000${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      }) as AuditLog;
    repo.qb.getMany.mockResolvedValueOnce([mk(3), mk(2), mk(1)]);
    repo.qb.getCount.mockResolvedValueOnce(42);

    const page = await service.search({ limit: 2, action: 'school' });
    expect(repo.qb.take).toHaveBeenCalledWith(3);
    expect(page.data).toHaveLength(2);
    expect(page.total).toBe(42);
    expect(page.nextCursor).toBe(
      Buffer.from(`${mk(2).createdAt.toISOString()}|${mk(2).id}`).toString(
        'base64url',
      ),
    );
  });

  it('omits total and nextCursor on the last cursor page', async () => {
    const { service, repo } = await setup();
    repo.qb.getMany.mockResolvedValueOnce([]);
    const cursor = Buffer.from(
      `2026-01-01T00:00:00.000Z|00000000-0000-4000-8000-000000000001`,
    ).toString('base64url');
    const page = await service.search({ cursor });
    expect(page).toEqual({ data: [], nextCursor: null });
    expect(repo.qb.getCount).not.toHaveBeenCalled();
  });

  it('keeps legacy offset paging', async () => {
    const { service, repo } = await setup();
    await service.search({ limit: 10, offset: 20 });
    expect(repo.qb.skip).toHaveBeenCalledWith(20);
  });
});
