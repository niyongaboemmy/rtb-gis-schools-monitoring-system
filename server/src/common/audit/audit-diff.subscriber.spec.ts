import {
  AuditDiffSubscriber,
  computeEntityDiff,
  type DiffColumn,
} from './audit-diff.subscriber';
import { auditStorage, createAuditContext } from './request-context';

const col = (
  propertyName: string,
  extra: Partial<DiffColumn> = {},
): DiffColumn => ({
  propertyName,
  getEntityValue: (e: any) => {
    const v = e?.[propertyName];
    if (extra.relationMetadata && v && typeof v === 'object') return v.id;
    return v;
  },
  ...extra,
});

describe('computeEntityDiff', () => {
  const columns = [
    col('name'),
    col('enrollment'),
    col('password'),
    col('refreshToken'),
    col('totpSecret'),
    col('passwordResetToken'),
    col('updatedAt', { isUpdateDate: true }),
    col('role', { relationMetadata: {} }),
    col('location'),
  ];

  it('returns only changed fields as [before, after]', () => {
    const diff = computeEntityDiff(
      columns,
      { name: 'A', enrollment: 10, location: { district: 'Gasabo' } },
      { name: 'B', enrollment: 10, location: { district: 'Gasabo' } },
    );
    expect(diff).toEqual({ name: ['A', 'B'] });
  });

  it('ignores fields not part of the save and timestamp columns', () => {
    expect(
      computeEntityDiff(
        columns,
        { name: 'A', updatedAt: new Date(1) },
        { updatedAt: new Date(2) },
      ),
    ).toEqual({});
  });

  it('masks sensitive fields while still reporting the change', () => {
    const diff = computeEntityDiff(
      columns,
      {
        password: 'old-hash',
        refreshToken: 'r1',
        totpSecret: 's1',
        passwordResetToken: 'p1',
      },
      {
        password: 'new-hash',
        refreshToken: 'r2',
        totpSecret: 's2',
        passwordResetToken: null,
      },
    );
    expect(diff).toEqual({
      password: ['[REDACTED]', '[REDACTED]'],
      refreshToken: ['[REDACTED]', '[REDACTED]'],
      totpSecret: ['[REDACTED]', '[REDACTED]'],
      passwordResetToken: ['[REDACTED]', '[REDACTED]'],
    });
    expect(JSON.stringify(diff)).not.toMatch(/old-hash|new-hash|r1|r2|s1|s2/);
  });

  it('reports relation changes by id under <relation>Id', () => {
    expect(
      computeEntityDiff(
        columns,
        { role: { id: 'viewer' } },
        { role: { id: 'admin', name: 'Admin' } },
      ),
    ).toEqual({ roleId: ['viewer', 'admin'] });
  });

  it('summarises oversized values (geometry blobs)', () => {
    const big = {
      type: 'Polygon',
      coordinates: Array.from({ length: 2000 }, (_, i) => [i, i]),
    };
    const diff = computeEntityDiff(
      [col('boundary')],
      { boundary: null },
      { boundary: big },
    );
    expect(diff.boundary[0]).toBeNull();
    expect(String(diff.boundary[1])).toMatch(/^\[omitted: \d+ chars/);
  });
});

describe('AuditDiffSubscriber', () => {
  const ds = { subscribers: [] as unknown[] };
  const sub = new AuditDiffSubscriber(ds as any);

  const event = (name: string) => ({
    metadata: { name, columns: [col('name'), col('password')] },
    entity: { id: 'x1', name: 'New', password: 'p2' },
    databaseEntity: { id: 'x1', name: 'Old', password: 'p1' },
  });

  it('registers itself with the data source', () => {
    expect(ds.subscribers).toContain(sub);
  });

  it('stashes diffs for key entities into the request context', () => {
    const ctx = createAuditContext({ method: 'PATCH', headers: {} });
    auditStorage.run(ctx, () => sub.beforeUpdate(event('User') as any));
    expect(ctx.changes).toEqual([
      {
        entity: 'User',
        id: 'x1',
        fields: {
          name: ['Old', 'New'],
          password: ['[REDACTED]', '[REDACTED]'],
        },
      },
    ]);
  });

  it('ignores other entities and calls outside a request', () => {
    const ctx = createAuditContext({ method: 'PATCH', headers: {} });
    auditStorage.run(ctx, () => sub.beforeUpdate(event('Facility') as any));
    expect(ctx.changes).toHaveLength(0);
    expect(() => sub.beforeUpdate(event('School') as any)).not.toThrow();
  });
});
