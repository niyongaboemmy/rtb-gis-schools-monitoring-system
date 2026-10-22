import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Building2,
  TrendingUp,
  Users,
  MapPin,
  ClipboardCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { formatNumber, formatPercent, formatScore } from "../../lib/format";
import { label } from "../../lib/labels";
import { MetricInfo } from "../metric-help/MetricInfo";
import { DataGapBadge } from "../metric-help/DataGapBadge";
import type { MetricId } from "../metric-help/metrics";
import type { PriorityKey, SchoolMetrics } from "./types";
import {
  bandOf,
  bandRanges,
  modelOf,
  weightOf,
  type ComponentKey,
} from "../../lib/scoring";

interface DecisionIntelligenceProps {
  /**
   * School assessment / metrics payload (GET /analytics/schools/:id/metrics
   * shape). `dataGaps` marks components that used the neutral 50.
   */
  assessment: (Partial<SchoolMetrics> & { resolutionRate?: number | null }) | null | undefined;
}

type GapKey = ComponentKey;

interface ScoreMetric {
  label: string;
  /** Weight (0–1) from the served scoring model. */
  weight: number;
  score: number | null;
  icon: React.ComponentType<{ className?: string }>;
  metricId: MetricId;
  gapKey: GapKey;
}

const BAND_STYLE: Record<PriorityKey, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
};
const BAR_STYLE: Record<PriorityKey, string> = {
  critical: "bg-red-500/60",
  high: "bg-orange-500/60",
  medium: "bg-amber-500/60",
  low: "bg-emerald-500/60",
};

/** Safe parse: returns null for null / NaN / undefined (never a fake 0). */
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : null;
};

export const DecisionIntelligenceScore = React.memo(
  ({ assessment }: DecisionIntelligenceProps) => {
    const model = modelOf(assessment?.scoringModel);
    const overallScore = numOrNull(assessment?.overallScore);
    // The server's Intervention Priority is authoritative; derive only as a fallback.
    const band: PriorityKey | null =
      assessment?.priorityLevel ?? (overallScore != null ? bandOf(overallScore, model) : null);
    const coverage =
      typeof assessment?.dataCoverage === "number" ? assessment.dataCoverage : null;

    // Server data-gap flags (WS1.7). Older payloads only carry the two
    // persisted flags, so fall back to those.
    const gaps: Partial<Record<GapKey, boolean>> = {
      infrastructure: assessment?.hasInfraDataGap ?? undefined,
      population: assessment?.hasPopDataGap ?? undefined,
      ...(assessment?.dataGaps ?? {}),
    };

    // The six components; weights come from the served scoring model.
    const w = (k: ComponentKey) => weightOf(k, model);
    const metrics: ScoreMetric[] = [
      { label: "Infrastructure", weight: w("infrastructure"), score: numOrNull(assessment?.infrastructureScore), icon: Building2, metricId: "component.infrastructure", gapKey: "infrastructure" },
      { label: "Building Age Score", weight: w("buildingAge"), score: numOrNull(assessment?.buildingAgeScore), icon: TrendingUp, metricId: "component.buildingAge", gapKey: "buildingAge" },
      { label: "Facility Compliance", weight: w("facilityCompliance"), score: numOrNull(assessment?.facilityComplianceScore), icon: ClipboardCheck, metricId: "component.facilityCompliance", gapKey: "facilityCompliance" },
      { label: "Accessibility", weight: w("accessibility"), score: numOrNull(assessment?.accessibilityScore), icon: MapPin, metricId: "component.accessibility", gapKey: "accessibility" },
      { label: "Population Pressure", weight: w("population"), score: numOrNull(assessment?.populationPressureScore), icon: Users, metricId: "component.population", gapKey: "population" },
      {
        label: "Resolution Rate",
        weight: w("resolution"),
        // Server component score (neutral 50 when there are no reports).
        score: numOrNull(assessment?.resolutionRateScore ?? assessment?.resolutionRate),
        icon: CheckCircle2,
        metricId: "component.resolution",
        gapKey: "resolution",
      },
    ];

    const BAND_TEXT = {
      low: "text-emerald-500",
      medium: "text-amber-500",
      high: "text-orange-500",
      critical: "text-red-500",
    } as const;
    const scoreColor = band ? BAND_TEXT[band] : "text-muted-foreground";

    const barColor = (s: number | null) =>
      s == null ? "bg-muted-foreground/20" : BAR_STYLE[bandOf(s, model)];

    return (
      <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/60 rounded-[32px] overflow-hidden transition-all duration-500">
        <div className="absolute -inset-x-20 -top-20 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none opacity-0 transition-opacity duration-700" />

        <CardHeader className="border-b border-slate-100 dark:border-blue-500/12 pb-5 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg font-medium flex items-center gap-3 text-slate-800 dark:text-white/90">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                <Activity className="w-5 h-5 text-primary opacity-80" />
              </div>
              School Condition Score
              <MetricInfo id="school.conditionScore" />
            </CardTitle>
            <Badge
              variant="outline"
              className="rounded-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-white/60 border-slate-200 dark:border-blue-500/20 text-[12px] font-medium px-4 py-1 tracking-wide"
            >
              0–100 · higher is better
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 relative z-10">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-white/5">

            {/* ── Overall score ring ───────────────────────────────────── */}
            <div className="lg:w-5/12 p-6 sm:p-10 flex flex-col items-center justify-center bg-linear-to-b from-slate-50/80 dark:from-white/2 to-transparent">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="relative w-40 h-40 sm:w-48 sm:h-48"
              >
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192" role="img" aria-label={overallScore != null ? `School Condition Score ${overallScore} out of 100` : "Not assessed yet"}>
                  <circle
                    cx="96" cy="96" r="88"
                    stroke="currentColor" strokeWidth="2" fill="none"
                    className="text-slate-100 dark:text-white/5"
                  />
                  <circle
                    cx="96" cy="96" r="80"
                    stroke="currentColor" strokeWidth="8" fill="none"
                    className="text-slate-100 dark:text-white/5"
                  />
                  <motion.circle
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: (overallScore ?? 0) / 100 }}
                    transition={{ duration: 2, ease: "circOut" }}
                    cx="96" cy="96" r="80"
                    stroke="currentColor" strokeWidth="8" fill="none"
                    strokeLinecap="round"
                    className={cn("transition-colors duration-1000 opacity-80", scoreColor)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-medium text-slate-900 dark:text-white tracking-tighter">
                      {formatScore(overallScore)}
                    </span>
                  </div>
                  <span className="text-[12px] font-normal tracking-wider text-slate-500 dark:text-white/50 mt-2">
                    out of 100
                  </span>
                </div>
              </motion.div>

              {/* How much of the score is measured rather than estimated */}
              {coverage != null && (
                <p
                  className={cn(
                    "mt-4 text-[12px] text-center",
                    coverage < 0.5
                      ? "text-amber-700 dark:text-amber-400 font-medium"
                      : "text-slate-500 dark:text-white/50",
                  )}
                >
                  {formatPercent(coverage * 100)} of this score is from measured data
                  {coverage < 0.5 ? " — treat the priority as provisional" : ""}
                </p>
              )}

              {/* Urgency + operational health ── */}
              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-blue-500/12 text-center">
                  <p className="text-[12px] font-normal text-slate-500 dark:text-white mb-2 flex items-center justify-center gap-1">
                    Intervention Priority
                    <MetricInfo id="school.priority" size="xs" />
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-xl font-medium text-[11px] px-4 py-1 border-slate-200 dark:border-blue-500/12 bg-white dark:bg-white/2",
                      scoreColor,
                    )}
                  >
                    {band ? label("priority", band) : "Not assessed"}
                  </Badge>
                </div>
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-blue-500/12 text-center">
                  <p className="text-[12px] font-normal text-slate-500 dark:text-white mb-2 flex items-center justify-center gap-1">
                    Months to intervention
                    <MetricInfo id="school.urgencyMonths" size="xs" />
                  </p>
                  <div className="text-xl font-medium text-slate-900 dark:text-white/90">
                    {assessment?.urgencyMonths == null || isNaN(assessment.urgencyMonths)
                      ? "—"
                      : Number(assessment.urgencyMonths) === 0
                        ? "Now"
                        : formatNumber(Number(assessment.urgencyMonths))}
                  </div>
                </div>
              </div>

              {/* Benchmarking strip — uses scoreDeltaFromDistrict when available */}
              <div className="mt-8 w-full px-4 pt-4 border-t border-slate-100 dark:border-blue-500/12 flex items-center justify-between">
                <span className="text-[12px] font-normal text-slate-500 dark:text-white/50 tracking-wide flex items-center gap-1">
                  vs district average
                  <MetricInfo id="school.peerDelta" size="xs" />
                </span>
                <span className="text-[12px] font-medium text-primary tabular-nums">
                  {(() => {
                    const delta = Number(assessment?.scoreDeltaFromDistrict);
                    if (assessment?.scoreDeltaFromDistrict == null || !isFinite(delta)) {
                      return "No district comparison yet";
                    }
                    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
                    return `${sign}${formatNumber(Math.abs(delta), 1)} points`;
                  })()}
                </span>
              </div>
            </div>

            {/* ── Score breakdown ──────────────────────────────────────── */}
            <div className="lg:w-7/12 p-4 sm:p-8 space-y-8 bg-slate-50/50 dark:bg-gray-900/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {metrics.map((metric, index) => {
                  const hasScore = metric.score != null;
                  const scoreValue = metric.score ?? 0;
                  const estimated = gaps[metric.gapKey] === true;

                  return (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="p-5 rounded-3xl bg-white dark:bg-white/2 border border-slate-200 dark:border-blue-500/12 group/metric hover:bg-slate-50 dark:hover:bg-gray-900/60 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20 flex items-center justify-center text-blue-500 dark:text-blue-500 group-hover/metric:text-primary transition-colors">
                          <metric.icon className="w-5 h-5" />
                        </div>
                        {/* Score value — 0–100 factor score, not a share of the total */}
                        <span className="text-lg font-medium text-slate-900 dark:text-white/80 tabular-nums">
                          {hasScore ? metric.score : "—"}
                          <span className="text-[11px] text-slate-400 dark:text-white/30">/100</span>
                        </span>
                      </div>

                      <div className="space-y-2">
                        {/* Label + weight chip on same row */}
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <p className="flex min-w-0 items-center gap-1 text-[13px] font-normal text-slate-600 dark:text-white group-hover/metric:text-slate-800 dark:group-hover/metric:text-white/70 transition-colors leading-tight">
                            {metric.label}
                            <MetricInfo id={metric.metricId} size="xs" />
                          </p>
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 border border-slate-200 dark:border-white/6">
                            weight {formatPercent(metric.weight * 100)}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: hasScore ? `${metric.score}%` : "0%" }}
                            transition={{ duration: 1, delay: 0.1 * index }}
                            className={cn("h-full rounded-full transition-all duration-1000", barColor(metric.score))}
                          />
                        </div>

                        {/* How this factor feeds the overall index */}
                        {hasScore && (
                          <p className="text-[11px] tabular-nums text-slate-500 dark:text-white/40">
                            {scoreValue} × {formatPercent(metric.weight * 100)} = {formatNumber(scoreValue * metric.weight, 1)} points of the score
                          </p>
                        )}
                        {estimated && <DataGapBadge metricId={metric.metricId} />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Decision directives ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-[11px] font-medium text-slate-500 dark:text-white/50 flex items-center gap-2 tracking-wide">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                    Top recommendations
                  </h4>
                  <span className="text-[10px] font-normal text-slate-500 dark:text-white/40 italic">
                    Rule-based, from the scores
                  </span>
                </div>

                <div className="grid gap-3">
                  {assessment?.recommendations
                    ?.slice(0, 2)
                    .map((rec: string, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="group/rec p-4 rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-blue-500/12 flex gap-4 items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                          <Sparkles className="w-5 h-5 text-slate-400 dark:text-white/40 group-hover/rec:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-slate-500 dark:text-white/40 mb-0.5 tracking-wide">
                            Recommendation {i + 1}
                          </p>
                          <p className="text-[13px] font-normal text-slate-700 dark:text-white/70 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white/90 transition-colors">
                            {rec.replace(/^\[[A-Z]+\]\s*/, "").trim()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  {(!assessment?.recommendations ||
                    assessment.recommendations.length === 0) && (
                    <p className="text-xs text-slate-400 dark:text-white/30 italic px-1">
                      No recommendations at this time.
                    </p>
                  )}
                </div>

                {/* ── Score interpretation legend (collapsible) ──────── */}
                <details className="group/legend border-t border-slate-100 dark:border-blue-500/6 pt-3 mt-2">
                  <summary className="cursor-pointer list-none flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50 transition-colors select-none">
                    <span>Intervention Priority bands</span>
                    <span className="transition-transform group-open/legend:rotate-180 text-[9px]">
                      ▾
                    </span>
                  </summary>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {bandRanges(model).map(({ key, range }) => (
                      <div
                        key={key}
                        className={`rounded-lg p-2 text-center ${BAND_STYLE[key]}`}
                      >
                        <div className="text-[10px] font-black tabular-nums">
                          {range}
                        </div>
                        <div className="text-[9px] font-medium uppercase tracking-wide mt-0.5">
                          {label("priority", key)}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);
