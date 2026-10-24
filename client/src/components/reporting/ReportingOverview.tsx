import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronRight, FileText, RefreshCw, School, Siren } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { formatDateTime, formatNumber, formatPercent } from "../../lib/format";
import { formatDaysAgo } from "../../lib/issueReportMetrics";
import { MetricInfo } from "../metric-help/MetricInfo";
import { FloatingStat } from "../dashboard/FloatingStat";
import { DashboardError } from "../dashboard/DashboardStates";
import { GlassCard } from "../school-dashboard/GlassCard";
import { StackBar } from "../school-dashboard/charts/StackBar";
import { MonthBars } from "../school-dashboard/charts/MonthBars";
import { REPORT_STATUS } from "../school-dashboard/status-colors";
import { BRAND, EASE } from "../school-dashboard/tokens";
import { EmptyNote, SegmentedTabs } from "../school-dashboard/details/primitives";
import { ReportingOverviewSkeleton } from "./ReportingOverviewSkeleton";
import { PERIOD_LABEL, type ReportingOverviewData, type ReportingPeriod } from "./types";

const PERIODS: ReportingPeriod[] = ["30d", "90d", "12m", "all"];

interface Props {
  /** Opens one report (the page's report dialog with triage). */
  onOpenReport: (id: string) => void;
  /** Bump after a report changes status so the figures reload. */
  refreshKey?: number;
}

/**
 * School Reporting overview for staff who see many schools: what was filed,
 * what is still open, which schools need attention first. Every figure comes
 * from GET /schools/dashboard/reporting/overview — the same rules as each
 * school's own dashboard, scoped to the user's access area.
 */
export function ReportingOverview({ onOpenReport, refreshKey = 0 }: Props) {
  const reduce = useReducedMotion();
  const tabsId = useId();
  const [period, setPeriod] = useState<ReportingPeriod>("90d");
  const [data, setData] = useState<ReportingOverviewData | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: ReportingPeriod, signal?: AbortSignal) => {
    setBusy(true);
    try {
      const res = await api.get("/schools/dashboard/reporting/overview", { params: { period: p }, signal });
      setData(res.data?.data ?? null);
      setLoadedAt(new Date());
      setState("ready");
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "CanceledError" && name !== "AbortError") setState((s) => (s === "loading" ? "error" : s));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(period, ctrl.signal);
    return () => ctrl.abort();
  }, [load, period, refreshKey]);

  if (state === "loading" && !data) return <ReportingOverviewSkeleton />;
  if (state === "error" && !data) return <DashboardError title="We couldn't load the reporting overview" onRetry={() => void load(period)} retrying={busy} />;
  if (!data) return null;

  const s = data.summary;
  const counts = data.statusCounts;
  const change = data.totalChangePct;
  const filed = data.trend.reduce((a, b) => a + b.created, 0);

  return (
    <div className="space-y-5">
      {/* Period + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs<ReportingPeriod>
          idPrefix={tabsId}
          ariaLabel="Reporting period"
          value={period}
          onChange={setPeriod}
          tabs={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))}
        />
        <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-white/50">
          <span>Updated {loadedAt ? formatDateTime(loadedAt) : "—"}</span>
          <button
            type="button"
            onClick={() => void load(period)}
            disabled={busy}
            aria-label="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 ring-1 ring-slate-900/10 transition-colors hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60 dark:text-white/60 dark:ring-white/10 dark:hover:bg-white/8"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin motion-reduce:animate-none")} aria-hidden />
          </button>
        </div>
      </div>

      {/* Key figures */}
      <dl className={cn("grid grid-cols-2 gap-3 transition-opacity xl:grid-cols-4", busy && "opacity-70")}>
        <FloatingStat
          index={0}
          compact
          label="Reports"
          value={s.total}
          format={(n) => formatNumber(n)}
          caption={change == null ? `in the last ${PERIOD_LABEL[data.period].toLowerCase()}` : `${change > 0 ? "+" : ""}${formatPercent(change)} vs previous`}
          icon={FileText}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="reports.filed" size="xs" />}
        />
        <FloatingStat
          index={1}
          compact
          label="Still open"
          value={s.active}
          format={(n) => formatNumber(n)}
          caption={counts.needIntervention ? `${formatNumber(counts.needIntervention)} ${counts.needIntervention === 1 ? "needs" : "need"} action` : "none urgent"}
          percent={s.total ? (s.active / s.total) * 100 : null}
          icon={AlertTriangle}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="reports.openIssues" size="xs" />}
        />
        <FloatingStat
          index={2}
          compact
          label="Fixed"
          value={s.resolutionRate}
          format={(n) => formatPercent(n)}
          caption={s.total ? `${formatNumber(s.resolved)} of ${formatNumber(s.total)} · ${s.avgResolutionDays == null ? "no times yet" : `${formatNumber(s.avgResolutionDays, 1)} days avg`}` : "nothing filed"}
          percent={s.resolutionRate}
          icon={CheckCircle2}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="reports.resolutionRate" size="xs" />}
        />
        <FloatingStat
          index={3}
          compact
          label="Schools affected"
          value={data.schoolsAffected}
          format={(n) => formatNumber(n)}
          caption={`of ${formatNumber(data.schoolCount)} active schools`}
          percent={data.schoolCount ? (data.schoolsAffected / data.schoolCount) * 100 : null}
          icon={School}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="reports.schoolsAffected" size="xs" />}
        />
      </dl>

      {/* Status + trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <GlassCard title="By status" icon={FileText} index={0}>
          {s.total === 0 ? (
            <EmptyNote title="No reports in this period" />
          ) : (
            <>
              <StackBar
                max={s.total}
                height={12}
                ariaLabel="Issue Reports by status"
                segments={REPORT_STATUS.map((st) => ({
                  key: st.key,
                  value: counts[st.key],
                  color: st.color,
                  tip: (
                    <span>
                      {st.label}: <b>{formatNumber(counts[st.key])}</b>
                    </span>
                  ),
                }))}
              />
              <ul className="mt-4 space-y-2.5">
                {REPORT_STATUS.map((st) => (
                  <li key={st.key} className="flex items-center gap-2 text-[15px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.color }} aria-hidden />
                    <span className="flex-1 text-slate-600 dark:text-white/65">{st.label}</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(counts[st.key])}</span>
                    <span className="w-10 text-right text-[13px] tabular-nums text-slate-400 dark:text-white/40">{formatPercent((counts[st.key] / s.total) * 100)}</span>
                  </li>
                ))}
              </ul>
              {s.oldestOpenDays != null && (
                <p className="mt-auto pt-4 text-[13px] text-slate-500 dark:text-white/50">
                  Oldest open report: <b className="font-semibold text-slate-800 dark:text-white/85">{formatNumber(s.oldestOpenDays)} days</b>
                </p>
              )}
            </>
          )}
        </GlassCard>

        <GlassCard title="Reported and fixed" icon={ArrowUpRight} index={1}>
          {filed === 0 && data.trend.every((t) => t.resolved === 0) ? (
            <EmptyNote title="No activity in this period" />
          ) : (
            <MonthBars
              height={170}
              ariaLabel={`Reports filed and resolved: ${data.trend.map((t) => `${t.label} ${t.created} filed, ${t.resolved} resolved`).join("; ")}`}
              series={[
                { key: "created", label: "Reported", color: BRAND },
                { key: "resolved", label: "Fixed", color: REPORT_STATUS[3].color },
              ]}
              data={data.trend.map((t) => ({ key: t.key, label: t.label, values: { created: t.created, resolved: t.resolved } }))}
            />
          )}
          <p className="mt-2 text-[13px] text-slate-400 dark:text-white/40">
            {data.bucket === "day" ? "Per day" : data.bucket === "week" ? "Per week" : "Per month"}, Kigali time.
          </p>
        </GlassCard>
      </div>

      {/* Urgent + schools */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <GlassCard title="Needs action" icon={Siren} index={2}>
          {data.urgent.length === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/8 p-3 text-[15px] text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              No urgent reports in this period.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.urgent.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onOpenReport(u.id)}
                    className="relative w-full overflow-hidden rounded-2xl bg-slate-900/[0.03] py-2.5 pl-4 pr-3 text-left ring-1 ring-slate-900/5 transition-colors hover:bg-slate-900/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/[0.04] dark:ring-white/8 dark:hover:bg-white/[0.07]"
                  >
                    <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full" style={{ background: REPORT_STATUS[0].color }} aria-hidden />
                    <span className="line-clamp-2 text-[15px] font-medium leading-snug text-slate-900 dark:text-white/90">{u.description || "No description"}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[13px] text-slate-500 dark:text-white/50">
                      <span className="truncate">{u.schoolName}</span>
                      <span className="shrink-0">{formatDaysAgo(u.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard title="Schools to follow up" icon={School} index={3}>
          {data.schools.length === 0 ? (
            <EmptyNote title="No school filed a report in this period" />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-[13px] font-medium text-slate-400 dark:text-white/40">
                  <tr>
                    <th scope="col" className="w-[42%] px-2 py-2 font-medium">School</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Open</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Needs action</th>
                    <th scope="col" className="px-2 py-2 font-medium">Fixed</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Oldest open</th>
                    <th scope="col" className="w-8 px-2 py-2"><span className="sr-only">Open dashboard</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/5 dark:divide-white/6">
                  {data.schools.slice(0, 10).map((r, i) => (
                    <motion.tr
                      key={r.schoolId}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                      className="group transition-colors hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.03]"
                    >
                      <th scope="row" className="max-w-0 px-2 py-2.5 text-left font-normal">
                        <span className="block truncate text-[15px] font-medium text-slate-900 dark:text-white/90">{r.name}</span>
                        <span className="block truncate text-[13px] text-slate-500 dark:text-white/45">{[r.district, r.province].filter(Boolean).join(", ") || "—"}</span>
                      </th>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(r.open)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {r.needIntervention ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: REPORT_STATUS[0].color }} aria-hidden />
                            {formatNumber(r.needIntervention)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-white/35">0</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8" aria-hidden>
                            <div className="h-full rounded-full" style={{ width: `${r.resolutionRate ?? 0}%`, background: REPORT_STATUS[3].color }} />
                          </div>
                          <span className="text-xs tabular-nums text-slate-600 dark:text-white/65">{r.resolutionRate == null ? "—" : formatPercent(r.resolutionRate)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right text-xs tabular-nums text-slate-600 dark:text-white/65">
                        {r.oldestOpenDays == null ? "—" : `${formatNumber(r.oldestOpenDays)} d`}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <Link
                          to={`/schools/${r.schoolId}/decision`}
                          aria-label={`Open ${r.name} dashboard`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:bg-white/8"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {data.schools.length > 10 && (
                <p className="px-2 pt-2 text-[13px] text-slate-500 dark:text-white/45">Top 10 of {formatNumber(data.schools.length)} schools with reports, most urgent first.</p>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
