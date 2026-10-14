import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { AuditIntegrityService } from './audit-integrity.service';
import { AuditExportQueryDto, AuditQueryDto } from './dto/audit-query.dto';
import type { AuditLog } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

const CSV_COLUMNS: Array<[string, (r: AuditLog) => unknown]> = [
  ['created_at_utc', (r) => r.createdAt.toISOString()],
  ['action', (r) => r.action],
  ['outcome', (r) => r.outcome],
  ['actor_email', (r) => r.actorEmail],
  ['actor_role', (r) => r.actorRole],
  ['actor_id', (r) => r.actorId],
  ['ip', (r) => r.ip],
  ['target_type', (r) => r.targetType],
  ['target_id', (r) => r.targetId],
  ['target_label', (r) => r.targetLabel],
  ['subject_user_id', (r) => r.subjectUserId],
  ['changes', (r) => (r.changes ? JSON.stringify(r.changes) : '')],
  ['meta', (r) => (r.meta ? JSON.stringify(r.meta) : '')],
  ['user_agent', (r) => r.userAgent],
  ['request_id', (r) => r.requestId],
  ['session_id', (r) => r.sessionId],
  ['id', (r) => r.id],
  ['hash', (r) => r.hash],
];

/** RFC 4180 cell, with spreadsheet formula injection neutralised. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s =
    typeof value === 'object'
      ? JSON.stringify(value)
      : String(value as string | number | boolean);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.VIEW_AUDIT_LOGS)
@ApiBearerAuth()
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly integrity: AuditIntegrityService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search audit logs (filters + cursor pagination)',
    description:
      'Returns {data, nextCursor, total?}. Pass nextCursor back as `cursor` for the next page. `limit` ≤ 200. `offset` is still accepted for older clients.',
  })
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.search(query);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Distinct action codes (for filter dropdowns)' })
  actions() {
    return this.auditService.distinctActions();
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify the tamper-evidence hash chain' })
  verify() {
    return this.integrity.verifyChain();
  }

  @Get('export.csv')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Export matching audit logs as CSV (max 50 000 rows; audited)',
  })
  async exportCsv(@Query() query: AuditExportQueryDto, @Res() res: Response) {
    const max = query.max ?? 50_000;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-trail-${stamp}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.write('﻿' + CSV_COLUMNS.map(([h]) => h).join(',') + '\n');
    try {
      for await (const row of this.auditService.iterate(query, max)) {
        const line =
          CSV_COLUMNS.map(([, get]) => csvCell(get(row))).join(',') + '\n';
        if (!res.write(line)) await new Promise((r) => res.once('drain', r));
      }
    } catch (err) {
      res.write(`# export aborted: ${csvCell((err as Error).message)}\n`);
    }
    res.end();
  }
}
