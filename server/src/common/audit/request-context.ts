import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { AuditSpec } from './audit.decorator';

/** Field-level diff captured by the TypeORM subscriber for one entity row. */
export interface CapturedChange {
  entity: string;
  id?: string;
  fields: Record<string, [unknown, unknown]>;
}

/** The handler that served the request (set by AuditContextGuard). */
export interface AuditHandlerInfo {
  /** Registry key: `ControllerClass.handlerName`. */
  key: string;
  /** Route pattern without ids, e.g. `/schools/:id`. */
  routePath: string;
  /** Spec from an `@Audit()` decorator, if any. */
  decorated?: AuditSpec | null;
  skipped?: boolean;
}

/**
 * Per-request audit state, kept in AsyncLocalStorage (and mirrored on the
 * request object, because some stream-based middleware such as multer can lose
 * the ALS context — the interceptor and finish hook read it from `req`).
 */
export interface AuditRequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  method: string;
  /** Raw request (for req.user / params). Never persisted. */
  req: any;
  handler?: AuditHandlerInfo;
  responseBody?: unknown;
  error?: { status: number; message: string };
  changes: CapturedChange[];
  /** Explicit `AuditService.record()` calls made while serving the request. */
  explicitRecords: number;
  finalized: boolean;
}

export const AUDIT_CTX_KEY = '__auditCtx';

export const auditStorage = new AsyncLocalStorage<AuditRequestContext>();

/** The current request's audit context, if any (undefined for cron/system). */
export function getAuditContext(): AuditRequestContext | undefined {
  return auditStorage.getStore();
}

export function getAuditContextFromRequest(
  req: any,
): AuditRequestContext | undefined {
  return (
    (req?.[AUDIT_CTX_KEY] as AuditRequestContext | undefined) ??
    getAuditContext()
  );
}

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

/** Accepts an upstream (nginx) request id if well-formed, else a new uuid. */
export function resolveRequestId(header: unknown): string {
  const v = Array.isArray(header) ? header[0] : header;
  return typeof v === 'string' && REQUEST_ID_RE.test(v) ? v : randomUUID();
}

function normaliseIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  return (trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed).slice(
    0,
    64,
  );
}

/**
 * Client IP. Production sits behind nginx, which sets X-Forwarded-For; the
 * first hop is the client. Set AUDIT_TRUST_FORWARDED=false when the API is
 * exposed directly (the header would then be client-controlled).
 */
export function resolveClientIp(req: any): string | null {
  const trustForwarded = process.env.AUDIT_TRUST_FORWARDED !== 'false';
  if (trustForwarded) {
    const xff = req?.headers?.['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    if (typeof raw === 'string' && raw.trim()) {
      return normaliseIp(raw.split(',')[0]);
    }
  }
  return normaliseIp(req?.ip ?? req?.socket?.remoteAddress);
}

export function createAuditContext(req: any): AuditRequestContext {
  const ua = req?.headers?.['user-agent'];
  return {
    requestId: resolveRequestId(req?.headers?.['x-request-id']),
    ip: resolveClientIp(req),
    userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
    method: String(req?.method ?? 'GET').toUpperCase(),
    req,
    changes: [],
    explicitRecords: 0,
    finalized: false,
  };
}

/**
 * Session id for correlating a user's actions: `sid` (or `jti`) from the
 * already-verified bearer token, when the auth module issues one.
 */
export function resolveSessionId(req: any): string | null {
  const fromUser = req?.user?.sessionId ?? req?.sessionId;
  if (typeof fromUser === 'string' && fromUser) return fromUser.slice(0, 128);
  if (!req?.user) return null;
  const auth = req?.headers?.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const parts = auth.slice(7).split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { sid?: unknown; jti?: unknown };
    const sid = payload.sid ?? payload.jti;
    return typeof sid === 'string' ? sid.slice(0, 128) : null;
  } catch {
    return null;
  }
}
