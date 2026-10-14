import { BadRequestException } from '@nestjs/common';
import {
  applyAuditFilters,
  applyCursor,
  decodeCursor,
  encodeCursor,
  escapeLike,
} from './audit-query';

function fakeQb() {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const order: Array<[string, string]> = [];
  const qb: any = {
    calls,
    order,
    andWhere: (sql: string, params?: Record<string, unknown>) => {
      calls.push([sql, params]);
      return qb;
    },
    orderBy: (c: string, d: string) => {
      order.push([c, d]);
      return qb;
    },
    addOrderBy: (c: string, d: string) => {
      order.push([c, d]);
      return qb;
    },
  };
  return qb;
}

describe('audit cursor', () => {
  it('round-trips createdAt + id', () => {
    const row = {
      createdAt: new Date('2026-10-14T08:30:00.123Z'),
      id: '3f1c2b9a-1111-4222-8333-444455556666',
    };
    const decoded = decodeCursor(encodeCursor(row));
    expect(decoded.id).toBe(row.id);
    expect(decoded.createdAt.toISOString()).toBe('2026-10-14T08:30:00.123Z');
  });

  it('rejects garbage and SQL in cursors', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(BadRequestException);
    const evil = Buffer.from("2026-01-01T00:00:00Z|1' OR '1'='1").toString(
      'base64url',
    );
    expect(() => decodeCursor(evil)).toThrow(BadRequestException);
  });

  it('builds a keyset condition and a stable order', () => {
    const qb = fakeQb();
    const cursor = {
      createdAt: new Date('2026-10-14T00:00:00Z'),
      id: '3f1c2b9a-1111-4222-8333-444455556666',
    };
    applyCursor(qb, cursor);
    expect(qb.calls[0][0]).toBe(
      '(a.createdAt < :cursorTs OR (a.createdAt = :cursorTs AND a.id < :cursorId))',
    );
    expect(qb.calls[0][1]).toEqual({
      cursorTs: cursor.createdAt,
      cursorId: cursor.id,
    });
    expect(qb.order).toEqual([
      ['a.createdAt', 'DESC'],
      ['a.id', 'DESC'],
    ]);
  });

  it('adds no keyset condition on the first page', () => {
    const qb = fakeQb();
    applyCursor(qb, null);
    expect(qb.calls).toHaveLength(0);
  });
});

describe('applyAuditFilters', () => {
  it('binds every filter as a parameter', () => {
    const qb = fakeQb();
    applyAuditFilters(qb, {
      from: '2026-10-01',
      to: '2026-10-14',
      actorId: 'u1',
      actor: 'jane',
      action: 'school.',
      targetType: 'school',
      targetId: 's1',
      schoolId: 's1',
      subjectUserId: 'u2',
      outcome: 'failure,denied',
      q: '50%_off',
    });
    const params = Object.assign({}, ...qb.calls.map(([, p]) => p));
    expect(params).toMatchObject({
      actorId: 'u1',
      actor: '%jane%',
      actionPrefix: 'school.%',
      targetType: 'school',
      targetId: 's1',
      schoolId: 's1',
      subjectUserId: 'u2',
      outcomes: ['failure', 'denied'],
      q: '%50\\%\\_off%',
    });
    // A bare "to" date covers the whole day.
    expect((params.to as Date).toISOString()).toBe('2026-10-14T23:59:59.999Z');
    for (const [sql] of qb.calls) expect(sql).not.toMatch(/jane|school\.|50%/);
  });

  it('adds nothing for an empty filter', () => {
    const qb = fakeQb();
    applyAuditFilters(qb, {});
    expect(qb.calls).toHaveLength(0);
  });

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });
});
