import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Building2, CheckCircle2, ChevronRight } from "lucide-react";
import { formatNumber } from "../../lib/format";
import { label } from "../../lib/labels";
import { formatDaysAgo } from "../../lib/issueReportMetrics";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { FacilityBuilding, ReportingData } from "../dashboard/types";
import { GlassCard } from "./GlassCard";
import { Donut } from "./charts/Donut";
import { EASE } from "./tokens";
import { CONDITIONS } from "./status-colors";


const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
};

interface Props {
  buildings: FacilityBuilding[];
  assessedCount: number | null;
  attention: ReportingData["buildingsAttention"] | null;
  onOpen: () => void;
  onBuildingClick?: (b: FacilityBuilding) => void;
  index?: number;
}

/** Condition donut (count in the hole) + the buildings to act on first. */
export function BuildingsCard({ buildings, attention, onOpen, onBuildingClick, index }: Props) {
  const reduce = useReducedMotion();
  const counts = CONDITIONS.map((c) => ({
    ...c,
    value: buildings.filter((b) => (c.key === "none" ? !b.condition : String(b.condition).toLowerCase() === c.key)).length,
  }));
  const rows = (attention ?? []).slice(0, 2);

  return (
    <GlassCard
      title="Buildings"
      icon={Building2}
      tone="text-primary"
      info={<MetricInfo id="school.buildingCount" size="xs" />}
      actionLabel="All"
      onAction={onOpen}
      index={index}
    >
      <div className="flex items-center gap-4">
        <Donut
          ariaLabel="Buildings by condition"
          segments={counts.map((c) => ({ key: c.key, label: c.label, value: c.value, color: c.color }))}
          center={
            <>
              <span className="text-2xl font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
                {formatNumber(buildings.length)}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/50">total</span>
            </>
          }
        />
        <ul className="min-w-0 flex-1 space-y-1.5">
          {counts.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-white/60">{c.label}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{c.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-3">
        {attention == null ? null : rows.length === 0 ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-emerald-500/8 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Nothing needs attention
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Buildings needing attention">
            {rows.map((row, i) => {
              const b = buildings.find((x) => x.id === row.buildingId);
              const open = row.intervention + row.failed + row.pending;
              return (
                <motion.li
                  key={row.buildingId}
                  initial={reduce ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.08, ease: EASE }}
                >
                  <button
                    type="button"
                    disabled={!onBuildingClick || !b}
                    onClick={() => b && onBuildingClick?.(b)}
                    title={row.lastReportAt ? `Last report ${formatDaysAgo(row.lastReportAt)}` : undefined}
                    className="group flex w-full items-center gap-2.5 rounded-xl bg-slate-900/3 px-3 py-1.5 text-left transition-colors enabled:hover:bg-slate-900/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/5 dark:enabled:hover:bg-white/8"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: SEVERITY_COLOR[row.severity] }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-white/85">{row.name}</span>
                    <span className="shrink-0 rounded-md bg-slate-900/6 px-1.5 text-[10px] font-semibold tabular-nums text-slate-700 dark:bg-white/8 dark:text-white/75">
                      {open > 0 ? `${open} open` : label("buildingCondition", row.condition)}
                    </span>
                    <span className="sr-only">{label("priority", row.severity)}</span>
                    {onBuildingClick && b && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
