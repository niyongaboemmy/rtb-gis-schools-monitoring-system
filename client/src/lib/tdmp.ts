/**
 * TDMP (TVET Data Management Platform) integration — shared client pieces.
 *
 * TDMP is the source of truth for users and school information; RTB GIS keeps
 * GPS and all GIS work. Users sign in through TDMP (OAuth, handled by the
 * server under /auth/tdmp/*), and schools are synced from TDMP by the server.
 */
import { api, API_BASE } from "./api";
import { titleCase } from "./labels";
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
  "totalStudents",
  "maleStudents",
  "femaleStudents",
  "totalTeachers",
  "maleTeachers",
  "femaleTeachers",
  "headTeacher",
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

export type TdmpInfraGroup =
  | "buildings"
  | "ict"
  | "sanitation"
  | "housing"
  | "utilities"
  | "healthAndSafety"
  | "food"
  | "books";

/** `school.tdmpData` — the TDMP snapshot stored at the last sync. */
export interface TdmpSchoolData {
  ownership?: string | null;
  institutionType?: string | null;
  schoolCategory?: string | null;
  schoolStatus?: string | null;
  trades?: string[];
  counts?: { teachers?: number; students?: number; trades?: number; levels?: number; modules?: number };
  infrastructure?: Partial<Record<TdmpInfraGroup | string, Record<string, number | boolean | string | null>>> | null;
  staff?: { maleTeachers?: number; femaleTeachers?: number; headTeacher?: string | null };
}

export interface TdmpLinkFields {
  tdmpSchoolId?: number | null;
  tdmpSchoolCode?: string | null;
  tdmpSyncedAt?: string | null;
  tdmpData?: TdmpSchoolData | null;
}

/** GET /schools/:id/staff */
export interface TdmpStaffMember {
  id: number | string;
  names: string | null;
  gender: string | null;
  positionName: string | null;
  qualificationLevel: string | null;
  staffType: string | null;
  employmentStatus: string | null;
  isHeadTeacher: boolean | null;
  isDeputyHeadTeacher: boolean | null;
}

export interface TdmpStaffResponse {
  source: "tdmp";
  fetchedAt: string;
  staff: TdmpStaffMember[];
}

/** Display order and names of the infrastructure groups. */
export const TDMP_INFRA_GROUPS: { key: TdmpInfraGroup; label: string }[] = [
  { key: "buildings", label: "Buildings" },
  { key: "ict", label: "ICT" },
  { key: "utilities", label: "Water & power" },
  { key: "sanitation", label: "Sanitation" },
  { key: "housing", label: "Boarding" },
  { key: "healthAndSafety", label: "Health & safety" },
  { key: "food", label: "Food" },
  { key: "books", label: "Books" },
];

/** Infrastructure keys whose camel-case split reads badly. */
const INFRA_KEY_LABELS: Record<string, string> = {
  workshopLabs: "Workshops & labs",
  agriVeterinaryLabs: "Agri / veterinary labs",
  specialGirlsRooms: "Girls' rooms",
  computersTotal: "Computers (total)",
  computersLearners: "Computers for learners",
  computersTeachers: "Computers for teachers",
  labWorkingLaptops: "Working lab laptops",
  labWorkingDesktops: "Working lab desktops",
  labServers: "Lab servers",
  hasInternet: "Internet",
  internetProviders: "Internet providers",
  connectionTypes: "Connection types",
  toiletsTotal: "Toilets (total)",
  toiletsPupils: "Toilets for students",
  toiletsStaff: "Toilets for staff",
  toiletsDisability: "Accessible toilets",
  toiletsFemale: "Toilets (female)",
  toiletsMale: "Toilets (male)",
  toiletsFlush: "Flush toilets",
  toiletsLatrines: "Latrines",
  dormitoriesBoys: "Dormitories (boys)",
  dormitoriesGirls: "Dormitories (girls)",
  tapWaterSupply: "Tap water points",
  rainWaterSystems: "Rainwater systems",
  hasGridElectricity: "Grid electricity",
  hasSolarPower: "Solar power",
  bedsInSickBay: "Sick-bay beds",
  booksStudents: "Books for students",
  booksTeachers: "Books for teachers",
  booksTotal: "Books (total)",
};

export function infraKeyLabel(key: string): string {
  if (INFRA_KEY_LABELS[key]) return INFRA_KEY_LABELS[key];
  // "classroomDesks" → "Classroom desks": sentence case like the rest of the UI.
  const text = titleCase(key);
  return (text.charAt(0) + text.slice(1).toLowerCase()).replace(/\bict\b/gi, "ICT");
}

export function infraValueLabel(value: number | boolean | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

// ── Admin (Settings ▸ TDMP) ─────────────────────────────────────────────────

export interface SyncTotals {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  linked: number;
  skippedNoGps: number;
  failed: number;
}

export interface SyncRun {
  id: string;
  trigger: "schedule" | "manual";
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  totals: SyncTotals;
  errors: string[];
  triggeredBy: string | null;
}

export interface TdmpStatus {
  enabled: { login: boolean; sync: boolean };
  authMode: AuthProviders["authMode"];
  running: boolean;
  lastRun: SyncRun | null;
  linkedSchools: number;
  unlinkedSchools: number;
}

export interface UnlinkedSchool {
  id: string;
  code: string;
  name: string;
  district: string | null;
  hasGisData: boolean;
}
