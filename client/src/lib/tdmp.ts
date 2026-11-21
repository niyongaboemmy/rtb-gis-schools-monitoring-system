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
  /**
   * Where a TDMP user's role and area come from: `local` = set by an RTB GIS
   * administrator (today: TDMP sign-in carries no role); `tdmp` = taken from
   * TDMP at each sign-in (future).
   */
  tdmpAccess: "local" | "tdmp";
}

/** What an older server (no /auth/providers) supports. */
export const LEGACY_PROVIDERS: AuthProviders = {
  authMode: "local",
  password: true,
  google: true,
  tdmp: false,
  breakGlass: false,
  tdmpAccess: "local",
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

/** `POST /auth/tdmp/mfa` answered 401: the pending TDMP sign-in expired. */
export const SSO_MFA_EXPIRED = "Your TDMP sign-in took too long. Please sign in again.";

// ── Automatic return to TDMP ────────────────────────────────────────────────
//
// TDMP sessions here last at most a day; TDMP itself usually still knows the
// person. When a TDMP user's session can't be restored, send them back through
// TDMP sign-in (normally no password) instead of showing the login page.

export const TDMP_AUTO_RETURN_KEY = "rtb_tdmp_auto_return";
/** At most one automatic return in this window, so a failing sign-in never loops. */
export const TDMP_AUTO_RETURN_WINDOW_MS = 2 * 60 * 1000;

/** Pages that never trigger the automatic return (sign-in pages, public pages). */
const NO_AUTO_RETURN = /^\/(login|forgot-password|sso\/|embed\/|developers)/;

export function shouldAutoReturnToTdmp(opts: {
  /** The remembered profile, read before the local session is cleared. */
  user: { authSource?: string | null } | null | undefined;
  tdmpSignIn: boolean;
  pathname: string;
  embed: boolean;
  /** Time of the last automatic return, or null. */
  lastReturnAt: number | null;
  now?: number;
}): boolean {
  const now = opts.now ?? Date.now();
  if (opts.embed || !opts.tdmpSignIn) return false;
  if (opts.user?.authSource !== "tdmp") return false;
  if (NO_AUTO_RETURN.test(opts.pathname)) return false;
  if (opts.lastReturnAt !== null && now - opts.lastReturnAt < TDMP_AUTO_RETURN_WINDOW_MS) return false;
  return true;
}

function readLastReturn(): number | null {
  try {
    const raw = sessionStorage.getItem(TDMP_AUTO_RETURN_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastReturn(at: number) {
  try {
    sessionStorage.setItem(TDMP_AUTO_RETURN_KEY, String(at));
  } catch {
    /* storage unavailable: the window check just won't apply */
  }
}

/**
 * The session is gone (refresh failed). For a TDMP user, sends the browser
 * back through TDMP sign-in, returning to `path`. Resolves true when it did;
 * the caller then skips its own redirect to /login. An explicit sign-out
 * clears the remembered profile first, so it never lands here as a TDMP user.
 */
export async function returnToTdmpIfSessionLost(
  user: { authSource?: string | null } | null | undefined,
  path: string,
  opts: {
    embed: boolean;
    /** Injected in tests. */
    getProviders?: () => Promise<Pick<AuthProviders, "tdmp">>;
    go?: (url: string) => void;
  },
): Promise<boolean> {
  // Cheap checks first: no request for local users or embedded views.
  if (opts.embed || user?.authSource !== "tdmp") return false;
  const providers = await (opts.getProviders ?? fetchAuthProviders)();
  const pathname = path.split(/[?#]/)[0] || "/";
  if (
    !shouldAutoReturnToTdmp({
      user,
      tdmpSignIn: providers.tdmp,
      pathname,
      embed: opts.embed,
      lastReturnAt: readLastReturn(),
    })
  )
    return false;
  writeLastReturn(Date.now());
  (opts.go ?? ((url: string) => window.location.assign(url)))(tdmpStartUrl({ next: path }));
  return true;
}

// ── Users ───────────────────────────────────────────────────────────────────

export type AuthSource = "local" | "tdmp" | "partner";

/** True for accounts that sign in through TDMP (no password here). */
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

/** Where a school's profile comes from, for directory filters and badges. */
export type SchoolSource = "tdmp" | "missing" | "local";

export function schoolSource(school: {
  tdmpSchoolCode?: string | null;
  tdmpData?: { missingFromTdmp?: boolean } | null;
}): SchoolSource {
  if (!isTdmpLinked(school)) return "local";
  return school.tdmpData?.missingFromTdmp ? "missing" : "tdmp";
}

export const SCHOOL_SOURCE_LABEL: Record<SchoolSource, string> = {
  tdmp: "From TDMP",
  missing: "Missing from TDMP",
  local: "RTB GIS only",
};

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

/** Whether "Sign in with TDMP" can work with what the server has. */
export interface SignInReadiness {
  authMode: AuthProviders["authMode"];
  accessSource: "local" | "tdmp";
  clientConfigured: boolean;
  /** TDMP's answer to our client ID + secret; null = not configured. */
  credentials: "accepted" | "rejected" | "unreachable" | null;
  /** RS256 keys TDMP publishes for ID tokens; null = not readable. */
  signingKeys: number | null;
  issuerMatches: boolean | null;
  redirectUri: string;
  launchUrl: string;
  sessionMaxHours: number;
}

/** True once TDMP accepts our client and publishes its signing keys. */
export function signInReady(s: SignInReadiness | null | undefined): boolean {
  return !!s && s.credentials === "accepted" && (s.signingKeys ?? 0) > 0 && s.issuerMatches !== false;
}

export interface ConnectionReport {
  checkedAt: string;
  /** Absent on servers older than the sign-in check. */
  signIn?: SignInReadiness;
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

// ── Data coverage: what we need from TDMP, and what is live today ───────────

export interface CoverageField {
  label: string;
  /** The request that unlocks it; none = live with today's access. */
  request?: string;
  /** Also live when that request is only partly met (e.g. sign-in works without prompt=none). */
  partialOk?: boolean;
}

export interface CoverageArea {
  id: "profile" | "enrolment" | "staffing" | "identity";
  title: string;
  priority: "P1" | "P1/P2" | "P3";
  summary: string;
  fields: CoverageField[];
}

/** The four data areas agreed with TDMP (docs/TDMP_INTEGRATION_PLAN.md §1). */
export const TDMP_COVERAGE: CoverageArea[] = [
  {
    id: "profile",
    title: "School profile",
    priority: "P1",
    summary: "Code, name, type, status, location and year established.",
    fields: [
      { label: "Code and name" },
      { label: "Type (TSS / VTC)" },
      { label: "Status" },
      { label: "Location names and ids" },
      { label: "Ownership" },
      { label: "Year established" },
    ],
  },
  {
    id: "enrolment",
    title: "Enrolment",
    priority: "P1",
    summary: "Learner totals, programmes, learners per programme, seats.",
    fields: [
      { label: "Learner total" },
      { label: "Programme codes" },
      { label: "Programme names", request: "R1" },
      { label: "Learners per programme", request: "R1" },
      { label: "Learners by gender", request: "R1" },
      { label: "Seat capacity", request: "R2" },
    ],
  },
  {
    id: "staffing",
    title: "Staffing",
    priority: "P1",
    summary: "Teacher totals per school.",
    fields: [{ label: "Teacher total" }],
  },
  {
    id: "identity",
    title: "Sign-in",
    priority: "P1",
    summary: "Single sign-on with TDMP accounts. Roles and areas are set in RTB GIS until TDMP sends them.",
    fields: [
      { label: "Sign-in registration", request: "R6", partialOk: true },
      { label: "Role at sign-in (later)", request: "R7" },
      { label: "Area at sign-in (later)", request: "R8" },
      { label: "MFA done in TDMP", request: "R9" },
    ],
  },
];

export interface FieldCoverage extends CoverageField {
  live: boolean;
}

/** Each field of an area, marked live or waiting given where the requests stand. */
export function areaCoverage(
  area: CoverageArea,
  requests: Pick<RequestStatus, "id" | "state">[] | undefined,
): { fields: FieldCoverage[]; live: number; total: number } {
  const state = (id?: string) => requests?.find((r) => r.id === id)?.state;
  const fields = area.fields.map((f) => {
    const s = state(f.request);
    return { ...f, live: !f.request || s === "done" || (!!f.partialOk && s === "partial") };
  });
  return { fields, live: fields.filter((f) => f.live).length, total: fields.length };
}

/** Share of all needed fields that are live (0–100). */
export function overallCoverage(requests: Pick<RequestStatus, "id" | "state">[] | undefined): number {
  let live = 0;
  let total = 0;
  for (const a of TDMP_COVERAGE) {
    const c = areaCoverage(a, requests);
    live += c.live;
    total += c.total;
  }
  return total ? Math.round((live / total) * 100) : 0;
}
