import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuditLog } from './entities/audit-log.entity';
import {
  getAuditContext,
  resolveSessionId,
  type AuditRequestContext,
} from '../../common/audit/request-context';
import { mergeCapturedChanges } from '../../common/audit/request-entry';
import {
  clip,
  computeAuditHash,
  maskSensitive,
  REDACTED,
  SENSITIVE_DIFF_FIELD_RE,
  toJsonSafe,
} from '../../common/audit/sanitize';
import {
  applyAuditFilters,
  applyCursor,
  decodeCursor,
  encodeCursor,
} from './audit-query';
import type { AuditFilterDto, AuditQueryDto } from './dto/audit-query.dto';
import { AuditAlertService } from './audit-alert.service';

export interface AuditActor {
  id: string;
  email: string;
}

export type AuditOutcome = 'success' | 'failure' | 'denied';

/**
 * One audit record, answering the meeting's four questions (WS11):
 *  Action = `action` (+ outcome, changes), By who = `actor` (+ request),
 *  When = the row's created_at, To who/what = target* and `subjectUserId`.
 */
export interface AuditEntry {
  /** Dotted verb, e.g. `school.update`, `auth.login_failed`. */
  action: string;
  actor?: {
    id?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  outcome?: AuditOutcome;
  targetType: string;
  targetId?: string | null;
  /** Human label for the target, e.g. the school name. */
  targetLabel?: string | null;
  /** The person affected, e.g. the user whose role changed. */
  subjectUserId?: string | null;
  /** Field-level diff: field → [before, after]. Sensitive fields masked. */
  changes?: Record<string, [unknown, unknown]> | null;
  meta?: Record<string, unknown> | null;
  /** Filled from the current request when omitted. */
  request?: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
    sessionId?: string;
  };
}

/** Row fields before id / createdAt / chain hashes are assigned. */
export type PendingAuditRow = Omit<
  AuditLog,
  'id' | 'createdAt' | 'prevHash' | 'hash'
>;

/** Postgres advisory-lock key serialising chain appends across processes. */
export const AUDIT_CHAIN_LOCK_KEY = 7_302_011;

export interface AuditPage {
  data: AuditLog[];
  nextCursor: string | null;
  total?: number;
}

function maskChanges(
  changes: Record<string, [unknown, unknown]> | null | undefined,
): Record<string, [unknown, unknown]> | null {
  if (!changes) return null;
  const out: Record<string, [unknown, unknown]> = {};
  for (const [field, pair] of Object.entries(changes)) {
    const [before, after] = Array.isArray(pair) ? pair : [null, pair];
    out[field] = SENSITIVE_DIFF_FIELD_RE.test(field.split('.').pop() ?? field)
      ? [REDACTED, REDACTED]
      : [toJsonSafe(before), toJsonSafe(after)];
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  /** In-process queue: appends are written one at a time, in call order. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @Optional() private readonly alerts?: AuditAlertService,
  ) {}

  /**
   * Legacy fire-and-forget API (kept for existing callers). Never throws.
   */
  log(
    actor: AuditActor | null,
    action: string,
    targetType: string,
    targetId?: string,
    meta?: Record<string, unknown>,
  ): void {
    this.record({
      action,
      actor: actor ? { id: actor.id, email: actor.email } : null,
      targetType,
      targetId: targetId ?? null,
      meta: meta ?? null,
    });
  }

  /**
   * Structured, fire-and-forget audit entry. Never throws — a logging failure
   * must not block the primary operation. Request details (IP, user agent,
   * request/session id, actor when omitted, captured field diffs) are taken
   * from the current request context when present.
   *
   * Called during an HTTP request, it also replaces that request's automatic
   * interceptor row (one row per request), unless the request fails.
   */
  record(entry: AuditEntry): void {
    const ctx = getAuditContext();
    if (ctx && !ctx.finalized) ctx.explicitRecords += 1;
    this.enqueue(entry, ctx);
  }

  /** Used by the request finish hook for the automatic row. */
  recordForRequest(entry: AuditEntry, ctx: AuditRequestContext): void {
    this.enqueue(entry, ctx);
  }

  /** Resolves once every queued entry has been written (tests, shutdown). */
  whenIdle(): Promise<void> {
    return this.queue;
  }

  private enqueue(
    entry: AuditEntry,
    ctx: AuditRequestContext | undefined,
  ): void {
    let row: PendingAuditRow;
    try {
      row = this.buildRow(entry, ctx);
    } catch (err) {
      this.logger.error(`Failed to build audit row: ${(err as Error).message}`);
      return;
    }
    this.queue = this.queue
      .then(async () => {
        // Diffs captured after an explicit record() in the same request
        // (e.g. save then log) are still attached.
        if (row.changes === null && ctx?.changes.length) {
          row.changes = maskChanges(mergeCapturedChanges(ctx.changes));
        }
        const saved = await this.append(row);
        this.alerts?.evaluate(saved);
      })
      .catch((err: Error) =>
        this.logger.error(
          `Failed to write audit log (${row.action}): ${err.message}`,
        ),
      );
  }

  private buildRow(
    entry: AuditEntry,
    ctx: AuditRequestContext | undefined,
  ): PendingAuditRow {
    const user = ctx?.req?.user;
    const actor =
      entry.actor && (entry.actor.id || entry.actor.email)
        ? entry.actor
        : user
          ? { id: user.id, email: user.email, role: user.role?.name }
          : null;
    // Role from the request user when the caller names the same actor.
    const actorRole =
      actor?.role ??
      (user && actor?.id && user.id === actor.id ? user.role?.name : null) ??
      null;
    const meta = entry.meta
      ? (toJsonSafe(maskSensitive(entry.meta)) as Record<string, unknown>)
      : null;

    return {
      actorId: (actor?.id ?? null) as string,
      actorEmail: (actor?.email ?? null) as string,
      actorRole: clip(actorRole, 100),
      action: clip(entry.action, 255) ?? 'unknown',
      outcome: entry.outcome ?? 'success',
      targetType: clip(entry.targetType, 255) ?? 'system',
      targetId: (clip(entry.targetId, 255) ?? null) as string,
      targetLabel: clip(entry.targetLabel, 255),
      subjectUserId: clip(entry.subjectUserId, 64),
      changes: entry.changes === undefined ? null : maskChanges(entry.changes),
      meta: meta && typeof meta === 'object' ? meta : null,
      ip: clip(entry.request?.ip ?? ctx?.ip, 64),
      userAgent: clip(entry.request?.userAgent ?? ctx?.userAgent, 512),
      requestId: clip(entry.request?.requestId ?? ctx?.requestId, 64),
      sessionId: clip(
        entry.request?.sessionId ?? (ctx ? resolveSessionId(ctx.req) : null),
        128,
      ),
    };
  }

  /**
   * Appends one row to the hash chain (WS11.6). The transaction-scoped
   * advisory lock makes the chain linear even across several API processes;
   * the in-process queue keeps this instance from contending with itself.
   */
  private async append(row: PendingAuditRow): Promise<AuditLog> {
    return this.auditLogRepository.manager.transaction(
      async (m: EntityManager) => {
        await m.query('SELECT pg_advisory_xact_lock($1)', [
          AUDIT_CHAIN_LOCK_KEY,
        ]);
        const last: Array<{ hash: string; created_at: Date }> = await m.query(
          'SELECT "hash", "created_at" FROM "audit_logs" WHERE "hash" IS NOT NULL ORDER BY "created_at" DESC, "id" DESC LIMIT 1',
        );
        const prev = last[0];
        let createdAt = new Date();
        const prevTs = prev ? new Date(prev.created_at).getTime() : 0;
        if (createdAt.getTime() <= prevTs) createdAt = new Date(prevTs + 1);

        const full = {
          ...row,
          id: randomUUID(),
          createdAt,
          prevHash: prev?.hash ?? null,
        } as AuditLog;
        full.hash = computeAuditHash(full);
        await m.insert(AuditLog, full as QueryDeepPartialEntity<AuditLog>);
        return full;
      },
    );
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** Legacy offset listing (kept for backward compatibility). */
  findAll(limit = 200, offset = 0): Promise<[AuditLog[], number]> {
    return this.auditLogRepository.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Filtered listing (WS11.7). Keyset (cursor) pagination by default; `offset`
   * still works for older clients. `total` is computed on the first page only.
   */
  async search(query: AuditQueryDto): Promise<AuditPage> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const qb = applyCursor(
      applyAuditFilters(this.auditLogRepository.createQueryBuilder('a'), query),
      cursor,
    );
    if (!cursor && query.offset) qb.skip(query.offset);
    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const page: AuditPage = {
      data,
      nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null,
    };
    if (!cursor) {
      page.total = await applyAuditFilters(
        this.auditLogRepository.createQueryBuilder('a'),
        query,
      ).getCount();
    }
    return page;
  }

  /** Streams matching rows in batches (newest first), up to `max`. */
  async *iterate(
    filters: AuditFilterDto,
    max: number,
    batchSize = 1000,
  ): AsyncGenerator<AuditLog> {
    let cursor: { createdAt: Date; id: string } | null = null;
    let emitted = 0;
    while (emitted < max) {
      const qb = applyCursor(
        applyAuditFilters(
          this.auditLogRepository.createQueryBuilder('a'),
          filters,
        ),
        cursor,
      ).take(Math.min(batchSize, max - emitted));
      const rows = await qb.getMany();
      if (rows.length === 0) return;
      for (const r of rows) {
        yield r;
        emitted += 1;
      }
      const lastRow = rows[rows.length - 1];
      cursor = { createdAt: lastRow.createdAt, id: lastRow.id };
      if (rows.length < batchSize) return;
    }
  }

  /** Distinct action codes, for the filter dropdown. */
  async distinctActions(): Promise<string[]> {
    const rows: Array<{ action: string }> = await this.auditLogRepository
      .createQueryBuilder('a')
      .select('DISTINCT a.action', 'action')
      .orderBy('action', 'ASC')
      .limit(500)
      .getRawMany();
    return rows.map((r) => r.action);
  }
}
