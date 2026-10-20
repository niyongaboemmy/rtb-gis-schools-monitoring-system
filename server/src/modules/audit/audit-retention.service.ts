import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { createWriteStream, mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';
import { once } from 'events';
import { createGzip } from 'zlib';
import { DataSource } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AUDIT_CHAIN_LOCK_KEY, AuditService } from './audit.service';

export const DEFAULT_AUDIT_RETENTION_DAYS = 730;

export interface ArchiveResult {
  archived: number;
  file: string | null;
  cutoff: string;
  lastHash: string | null;
}

/**
 * Retention (WS11.9): rows older than AUDIT_RETENTION_DAYS (default 730) are
 * written to a gzipped JSONL file — every column, chain hashes included, so
 * the archive itself can be verified — and then deleted. The delete runs in
 * the same transaction with `SET LOCAL rtb.audit_archive = 'on'`, the only
 * condition under which the append-only trigger allows a DELETE.
 *
 * Disabled unless AUDIT_ARCHIVE_ENABLED=true. Files go to AUDIT_ARCHIVE_DIR
 * (default `<cwd>/uploads/audit-archive`) — copy them to durable, in-country
 * storage as part of the backup policy (WS8.8).
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  retentionDays(): number {
    const n = Number(this.config.get<string>('AUDIT_RETENTION_DAYS'));
    return Number.isFinite(n) && n >= 30
      ? Math.floor(n)
      : DEFAULT_AUDIT_RETENTION_DAYS;
  }

  archiveDir(): string {
    const cfg = this.config.get<string>('AUDIT_ARCHIVE_DIR')?.trim();
    if (!cfg) return join(process.cwd(), 'uploads', 'audit-archive');
    return isAbsolute(cfg) ? cfg : join(process.cwd(), cfg);
  }

  /** 1st of every month, 03:15 server time. */
  @Cron('15 3 1 * *', { name: 'audit-archive' })
  async monthlyArchive(): Promise<void> {
    if (this.config.get<string>('AUDIT_ARCHIVE_ENABLED') !== 'true') return;
    try {
      await this.archive();
    } catch (err) {
      this.logger.error(`Audit archival failed: ${(err as Error).message}`);
    }
  }

  async archive(now = new Date()): Promise<ArchiveResult> {
    if (this.running) throw new Error('Archival already running');
    this.running = true;
    const cutoff = new Date(now.getTime() - this.retentionDays() * 86_400_000);
    try {
      const result = await this.dataSource.transaction(async (m) => {
        // Hold the chain lock so no append interleaves with the cut.
        await m.query('SELECT pg_advisory_xact_lock($1)', [
          AUDIT_CHAIN_LOCK_KEY,
        ]);
        await m.query("SET LOCAL rtb.audit_archive = 'on'");
        const rows = await m
          .getRepository(AuditLog)
          .createQueryBuilder('a')
          .where('a.createdAt < :cutoff', { cutoff })
          .orderBy('a.createdAt', 'ASC')
          .addOrderBy('a.id', 'ASC')
          .getMany();
        if (rows.length === 0) {
          return {
            archived: 0,
            file: null,
            cutoff: cutoff.toISOString(),
            lastHash: null,
          };
        }

        const dir = this.archiveDir();
        mkdirSync(dir, { recursive: true });
        const file = join(
          dir,
          `audit-${rows[0].createdAt.toISOString().slice(0, 10)}_to_${cutoff
            .toISOString()
            .slice(0, 10)}_${Date.now()}.jsonl.gz`,
        );
        const gzip = createGzip();
        const out = createWriteStream(file, { flags: 'wx', mode: 0o600 });
        gzip.pipe(out);
        for (const r of rows) {
          if (!gzip.write(`${JSON.stringify(r)}\n`)) await once(gzip, 'drain');
        }
        gzip.end();
        await once(out, 'finish');

        await m
          .createQueryBuilder()
          .delete()
          .from(AuditLog)
          .where('created_at < :cutoff', { cutoff })
          .execute();

        return {
          archived: rows.length,
          file,
          cutoff: cutoff.toISOString(),
          lastHash: rows[rows.length - 1].hash ?? null,
        };
      });

      if (result.archived > 0) {
        this.logger.log(
          `Archived ${result.archived} audit rows to ${result.file}`,
        );
        this.audit.record({
          action: 'audit.archived',
          targetType: 'audit_log',
          meta: {
            count: result.archived,
            file: result.file,
            cutoff: result.cutoff,
            lastArchivedHash: result.lastHash,
            retentionDays: this.retentionDays(),
          },
        });
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}
