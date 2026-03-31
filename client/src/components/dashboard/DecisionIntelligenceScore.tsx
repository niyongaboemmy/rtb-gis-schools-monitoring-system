import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Building2,
  TrendingUp,
  Users,
  MapPin,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface DecisionIntelligenceProps {
  assessment: any;
}

export const DecisionIntelligenceScore = React.memo(
  ({ assessment }: DecisionIntelligenceProps) => {
    return (
      <Card className="group relative border-0 bg-gray-950/60 rounded-[32px] overflow-hidden transition-all duration-500 shadow-2xl">
        {/* Subtle Shadow Glow */}
        <div className="absolute -inset-x-20 -top-20 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none opacity-0 transition-opacity duration-700" />

        <CardHeader className="border-b border-blue-500/20 pb-5 relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-3 text-white/90">
              <div className="p-2 rounded-xl bg-white/5 border border-blue-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <Activity className="w-5 h-5 text-primary opacity-80" />
              </div>
              Decision intelligence score
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-normal text-white/50 tracking-wider">
                  System status
                </span>
                <span className="text-[11px] font-medium text-emerald-400/90 flex items-center gap-1.5 mt-0.5 text-shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
                  Live analysis
                </span>
              </div>
              <Badge
                variant="outline"
                className="rounded-full bg-white/5 text-white/40 border-blue-500/30 text-[10px] font-medium px-4 py-1 tracking-wide"
              >
                Strategic cockpit
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 relative z-10">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/5">
            {/* Main Score Section */}
            <div className="lg:w-5/12 p-10 flex flex-col items-center justify-center bg-linear-to-b from-white/2 to-transparent">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="relative w-48 h-48"
              >
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    className="text-white/5"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-white/5"
                  />
                  <motion.circle
                    initial={{ pathLength: 0 }}
                    animate={{
                      pathLength: (assessment.overallScore ?? 50) / 100,
                    }}
                    transition={{ duration: 2, ease: "circOut" }}
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    className={cn(
                      "transition-colors duration-1000 opacity-80",
                      assessment.overallScore >= 70
                        ? "text-emerald-500"
                        : assessment.overallScore >= 50
                          ? "text-blue-500"
                          : "text-red-500",
                    )}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-medium text-white tracking-tighter">
                      {assessment.overallScore ?? 50}
                    </span>
                    <span className="text-base font-normal text-white/50 ml-0.5">
                      %
                    </span>
                  </div>
                  <span className="text-[10px] font-normal tracking-wider text-white/50 mt-2">
                    Global strength
                  </span>
                </div>
              </motion.div>

              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="p-4 rounded-3xl bg-white/2 border border-blue-500/20 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                  <p className="text-[10px] font-normal text-white/50 mb-2">
                    Operational health
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-xl font-medium text-[11px] px-4 py-1 border-blue-500/20 bg-white/2",
                      assessment.overallScore >= 70
                        ? "text-emerald-400/80"
                        : assessment.overallScore >= 50
                          ? "text-blue-400/80"
                          : "text-red-400/80",
                    )}
                  >
                    {assessment.overallScore >= 70
                      ? "Optimal"
                      : assessment.overallScore >= 50
                        ? "Strategic"
                        : "Critical"}
                  </Badge>
                </div>
                <div className="p-4 rounded-3xl bg-white/2 border border-blue-500/20 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                  <p className="text-[10px] font-normal text-white/50 mb-2">
                    Decision urgency
                  </p>
                  <div className="text-xl font-medium text-white/90">
                    {assessment.urgencyMonths ?? "--"}{" "}
                    <span className="text-[11px] font-normal text-white/20 ml-0.5">
                      mo
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 w-full px-4 pt-4 border-t border-blue-500/20 flex items-center justify-between">
                <span className="text-[10px] font-normal text-white/40 tracking-wide">
                  Benchmarking sync
                </span>
                <span className="text-[10px] font-medium text-primary/60">
                  Regional top 15%
                </span>
              </div>
            </div>

            {/* Breakdown Section */}
            <div className="lg:w-7/12 p-8 space-y-8 bg-gray-900/10">
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Infrastructure health",
                    score: assessment.infrastructureScore ?? 50,
                    icon: Building2,
                  },
                  {
                    label: "Asset life cycle",
                    score: assessment.buildingAgeScore ?? 50,
                    icon: TrendingUp,
                  },
                  {
                    label: "Demographic load",
                    score: assessment.populationPressureScore ?? 50,
                    icon: Users,
                  },
                  {
                    label: "Hub accessibility",
                    score: assessment.accessibilityScore ?? 50,
                    icon: MapPin,
                  },
                  {
                    label: "Facility compliance",
                    score: assessment.facilityComplianceScore ?? 0,
                    icon: ClipboardCheck,
                  },
                ].map((metric, index) => (
                  <div
                    key={metric.label}
                    className="p-5 rounded-3xl bg-white/2 border border-blue-500/20 group/metric hover:bg-white/5 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-blue-500/30 flex items-center justify-center text-white/30 group-hover/metric:text-primary transition-colors shadow-inner">
                        <metric.icon className="w-5 h-5" />
                      </div>
                      <span className="text-lg font-medium text-white/80">
                        {metric.score}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-normal text-white/50 group-hover/metric:text-white/70 transition-colors">
                        {metric.label}
                      </p>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metric.score}%` }}
                          transition={{ duration: 1, delay: 0.1 * index }}
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            metric.score >= 70
                              ? "bg-emerald-500/60"
                              : metric.score >= 50
                                ? "bg-blue-500/60"
                                : "bg-red-500/60",
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center text-center shadow-[inset_0_1px_2px_rgba(var(--primary),0.1)]">
                  <Sparkles className="w-6 h-6 text-primary/30 mb-2" />
                  <p className="text-[10px] font-normal text-primary/40 mb-1">
                    Peer ranking
                  </p>
                  <p className="text-base font-medium text-white/80">
                    Top quintile
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-[11px] font-medium text-white/50 flex items-center gap-2 tracking-wide">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                    Decision directives
                  </h4>
                  <span className="text-[9px] font-normal text-white/20 italic">
                    Managed by AI precision
                  </span>
                </div>

                <div className="grid gap-3">
                  {assessment.recommendations
                    ?.slice(0, 2)
                    .map((rec: string, i: number) => (
                      <div
                        key={i}
                        className="group/rec p-4 rounded-2xl bg-white/2 border border-blue-500/20 flex gap-4 items-center hover:bg-white/5 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
                          <Sparkles className="w-5 h-5 text-white/40 group-hover/rec:text-primary/60 transition-colors" />
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-white/40 mb-0.5 tracking-wide">
                            Directive 0{i + 1}
                          </p>
                          <p className="text-[13px] font-normal text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
                            {rec
                              .replace("[URGENT]", "")
                              .replace("[CRITICAL]", "")
                              .replace("[STRATEGIC]", "")
                              .trim()}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);
