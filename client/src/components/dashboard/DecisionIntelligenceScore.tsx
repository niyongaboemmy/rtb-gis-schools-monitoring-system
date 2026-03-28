import React from "react";
import { motion } from "framer-motion";
import { Activity, Building2, TrendingUp, Users, MapPin, ClipboardCheck, Sparkles, AlertTriangle, Wrench, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface DecisionIntelligenceProps {
  assessment: any;
}

export const DecisionIntelligenceScore = React.memo(({ assessment }: DecisionIntelligenceProps) => {
  return (
    <Card className="border border-border/20 dark:border-blue-900/50 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden">
      <CardHeader className="border-b border-border/10 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Decision Intelligence Score
          </CardTitle>
          <Badge
            variant="outline"
            className="rounded-full bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-black px-3"
          >
            Dynamic Analysis
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/10">
          {/* Hero Score Section */}
          <div className="lg:w-2/5 p-8 flex flex-col items-center justify-center bg-linear-to-br from-primary/5 via-transparent to-transparent">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15, delay: 0.6 }}
              className="relative w-48 h-48"
            >
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted/10"
                />
                <motion.circle
                  initial={{ pathLength: 0 }}
                  animate={{
                    pathLength: (assessment.overallScore ?? 50) / 100,
                  }}
                  transition={{
                    duration: 1.5,
                    ease: "easeOut",
                    delay: 0.8,
                  }}
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  className={cn(
                    assessment.overallScore >= 70
                      ? "text-emerald-500"
                      : assessment.overallScore >= 50
                        ? "text-amber-500"
                        : "text-red-500",
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                  className="text-5xl font-black tracking-tight"
                >
                  {assessment.overallScore ?? 50}
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4 }}
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1"
                >
                  Overall Score
                </motion.span>
              </div>

              {/* Animated Glow Effect */}
              <div
                className={cn(
                  "absolute -inset-4 rounded-full opacity-20 blur-2xl -z-10 animate-pulse",
                  assessment.overallScore >= 70
                    ? "bg-emerald-500"
                    : assessment.overallScore >= 50
                      ? "bg-amber-500"
                      : "bg-red-500",
                )}
              />
            </motion.div>

            <div className="mt-8 grid grid-cols-2 gap-4 w-full">
              <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">
                  Status
                </p>
                <Badge
                  className={cn(
                    "rounded-full font-black text-[10px] uppercase",
                    assessment.overallScore >= 70
                      ? "bg-emerald-500"
                      : assessment.overallScore >= 50
                        ? "bg-amber-500"
                        : "bg-red-500",
                  )}
                >
                  {assessment.overallScore >= 70
                    ? "Optimal"
                    : assessment.overallScore >= 50
                      ? "Acceptable"
                      : "Critical"}
                </Badge>
              </div>
              <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">
                  Urgency
                </p>
                <p className="text-sm font-black text-primary uppercase leading-tight">
                  {assessment.urgencyMonths} Months
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="lg:w-3/5 p-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Buildings Health",
                  score: assessment.infrastructureScore ?? 50,
                  icon: Building2,
                },
                {
                  label: "Buildings Depreciation",
                  score: assessment.buildingAgeScore ?? 50,
                  icon: TrendingUp,
                },
                {
                  label: "Students Population",
                  score: assessment.populationPressureScore ?? 50,
                  icon: Users,
                },
                {
                  label: "School Accessibility",
                  score: assessment.accessibilityScore ?? 50,
                  icon: MapPin,
                },
                {
                  label: "Facility Compliance",
                  score: assessment.facilityComplianceScore ?? 0,
                  icon: ClipboardCheck,
                },
              ].map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index + 0.5 }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: "rgba(var(--primary), 0.05)",
                  }}
                  className="p-3 rounded-2xl bg-muted/30 border border-border/5 transition-all group cursor-default"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-background dark:bg-blue-900/20 shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <metric.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-bold text-muted-foreground dark:text-white group-hover:text-foreground transition-colors">
                      {metric.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-lg font-black leading-none">
                      {metric.score}%
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${metric.score}%` }}
                        transition={{
                          duration: 1,
                          delay: 0.8 + index * 0.1,
                        }}
                        className={cn(
                          "h-full rounded-full",
                          metric.score >= 70
                            ? "bg-emerald-500"
                            : metric.score >= 50
                              ? "bg-amber-500"
                              : "bg-red-500",
                        )}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Enhanced Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="p-5 bg-card/40 border border-border/10 rounded-3xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-primary flex items-center gap-2 uppercase tracking-[0.2em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Intelligence Suggestions
                </h4>
                <Badge
                  variant="outline"
                  className="rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20"
                >
                  Live Analysis
                </Badge>
              </div>
              <div className="space-y-3">
                {assessment.recommendations
                  ?.slice(0, 4)
                  .map((rec: string, i: number) => {
                    const isUrgent = rec.includes("[URGENT]");
                    const isCritical = rec.includes("[CRITICAL]");
                    const isStrategic = rec.includes("[STRATEGIC]");
                    const cleanRec = rec
                      .replace("[URGENT]", "")
                      .replace("[CRITICAL]", "")
                      .replace("[STRATEGIC]", "")
                      .trim();

                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.3 + i * 0.1 }}
                        key={i}
                        className={cn(
                          "flex items-start gap-4 p-3.5 rounded-2xl border transition-all hover:scale-[1.01]",
                          isUrgent
                            ? "bg-red-500/5 border-red-500/20 shadow-red-500/5"
                            : isCritical
                              ? "bg-amber-500/5 border-amber-500/20 shadow-amber-500/5"
                              : isStrategic
                                ? "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5"
                                : "bg-primary/5 border-primary/20 shadow-primary/5",
                        )}
                      >
                        <div
                          className={cn(
                            "p-2 rounded-xl shrink-0",
                            isUrgent
                              ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                              : isCritical
                                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                                : isStrategic
                                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                  : "bg-primary text-white shadow-lg shadow-primary/30",
                          )}
                        >
                          {isUrgent ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : isCritical ? (
                            <Wrench className="w-3.5 h-3.5" />
                          ) : isStrategic ? (
                            <Sparkles className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase tracking-wider",
                                isUrgent
                                  ? "text-red-500"
                                  : isCritical
                                    ? "text-amber-600"
                                    : isStrategic
                                      ? "text-emerald-600"
                                      : "text-primary",
                              )}
                            >
                              {isUrgent
                                ? "Urgent Refactor"
                                : isCritical
                                  ? "Critical Need"
                                  : isStrategic
                                    ? "Strategic Goal"
                                    : "System Note"}
                            </span>
                            <div
                              className={cn(
                                "h-1 w-1 rounded-full",
                                isUrgent
                                  ? "bg-red-500"
                                  : isCritical
                                    ? "bg-amber-500"
                                    : isStrategic
                                      ? "bg-emerald-500"
                                      : "bg-primary",
                              )}
                            />
                          </div>
                          <p className="text-xs font-bold leading-relaxed text-foreground/90">
                            {cleanRec}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
