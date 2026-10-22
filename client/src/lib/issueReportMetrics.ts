/**
 * Display helpers for Issue Reports. Every count, rate, trend and ranking is
 * computed by the server (GET /schools/dashboard/reporting and
 * /analytics/schools/:id/metrics → reportSummary); nothing is recounted here.
 */

/** Mirrors server `ReportStatus`. */
export type ReportStatusUpper =
  | "PENDING"
  | "SOLVED"
  | "NEED_INTERVENTION"
  | "FAILED";

export function normalizeReportStatus(status: unknown): ReportStatusUpper {
  const s = String(status ?? "")
    .trim()
    .toUpperCase();
  if (
    s === "PENDING" ||
    s === "SOLVED" ||
    s === "NEED_INTERVENTION" ||
    s === "FAILED"
  ) {
    return s;
  }
  return "PENDING";
}

/** Minimal Issue Report shape for list rows. */
export interface IssueReportLike {
  status?: unknown;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  resolvedAt?: string | Date | null;
  buildingId?: string | null;
  reporter?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
}

/** "+12.5% vs last month"; "—" when there is nothing to compare against. */
export function formatTrendPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return "—";
  }
  if (pct === 0) return "0% vs last month";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs last month`;
}

const KIGALI_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Kigali",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Days since the epoch of the Kigali calendar date of an instant. */
function kigaliDayNumber(d: Date): number {
  const [y, m, day] = KIGALI_DAY.format(d).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000);
}

/**
 * "Today", "Yesterday", "3d ago" — in Kigali CALENDAR days, so a report filed
 * at 23:00 yesterday reads "Yesterday", not "Today" (24-hour blocks did).
 */
export function formatDaysAgo(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  const days = kigaliDayNumber(now) - kigaliDayNumber(t);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
