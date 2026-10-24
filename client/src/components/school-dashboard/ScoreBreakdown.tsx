import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber, formatPercent, formatScore } from "../../lib/format";
import { label } from "../../lib/labels";
import { BAND_HEX, bandOf, COMPONENT_ORDER, modelOf, type ComponentKey } from "../../lib/scoring";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { MetricId } from "../metric-help/metrics";
import type { SchoolMetrics } from "../dashboard/types";
import { EASE } from "./tokens";
import { NO_DATA } from "./status-colors";
import { DetailSection, SummaryStat, SummaryStats } from "./details/primitives";

const FACTOR: Record<ComponentKey, { name: string; field: keyof SchoolMetrics; metric: MetricId; color: string }> = {
  infrastructure: { name: "Building condition", field: "infrastructureScore", metric: "component.infrastructure", color: "var(--viz-1)" },
  buildingAge: { name: "Building age", field: "buildingAgeScore", metric: "component.buildingAge", color: "var(--viz-2)" },
  facilityCompliance: { name: "Facilities checklist", field: "facilityComplianceScore", metric: "component.facilityCompliance", color: "var(--viz-3)" },
  accessibility: { name: "Road access", field: "accessibilityScore", metric: "component.accessibility", color: "var(--viz-4)" },
  population: { name: "Nearby population", field: "populationPressureScore", metric: "component.population", color: "var(--viz-5)" },
  resolution: { name: "Problems fixed", field: "resolutionRateScore", metric: "component.resolution", color: "var(--viz-6)" },
};

function rowsOf(metrics: SchoolMetrics) {
  const model = modelOf(metrics.scoringModel);
  return COMPONENT_ORDER.map((k) => {
    const raw = metrics[FACTOR[k].field];
    const score = raw == null ? null : Number(raw);
    const max = model.weights[k] * 100;
    return { k, score, max, points: score == null ? null : (score * max) / 100, estimated: metrics.dataGaps?.[k] === true };
  });
}

/** Header figures: score, priority band, measured share, estimated factors. */
export function ScoreSummary({ metrics }: { metrics: SchoolMetrics | null }) {
  if (!metrics) return null;
  const model = modelOf(metrics.scoringModel);
  const overall = Number(metrics.overallScore);
  const band = metrics.priorityLevel ?? bandOf(overall, model);
  const estimated = rowsOf(metrics).filter((r) => r.estimated).length;
  const coverage = typeof metrics.dataCoverage === "number" ? metrics.dataCoverage * 100 : null;
  return (
    <SummaryStats>
      <SummaryStat label="Condition score" value={formatScore(overall)} hint="out of 100" accent={BAND_HEX[band]} meter={overall} />
      <SummaryStat
        label="Priority"
        value={label("priority", band)}
        hint={metrics.urgencyMonths != null ? `Act within ${formatNumber(metrics.urgencyMonths)} months` : undefined}
        accent={BAND_HEX[band]}
      />
      <SummaryStat label="Real data" value={coverage == null ? "—" : formatPercent(coverage)} hint="of the score is based on records" meter={coverage} />
      <SummaryStat label="Missing data" value={`${estimated} of ${COMPONENT_ORDER.length}`} hint={`parts counted as ${model.neutral} for now`} />
    </SummaryStats>
  );
}

/**
 * The score as arithmetic: each factor's 0–100 value × its weight = points,
 * and the points add up to the School Condition Score. Server values only.
 */
export function ScoreBreakdown({ metrics }: { metrics: SchoolMetrics | null }) {
  const reduce = useReducedMotion();
  if (!metrics) return <p className="text-sm text-slate-500 dark:text-white/55">Scores are not available yet.</p>;
  const model = modelOf(metrics.scoringModel);
  const rows = rowsOf(metrics);
  const sum = rows.reduce((a, r) => a + (r.points ?? 0), 0);
  const overall = Number(metrics.overallScore);
  const band = metrics.priorityLevel ?? bandOf(overall, model);
  const bands = (["critical", "high", "medium", "low"] as const).map((key) => ({ key, ...model.bands[key] }));

  return (
    <div className="space-y-8">
      <DetailSection title="Where the points come from" aside="part score × weight = points">
        <div className="overflow-hidden rounded-2xl ring-1 ring-slate-900/6 dark:ring-white/8">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/[0.03] text-left text-[13px] font-medium text-slate-500 dark:bg-white/[0.03] dark:text-white/45">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Part</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Score</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Points</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/5 dark:divide-white/6">
              {rows.map((r, i) => {
                const c = r.score == null ? NO_DATA : BAND_HEX[bandOf(r.score, model)];
                return (
                  <tr key={r.k} className="transition-colors hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02]">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-slate-800 dark:text-white/85">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: FACTOR[r.k].color }} aria-hidden />
                        <span className="min-w-0">{FACTOR[r.k].name}</span>
                        <MetricInfo id={FACTOR[r.k].metric} size="xs" />
                      </span>
                      {/* Phones: the data flag sits under the name */}
                      <span className={cn("mt-1 block pl-[18px] text-[13px] font-normal md:hidden", r.estimated ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-white/45")}>
                        {r.estimated ? "No data" : "Recorded"} · score {formatScore(r.score)}
                      </span>
                    </th>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 font-semibold tabular-nums text-slate-900 dark:text-white">{formatScore(r.score)}</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/6 lg:w-32 dark:bg-white/8">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: c }}
                            initial={{ width: 0 }}
                            animate={{ width: `${r.score ?? 0}%` }}
                            transition={{ duration: reduce ? 0 : 0.8, delay: 0.1 + i * 0.05, ease: EASE }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-baseline gap-1">
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{r.points == null ? "—" : formatNumber(r.points, 1)}</span>
                        <span className="text-[13px] tabular-nums text-slate-400 dark:text-white/40">of {formatNumber(r.max)}</span>
                      </div>
                      {/* Track = the factor's weight, fill = points earned */}
                      <div className="mt-1.5 h-1 w-full max-w-[7rem] overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8" aria-hidden>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: FACTOR[r.k].color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${r.max ? ((r.points ?? 0) / r.max) * 100 : 0}%` }}
                          transition={{ duration: reduce ? 0 : 0.8, delay: 0.15 + i * 0.05, ease: EASE }}
                        />
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {r.estimated ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[13px] font-medium text-amber-800 dark:text-amber-300">
                          <CircleDashed className="h-3 w-3" aria-hidden /> No data
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" aria-hidden /> Recorded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900/[0.03] dark:bg-white/[0.03]">
                <th scope="row" className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">
                  School Condition Score
                </th>
                <td className="hidden sm:table-cell" />
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: BAND_HEX[band] }} aria-hidden />
                    <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{formatScore(overall)}</span>
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-[13px] text-slate-500 md:table-cell dark:text-white/50">Σ {formatNumber(sum, 1)} → rounded</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DetailSection>

      <DetailSection title="Priority" aside={`${label("priority", band)} band`}>
        <div className="pt-7">
          <div className="relative">
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
              {bands.map((b) => (
                <span
                  key={b.key}
                  className="h-full transition-opacity"
                  style={{ flexGrow: b.max - b.min + 1, flexBasis: 0, background: BAND_HEX[b.key], opacity: b.key === band ? 1 : 0.28 }}
                />
              ))}
            </div>
            {/* Where this school sits */}
            <motion.div
              className="absolute -top-7 flex -translate-x-1/2 flex-col items-center"
              initial={{ left: "0%" }}
              animate={{ left: `${Math.max(0, Math.min(100, overall))}%` }}
              transition={{ duration: reduce ? 0 : 1.1, delay: 0.2, ease: EASE }}
            >
              <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[13px] font-semibold tabular-nums text-white dark:bg-white dark:text-slate-900">
                {formatScore(overall)}
              </span>
              <span className="mt-0.5 h-5 w-0.5 rounded-full bg-slate-900 dark:bg-white" />
            </motion.div>
          </div>
          <div className="mt-2 flex gap-[2px]">
            {bands.map((b) => (
              <div key={b.key} className="min-w-0" style={{ flexGrow: b.max - b.min + 1, flexBasis: 0 }}>
                <p className={cn("truncate text-xs", b.key === band ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500 dark:text-white/50")}>
                  {label("priority", b.key)}
                </p>
                <p className="text-[13px] tabular-nums text-slate-400 dark:text-white/40">
                  {b.min}–{b.max}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-white/50">
          Estimated factors use the neutral {model.neutral} until the data is recorded.
          {typeof metrics.dataCoverage === "number" && ` ${formatPercent(metrics.dataCoverage * 100)} of this score is measured.`}
        </p>
      </DetailSection>
    </div>
  );
}
