import { motion, useReducedMotion } from "framer-motion";
import { HelpCircle, ShieldAlert } from "lucide-react";
import { formatNumber } from "../../lib/format";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { RiskAssessmentData } from "../dashboard/types";
import { GlassCard } from "./GlassCard";
import { EASE } from "./tokens";
import { useChartTooltip } from "./charts/useChartTooltip";
import { RISK_LEVEL } from "./status-colors";

const LEVEL = RISK_LEVEL;

/** Short driver names for the bars. */
const SHORT: Record<string, string> = {
  needsIntervention: "Urgent issues",
  failedRepairs: "Failed repairs",
  infrastructure: "Deterioration",
  population: "Demand",
  resolutionTime: "Slow fixes",
};

interface Props {
  risk: RiskAssessmentData | null | undefined;
  onOpen: () => void;
  index?: number;
}

/** Indicative risk: half-gauge + one bar per factor that counts. */
export function RiskCard({ risk, onOpen, index }: Props) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  const level = LEVEL[risk?.overall.level ?? "unknown"] ?? LEVEL.unknown;
  const score = risk?.overall.score ?? null;
  const factors = (risk?.factors ?? []).filter((f) => f.applies !== false).sort((a, b) => b.riskScore - a.riskScore);
  const unknown = (risk?.factors ?? []).filter((f) => f.level === "unknown").length;
  const ARC = Math.PI * 40;

  return (
    <GlassCard
      title="Risk"
      icon={ShieldAlert}
      tone="text-primary"
      info={<MetricInfo id="risk.overall" size="xs" />}
      actionLabel="Plan"
      onAction={onOpen}
      index={index}
    >
      {!risk ? (
        <p className="text-sm text-slate-500 dark:text-white/55">—</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative h-[52px] w-[94px] shrink-0">
              <svg viewBox="0 0 100 54" className="h-full w-full overflow-visible" role="img" aria-label={`Indicative risk ${score} of 100, ${level.label}`}>
                <path d="M10 50 A40 40 0 0 1 90 50" fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-slate-900/6 dark:stroke-white/8" />
                <motion.path
                  d="M10 50 A40 40 0 0 1 90 50"
                  fill="none"
                  stroke={level.color}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={ARC}
                  initial={{ strokeDashoffset: ARC }}
                  animate={{ strokeDashoffset: ARC * (1 - Math.min(100, score ?? 0) / 100) }}
                  transition={{ duration: reduce ? 0 : 1.1, ease: EASE, delay: 0.3 }}
                />
              </svg>
              <span className="absolute inset-x-0 bottom-0 text-center text-xl font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
                {formatNumber(score)}
              </span>
            </div>
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-white"
                style={{ background: `${level.color}26` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.color }} aria-hidden />
                {level.label}
              </span>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40">Indicative</p>
            </div>
          </div>

          <div ref={boxRef} className="relative mt-3 space-y-1.5" role="list" aria-label="Risk by factor">
            {factors.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-white/50">No active risk drivers</p>
            ) : (
              factors.slice(0, 3).map((f, i) => {
                const l = LEVEL[f.level] ?? LEVEL.unknown;
                return (
                  <div
                    key={f.id}
                    role="listitem"
                    tabIndex={0}
                    className="grid cursor-default grid-cols-[5.5rem_1fr_1.75rem] items-center gap-2 rounded-md text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    {...bind(
                      <span>
                        {f.title}: <b>{f.riskScore}</b> ({l.label})
                      </span>,
                    )}
                  >
                    <span className="truncate text-slate-600 dark:text-white/60">{SHORT[f.id] ?? f.title}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8">
                      <motion.span
                        className="block h-full rounded-full"
                        style={{ background: l.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(3, f.riskScore)}%` }}
                        transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.35 + i * 0.08, ease: EASE }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{f.riskScore}</span>
                  </div>
                );
              })
            )}
            {tooltip}
          </div>

          {unknown > 0 && (
            <p className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] text-slate-500 dark:text-white/50" title="Factors without data are not counted">
              <HelpCircle className="h-3 w-3" aria-hidden /> {unknown} unknown
            </p>
          )}
        </>
      )}
    </GlassCard>
  );
}
