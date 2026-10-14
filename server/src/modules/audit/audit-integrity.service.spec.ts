import { randomUUID } from 'crypto';
import { verifyRows } from './audit-integrity.service';
import { computeAuditHash } from '../../common/audit/sanitize';
import type { AuditLog } from './entities/audit-log.entity';

function chain(n: number, startPrev: string | null = null): AuditLog[] {
  const rows: AuditLog[] = [];
  let prev = startPrev;
  for (let i = 0; i < n; i += 1) {
    const row = {
      id: randomUUID(),
      createdAt: new Date(Date.UTC(2026, 9, 1, 8, 0, 0, i)),
      actorId: 'u1',
      actorEmail: 'admin@rtb.gov.rw',
      actorRole: 'super_admin',
      action: 'school.update',
      outcome: 'success',
      targetType: 'school',
      targetId: `s${i}`,
      targetLabel: `School ${i}`,
      subjectUserId: null,
      changes: { name: ['a', `b${i}`] },
      meta: { status: 200, nested: { z: 1, a: 2 } },
      ip: '41.1.1.1',
      userAgent: 'UA',
      sessionId: null,
      requestId: `req-${i}`,
      prevHash: prev,
      hash: null,
    } as AuditLog;
    row.hash = computeAuditHash(row);
    prev = row.hash;
    rows.push(row);
  }
  return rows;
}

describe('audit hash chain (WS11.6)', () => {
  it('accepts an intact chain', () => {
    expect(verifyRows(chain(10))).toBeNull();
  });

  it('accepts a chain whose first row points at an archived predecessor', () => {
    expect(verifyRows(chain(3, 'f'.repeat(64)))).toBeNull();
  });

  it('is independent of jsonb key order', () => {
    const rows = chain(2);
    rows[0].meta = { nested: { a: 2, z: 1 }, status: 200 };
    expect(verifyRows(rows)).toBeNull();
  });

  it('detects a modified row', () => {
    const rows = chain(5);
    rows[2].targetLabel = 'Tampered';
    expect(verifyRows(rows)).toEqual({
      ok: false,
      checked: 2,
      firstBrokenId: rows[2].id,
      reason: 'hash_mismatch',
    });
  });

  it('detects a modified diff value', () => {
    const rows = chain(3);
    rows[1].changes = { name: ['a', 'evil'] };
    expect(verifyRows(rows)?.firstBrokenId).toBe(rows[1].id);
  });

  it('detects a deleted row (broken link)', () => {
    const rows = chain(5);
    rows.splice(2, 1);
    expect(verifyRows(rows)).toMatchObject({
      ok: false,
      reason: 'broken_link',
      firstBrokenId: rows[2].id,
    });
  });

  it('detects a re-hashed forgery that does not re-link the successors', () => {
    const rows = chain(4);
    rows[1].actorEmail = 'someone-else@rtb.gov.rw';
    rows[1].hash = computeAuditHash(rows[1]);
    expect(verifyRows(rows)).toMatchObject({
      reason: 'broken_link',
      firstBrokenId: rows[2].id,
    });
  });
});
