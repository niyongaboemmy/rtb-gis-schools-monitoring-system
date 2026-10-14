import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import type { AuditLog } from './entities/audit-log.entity';

export type SecurityAlertType =
  | 'repeated_login_failures'
  | 'account_locked'
  | '2fa_reset'
  | 'role_change'
  | 'user_permission_change'
  | 'bulk_delete'
  | 'audit_chain_broken';

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FAILED_LOGIN_THRESHOLD = 5;
const ALERT_THROTTLE_MS = 10 * 60 * 1000;
const BULK_DELETE_THRESHOLD = 10;

const ROLE_ACTIONS = new Set(['role.create', 'role.update', 'role.delete']);
const USER_ROLE_ACTIONS = new Set([
  'user.update',
  'user.role_change',
  'user.permissions_change',
]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Security alerts from the audit stream (WS11.10). Emails the addresses in
 * SECURITY_ALERT_EMAILS; at most one alert per type per 10 minutes. Fails soft:
 * a mail problem is logged, never thrown.
 *
 * State (failed-login window, throttle) is in-process — with several API
 * instances each one counts and throttles separately.
 */
@Injectable()
export class AuditAlertService {
  private readonly logger = new Logger(AuditAlertService.name);
  private readonly failedLogins = new Map<string, number[]>();
  private readonly lastSent = new Map<SecurityAlertType, number>();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly mail?: MailService,
  ) {}

  private recipients(): string[] {
    return (this.config.get<string>('SECURITY_ALERT_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+$/.test(e));
  }

  /** Decides whether a freshly written row warrants an alert. Never throws. */
  evaluate(row: AuditLog, now = Date.now()): SecurityAlertType | null {
    try {
      const type = this.classify(row, now);
      if (type) void this.send(type, row, now);
      return type;
    } catch (err) {
      this.logger.warn(`Alert evaluation failed: ${(err as Error).message}`);
      return null;
    }
  }

  classify(row: AuditLog, now = Date.now()): SecurityAlertType | null {
    const action = row.action;
    if (action === 'auth.login_failed') {
      const key = (
        (row.meta?.email as string | undefined) ??
        row.actorEmail ??
        row.targetId ??
        'unknown'
      ).toLowerCase();
      const recent = (this.failedLogins.get(key) ?? []).filter(
        (t) => now - t < FAILED_LOGIN_WINDOW_MS,
      );
      recent.push(now);
      this.failedLogins.set(key, recent);
      if (this.failedLogins.size > 5000) this.pruneFailedLogins(now);
      return recent.length >= FAILED_LOGIN_THRESHOLD
        ? 'repeated_login_failures'
        : null;
    }
    if (action === 'auth.account_locked') return 'account_locked';
    // The auth module names it auth.mfa_reset; auth.2fa_reset kept as alias.
    if (action === 'auth.2fa_reset' || action === 'auth.mfa_reset')
      return '2fa_reset';
    if (action === 'audit.integrity_failed') return 'audit_chain_broken';
    if (row.outcome !== 'success') return null;
    if (ROLE_ACTIONS.has(action)) return 'role_change';
    if (USER_ROLE_ACTIONS.has(action)) {
      const changed = Object.keys(row.changes ?? {});
      if (
        action !== 'user.update' ||
        changed.some((f) =>
          /^(role|roleId|permissions)$/.test(f.split('.').pop() ?? f),
        )
      ) {
        return 'user_permission_change';
      }
      return null;
    }
    const deleted = row.meta?.deleted;
    if (
      /bulk_delete|\.purge$/.test(action) ||
      (row.meta?.bulk === true && /delete|remove/.test(action)) ||
      (typeof deleted === 'number' && deleted >= BULK_DELETE_THRESHOLD)
    ) {
      return 'bulk_delete';
    }
    return null;
  }

  private pruneFailedLogins(now: number) {
    for (const [k, times] of this.failedLogins) {
      if (!times.some((t) => now - t < FAILED_LOGIN_WINDOW_MS))
        this.failedLogins.delete(k);
    }
  }

  private async send(
    type: SecurityAlertType,
    row: AuditLog,
    now: number,
  ): Promise<void> {
    const to = this.recipients();
    if (to.length === 0 || !this.mail) return;
    const last = this.lastSent.get(type);
    if (last !== undefined && now - last < ALERT_THROTTLE_MS) return;
    this.lastSent.set(type, now);

    const lines = [
      `Alert: ${type.replace(/_/g, ' ')}`,
      `Action: ${row.action} (${row.outcome})`,
      `By: ${row.actorEmail ?? 'unknown'}${row.actorRole ? ` [${row.actorRole}]` : ''} from ${row.ip ?? 'unknown IP'}`,
      `When (UTC): ${new Date(row.createdAt).toISOString()}`,
      `Target: ${row.targetType}${row.targetId ? ` ${row.targetId}` : ''}${row.targetLabel ? ` (${row.targetLabel})` : ''}`,
      `Request id: ${row.requestId ?? '-'}`,
      '',
      'Review the Audit Trail (Settings → Audit Trail). Further alerts of this type are suppressed for 10 minutes.',
    ];
    const text = lines.join('\n');
    try {
      await this.mail.send({
        to: to.join(','),
        subject: `[RTB GIS security] ${type.replace(/_/g, ' ')}`,
        text,
        html: `<pre style="font-family:monospace">${escapeHtml(text)}</pre>`,
      });
    } catch (err) {
      this.logger.warn(
        `Security alert email failed (${type}): ${(err as Error).message}`,
      );
    }
  }
}
