import { ArrowDownRight, ArrowUpRight, Clock, FileText } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber, formatPercent } from "../../lib/format";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { ReportSummary, ReportingData } from "../dashboard/types";
import { GlassCard } from "./GlassCard";
import { Donut } from "./charts/Donut";
import { SparkBars } from "./charts/SparkBars";
import { REPORT_STATUS } from "./status-colors";

const SEGMENTS = REPORT_STATUS;

interface Props {
  summary: ReportSummary | null;
  reporting: ReportingData | null;
  onOpen: () => void;
  index?: number;
}

/** Status donut (open count in the hole) + 12-month filing bars. */
export function IssueReportsCard({ summary, reporting, onOpen, index }: Props) {
  const counts = reporting?.statusCounts;
  const change = reporting?.comparison.createdChangePct ?? null;
  const oldest = summary?.oldestOpenDays ?? null;

  return (
    <GlassCard
      title="Issue Reports"
      icon={FileText}
      tone="text-primary"
      info={<MetricInfo id="reports.openIssues" size="xs" />}
      actionLabel="All"
      onAction={onOpen}
      index={index}
    >
      <div className="flex items-center gap-4">
        <Donut
          ariaLabel="Issue Reports by status"
          segments={SEGMENTS.map((s) => ({ key: s.key, label: s.label, value: counts?.[s.key] ?? 0, color: s.color }))}
          center={
            <>
              <span className="text-2xl font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
                {formatNumber(summary?.active ?? null)}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/50">open</span>
            </>
          }
        />
        <ul className="min-w-0 flex-1 space-y-1.5">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-white/60">{s.short}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(counts?.[s.key] ?? null)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-3">
        <SparkBars
          height={30}
          ariaLabel="Issue Reports filed per month, last 12 months"
          data={(reporting?.months ?? []).map((m) => ({
            key: m.key,
            value: m.created,
            tip: (
              <span>
                {m.label}: <b>{m.created}</b> filed · {m.resolved} resolved
              </span>
            ),
          }))}
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
              change == null
                ? "bg-slate-900/5 text-slate-500 dark:bg-white/6 dark:text-white/50"
                : change > 0
                  ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
            )}
            title="Reports filed this month vs last month"
          >
            {change != null && change > 0 && <ArrowUpRight className="h-3 w-3" aria-hidden />}
            {change != null && change < 0 && <ArrowDownRight className="h-3 w-3" aria-hidden />}
            {change == null ? "— vs last mo." : `${change > 0 ? "+" : ""}${change}%`}
          </span>
          <span className="rounded-full bg-slate-900/5 px-2 py-0.5 font-medium text-slate-600 dark:bg-white/6 dark:text-white/60" title="Resolution rate">
            {summary?.resolutionRate == null ? "—" : formatPercent(summary.resolutionRate)} resolved
          </span>
          {oldest != null && oldest > 30 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-700 dark:text-red-300" title="Oldest open report">
              <Clock className="h-3 w-3" aria-hidden />
              {formatNumber(oldest)}d
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
