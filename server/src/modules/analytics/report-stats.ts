/**
 * report-stats.ts
 *
 * Every Issue Report figure shown on the school dashboard — overview card,
 * Issue Reports tab, risk panel — comes from these pure functions over the
 * SAME uncapped row set, so the counts always agree with each other and with
 * the resolution score component. Data change requests are not issues and
 * are excluded everywhere. Months and days are Africa/Kigali calendar units.
 */
import { ReportStatus } from '../reports/entities/issue-report.entity';
import { isIssueReport } from './scoring-engine';

export const REPORT_TIME_ZONE = 'Africa/Kigali';
const DAY_MS = 86_400_000;

export interface ReportRow {
  id: string;
  status: ReportStatus;
  type?: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  issueCategory?: string[] | null;
  facilityId?: string | null;
  buildingId?: string | null;
  description?: string | null;
  reporter?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

export interface StatusCounts {
  pending: number;
  needIntervention: number;
  solved: number;
  failed: number;
}

export interface IssueReportSummary {
  total: number;
  /** "Needs Intervention" reports (status, not a severity). */
  critical: number;
  pending: number;
  resolved: number;
  failed: number;
  active: number;
  /** Resolved ÷ all Issue Reports × 100 (integer); null without reports. */
  resolutionRate: number | null;
  /** Mean days created → resolved over SOLVED reports with a valid resolution date (1 dp). */
  avgResolutionDays: number | null;
  /** Age in days of the oldest open report; null when none are open. */
  oldestOpenDays: number | null;
  recentCritical: Array<{
    id: string;
    facilityId: string;
    description: string;
    status: string;
    buildingId: string | null;
    createdAt: string;
  }>;
}

const ms = (d: Date | string | null | undefined): number | null => {
  if (d == null) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Issue Reports only (change requests dropped). */
export const issueReportsOnly = <T extends { type?: string | null }>(
  rows: T[],
): T[] => rows.filter(isIssueReport);

export function countByStatus(rows: ReportRow[]): StatusCounts {
  const c: StatusCounts = {
    pending: 0,
    needIntervention: 0,
    solved: 0,
    failed: 0,
  };
  for (const r of rows) {
    if (r.status === ReportStatus.PENDING) c.pending++;
    else if (r.status === ReportStatus.NEED_INTERVENTION) c.needIntervention++;
    else if (r.status === ReportStatus.SOLVED) c.solved++;
    else if (r.status === ReportStatus.FAILED) c.failed++;
  }
  return c;
}

/**
 * Mean resolution time. Only SOLVED reports count (a reopened report keeps no
 * resolution date), and a resolution date before the creation date is bad data
 * and skipped rather than averaged in as a negative duration.
 */
export function averageResolutionDays(rows: ReportRow[]): number | null {
  const durations: number[] = [];
  for (const r of rows) {
    if (r.status !== ReportStatus.SOLVED) continue;
    const c = ms(r.createdAt);
    const s = ms(r.resolvedAt);
    if (c === null || s === null || s < c) continue;
    durations.push((s - c) / DAY_MS);
  }
  if (durations.length === 0) return null;
  return (
    Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) /
    10
  );
}

export function summariseIssueReports(
  allRows: ReportRow[],
  now: Date,
): IssueReportSummary {
  const rows = issueReportsOnly(allRows);
  const c = countByStatus(rows);
  const total = rows.length;
  const open = rows.filter((r) => r.status !== ReportStatus.SOLVED);
  const oldestOpen = open.reduce<number | null>((min, r) => {
    const t = ms(r.createdAt);
    return t === null ? min : min === null ? t : Math.min(min, t);
  }, null);
  const byNewest = (a: ReportRow, b: ReportRow) =>
    (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0);
  return {
    total,
    critical: c.needIntervention,
    pending: c.pending,
    resolved: c.solved,
    failed: c.failed,
    active: c.pending + c.needIntervention + c.failed,
    resolutionRate: total > 0 ? Math.round((c.solved / total) * 100) : null,
    avgResolutionDays: averageResolutionDays(rows),
    oldestOpenDays:
      oldestOpen === null
        ? null
        : Math.max(0, Math.floor((now.getTime() - oldestOpen) / DAY_MS)),
    recentCritical: rows
      .filter((r) => r.status === ReportStatus.NEED_INTERVENTION)
      .sort(byNewest)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        facilityId: r.facilityId ?? '',
        description: r.description ?? '',
        status: String(r.status),
        buildingId: r.buildingId ?? null,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
  };
}

// ─── Kigali calendar helpers ──────────────────────────────────────────────────

const ymFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});
const labelFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIME_ZONE,
  month: 'short',
  year: 'numeric',
});

/** "YYYY-MM" of an instant in Kigali time. */
export function kigaliMonthKey(d: Date | string): string {
  const parts = ymFmt.formatToParts(new Date(d));
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

/** The last `n` Kigali months ending with the month of `now`, oldest first. */
export function lastKigaliMonths(
  now: Date,
  n = 12,
): Array<{ key: string; label: string }> {
  const [y, m] = kigaliMonthKey(now).split('-').map(Number);
  const out: Array<{ key: string; label: string }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    // Mid-month UTC noon never crosses a month boundary in any zone.
    const mid = new Date(Date.UTC(yy, mm - 1, 15, 12));
    out.push({
      key: `${yy}-${String(mm).padStart(2, '0')}`,
      label: labelFmt.format(mid),
    });
  }
  return out;
}

/** % change; null when there is no previous value to compare against. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export interface MonthBucket {
  key: string;
  label: string;
  /** Issue Reports filed in the month. */
  created: number;
  /** Issue Reports resolved in the month (by resolution date). */
  resolved: number;
}

export interface ReportTrends {
  months: MonthBucket[];
  comparison: {
    current: { key: string; created: number; resolved: number };
    previous: { key: string; created: number; resolved: number };
    /** % change in reports filed; null when last month had none. */
    createdChangePct: number | null;
    /** % change in reports resolved; null when last month had none. */
    resolvedChangePct: number | null;
  };
  /** Category TAG counts — a report with two categories counts in both. */
  categoryTags: Record<string, number>;
  statusCounts: StatusCounts;
}

export function reportTrends(allRows: ReportRow[], now: Date): ReportTrends {
  const rows = issueReportsOnly(allRows);
  const months: MonthBucket[] = lastKigaliMonths(now, 12).map((m) => ({
    ...m,
    created: 0,
    resolved: 0,
  }));
  const byKey = new Map(months.map((m) => [m.key, m]));
  const categoryTags: Record<string, number> = {};

  for (const r of rows) {
    const created = byKey.get(kigaliMonthKey(r.createdAt));
    if (created) created.created++;
    if (r.status === ReportStatus.SOLVED && ms(r.resolvedAt) !== null) {
      const solved = byKey.get(kigaliMonthKey(r.resolvedAt as Date));
      if (solved) solved.resolved++;
    }
    for (const cat of Array.isArray(r.issueCategory) ? r.issueCategory : []) {
      const k = String(cat).trim().toLowerCase();
      if (k) categoryTags[k] = (categoryTags[k] ?? 0) + 1;
    }
  }

  const cur = months[months.length - 1];
  const prev = months[months.length - 2];
  return {
    months,
    comparison: {
      current: { key: cur.key, created: cur.created, resolved: cur.resolved },
      previous: {
        key: prev.key,
        created: prev.created,
        resolved: prev.resolved,
      },
      createdChangePct: pctChange(cur.created, prev.created),
      resolvedChangePct: pctChange(cur.resolved, prev.resolved),
    },
    categoryTags,
    statusCounts: countByStatus(rows),
  };
}

// ─── Buildings needing attention ──────────────────────────────────────────────

export interface AttentionBuilding {
  id: string;
  name?: string | null;
  yearBuilt?: number | string | null;
  /** Assessed condition; null = not assessed. */
  condition?: string | null;
}

export interface BuildingAttentionRow {
  buildingId: string;
  name: string;
  yearBuilt: number | null;
  condition: string | null;
  pending: number;
  intervention: number;
  failed: number;
  lastReportAt: string | null;
  lastReporter: string | null;
  /** Priority-style key for the badge. */
  severity: 'critical' | 'high' | 'medium';
}

const CONDITION_WEIGHT: Record<string, number> = {
  critical: 400,
  poor: 300,
  fair: 200,
  good: 100,
};

/**
 * Up to `max` buildings ranked by OPEN Issue Reports (Needs Intervention >
 * Failed > Pending, then assessed condition), topped up with assessed
 * poor/critical buildings that have no open report. Solved reports and data
 * change requests never put a building on the list.
 */
export function buildingsNeedingAttention(
  allRows: ReportRow[],
  buildings: AttentionBuilding[],
  max = 3,
): BuildingAttentionRow[] {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const agg = new Map<
    string,
    {
      pending: number;
      intervention: number;
      failed: number;
      last: ReportRow | null;
    }
  >();
  for (const r of issueReportsOnly(allRows)) {
    if (!r.buildingId || r.status === ReportStatus.SOLVED) continue;
    const a = agg.get(r.buildingId) ?? {
      pending: 0,
      intervention: 0,
      failed: 0,
      last: null,
    };
    if (r.status === ReportStatus.PENDING) a.pending++;
    else if (r.status === ReportStatus.NEED_INTERVENTION) a.intervention++;
    else if (r.status === ReportStatus.FAILED) a.failed++;
    if (!a.last || (ms(r.createdAt) ?? 0) >= (ms(a.last.createdAt) ?? 0))
      a.last = r;
    agg.set(r.buildingId, a);
  }

  const reporterName = (r: ReportRow | null): string | null => {
    const p = r?.reporter;
    if (!p) return null;
    return (
      [p.firstName, p.lastName].filter(Boolean).join(' ').trim() ||
      p.email ||
      null
    );
  };
  const year = (v: unknown) => {
    const n = Number(v);
    return v != null && Number.isFinite(n) ? n : null;
  };
  const condWeight = (c?: string | null) =>
    CONDITION_WEIGHT[String(c ?? '')] ?? 0;

  const rows = [...agg.entries()].map(([id, a]) => {
    const b = byId.get(id);
    const row: BuildingAttentionRow = {
      buildingId: id,
      name: b?.name || 'Building',
      yearBuilt: year(b?.yearBuilt),
      condition: b?.condition ?? null,
      pending: a.pending,
      intervention: a.intervention,
      failed: a.failed,
      lastReportAt: a.last ? new Date(a.last.createdAt).toISOString() : null,
      lastReporter: reporterName(a.last),
      severity:
        a.intervention > 0 ? 'critical' : a.failed > 0 ? 'high' : 'medium',
    };
    return {
      row,
      rank:
        a.intervention * 100 +
        a.failed * 40 +
        a.pending * 10 +
        condWeight(b?.condition),
    };
  });
  rows.sort((x, y) => y.rank - x.rank);
  const out = rows.slice(0, max).map((x) => x.row);

  if (out.length < max) {
    const used = new Set(out.map((r) => r.buildingId));
    const rest = buildings
      .filter(
        (b) =>
          !used.has(b.id) &&
          (b.condition === 'critical' || b.condition === 'poor'),
      )
      .sort((a, b) => condWeight(b.condition) - condWeight(a.condition));
    for (const b of rest) {
      if (out.length >= max) break;
      out.push({
        buildingId: b.id,
        name: b.name || 'Building',
        yearBuilt: year(b.yearBuilt),
        condition: b.condition ?? null,
        pending: 0,
        intervention: 0,
        failed: 0,
        lastReportAt: null,
        lastReporter: null,
        severity: b.condition === 'critical' ? 'critical' : 'high',
      });
    }
  }
  return out;
}

// ─── Reporting overview (all schools in the caller's scope) ───────────────────

export const REPORTING_PERIODS = ['30d', '90d', '12m', 'all'] as const;
export type ReportingPeriod = (typeof REPORTING_PERIODS)[number];
const PERIOD_DAYS: Record<ReportingPeriod, number | null> = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
  all: null,
};

export interface OverviewSchool {
  id: string;
  name: string;
  code?: string | null;
  district?: string | null;
  province?: string | null;
}

export interface OverviewReportRow extends ReportRow {
  schoolId: string;
}

export interface TrendBucket {
  key: string;
  label: string;
  created: number;
  resolved: number;
}

export interface SchoolReportingRow {
  schoolId: string;
  name: string;
  code: string | null;
  district: string | null;
  province: string | null;
  total: number;
  /** Pending + Needs Intervention + Failed (same rule as the summary). */
  open: number;
  needIntervention: number;
  resolved: number;
  resolutionRate: number | null;
  oldestOpenDays: number | null;
}

export interface ReportingOverview {
  period: ReportingPeriod;
  from: string | null;
  to: string;
  bucket: 'day' | 'week' | 'month';
  summary: Omit<IssueReportSummary, 'recentCritical'>;
  statusCounts: StatusCounts;
  schoolsAffected: number;
  /** Active schools in scope — the denominator for "schools affected". */
  schoolCount: number;
  /** Same figures for the previous window of equal length; null for "all". */
  previous: {
    total: number;
    resolved: number;
    resolutionRate: number | null;
  } | null;
  /** % change in reports filed vs the previous window; null without a base. */
  totalChangePct: number | null;
  trend: TrendBucket[];
  /** Schools with reports in the window, most urgent first. */
  schools: SchoolReportingRow[];
  /** Newest "Needs Intervention" reports in the window. */
  urgent: Array<{
    id: string;
    schoolId: string;
    schoolName: string;
    description: string;
    facilityId: string | null;
    createdAt: string;
  }>;
}

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayLabelFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});
/** "YYYY-MM-DD" of an instant in Kigali time. */
export const kigaliDayKey = (d: Date | string): string =>
  dayFmt.format(new Date(d));

/**
 * Trend buckets ending today (Kigali): 30 days → daily, 90 days → 13 weekly
 * buckets, 12 months / all → monthly (12 or 24). Filed by creation date,
 * resolved by resolution date.
 */
function trendBuckets(
  rows: ReportRow[],
  period: ReportingPeriod,
  now: Date,
): { bucket: ReportingOverview['bucket']; trend: TrendBucket[] } {
  if (period === '12m' || period === 'all') {
    const months = lastKigaliMonths(now, period === '12m' ? 12 : 24).map(
      (m) => ({ ...m, created: 0, resolved: 0 }),
    );
    const at = new Map(months.map((m, i) => [m.key, i]));
    for (const r of rows) {
      const c = at.get(kigaliMonthKey(r.createdAt));
      if (c !== undefined) months[c].created++;
      if (r.status === ReportStatus.SOLVED && ms(r.resolvedAt) !== null) {
        const s = at.get(kigaliMonthKey(r.resolvedAt as Date | string));
        if (s !== undefined) months[s].resolved++;
      }
    }
    return { bucket: 'month', trend: months };
  }

  // Kigali has no DST, so whole-day steps back from now land on each day.
  const days = period === '30d' ? 30 : 91;
  const step = period === '30d' ? 1 : 7;
  const dayKeys = Array.from({ length: days }, (_, i) =>
    kigaliDayKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS)),
  );
  const dayIndex = new Map(dayKeys.map((k, i) => [k, i]));
  const trend: TrendBucket[] = [];
  for (let i = 0; i < days; i += step) {
    const first = new Date(now.getTime() - (days - 1 - i) * DAY_MS);
    trend.push({
      key: dayKeys[i],
      label: dayLabelFmt.format(first),
      created: 0,
      resolved: 0,
    });
  }
  const slot = (d: Date | string | null | undefined) => {
    if (ms(d) === null) return undefined;
    const i = dayIndex.get(kigaliDayKey(d as Date | string));
    return i === undefined ? undefined : Math.floor(i / step);
  };
  for (const r of rows) {
    const c = slot(r.createdAt);
    if (c !== undefined) trend[c].created++;
    if (r.status === ReportStatus.SOLVED) {
      const s = slot(r.resolvedAt);
      if (s !== undefined) trend[s].resolved++;
    }
  }
  return { bucket: period === '30d' ? 'day' : 'week', trend };
}

/**
 * Network-wide Issue Report figures for one period, from the same rules as
 * the school dashboard (summariseIssueReports), so a school's numbers agree
 * on both pages. Change requests are excluded.
 */
export function reportingOverview(
  allRows: OverviewReportRow[],
  schools: OverviewSchool[],
  period: ReportingPeriod,
  now: Date,
): ReportingOverview {
  const rows = issueReportsOnly(allRows);
  const days = PERIOD_DAYS[period];
  const from = days === null ? null : now.getTime() - days * DAY_MS;
  const inWindow = rows.filter((r) => {
    const t = ms(r.createdAt);
    return t !== null && (from === null || t >= from);
  });
  const prevRows =
    from === null || days === null
      ? null
      : rows.filter((r) => {
          const t = ms(r.createdAt);
          return t !== null && t >= from - days * DAY_MS && t < from;
        });

  const { recentCritical: _drop, ...summary } = summariseIssueReports(
    inWindow,
    now,
  );
  void _drop;
  const prevSummary = prevRows ? summariseIssueReports(prevRows, now) : null;

  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const bySchool = new Map<string, OverviewReportRow[]>();
  for (const r of inWindow) {
    const list = bySchool.get(r.schoolId) ?? [];
    list.push(r);
    bySchool.set(r.schoolId, list);
  }
  const schoolRows: SchoolReportingRow[] = [...bySchool.entries()].map(
    ([id, list]) => {
      const s = summariseIssueReports(list, now);
      const info = schoolById.get(id);
      return {
        schoolId: id,
        name: info?.name ?? 'Unknown school',
        code: info?.code ?? null,
        district: info?.district ?? null,
        province: info?.province ?? null,
        total: s.total,
        open: s.active,
        needIntervention: s.critical,
        resolved: s.resolved,
        resolutionRate: s.resolutionRate,
        oldestOpenDays: s.oldestOpenDays,
      };
    },
  );
  schoolRows.sort(
    (a, b) =>
      b.needIntervention - a.needIntervention ||
      b.open - a.open ||
      (b.oldestOpenDays ?? -1) - (a.oldestOpenDays ?? -1) ||
      a.name.localeCompare(b.name),
  );

  const urgent = inWindow
    .filter((r) => r.status === ReportStatus.NEED_INTERVENTION)
    .sort((a, b) => (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      schoolId: r.schoolId,
      schoolName: schoolById.get(r.schoolId)?.name ?? 'Unknown school',
      description: r.description ?? '',
      facilityId: r.facilityId ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    }));

  // All rows: a report filed earlier but resolved in the window still counts as resolved there.
  const { bucket, trend } = trendBuckets(rows, period, now);
  return {
    period,
    from: from === null ? null : new Date(from).toISOString(),
    to: now.toISOString(),
    bucket,
    summary,
    statusCounts: countByStatus(inWindow),
    schoolsAffected: bySchool.size,
    schoolCount: schools.length,
    previous: prevSummary
      ? {
          total: prevSummary.total,
          resolved: prevSummary.resolved,
          resolutionRate: prevSummary.resolutionRate,
        }
      : null,
    totalChangePct: prevSummary
      ? pctChange(summary.total, prevSummary.total)
      : null,
    trend,
    schools: schoolRows.slice(0, 50),
    urgent,
  };
}
