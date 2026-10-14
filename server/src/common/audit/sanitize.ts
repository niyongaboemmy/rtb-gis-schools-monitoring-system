import { createHash } from 'crypto';

/**
 * Keys whose VALUES must never reach the audit trail (request meta, query
 * strings, params). Deliberately broad — a masked harmless field is cheaper
 * than a leaked OTP.
 */
export const SENSITIVE_KEY_RE = /pass|token|secret|otp|code|recovery/i;

/**
 * Entity fields that are masked in field-level diffs (WS11.4). Narrower than
 * SENSITIVE_KEY_RE so that e.g. a school's `code` change stays readable.
 */
export const SENSITIVE_DIFF_FIELD_RE =
  /^(password|refreshToken|totp|passwordReset|recovery|mfa|twoFactor)|secret|token/i;

export const REDACTED = '[REDACTED]';

/** Longest serialised value kept verbatim (geometry blobs get summarised). */
export const MAX_VALUE_CHARS = 2000;

/** Recursively replaces values of sensitive keys with REDACTED. */
export function maskSensitive<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > 6) return value;
  if (Array.isArray(value)) {
    return value.map((v) => maskSensitive(v, depth + 1)) as unknown as T;
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k)
        ? REDACTED
        : maskSensitive(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

/**
 * Makes a value safe for jsonb + stable hashing: Dates → ISO strings,
 * undefined dropped, NUL characters stripped (Postgres rejects them in jsonb),
 * oversized values summarised.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  let json: string | undefined;
  try {
    json = JSON.stringify(value, (_k, v: unknown) =>
      typeof v === 'string' ? stripNul(v) : v,
    );
  } catch {
    return '[unserialisable]';
  }
  if (json === undefined) return null;
  if (json.length > MAX_VALUE_CHARS) {
    return `[omitted: ${json.length} chars, sha256 ${createHash('sha256')
      .update(json)
      .digest('hex')
      .slice(0, 16)}]`;
  }
  return JSON.parse(json) as unknown;
}

/** Postgres text cannot hold NUL characters. */
const stripNul = (s: string) => s.split('\u0000').join('');

/** Text form of a scalar; objects are JSON-encoded, never "[object Object]". */
function scalarText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? '';
    } catch {
      return '[unserialisable]';
    }
  }
  return String(value as string | number | boolean | bigint | symbol);
}

/** Truncates free text (error messages, user agents). */
export function clip(value: unknown, max = 500): string | null {
  if (value === null || value === undefined) return null;
  const s = stripNul(scalarText(value));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Deterministic JSON: object keys sorted recursively. jsonb does not keep key
 * order, so hashing must not depend on it.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
  return JSON.stringify(value);
}

/** The persisted fields covered by the tamper-evidence hash (WS11.6). */
export interface HashableAuditRow {
  id: string;
  createdAt: Date | string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  outcome?: string | null;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  subjectUserId?: string | null;
  changes?: unknown;
  meta?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  prevHash?: string | null;
}

/** hash = sha256(prevHash + canonicalJSON(row fields)) */
export function computeAuditHash(row: HashableAuditRow): string {
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : new Date(row.createdAt).toISOString();
  const fields = {
    id: row.id,
    createdAt,
    actorId: row.actorId ?? null,
    actorEmail: row.actorEmail ?? null,
    actorRole: row.actorRole ?? null,
    action: row.action,
    outcome: row.outcome ?? null,
    targetType: row.targetType,
    targetId: row.targetId ?? null,
    targetLabel: row.targetLabel ?? null,
    subjectUserId: row.subjectUserId ?? null,
    changes: row.changes ?? null,
    meta: row.meta ?? null,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    sessionId: row.sessionId ?? null,
    requestId: row.requestId ?? null,
  };
  return createHash('sha256')
    .update((row.prevHash ?? '') + canonicalJson(fields))
    .digest('hex');
}
