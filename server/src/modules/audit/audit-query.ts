import { BadRequestException } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import type { AuditLog } from './entities/audit-log.entity';
import type { AuditFilterDto } from './dto/audit-query.dto';

export interface AuditCursor {
  createdAt: Date;
  id: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opaque keyset cursor: base64url("<createdAt ISO>|<id>"). */
export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(
    `${row.createdAt.toISOString()}|${row.id}`,
    'utf8',
  ).toString('base64url');
}

export function decodeCursor(cursor: string): AuditCursor {
  let raw: string;
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
  const [ts, id] = raw.split('|');
  const createdAt = new Date(ts ?? '');
  if (!id || !UUID_RE.test(id) || Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException('Invalid cursor');
  }
  return { createdAt, id };
}

/** Escapes LIKE wildcards so user input matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Applies WS11.7 filters to a query builder aliased `a`. Every value is a
 * bound parameter.
 */
export function applyAuditFilters(
  qb: SelectQueryBuilder<AuditLog>,
  f: AuditFilterDto,
): SelectQueryBuilder<AuditLog> {
  if (f.from) qb.andWhere('a.createdAt >= :from', { from: new Date(f.from) });
  if (f.to) {
    // A bare date ("2026-10-14") means the whole day.
    const to = new Date(f.to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f.to)) to.setUTCHours(23, 59, 59, 999);
    qb.andWhere('a.createdAt <= :to', { to });
  }
  if (f.actorId) qb.andWhere('a.actorId = :actorId', { actorId: f.actorId });
  if (f.actor) {
    qb.andWhere("a.actorEmail ILIKE :actor ESCAPE '\\'", {
      actor: `%${escapeLike(f.actor)}%`,
    });
  }
  if (f.action) {
    qb.andWhere("a.action LIKE :actionPrefix ESCAPE '\\'", {
      actionPrefix: `${escapeLike(f.action)}%`,
    });
  }
  if (f.targetType)
    qb.andWhere('a.targetType = :targetType', { targetType: f.targetType });
  if (f.targetId)
    qb.andWhere('a.targetId = :targetId', { targetId: f.targetId });
  if (f.schoolId) {
    qb.andWhere(
      "((a.targetType = 'school' AND a.targetId = :schoolId) OR a.meta ->> 'schoolId' = :schoolId)",
      { schoolId: f.schoolId },
    );
  }
  if (f.subjectUserId) {
    qb.andWhere('a.subjectUserId = :subjectUserId', {
      subjectUserId: f.subjectUserId,
    });
  }
  if (f.outcome) {
    qb.andWhere('a.outcome IN (:...outcomes)', {
      outcomes: f.outcome.split(','),
    });
  }
  if (f.q) {
    qb.andWhere(
      "(a.action ILIKE :q ESCAPE '\\' OR a.targetLabel ILIKE :q ESCAPE '\\' OR a.actorEmail ILIKE :q ESCAPE '\\' OR a.targetId ILIKE :q ESCAPE '\\')",
      { q: `%${escapeLike(f.q)}%` },
    );
  }
  return qb;
}

/** Newest first; (createdAt, id) is unique and matches the keyset cursor. */
export function applyCursor(
  qb: SelectQueryBuilder<AuditLog>,
  cursor: AuditCursor | null,
): SelectQueryBuilder<AuditLog> {
  if (cursor) {
    qb.andWhere(
      '(a.createdAt < :cursorTs OR (a.createdAt = :cursorTs AND a.id < :cursorId))',
      { cursorTs: cursor.createdAt, cursorId: cursor.id },
    );
  }
  return qb.orderBy('a.createdAt', 'DESC').addOrderBy('a.id', 'DESC');
}
