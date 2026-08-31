import React from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Target,
  Clock,
  DollarSign,
  Users,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface RiskAssessmentProps {
  assessment: any;
  reportingData?: {
    statusCounts?: {
      pending: number;
      needIntervention: number;
      solved: number;
      failed: number;
    };
    totalReports?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    avgResolutionTime?: number;
  };
}

interface RiskFactor {
  id: string;
  title: string;
  level: "low" | "medium" | "high" | "critical";
  impact: number;       // consequence severity (0–100) — driven by score deficit
  probability: number;  // likelihood of failure (0–100) — driven by urgency timeline
  mitigation: string;
  timeline: string;
  owner: string;
}

interface MitigationStrategy {
  title: string;
  priority: "immediate" | "short-term" | "long-term";
  cost: "low" | "medium" | "high";
  effectiveness: number;
  description: string;
}

export const RiskAssessment = React.memo(
  ({ assessment, reportingData }: RiskAssessmentProps) => {
    const criticalCount =
      reportingData?.statusCounts?.needIntervention ??
      reportingData?.critical ??
      0;
    const needInterventionCount =
      reportingData?.statusCounts?.needIntervention || 0;
    const avgResolutionTime = reportingData?.avgResolutionTime || 0;

    // ── Semantically distinct axes ────────────────────────────────────────────
    // Impact   = consequence severity if the risk materialises
    // Probability = likelihood of failure in the next 12 months
    //
    // When server-computed values are available (from getSchoolMetrics), prefer
    // them — they incorporate building age, survey staleness, and pop-data gaps
    // that the client-side estimate cannot see.
    const overallScore = Math.min(
      100,
      Math.max(0, parseFloat(String(assessment?.overallScore)) || 0),
    );
    const urgencyMonths: number = assessment?.urgencyMonths ?? 36;
    const infrastructureScore =
      parseFloat(String(assessment?.infrastructureScore)) || 50;
    const populationScore =
      parseFloat(String(assessment?.populationPressureScore)) || 50;

    // Server-computed impact (Phase 4.5) — falls back to score-deficit estimate
    const baseImpact =
      assessment?.riskImpactScore != null
        ? Math.min(100, Math.max(0, parseFloat(String(assessment.riskImpactScore))))
        : Math.min(100, Math.max(0, Math.round(100 - overallScore)));

    // Server-computed probability — falls back to urgency-band estimate
    const baseProbability =
      assessment?.riskProbabilityScore != null
        ? Math.min(100, Math.max(0, parseFloat(String(assessment.riskProbabilityScore))))
        : urgencyMonths === 0
          ? 95
          : urgencyMonths <= 6
            ? 75
            : urgencyMonths <= 12
              ? 55
              : urgencyMonths <= 24
                ? 35
                : 20;

    const resolutionRiskScore =
      avgResolutionTime > 5
        ? Math.min(Math.round((avgResolutionTime / 10) * 100), 100)
        : 0;

    const riskFactors: RiskFactor[] = [
      {
        id: "1",
        title: "Critical Issues Requiring Immediate Attention",
        level:
          criticalCount > 5
            ? "critical"
            : criticalCount > 2
              ? "high"
              : criticalCount > 0
                ? "medium"
                : "low",
        // Impact: base deficit, amplified by critical count (more unresolved = worse outcome)
        impact: Math.min(100, baseImpact + Math.min(20, criticalCount * 4)),
        // Probability: consistently from urgency timeline (independent of impact driver)
        probability: baseProbability,
        mitigation:
          "Prioritize resolution of critical issues through emergency intervention protocols",
        timeline: "1-7 days",
        owner: "Crisis Management Team",
      },
      {
        id: "2",
        title: "Issues Needing Intervention",
        level:
          needInterventionCount > 10
            ? "high"
            : needInterventionCount > 5
              ? "medium"
              : "low",
        // Impact: base deficit, amplified by volume of unresolved interventions
        impact: Math.min(
          100,
          baseImpact + Math.min(15, needInterventionCount * 2),
        ),
        probability: baseProbability,
        mitigation:
          "Deploy intervention teams to address escalated issues before they become critical",
        timeline: "1-4 weeks",
        owner: "Intervention Team",
      },
      {
        id: "3",
        title: "Infrastructure Deterioration",
        level: infrastructureScore < 50 ? "high" : "medium",
        // Impact: infra-specific score deficit (independently meaningful)
        impact: Math.min(
          100,
          Math.max(0, Math.round(100 - infrastructureScore)),
        ),
        probability: baseProbability,
        mitigation:
          "Implement preventive maintenance schedule and prioritize critical repairs",
        timeline: "3-6 months",
        owner: "Facilities Management",
      },
      {
        id: "4",
        title: "Demographic Pressure on Capacity",
        level:
          populationScore < 30
            ? "critical"
            : populationScore < 50
              ? "high"
              : "medium",
        // Impact: population-specific score deficit (capacity headroom deficit)
        impact: Math.min(
          100,
          Math.max(0, Math.round(100 - populationScore)),
        ),
        probability: baseProbability,
        mitigation:
          "Expand facilities or optimize space utilization through scheduling",
        timeline: "6-12 months",
        owner: "School Administration",
      },
      {
        id: "5",
        title: "Slow Resolution Times",
        level:
          avgResolutionTime > 10
            ? "high"
            : avgResolutionTime > 5
              ? "medium"
              : "low",
        // Impact: resolution-time-specific (operational lag severity)
        impact: Math.min(100, resolutionRiskScore),
        probability: baseProbability,
        mitigation:
          "Streamline issue resolution workflows and allocate additional resources",
        timeline: "2-8 weeks",
        owner: "Operations Manager",
      },
    ];

    // ── Mitigation strategies ─────────────────────────────────────────────────
    // Effectiveness must DECREASE when more critical issues exist:
    // more critical = stretched resources = lower expected effectiveness (not higher)
    const mitigationStrategies: MitigationStrategy[] = [
      {
        title: "Emergency Critical Issue Response",
        priority: criticalCount > 0 ? "immediate" : "short-term",
        cost: "high",
        // FIXED: was `90 + criticalCount * 2` (inverted) → now decreases with count
        effectiveness: Math.max(20, Math.min(85, 90 - criticalCount * 8)),
        description: `Address ${criticalCount} critical issue${criticalCount !== 1 ? "s" : ""} requiring immediate intervention through emergency protocols`,
      },
      {
        title: "Intervention Team Deployment",
        priority: needInterventionCount > 5 ? "immediate" : "short-term",
        cost: "medium",
        // FIXED: was `85 + needInterventionCount` (inverted) → now decreases with count
        effectiveness: Math.max(20, Math.min(80, 85 - needInterventionCount * 3)),
        description: `Deploy teams to handle ${needInterventionCount} issue${needInterventionCount !== 1 ? "s" : ""} needing intervention before escalation`,
      },
      {
        title: "Resolution Workflow Optimization",
        priority: avgResolutionTime > 7 ? "immediate" : "short-term",
        cost: avgResolutionTime > 10 ? "high" : "medium",
        // Reasonable as-is: longer delay = less effective optimization ceiling
        effectiveness: Math.max(
          30,
          Math.min(90, 85 - (avgResolutionTime > 5 ? 10 : 0)),
        ),
        description: `Streamline processes to reduce current ${avgResolutionTime.toFixed(1)} day average resolution time`,
      },
      {
        title: "Preventive Maintenance System",
        priority:
          assessment?.infrastructureScore < 50 ? "immediate" : "long-term",
        cost: "low",
        effectiveness: infrastructureScore < 50 ? 85 : 70,
        description:
          "Implement regular maintenance schedule to prevent infrastructure deterioration",
      },
    ];

    const getRiskColor = (level: string) => {
      switch (level) {
        case "critical":
          return "text-red-500 bg-red-500/10 border-red-500/20";
        case "high":
          return "text-orange-500 bg-orange-500/10 border-orange-500/20";
        case "medium":
          return "text-amber-500 bg-amber-500/10 border-amber-500/20";
        case "low":
          return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
        default:
          return "text-slate-500 bg-slate-500/10 border-slate-500/12";
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case "immediate":
          return "text-red-600 bg-red-500/10 border-red-500/20";
        case "short-term":
          return "text-amber-600 bg-amber-500/10 border-amber-500/20";
        case "long-term":
          return "text-blue-600 bg-blue-500/10 border-blue-500/12";
        default:
          return "text-slate-600 bg-slate-500/10 border-slate-500/12";
      }
    };

    const getCostColor = (cost: string) => {
      switch (cost) {
        case "high":
          return "text-red-500";
        case "medium":
          return "text-amber-500";
        case "low":
          return "text-emerald-500";
        default:
          return "text-slate-500";
      }
    };

    const calculateOverallRisk = () => {
      const totalImpact = riskFactors.reduce(
        (sum, risk) => sum + (risk.impact * risk.probability) / 100,
        0,
      );
      const averageRisk = totalImpact / riskFactors.length;

      if (averageRisk > 70)
        return { level: "critical", score: Math.round(averageRisk) };
      if (averageRisk > 50)
        return { level: "high", score: Math.round(averageRisk) };
      if (averageRisk > 30)
        return { level: "medium", score: Math.round(averageRisk) };
      return { level: "low", score: Math.round(averageRisk) };
    };

    const overallRisk = calculateOverallRisk();

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-slate-800 dark:text-white/90 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                <Shield className="w-5 h-5 text-primary opacity-80" />
              </div>
              Risk Assessment & Mitigation
            </h3>
            <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
              Proactive risk management and strategic mitigation planning
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {overallRisk.score}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/60">
              Overall Risk Score
            </div>
            <Badge
              className={cn(
                "mt-1 text-xs font-medium",
                getRiskColor(overallRisk.level),
              )}
            >
              {overallRisk.level.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Risk Matrix */}
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-primary opacity-80" />
              Risk Factor Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {riskFactors.map((risk, index) => (
                <motion.div
                  key={risk.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                          {risk.title}
                        </h4>
                        <Badge
                          className={cn(
                            "text-xs font-medium",
                            getRiskColor(risk.level),
                          )}
                        >
                          {risk.level.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-white/60 mb-3">
                        {risk.mitigation}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {Math.round((risk.impact * risk.probability) / 100)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/60">
                        Risk Score
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500 dark:text-white/60">
                          Impact
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-white">
                          {risk.impact}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                        <div
                          className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${risk.impact}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500 dark:text-white/60">
                          Probability
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-white">
                          {risk.probability}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${risk.probability}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-slate-500 dark:text-white/60">
                        <Clock className="w-3 h-3" />
                        <span>{risk.timeline}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 dark:text-white/60">
                        <Users className="w-3 h-3" />
                        <span>{risk.owner}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mitigation Strategies */}
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <Target className="w-5 h-5 text-primary opacity-80" />
              Strategic Mitigation Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mitigationStrategies.map((strategy, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                        {strategy.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-white/60 mb-3">
                        {strategy.description}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {strategy.effectiveness}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/60">
                        Effectiveness
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${strategy.effectiveness}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className="bg-emerald-500 h-2 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge
                      className={cn(
                        "text-xs font-medium",
                        getPriorityColor(strategy.priority),
                      )}
                    >
                      {strategy.priority.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <DollarSign
                        className={cn("w-3 h-3", getCostColor(strategy.cost))}
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          getCostColor(strategy.cost),
                        )}
                      >
                        {strategy.cost.toUpperCase()} COST
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);
