/** Mirrors server `ReportStatus` — issue reports have no separate priority field. */

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

export function isActiveReportStatus(status: unknown): boolean {
  const s = normalizeReportStatus(status);
  return s === "PENDING" || s === "NEED_INTERVENTION" || s === "FAILED";
}

/** UI tier derived from IssueReport.status (no priority column in DB). */
export type IssueSeverityLabel = "Critical" | "High" | "Medium" | "Low";

export function severityLabelFromStatus(
  status: unknown,
): IssueSeverityLabel {
  const s = normalizeReportStatus(status);
  if (s === "NEED_INTERVENTION") return "Critical";
  if (s === "FAILED") return "High";
  if (s === "PENDING") return "Medium";
  if (s === "SOLVED") return "Low";
  return "Medium";
}

export interface ReportingRollup {
  totalReports: number;
  /** Non-SOLVED reports (open workload) */
  activeIssues: number;
  resolvedIssues: number;
  needIntervention: number;
  statusCounts: {
    pending: number;
    needIntervention: number;
    solved: number;
    failed: number;
  };
  resolutionRate: number;
  avgResolutionDays: number;
  monthComparison: {
    current: {
      pending: number;
      needIntervention: number;
      solved: number;
      failed: number;
      activeCreated: number;
    };
    previous: {
      pending: number;
      needIntervention: number;
      solved: number;
      failed: number;
      activeCreated: number;
    };
    activeChangePct: number | null;
    solvedChangePct: number | null;
  };
}

function emptyMonth() {
  return {
    pending: 0,
    needIntervention: 0,
    solved: 0,
    failed: 0,
    activeCreated: 0,
  };
}

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export function rollupIssueReports(reports: any[]): ReportingRollup {
  const list = Array.isArray(reports) ? reports : [];
  const statusCounts = {
    pending: 0,
    needIntervention: 0,
    solved: 0,
    failed: 0,
  };

  let resolvedIssues = 0;
  let needIntervention = 0;
  let sumResolutionDays = 0;
  let resolutionSamples = 0;

  const now = new Date();
  const curYm = now.getFullYear() * 12 + now.getMonth();
  const prevYm = curYm - 1;
  let monthCurrent = emptyMonth();
  let monthPrevious = emptyMonth();

  for (const r of list) {
    const st = normalizeReportStatus(r?.status);
    if (st === "PENDING") {
      statusCounts.pending += 1;
    } else if (st === "NEED_INTERVENTION") {
      statusCounts.needIntervention += 1;
      needIntervention += 1;
    } else if (st === "SOLVED") {
      statusCounts.solved += 1;
      resolvedIssues += 1;
    } else if (st === "FAILED") {
      statusCounts.failed += 1;
    }

    const created = r?.createdAt ? new Date(r.createdAt) : null;
    const updated = r?.updatedAt ? new Date(r.updatedAt) : null;
    if (created && updated && !Number.isNaN(created.getTime())) {
      const days =
        (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        sumResolutionDays += days;
        resolutionSamples += 1;
      }
    }

    if (created && !Number.isNaN(created.getTime())) {
      const rYm = created.getFullYear() * 12 + created.getMonth();
      const snap =
        rYm === curYm ? monthCurrent : rYm === prevYm ? monthPrevious : null;
      if (snap) {
        if (st === "PENDING") snap.pending += 1;
        else if (st === "NEED_INTERVENTION") snap.needIntervention += 1;
        else if (st === "SOLVED") snap.solved += 1;
        else if (st === "FAILED") snap.failed += 1;
        if (isActiveReportStatus(st)) snap.activeCreated += 1;
      }
    }
  }

  const totalReports = list.length;
  const activeIssues = list.filter((r) => isActiveReportStatus(r?.status)).length;
  const resolutionRate =
    totalReports > 0
      ? Math.round((resolvedIssues / totalReports) * 100)
      : 100;
  const avgResolutionDays =
    resolutionSamples > 0 ? sumResolutionDays / resolutionSamples : 0;

  return {
    totalReports,
    activeIssues,
    resolvedIssues,
    needIntervention,
    statusCounts,
    resolutionRate,
    avgResolutionDays,
    monthComparison: {
      current: monthCurrent,
      previous: monthPrevious,
      activeChangePct: pctChange(
        monthCurrent.activeCreated,
        monthPrevious.activeCreated,
      ),
      solvedChangePct: pctChange(monthCurrent.solved, monthPrevious.solved),
    },
  };
}

const CONDITION_SCORE: Record<string, number> = {
  CRITICAL: 400,
  POOR: 300,
  FAIR: 200,
  GOOD: 100,
};

export interface BuildingAttentionRow {
  buildingId: string;
  name: string;
  yearBuilt: number | null;
  pending: number;
  intervention: number;
  failed: number;
  lastReportAt: string | null;
  reporterLabel: string;
  severityLabel: "CRITICAL" | "HIGH" | "MEDIUM";
  score: number;
}

export function buildBuildingsAttention(
  buildings: any[],
  reports: any[],
  max = 3,
): BuildingAttentionRow[] {
  const bmap = new Map<string, any>();
  for (const b of buildings || []) {
    if (b?.id) bmap.set(b.id, b);
  }

  const agg = new Map<
    string,
    {
      pending: number;
      intervention: number;
      failed: number;
      lastAt: number;
      lastReporter: string;
    }
  >();

  for (const r of reports || []) {
    const bid = r?.buildingId;
    if (!bid) continue;
    const st = normalizeReportStatus(r?.status);
    const cur = agg.get(bid) || {
      pending: 0,
      intervention: 0,
      failed: 0,
      lastAt: 0,
      lastReporter: "",
    };
    if (st === "PENDING") cur.pending += 1;
    else if (st === "NEED_INTERVENTION") cur.intervention += 1;
    else if (st === "FAILED") cur.failed += 1;
    const t = r?.createdAt ? new Date(r.createdAt).getTime() : 0;
    if (t >= cur.lastAt) {
      cur.lastAt = t;
      const rep = r?.reporter;
      cur.lastReporter = rep
        ? [rep.firstName, rep.lastName].filter(Boolean).join(" ").trim() ||
          rep.email ||
          "Reporter"
        : "Unknown";
    }
    agg.set(bid, cur);
  }

  const rows: BuildingAttentionRow[] = [];
  for (const [bid, v] of agg) {
    const b = bmap.get(bid);
    const score =
      v.intervention * 100 +
      v.failed * 40 +
      v.pending * 10 +
      (CONDITION_SCORE[String(b?.condition)] || 0);
    const sev: BuildingAttentionRow["severityLabel"] =
      v.intervention > 0 ? "CRITICAL" : v.failed > 0 ? "HIGH" : "MEDIUM";
    rows.push({
      buildingId: bid,
      name: b?.name || `Building ${bid.slice(0, 8)}`,
      yearBuilt: b?.yearBuilt != null ? Number(b.yearBuilt) : null,
      pending: v.pending,
      intervention: v.intervention,
      failed: v.failed,
      lastReportAt: v.lastAt ? new Date(v.lastAt).toISOString() : null,
      reporterLabel: v.lastReporter,
      severityLabel: sev,
      score,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  const out = rows.slice(0, max);

  if (out.length < max) {
    const used = new Set(out.map((r) => r.buildingId));
    const rest = (buildings || [])
      .filter((b) => b?.id && !used.has(b.id))
      .map((b) => ({
        buildingId: b.id,
        name: b.name || "Building",
        yearBuilt: b.yearBuilt != null ? Number(b.yearBuilt) : null,
        pending: 0,
        intervention: 0,
        failed: 0,
        lastReportAt: null as string | null,
        reporterLabel: "—",
        severityLabel: (["CRITICAL", "POOR"].includes(String(b.condition))
          ? "CRITICAL"
          : "MEDIUM") as BuildingAttentionRow["severityLabel"],
        score: CONDITION_SCORE[String(b.condition)] || 0,
      }))
      .sort((a, b) => b.score - a.score);
    for (const r of rest) {
      if (out.length >= max) break;
      out.push(r);
    }
  }

  return out;
}

export function formatTrendPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return "—";
  }
  if (pct === 0) return "0% vs last month";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs last month`;
}

export function formatDaysAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const d = (Date.now() - t) / 86400000;
  if (d < 1) return "Today";
  return `${Math.floor(d)}d ago`;
}
