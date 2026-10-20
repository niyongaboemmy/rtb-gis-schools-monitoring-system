import type {
  AuditEntry,
  AuditOutcome,
} from '../../modules/audit/audit.service';
import type { AuditSpec } from './audit.decorator';
import {
  EXPORT_PATH_RE,
  isSkippedHandler,
  lookupAuditSpec,
} from './action-registry';
import type { AuditRequestContext, CapturedChange } from './request-context';
import { resolveSessionId } from './request-context';
import { clip, maskSensitive } from './sanitize';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function outcomeFromStatus(status: number): AuditOutcome {
  if (status === 401 || status === 403 || status === 429) return 'denied';
  if (status >= 400) return 'failure';
  return 'success';
}

function pick(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object')
      return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function asId(v: unknown): string | null {
  if (typeof v === 'string' && v) return v.slice(0, 255);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** `/schools/:id` → `school`; used when nothing names the target type. */
function targetFromRoute(routePath: string): string {
  const seg =
    routePath.split('/').find((s) => s && !s.startsWith(':')) ?? 'system';
  const clean = seg
    .replace(/[^a-z0-9_-]/gi, '')
    .replace(/-/g, '_')
    .toLowerCase();
  return clean.endsWith('s') && clean.length > 3
    ? clean.slice(0, -1)
    : clean || 'system';
}

/**
 * Merges the subscriber's per-entity diffs into one `changes` map. A single
 * changed row keeps plain field names; several rows prefix `Entity.field`.
 */
export function mergeCapturedChanges(
  captured: CapturedChange[],
): Record<string, [unknown, unknown]> | null {
  const withFields = captured.filter((c) => Object.keys(c.fields).length > 0);
  if (withFields.length === 0) return null;
  const distinct = new Set(withFields.map((c) => `${c.entity}#${c.id ?? ''}`));
  if (distinct.size === 1) {
    return Object.assign({}, ...withFields.map((c) => c.fields)) as Record<
      string,
      [unknown, unknown]
    >;
  }
  const out: Record<string, [unknown, unknown]> = {};
  for (const c of withFields) {
    for (const [field, pair] of Object.entries(c.fields)) {
      let key = `${c.entity}.${field}`;
      if (key in out) key = `${key}#${c.id ?? '?'}`;
      out[key] = pair;
    }
  }
  return out;
}

export function resolveSpec(ctx: AuditRequestContext): AuditSpec | null {
  if (!ctx.handler) return null;
  return ctx.handler.decorated ?? lookupAuditSpec(ctx.handler.key) ?? null;
}

/**
 * Builds the automatic audit row for a finished request, or null when the
 * request should not produce one. Pure — unit-tested in isolation.
 */
export function buildRequestAuditEntry(
  ctx: AuditRequestContext,
  statusCode: number,
): AuditEntry | null {
  const handler = ctx.handler;
  // Unmatched routes (404 scanners) and requests rejected before routing.
  if (!handler) return null;
  if (handler.skipped || isSkippedHandler(handler.key)) return null;

  const req = ctx.req ?? {};
  const spec = resolveSpec(ctx);
  const isRead = READ_METHODS.has(ctx.method);
  const isExport = EXPORT_PATH_RE.test(handler.routePath);

  if (isRead) {
    if (ctx.method !== 'GET') return null;
    const wanted = (spec?.auditReads ?? false) || isExport;
    if (!wanted) return null;
    if (spec?.readWhen && !spec.readWhen(req)) return null;
  }

  const outcome = outcomeFromStatus(statusCode);
  // The service already wrote a richer explicit row for this request.
  if (ctx.explicitRecords > 0 && outcome === 'success') return null;

  const params: Record<string, unknown> = req.params ?? {};
  const body = ctx.responseBody;
  const user = req.user;

  const action =
    spec?.action ??
    (isRead && isExport
      ? `${targetFromRoute(handler.routePath)}.export`
      : `${ctx.method} ${handler.routePath}`);
  const targetType = spec?.target ?? targetFromRoute(handler.routePath);

  const idParam = spec?.idParam;
  const targetId =
    (idParam ? asId(params[idParam]) : null) ??
    (spec?.idFromResponse && outcome === 'success'
      ? asId(pick(body, spec.idFromResponse))
      : null) ??
    asId(params.id) ??
    asId(Object.values(params)[0]);

  let targetLabel: string | null = null;
  if (outcome === 'success') {
    for (const path of spec?.labelFrom ?? []) {
      const v = pick(body, path);
      if (typeof v === 'string' && v.trim()) {
        targetLabel = clip(v, 255);
        break;
      }
    }
  }

  let subjectUserId: string | null = null;
  const subject = spec?.subject;
  if (subject === 'actor') subjectUserId = asId(user?.id);
  else if (subject && 'param' in subject)
    subjectUserId = asId(params[subject.param]);
  else if (subject && 'response' in subject && outcome === 'success') {
    subjectUserId = asId(pick(body, subject.response));
  }

  // School correlation, so a school's Activity feed can include its buildings.
  const schoolId =
    asId(params.schoolId) ??
    (targetType === 'school' ? targetId : null) ??
    asId(pick(body, 'schoolId'));

  const meta: Record<string, unknown> = {
    method: ctx.method,
    route: handler.routePath,
    status: statusCode,
  };
  if (schoolId) meta.schoolId = schoolId;
  if (Object.keys(params).length) meta.params = maskSensitive(params);
  if (isRead && req.query && Object.keys(req.query).length) {
    // Export filters, never values of sensitive keys.
    meta.query = maskSensitive(req.query);
  }
  if (ctx.error) meta.error = clip(ctx.error.message, 300);
  if (spec?.bulkDelete) meta.bulk = true;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const k of [
      'created',
      'updated',
      'deleted',
      'failed',
      'count',
      'processed',
    ]) {
      const v = (body as Record<string, unknown>)[k];
      if (typeof v === 'number') meta[k] = v;
      else if (Array.isArray(v)) meta[k] = v.length;
    }
  }

  return {
    action,
    outcome,
    actor: user
      ? {
          id: user.id ?? null,
          email: user.email ?? null,
          role: user.role?.name ?? null,
        }
      : null,
    targetType,
    targetId,
    targetLabel,
    subjectUserId,
    changes: mergeCapturedChanges(ctx.changes),
    meta,
    request: {
      ip: ctx.ip ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
      requestId: ctx.requestId,
      sessionId: resolveSessionId(req) ?? undefined,
    },
  };
}
