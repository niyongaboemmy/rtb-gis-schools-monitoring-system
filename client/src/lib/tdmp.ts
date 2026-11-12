/**
 * TDMP (TVET Data Management Platform) integration — shared client pieces.
 *
 * TDMP is the source of truth for users and school information; RTB GIS keeps
 * GPS and all GIS work. Users sign in through TDMP (OAuth, handled by the
 * server under /auth/tdmp/*), and schools are synced from TDMP by the server.
 */
import { api, API_BASE } from "./api";
import { formatNumber } from "./format";

// ── Sign-in providers ───────────────────────────────────────────────────────

/** GET /auth/providers — which sign-in methods this server offers. */
export interface AuthProviders {
  authMode: "local" | "both" | "tdmp";
  /** Email/password form shown normally. */
  password: boolean;
  google: boolean;
  tdmp: boolean;
  /** TDMP mode with an emergency allowlist: password form behind a link. */
  breakGlass: boolean;
}

/** What an older server (no /auth/providers) supports. */
export const LEGACY_PROVIDERS: AuthProviders = {
  authMode: "local",
  password: true,
  google: true,
  tdmp: false,
  breakGlass: false,
};

let providersPromise: Promise<AuthProviders> | null = null;

/** Fetched once per page load; falls back to the legacy set on any error. */
export function fetchAuthProviders(): Promise<AuthProviders> {
  providersPromise ??= api
    .get<AuthProviders>("/auth/providers")
    .then(({ data }) => ({ ...LEGACY_PROVIDERS, ...data }))
    .catch(() => {
      providersPromise = null; // retry on the next call
      return LEGACY_PROVIDERS;
    });
  return providersPromise;
}

/**
 * Only same-app paths are followed after sign-in ("/schools/1"), never
 * another origin ("//evil.example", "https://…").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

/** Server route that starts the TDMP OAuth flow — open with a full page load. */
export function tdmpStartUrl(opts: { next?: string; school?: string } = {}): string {
  const params = new URLSearchParams();
  if (opts.next) params.set("next", safeNextPath(opts.next));
  if (opts.school) params.set("school", opts.school);
  const qs = params.toString();
  return `${API_BASE}/auth/tdmp/start${qs ? `?${qs}` : ""}`;
}

export type SsoErrorCode = "cancelled" | "state" | "not_allowed" | "inactive" | "unavailable" | "failed";

/** `/login?sso_error=<code>` → what to tell the person. */
export const SSO_ERROR_MESSAGES: Record<SsoErrorCode, string> = {
  cancelled: "Sign-in was cancelled in TDMP. You can try again whenever you're ready.",
  state: "Your sign-in link expired or was opened in another browser. Please sign in again.",
  not_allowed:
    "Your TDMP account doesn't have access to RTB GIS yet. Ask an administrator to give your TDMP role access.",
  inactive: "Your RTB GIS access has been turned off. Contact an administrator if you think this is a mistake.",
  unavailable: "TDMP can't be reached right now. Please try again in a few minutes.",
  failed: "Signing in with TDMP didn't finish. Please try again.",
};

export function ssoErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return SSO_ERROR_MESSAGES[code as SsoErrorCode] ?? SSO_ERROR_MESSAGES.failed;
}

// ── Users ───────────────────────────────────────────────────────────────────

export type AuthSource = "local" | "tdmp";

/** True for accounts whose sign-in (password, 2FA) is managed by TDMP. */
export function isTdmpUser(user: { authSource?: AuthSource | null } | null | undefined): boolean {
  return user?.authSource === "tdmp";
}

// ── Schools ─────────────────────────────────────────────────────────────────

/**
 * School fields that come from TDMP. Read-only here once a school is linked;
 * GPS (latitude/longitude/elevation) is NOT in this list — RTB GIS owns it.
 * Gender splits and the head teacher stay editable until TDMP sends them.
 * Mirrors the server's list; PATCH with a changed one answers 403 TDMP_OWNED.
 */
export const TDMP_OWNED_SCHOOL_FIELDS = [
  "code",
  "name",
  "type",
  "status",
  "establishedYear",
  "province",
  "district",
  "sector",
  "cell",
  "village",
  "ownership",
  "totalStudents",
  "totalTeachers",
] as const;

export type TdmpOwnedField = (typeof TDMP_OWNED_SCHOOL_FIELDS)[number];

const OWNED = new Set<string>(TDMP_OWNED_SCHOOL_FIELDS);

export function isTdmpOwnedField(field: string): boolean {
  return OWNED.has(field);
}

/** A school is linked once the server has matched it to a TDMP school code. */
export function isTdmpLinked(school: { tdmpSchoolCode?: unknown } | null | undefined): boolean {
  return typeof school?.tdmpSchoolCode === "string" && school.tdmpSchoolCode.trim() !== "";
}

/** Short hint shown next to a locked field. */
export const TDMP_LOCK_HINT = "Managed in TDMP — change it there";

/** `school.tdmpData` — the TDMP snapshot stored at the last sync. */
export interface TdmpSchoolData {
  ownership?: string | null;
  institutionType?: string | null;
  schoolCategory?: string | null;
  schoolStatus?: string | null;
  isActive?: string | null;
  /** TSS / VTC band in TDMP; null = in neither. */
  band?: string | null;
  typeUnverified?: boolean;
  tmisSchoolCode?: string | null;
  trades?: string[];
  counts?: { teachers?: number; students?: number; trades?: number; levels?: number; modules?: number };
  academicYear?: string | null;
  establishmentDate?: string | null;
  sourceUpdatedAt?: string | null;
  missingFromTdmp?: boolean;
}

export interface TdmpLinkFields {
  tdmpSchoolId?: number | null;
  tdmpSchoolCode?: string | null;
  tdmpSyncedAt?: string | null;
  tdmpData?: TdmpSchoolData | null;
}

// ── Admin (TDMP integration page) ───────────────────────────────────────────

export interface SyncTotals {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  linked: number;
  skippedNoGps: number;
  skipped: number;
  failed: number;
  missing: number;
  deactivated: number;
  details: number;
}

export interface ReportSchool {
  code: string;
  name: string;
  district?: string | null;
  schoolId?: string;
  localName?: string;
  fields?: string[];
  reason?: string;
}

export interface RunReport {
  tdmpMaterialisedAt?: string | null;
  changes: ReportSchool[];
  newLinks: ReportSchool[];
  created: ReportSchool[];
  needsLocation: ReportSchool[];
  missing: ReportSchool[];
  gisOnly: ReportSchool[];
  skipped: ReportSchool[];
}

export type SyncTrigger = "schedule" | "probe" | "manual";

export interface SyncRun {
  id: string;
  trigger: SyncTrigger;
  status: "running" | "completed" | "failed";
  dryRun: boolean;
  startedAt: string;
  finishedAt: string | null;
  totals: SyncTotals;
  errors: string[];
  report: RunReport | null;
  progress: { phase: "list" | "bands" | "schools" | "missing"; done: number; total: number } | null;
  triggeredBy: string | null;
}

export interface TdmpSyncSettings {
  autoSync: boolean;
  probeIntervalMinutes: number;
  dailyRunAt: string;
  lastProbeAt: string | null;
  tdmpMaterialisedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  probeIntervals: number[];
  nextDailyRunAt: string | null;
}

export interface TdmpStatus {
  enabled: { login: boolean; sync: boolean };
  authMode: AuthProviders["authMode"];
  running: boolean;
  currentRun: SyncRun | null;
  lastRun: SyncRun | null;
  lastSuccessAt: string | null;
  linkedSchools: number;
  unlinkedSchools: number;
  settings: TdmpSyncSettings;
}

export interface UnlinkedSchool {
  id: string;
  code: string;
  name: string;
  district: string | null;
  hasGisData: boolean;
  suggestion: { schoolCode: string; schoolName: string } | null;
}

export interface EndpointStatus {
  key: string;
  label: string;
  path: string;
  status: number;
  ms: number;
  ok: boolean;
  request?: string;
}

export type RequestState = "done" | "partial" | "waiting" | "manual";

export interface RequestStatus {
  id: string;
  title: string;
  priority: "P1" | "P2" | "P3";
  state: RequestState;
  evidence: string;
}

export interface ConnectionReport {
  checkedAt: string;
  configured: { apiKey: boolean; oauthClient: boolean; baseUrl: string };
  reachable: boolean;
  authorised: boolean;
  latencyMs: number | null;
  tdmpMaterialisedAt: string | null;
  tvetSchools: number | null;
  endpoints: EndpointStatus[];
  requests: RequestStatus[];
}

const TRIGGER_LABEL: Record<SyncTrigger, string> = {
  schedule: "Daily",
  probe: "TDMP data changed",
  manual: "Manual",
};

export function triggerLabel(run: Pick<SyncRun, "trigger" | "dryRun">): string {
  return `${TRIGGER_LABEL[run.trigger] ?? run.trigger}${run.dryRun ? " · dry run" : ""}`;
}

/** "12 new · 340 updated · 2 failed" — only the parts that happened. */
export function totalsSummary(t: Partial<SyncTotals>, dryRun = false): string {
  const n = (v: number | undefined) => v ?? 0;
  const parts: Array<[number, string]> = [
    [n(t.created), dryRun ? "to add" : "new"],
    [n(t.linked), dryRun ? "to link" : "linked"],
    [n(t.updated), dryRun ? "to update" : "updated"],
    [n(t.unchanged), "unchanged"],
    [n(t.skippedNoGps), "need a location"],
    [n(t.deactivated), dryRun ? "to deactivate" : "deactivated"],
    [n(t.missing), "missing from TDMP"],
    [n(t.skipped), "skipped"],
    [n(t.failed), "failed"],
  ];
  const shown = parts.filter(([v]) => v > 0).map(([v, what]) => `${formatNumber(v)} ${what}`);
  return shown.length ? shown.join(" · ") : "No changes";
}

const PHASE_LABEL: Record<NonNullable<SyncRun["progress"]>["phase"], string> = {
  list: "Reading the school list",
  bands: "Reading TSS / VTC bands",
  schools: "Updating schools",
  missing: "Checking schools TDMP no longer lists",
};

export function progressLabel(p: SyncRun["progress"]): string {
  if (!p) return "Starting…";
  const base = PHASE_LABEL[p.phase] ?? p.phase;
  return p.total > 0 ? `${base} · ${formatNumber(p.done)} of ${formatNumber(p.total)}` : base;
}

/** School field names as people say them. */
const FIELD_LABEL: Record<string, string> = {
  code: "code",
  name: "name",
  type: "type",
  status: "status",
  establishedYear: "year established",
  province: "province",
  district: "district",
  sector: "sector",
  cell: "cell",
  village: "village",
  provinceId: "province id",
  districtId: "district id",
  sectorId: "sector id",
  cellId: "cell id",
  villageId: "village id",
  ownership: "ownership",
  totalStudents: "learners",
  totalTeachers: "teachers",
};

export function fieldsLabel(fields: string[] | undefined): string {
  if (!fields?.length) return "";
  return fields.map((f) => FIELD_LABEL[f] ?? f).join(", ");
}
