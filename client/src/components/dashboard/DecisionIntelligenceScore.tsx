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

interface DecisionIntelligenceProps {
  assessment: any;
}

interface ScoreMetric {
  label: string;
  /** Displayed as a small badge next to the label so the user always knows the formula */
  weight: string;
  score: number | null;
  icon: React.ComponentType<{ className?: string }>;
  tooltip?: string;
}

/** Safe parse: returns 0 for null / NaN / undefined */
const safeNum = (v: unknown): number => {
  const n = parseFloat(String(v));
  return isFinite(n) ? n : 0;
};

export const DecisionIntelligenceScore = React.memo(
  ({ assessment }: DecisionIntelligenceProps) => {
    const overallScore = Math.min(
      100,
      Math.max(0, Math.round(safeNum(assessment?.overallScore ?? 50))),
    );

    // Weighted composite breakdown — labels and weights mirror the server formula
    const metrics: ScoreMetric[] = [
      {
        label: "Infrastructure",
        weight: "35%",
        score: assessment?.infrastructureScore != null
          ? Math.min(100, Math.max(0, Math.round(safeNum(assessment.infrastructureScore))))
          : null,
        icon: Building2,
      },
      {
        label: "Building Age",
        weight: "25%",
        score: assessment?.buildingAgeScore != null
          ? Math.min(100, Math.max(0, Math.round(safeNum(assessment.buildingAgeScore))))
          : null,
        icon: TrendingUp,
      },
      {
        label: "Capacity Resilience",
        weight: "10%",
        score: assessment?.populationPressureScore != null
          ? Math.min(100, Math.max(0, Math.round(safeNum(assessment.populationPressureScore))))
          : null,
        icon: Users,
        tooltip: "Higher = more capacity headroom vs. local school-age population",
      },
      {
        label: "Accessibility",
        weight: "10%",
        score: assessment?.accessibilityScore != null
          ? Math.min(100, Math.max(0, Math.round(safeNum(assessment.accessibilityScore))))
          : null,
        icon: MapPin,
      },
      {
        label: "Facility Compliance",
        weight: "15%",
        score: assessment?.facilityComplianceScore != null
          ? Math.min(100, Math.max(0, Math.round(safeNum(assessment.facilityComplianceScore))))
          : null,
        icon: ClipboardCheck,
      },
      {
        label: "Resolution Rate",
        weight: "5%",
        // resolutionRate is computed client-side in getAssessment(); null = no reports (neutral)
        score: assessment?.resolutionRate != null
          ? Math.min(100, Math.max(0, Math.round(safeNum(assessment.resolutionRate))))
          : null,
        icon: CheckCircle2,
      },
    ];

    const scoreColor =
      overallScore >= 70
        ? "text-emerald-500"
        : overallScore >= 50
          ? "text-blue-500"
          : "text-red-500";

    const barColor = (s: number | null) => {
      if (s == null) return "bg-muted-foreground/20";
      if (s >= 70)   return "bg-emerald-500/60";
      if (s >= 50)   return "bg-blue-500/60";
      return           "bg-red-500/60";
    };

    return (
      <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/60 rounded-[32px] overflow-hidden transition-all duration-500">
        <div className="absolute -inset-x-20 -top-20 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none opacity-0 transition-opacity duration-700" />

        <CardHeader className="border-b border-slate-100 dark:border-blue-500/12 pb-5 relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-3 text-slate-800 dark:text-white/90">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                <Activity className="w-5 h-5 text-primary opacity-80" />
              </div>
              Decision intelligence score
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-normal text-slate-500 dark:text-white/50 tracking-wider">
                  System status
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400/90 flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live analysis
                </span>
              </div>
              <Badge
                variant="outline"
                className="rounded-full bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/40 border-slate-200 dark:border-blue-500/20 text-[12px] font-medium px-4 py-1 tracking-wide"
              >
                Strategic cockpit
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 relative z-10">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-white/5">

            {/* ── Overall score ring ───────────────────────────────────── */}
            <div className="lg:w-5/12 p-10 flex flex-col items-center justify-center bg-linear-to-b from-slate-50/80 dark:from-white/2 to-transparent">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="relative w-48 h-48"
              >
                <svg className="w-full h-full transform -rotate-90">
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
                    animate={{ pathLength: overallScore / 100 }}
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
                      {overallScore}
                    </span>
                    <span className="text-base font-normal text-slate-400 dark:text-white/50 ml-0.5">
                      %
                    </span>
                  </div>
                  <span className="text-[12px] font-normal tracking-wider text-slate-500 dark:text-white/50 mt-2">
                    Global strength
                  </span>
                </div>
              </motion.div>

              {/* Urgency + operational health ── */}
              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-blue-500/12 text-center">
                  <p className="text-[12px] font-normal text-slate-500 dark:text-white mb-2">
                    Operational health
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-xl font-medium text-[11px] px-4 py-1 border-slate-200 dark:border-blue-500/12 bg-white dark:bg-white/2",
                      overallScore >= 70
                        ? "text-emerald-600 dark:text-emerald-400/80"
                        : overallScore >= 50
                          ? "text-blue-600 dark:text-blue-400/80"
                          : "text-red-600 dark:text-red-400/80",
                    )}
                  >
                    {overallScore >= 70 ? "Optimal" : overallScore >= 50 ? "Strategic" : "Critical"}
                  </Badge>
                </div>
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-blue-500/12 text-center">
                  <p className="text-[12px] font-normal text-slate-500 dark:text-white mb-2">
                    Decision urgency
                  </p>
                  <div className="text-xl font-medium text-slate-900 dark:text-white/90">
                    {assessment?.urgencyMonths != null && !isNaN(assessment.urgencyMonths)
                      ? assessment.urgencyMonths
                      : "—"}
                    <span className="text-[11px] font-normal text-slate-400 dark:text-white/20 ml-0.5">
                      {assessment?.urgencyMonths != null ? " mo" : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Benchmarking strip — uses scoreDeltaFromDistrict when available */}
              <div className="mt-8 w-full px-4 pt-4 border-t border-slate-100 dark:border-blue-500/12 flex items-center justify-between">
                <span className="text-[12px] font-normal text-slate-400 dark:text-white/40 tracking-wide">
                  Benchmarking
                </span>
                <span className="text-[12px] font-medium text-primary">
                  {(() => {
                    const delta = assessment?.scoreDeltaFromDistrict;
                    if (delta != null && isFinite(delta)) {
                      const sign = delta >= 0 ? "+" : "";
                      if (delta >= 10)  return `${sign}${delta.toFixed(1)} vs district — Above peers`;
                      if (delta >= 0)   return `${sign}${delta.toFixed(1)} vs district avg`;
                      if (delta >= -10) return `${delta.toFixed(1)} vs district avg`;
                      return `${delta.toFixed(1)} vs district — Below avg`;
                    }
                    // Fallback: threshold-based label until peer data is available
                    if (overallScore > 80) return "Regional top 10%";
                    if (overallScore > 60) return "Regional top 25%";
                    if (overallScore > 40) return "Regional average";
                    return "Needs improvement";
                  })()}
                </span>
              </div>
            </div>

            {/* ── Score breakdown ──────────────────────────────────────── */}
            <div className="lg:w-7/12 p-8 space-y-8 bg-slate-50/50 dark:bg-gray-900/10">
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((metric, index) => {
                  const hasScore = metric.score != null;

                  return (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      title={metric.tooltip}
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
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-normal text-slate-500 dark:text-white group-hover/metric:text-slate-800 dark:group-hover/metric:text-white/70 transition-colors leading-tight">
                            {metric.label}
                          </p>
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 border border-slate-200 dark:border-white/6">
                            weight {metric.weight}
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
                          <p className="text-[10px] tabular-nums text-slate-400 dark:text-white/30">
                            {metric.score} × {metric.weight} = {((metric.score * parseFloat(metric.weight)) / 100).toFixed(1)} pts of the overall
                          </p>
                        )}
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
                    Decision directives
                  </h4>
                  <span className="text-[9px] font-normal text-slate-400 dark:text-white/20 italic">
                    Managed by AI precision
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
                            Directive 0{i + 1}
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
                      No critical directives at this time.
                    </p>
                  )}
                </div>

                {/* ── Score interpretation legend (collapsible) ──────── */}
                <details className="group/legend border-t border-slate-100 dark:border-blue-500/6 pt-3 mt-2">
                  <summary className="cursor-pointer list-none flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50 transition-colors select-none">
                    <span>Score Guide</span>
                    <span className="transition-transform group-open/legend:rotate-180 text-[9px]">
                      ▾
                    </span>
                  </summary>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {(
                      [
                        {
                          band: "Critical",
                          range: "0–34",
                          color:
                            "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                        },
                        {
                          band: "High",
                          range: "35–54",
                          color:
                            "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
                        },
                        {
                          band: "Medium",
                          range: "55–74",
                          color:
                            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                        },
                        {
                          band: "Optimal",
                          range: "75–100",
                          color:
                            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                        },
                      ] as const
                    ).map(({ band, range, color }) => (
                      <div
                        key={band}
                        className={`rounded-lg p-2 text-center ${color}`}
                      >
                        <div className="text-[10px] font-black tabular-nums">
                          {range}
                        </div>
                        <div className="text-[9px] font-medium uppercase tracking-wide mt-0.5">
                          {band}
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
