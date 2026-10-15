import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { computeAuditHash } from '../../common/audit/sanitize';

export interface ChainVerification {
  ok: boolean;
  checked: number;
  firstBrokenId: string | null;
  reason?: 'hash_mismatch' | 'broken_link';
}

/**
 * Walks the chain oldest → newest and checks every row's hash and its link
 * to the previous row. Pure, so it can be unit-tested with plain objects.
 * The first row may point at an archived predecessor (WS11.9).
 */
export function verifyRows(
  rows: Iterable<AuditLog>,
  state: { prevHash: string | null; checked: number; started: boolean } = {
    prevHash: null,
    checked: 0,
    started: false,
  },
): ChainVerification | null {
  for (const row of rows) {
    if (state.started && row.prevHash !== state.prevHash) {
      return {
        ok: false,
        checked: state.checked,
        firstBrokenId: row.id,
        reason: 'broken_link',
      };
    }
    if (computeAuditHash(row) !== row.hash) {
      return {
        ok: false,
        checked: state.checked,
        firstBrokenId: row.id,
        reason: 'hash_mismatch',
      };
    }
    state.started = true;
    state.prevHash = row.hash;
    state.checked += 1;
  }
  return null;
}

@Injectable()
export class AuditIntegrityService {
  private readonly logger = new Logger(AuditIntegrityService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    private readonly audit: AuditService,
  ) {}

  /** Verifies the whole chain (rows written before WS11 have no hash). */
  async verifyChain(batchSize = 2000): Promise<ChainVerification> {
    const state = {
      prevHash: null as string | null,
      checked: 0,
      started: false,
    };
    let cursor: { createdAt: Date; id: string } | null = null;
    for (;;) {
      const qb = this.repo
        .createQueryBuilder('a')
        .where('a.hash IS NOT NULL')
        .orderBy('a.createdAt', 'ASC')
        .addOrderBy('a.id', 'ASC')
        .take(batchSize);
      if (cursor) {
        qb.andWhere(
          '(a.createdAt > :ts OR (a.createdAt = :ts AND a.id > :id))',
          { ts: cursor.createdAt, id: cursor.id },
        );
      }
      const rows = await qb.getMany();
      const broken = verifyRows(rows, state);
      if (broken) return broken;
      if (rows.length < batchSize) break;
      const last = rows[rows.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }
    return { ok: true, checked: state.checked, firstBrokenId: null };
  }

  /** Nightly integrity check (02:30 server time). */
  @Cron('30 2 * * *', { name: 'audit-integrity-check' })
  async nightlyCheck(): Promise<void> {
    try {
      const result = await this.verifyChain();
      if (result.ok) {
        this.logger.log(`Audit chain intact (${result.checked} rows)`);
        return;
      }
      this.logger.error(
        `AUDIT CHAIN BROKEN at row ${result.firstBrokenId} (${result.reason}) after ${result.checked} valid rows`,
      );
      // Raises a security alert email via AuditAlertService.
      this.audit.record({
        action: 'audit.integrity_failed',
        outcome: 'failure',
        targetType: 'audit_log',
        targetId: result.firstBrokenId,
        meta: { reason: result.reason, checked: result.checked },
      });
    } catch (err) {
      this.logger.error(
        `Audit integrity check failed to run: ${(err as Error).message}`,
      );
    }
  }
}
