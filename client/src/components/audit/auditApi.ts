import { api } from "../../lib/api";
import type { AuditOutcome } from "./auditLabels";

export interface AuditLogRow {
  id: string;
  createdAt: string;
  action: string;
  outcome: AuditOutcome | string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  subjectUserId: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  requestId: string | null;
  prevHash?: string | null;
  hash?: string | null;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  actorId?: string;
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  schoolId?: string;
  subjectUserId?: string;
  /** Comma list, e.g. "failure,denied". */
  outcome?: string;
  q?: string;
}

export interface AuditPage {
  data: AuditLogRow[];
  nextCursor: string | null;
  total?: number;
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  firstBrokenId: string | null;
  reason?: string;
}

/** Drops empty values so the server's whitelist validation stays happy. */
export function cleanFilters(f: AuditFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export async function fetchAuditLogs(
  filters: AuditFilters,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<AuditPage> {
  const params: Record<string, string | number> = {
    ...cleanFilters(filters),
    limit: opts.limit ?? 50,
  };
  if (opts.cursor) params.cursor = opts.cursor;
  const { data } = await api.get<AuditPage>("/audit-logs", { params });
  return data;
}

export async function fetchAuditActions(): Promise<string[]> {
  const { data } = await api.get<string[]>("/audit-logs/actions");
  return Array.isArray(data) ? data : [];
}

export async function verifyAuditChain(): Promise<ChainVerification> {
  const { data } = await api.get<ChainVerification>("/audit-logs/verify");
  return data;
}

/** Downloads the CSV export (authenticated, so via axios + blob). */
export async function downloadAuditCsv(filters: AuditFilters): Promise<void> {
  const res = await api.get<Blob>("/audit-logs/export.csv", {
    params: cleanFilters(filters),
    responseType: "blob",
  });
  const disposition = String(res.headers?.["content-disposition"] ?? "");
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "audit-trail.csv";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
