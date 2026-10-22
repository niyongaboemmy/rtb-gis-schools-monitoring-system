import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, CircleDashed, MapPin, Timer, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatPercent, formatScore } from "../../lib/format";
import { label } from "../../lib/labels";
import { BAND_HEX, bandOf } from "../../lib/scoring";
import type { PriorityKey, ScoringModel } from "../dashboard/types";
import { EASE } from "../school-dashboard/tokens";
import { NO_DATA } from "../school-dashboard/status-colors";
import { FACTOR_NAME, num, rwf, urgencyText, weakestFactor, type DecisionRow } from "./decision-utils";

/** Small band-coloured score ring. */
export function ScoreDial({ score, size = 46 }: { score: number | null; size?: number }) {
  const reduce = useReducedMotion();
  const color = score == null ? NO_DATA : BAND_HEX[bandOf(score)];
  const R = 20;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={score == null ? "Not scored" : `School Condition Score ${formatScore(score)} of 100`}>
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={R} fill="none" strokeWidth="4.5" className="stroke-slate-900/7 dark:stroke-white/9" />
        <motion.circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - (score ?? 0) / 100) }}
          transition={{ duration: reduce ? 0 : 1, ease: EASE, delay: 0.1 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">{formatScore(score)}</span>
    </div>
  );
}

interface Props {
  d: DecisionRow;
  rank: number;
  model?: ScoringModel | null;
  onOpen: () => void;
  index: number;
}

/**
 * One school in the queue, built for a decision at a glance: rank, score,
 * band, the weakest measured factor, when to act, what it may cost, and how
 * much of the score is measured. Everything else is one click away.
 */
export function QueueRow({ d, rank, model, onOpen, index }: Props) {
  const reduce = useReducedMotion();
  const score = num(d.overallScore);
  const band = (d.priorityLevel as PriorityKey) || (score != null ? bandOf(score, model) : null);
  const color = band ? BAND_HEX[band as PriorityKey] ?? NO_DATA : NO_DATA;
  const weak = weakestFactor(d);
  const coverage = num(d.dataCoverage);
  const place = [d.school?.district, d.school?.province].filter(Boolean).join(", ");
  const name = d.school?.name ?? "Unknown school";

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: EASE }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${rank}. ${name}, ${band ? label("priority", band) : "not assessed"} priority, score ${formatScore(score)}: open details`}
        className="group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-slate-900/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:px-4 lg:grid-cols-[2rem_auto_minmax(0,1.6fr)_minmax(0,1fr)_7rem_6rem_auto] dark:hover:bg-white/[0.04]"
      >
        <span className="hidden text-xs font-medium tabular-nums text-slate-400 lg:block dark:text-white/35">{rank}</span>
        <ScoreDial score={score} />

        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/7 dark:text-white/80">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
              {band ? label("priority", band) : "Not assessed"}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-white/50">
            {place && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {place}
              </span>
            )}
            {/* Phones/tablets: the deadline and cost move under the name */}
            <span className="inline-flex items-center gap-1 lg:hidden">
              <Timer className="h-3 w-3" aria-hidden />
              {urgencyText(d.urgencyMonths)}
            </span>
            <span className="inline-flex items-center gap-1 lg:hidden">
              <Wallet className="h-3 w-3" aria-hidden />
              {rwf(d.estimatedBudgetRwf)}
            </span>
          </span>
        </span>

        {/* Weakest factor + data coverage */}
        <span className="hidden min-w-0 lg:block">
          {weak ? (
            <span className="block truncate text-xs text-slate-700 dark:text-white/80">
              Lowest: <b className="font-semibold">{FACTOR_NAME[weak.key]}</b>
              <span className="ml-1.5 inline-flex items-center gap-1 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: BAND_HEX[bandOf(weak.score, model)] }} aria-hidden />
                {formatScore(weak.score)}
              </span>
            </span>
          ) : (
            <span className="block text-xs text-slate-400 dark:text-white/40">No measured factor yet</span>
          )}
          <span className={cn("mt-1 flex items-center gap-1.5 text-[11px]", coverage != null && coverage < 0.5 ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-white/45")}>
            {coverage != null && coverage < 0.5 && <CircleDashed className="h-3 w-3" aria-hidden />}
            {coverage == null ? "Coverage unknown" : `${formatPercent(coverage * 100)} real data`}
          </span>
        </span>

        <span className="hidden text-xs font-medium text-slate-900 lg:block dark:text-white/90">{urgencyText(d.urgencyMonths)}</span>
        <span className="hidden text-xs font-medium tabular-nums text-slate-900 lg:block dark:text-white/90">{rwf(d.estimatedBudgetRwf)}</span>

        <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-white/40" aria-hidden />
      </button>
    </motion.li>
  );
}
