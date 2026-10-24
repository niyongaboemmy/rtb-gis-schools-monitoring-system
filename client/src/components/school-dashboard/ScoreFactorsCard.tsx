import { motion, useReducedMotion } from "framer-motion";
import { Gauge } from "lucide-react";
import { formatNumber, formatScore } from "../../lib/format";
import { COMPONENT_ORDER, modelOf, type ComponentKey } from "../../lib/scoring";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { SchoolMetrics } from "../dashboard/types";
import { GlassCard } from "./GlassCard";
import { StackBar } from "./charts/StackBar";
import { EASE } from "./tokens";

/** Short names; colours are the categorical chart slots, in weight order. */
const FACTOR: Record<ComponentKey, { name: string; field: keyof SchoolMetrics; color: string }> = {
  infrastructure: { name: "Buildings", field: "infrastructureScore", color: "var(--viz-1)" },
  buildingAge: { name: "Building age", field: "buildingAgeScore", color: "var(--viz-2)" },
  facilityCompliance: { name: "Facilities", field: "facilityComplianceScore", color: "var(--viz-3)" },
  accessibility: { name: "Road access", field: "accessibilityScore", color: "var(--viz-4)" },
  population: { name: "Population", field: "populationPressureScore", color: "var(--viz-5)" },
  resolution: { name: "Problems fixed", field: "resolutionRateScore", color: "var(--viz-6)" },
};

interface Props {
  metrics: SchoolMetrics | null;
  onOpen: () => void;
  index?: number;
}

/**
 * How the score is built, as one picture: each factor's points (score ×
 * weight) stacked to the total; striped = estimated. Legend below.
 */
export function ScoreFactorsCard({ metrics, onOpen, index }: Props) {
  const reduce = useReducedMotion();
  const model = modelOf(metrics?.scoringModel);
  const rows = COMPONENT_ORDER.map((k) => {
    const raw = metrics?.[FACTOR[k].field];
    const score = raw == null ? null : Number(raw);
    const w = model.weights[k];
    return { k, score, w, points: score == null ? 0 : score * w, estimated: metrics?.dataGaps?.[k] === true };
  });
  const overall = metrics ? Number(metrics.overallScore) : null;

  return (
    <GlassCard
      title="What makes the score"
      icon={Gauge}
      info={<MetricInfo id="school.conditionScore" size="xs" />}
      actionLabel="Breakdown"
      onAction={onOpen}
      index={index}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
          {formatScore(overall)}
          <span className="text-sm font-normal text-slate-400 dark:text-white/40"> / 100</span>
        </span>
        <span className="text-[13px] text-slate-500 dark:text-white/50">points per part</span>
      </div>

      <div className="mt-3">
        <StackBar
          max={100}
          height={16}
          ariaLabel="Points each factor adds to the School Condition Score"
          segments={rows.map((r) => ({
            key: r.k,
            value: r.points,
            color: FACTOR[r.k].color,
            textured: r.estimated,
            tip: (
              <span>
                {FACTOR[r.k].name}: {formatScore(r.score)} × {Math.round(r.w * 100)}% = <b>{formatNumber(r.points, 1)} pts</b>
                {r.estimated ? " · estimated" : ""}
              </span>
            ),
          }))}
        />
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 2xl:grid-cols-3">
        {rows.map((r, i) => (
          <li key={r.k} className="min-w-0" title={r.estimated ? "No data yet — counted as 50" : undefined}>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: FACTOR[r.k].color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600 dark:text-white/60">{FACTOR[r.k].name}</span>
              <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{formatScore(r.score)}</span>
            </div>
            {/* the factor's own 0–100 value */}
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8" aria-hidden>
              <motion.div
                className="h-full rounded-full"
                style={{ background: FACTOR[r.k].color, opacity: r.estimated ? 0.45 : 1 }}
                initial={{ width: 0 }}
                animate={{ width: `${r.score ?? 0}%` }}
                transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.4 + i * 0.05, ease: EASE }}
              />
            </div>
            {r.estimated && <span className="sr-only">estimated</span>}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
