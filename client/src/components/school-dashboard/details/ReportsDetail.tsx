import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, Clock, RefreshCw, User } from "lucide-react";
import { cn } from "../../../lib/utils";
import { api } from "../../../lib/api";
import { formatDateTime, formatNumber, formatPercent } from "../../../lib/format";
import { formatDaysAgo, normalizeReportStatus, type IssueReportLike } from "../../../lib/issueReportMetrics";
import { MetricInfo } from "../../metric-help/MetricInfo";
import { Skeleton } from "../../ui/skeleton";
import { DashboardError } from "../../dashboard/DashboardStates";
import type { ReportingData } from "../../dashboard/types";
import { REPORT_STATUS } from "../status-colors";
import { StackBar } from "../charts/StackBar";
import { MonthBars } from "../charts/MonthBars";
import { BRAND } from "../tokens";
import { DetailSection, EmptyNote, FilterChips, SegmentedTabs, StatusPill, SummaryStat, SummaryStats } from "./primitives";

/** Recent-reports list size (a list for reading, not a source of counts). */
const RECENT_LIMIT = 50;

const STATUS_BY_API = Object.fromEntries(REPORT_STATUS.map((s) => [s.api, s]));

interface IssueRow extends IssueReportLike {
  id: string;
  description?: string | null;
  building?: { name?: string | null } | null;
}

/** Header figures — all from GET /schools/dashboard/reporting. */
export function ReportsSummary({ data }: { data: ReportingData | null }) {
  const s = data?.summary ?? null;
  const urgent = data?.statusCounts.needIntervention ?? 0;
  return (
    <SummaryStats>
      <SummaryStat label="All reports" value={formatNumber(s?.total ?? null)} hint="filed for this school" />
      <SummaryStat
        label="Open"
        value={formatNumber(s?.active ?? null)}
        hint={urgent > 0 ? `${formatNumber(urgent)} ${urgent === 1 ? "needs" : "need"} action` : "none urgent"}
        accent={urgent > 0 ? REPORT_STATUS[0].color : undefined}
        info={<MetricInfo id="reports.openIssues" size="xs" />}
      />
      <SummaryStat
        label="Fixed"
        value={s?.resolutionRate == null ? "—" : formatPercent(s.resolutionRate)}
        hint={`${formatNumber(s?.resolved ?? null)} of ${formatNumber(s?.total ?? null)}`}
        accent={REPORT_STATUS[3].color}
        meter={s?.resolutionRate ?? null}
        info={<MetricInfo id="reports.resolutionRate" size="xs" />}
      />
      <SummaryStat
        label="Days to fix"
        value={s?.avgResolutionDays == null ? "—" : formatNumber(s.avgResolutionDays, 1)}
        hint={s?.oldestOpenDays != null ? `Oldest open: ${formatNumber(s.oldestOpenDays)} days` : "average"}
      />
    </SummaryStats>
  );
}

interface Props {
  schoolId: string;
  data: ReportingData | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Bump to reload the report list (the footer's Refresh). */
  refreshKey?: number;
}

type Tab = "overview" | "reports";
type Filter = "all" | (typeof REPORT_STATUS)[number]["api"];

/** Status mix and 12-month trend; the latest reports with a status filter. */
export function ReportsDetail({ schoolId, data, loading = false, error = false, onRetry, refreshKey = 0 }: Props) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);

  const loadRows = useCallback(async () => {
    if (!schoolId) return;
    setRowsLoading(true);
    try {
      // Issue Reports only — data change requests are not issues.
      const res = await api.get(`/reports`, { params: { schoolId, type: "issue", limit: RECENT_LIMIT } });
      const raw = res.data?.data ?? [];
      setRows(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error("Failed to fetch recent Issue Reports:", err);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => normalizeReportStatus(r.status) === filter)),
    [rows, filter],
  );

  if (error && !data) return <DashboardError title="We couldn't load the Issue Reports" onRetry={onRetry} retrying={loading} />;
  if (!data) {
    return loading ? (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-48 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    ) : (
      <p className="text-sm text-slate-600 dark:text-white/60">Issue Report figures are not available.</p>
    );
  }

  const total = data.summary.total;
  const counts = data.statusCounts;
  const change = data.comparison.createdChangePct;
  const filed12 = data.months.reduce((a, m) => a + m.created, 0);
  const busiest = data.months.reduce<(typeof data.months)[number] | null>((a, m) => (m.created > (a?.created ?? 0) ? m : a), null);

  return (
    <div className="space-y-6">
      <SegmentedTabs
        idPrefix={id}
        ariaLabel="Issue Report views"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "reports", label: `Reports${total ? ` · ${formatNumber(total)}` : ""}` },
        ]}
      />

      {tab === "overview" && (
        <div role="tabpanel" id={`${id}-panel-overview`} aria-labelledby={`${id}-tab-overview`} className="space-y-8">
          {total === 0 ? (
            <EmptyNote title="No Issue Reports for this school yet">
              School users can report a problem from the Reporting page. Reports appear here as soon as they are filed.
            </EmptyNote>
          ) : (
            <DetailSection title="By status" aside={`${formatNumber(total)} report${total === 1 ? "" : "s"}`}>
              <StackBar
                max={total}
                height={12}
                ariaLabel="Issue Reports by status"
                segments={REPORT_STATUS.map((s) => ({
                  key: s.key,
                  value: counts[s.key],
                  color: s.color,
                  tip: (
                    <span>
                      {s.label}: <b>{formatNumber(counts[s.key])}</b>
                    </span>
                  ),
                }))}
              />
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REPORT_STATUS.map((s) => (
                  <li key={s.key} className="rounded-xl px-3 py-2 ring-1 ring-slate-900/6 dark:ring-white/8">
                    <p className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-white/50">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
                      {s.label}
                    </p>
                    <p className="mt-0.5 flex items-baseline gap-1.5">
                      <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(counts[s.key])}</span>
                      <span className="text-[13px] tabular-nums text-slate-400 dark:text-white/40">{formatPercent((counts[s.key] / total) * 100)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}

          <DetailSection
            title="Last 12 months"
            aside={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  <b className="font-semibold text-slate-700 dark:text-white/80">{formatNumber(filed12)}</b> filed
                </span>
                {busiest && (
                  <span>
                    Busiest <b className="font-semibold text-slate-700 dark:text-white/80">{busiest.label}</b>
                  </span>
                )}
                {change != null && (
                  <span className={cn("inline-flex items-center gap-0.5", change > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
                    {change > 0 ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : <ArrowDownRight className="h-3 w-3" aria-hidden />}
                    {formatPercent(Math.abs(change))} vs last month
                  </span>
                )}
              </span>
            }
          >
            {filed12 === 0 ? (
              <EmptyNote title="No reports filed in the last 12 months" />
            ) : (
              <MonthBars
                ariaLabel={`Reports filed and resolved per month: ${data.months.map((m) => `${m.label} ${m.created} filed, ${m.resolved} resolved`).join("; ")}`}
                series={[
                  { key: "created", label: "Reported", color: BRAND },
                  { key: "resolved", label: "Fixed", color: REPORT_STATUS[3].color },
                ]}
                data={data.months.map((m) => ({ key: m.key, label: m.label, values: { created: m.created, resolved: m.resolved } }))}
              />
            )}
            <p className="text-[13px] text-slate-400 dark:text-white/40">Kigali calendar months.</p>
          </DetailSection>
        </div>
      )}

      {tab === "reports" && (
        <div role="tabpanel" id={`${id}-panel-reports`} aria-labelledby={`${id}-tab-reports`} className="space-y-4">
          <FilterChips<Filter>
            ariaLabel="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all", label: "All", count: total },
              ...REPORT_STATUS.map((s) => ({ key: s.api, label: s.label, count: counts[s.key], color: s.color })),
            ]}
          />

          {rowsLoading ? (
            <div className="space-y-2" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyNote title={rows.length === 0 ? "No Issue Reports for this school yet" : "No reports match this filter"} />
          ) : (
            <>
              <ul className="space-y-2">
                {shown.map((r) => {
                  const st = STATUS_BY_API[normalizeReportStatus(r.status) as string] ?? REPORT_STATUS[1];
                  const reporter = r.reporter
                    ? [r.reporter.firstName, r.reporter.lastName].filter(Boolean).join(" ").trim() || r.reporter.email
                    : null;
                  return (
                    <li
                      key={r.id}
                      className="relative overflow-hidden rounded-2xl bg-slate-900/[0.025] py-3 pl-4 pr-3.5 ring-1 ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8"
                    >
                      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: st.color }} aria-hidden />
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 min-w-0 break-words text-[15px] font-medium leading-snug text-slate-900 dark:text-white/90">
                          {r.description?.trim() ? r.description : `Report ${String(r.id).slice(0, 8)}…`}
                        </p>
                        <StatusPill color={st.color}>{st.label}</StatusPill>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-slate-500 dark:text-white/50">
                        {r.building?.name && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" aria-hidden />
                            {r.building.name}
                          </span>
                        )}
                        {reporter && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" aria-hidden />
                            {reporter}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1" title={formatDateTime(r.createdAt ?? null)}>
                          <Clock className="h-3 w-3" aria-hidden />
                          {formatDaysAgo(r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? null))}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {total > rows.length && (
                <p className="text-center text-[13px] text-slate-500 dark:text-white/45">
                  The {formatNumber(rows.length)} most recent of {formatNumber(total)} reports.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Footer: refresh + when the figures were loaded. */
export function ReportsFooter({
  onRefresh,
  busy,
  error,
  loadedAt,
}: {
  onRefresh: () => void;
  busy?: boolean;
  error?: boolean;
  loadedAt?: Date | null;
}) {
  return (
    <>
      <p className="text-[13px] text-slate-500 dark:text-white/50">
        {error ? "Refresh failed — showing earlier data. " : ""}Updated {loadedAt ? formatDateTime(loadedAt) : "—"}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/10 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60 dark:bg-white/6 dark:text-white/80 dark:ring-white/10 dark:hover:bg-white/10"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin motion-reduce:animate-none")} aria-hidden />
        Refresh
      </button>
    </>
  );
}
