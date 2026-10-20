import { SetMetadata } from '@nestjs/common';

export const AUDIT_META_KEY = 'rtb:audit';
export const AUDIT_SKIP_KEY = 'rtb:audit-skip';

/** Where the "to whom" person (subjectUserId) comes from. */
export type AuditSubjectSource =
  | { param: string }
  | 'actor'
  | { response: string };

export interface AuditOptions {
  /** targetType, e.g. `school`. Defaults to the controller's resource. */
  target?: string;
  /** Route param holding the target id (default: `id`, then the first param). */
  idParam?: string;
  /** Response field holding the target id (creates), e.g. `id`. */
  idFromResponse?: string;
  /** Response fields tried in order for a human label, e.g. ['name']. */
  labelFrom?: string[];
  subject?: AuditSubjectSource;
  /** Also audit GET requests to this handler (sensitive reads, WS11.5). */
  auditReads?: boolean;
  /** Further narrows which reads are audited (e.g. only the first page). */
  readWhen?: (req: any) => boolean;
  /** Treat as a bulk delete for security alerts (WS11.10). */
  bulkDelete?: boolean;
}

export interface AuditSpec extends AuditOptions {
  action: string;
}

/**
 * Names the audit action for a handler, overriding the central registry.
 *   @Audit('school.update', { target: 'school', idParam: 'id', labelFrom: ['name'] })
 */
export const Audit = (action: string, options: AuditOptions = {}) =>
  SetMetadata(AUDIT_META_KEY, { action, ...options } satisfies AuditSpec);

/** Opt a handler out of the automatic audit row (it logs explicitly). */
export const SkipAudit = () => SetMetadata(AUDIT_SKIP_KEY, true);
