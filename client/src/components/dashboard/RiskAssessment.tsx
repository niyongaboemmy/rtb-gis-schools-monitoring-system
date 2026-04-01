import React from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Target,
  Zap,
  Clock,
  DollarSign,
  Users,
  AlertCircle,
  Info,
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
  impact: number;
  probability: number;
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
    // Extract actual report counts for dynamic risk calculation
    const criticalCount = reportingData?.critical || 0;
    const needInterventionCount =
      reportingData?.statusCounts?.needIntervention || 0;
    const totalReports = reportingData?.totalReports || 0;
    const avgResolutionTime = reportingData?.avgResolutionTime || 0;

    // Calculate risk scores based on actual report data
    const criticalRiskScore =
      totalReports > 0 ? (criticalCount / totalReports) * 100 : 0;
    const interventionRiskScore =
      totalReports > 0 ? (needInterventionCount / totalReports) * 100 : 0;
    const resolutionRiskScore =
      avgResolutionTime > 5 ? Math.min((avgResolutionTime / 10) * 100, 100) : 0;

    // Dynamic risk factors based on actual report data
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
        impact: Math.min(criticalRiskScore * 1.2, 100),
        probability: Math.min(criticalRiskScore * 1.5, 100),
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
        impact: Math.min(interventionRiskScore * 1.1, 100),
        probability: Math.min(interventionRiskScore * 1.3, 100),
        mitigation:
          "Deploy intervention teams to address escalated issues before they become critical",
        timeline: "1-4 weeks",
        owner: "Intervention Team",
      },
      {
        id: "3",
        title: "Infrastructure Deterioration",
        level: assessment.infrastructureScore < 50 ? "high" : "medium",
        impact: assessment.infrastructureScore < 50 ? 85.0 : 45.0,
        probability: assessment.infrastructureScore < 50 ? 75.0 : 45.0,
        mitigation:
          "Implement preventive maintenance schedule and prioritize critical repairs",
        timeline: "3-6 months",
        owner: "Facilities Management",
      },
      {
        id: "4",
        title: "Overcapacity Issues",
        level:
          assessment.populationPressureScore > 80
            ? "critical"
            : assessment.populationPressureScore > 60
              ? "high"
              : "medium",
        impact: assessment.populationPressureScore > 80 ? 90.0 : 60.0,
        probability: assessment.populationPressureScore > 80 ? 85.0 : 60.0,
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
        impact: Math.min(resolutionRiskScore, 100),
        probability: Math.min(resolutionRiskScore * 1.2, 100),
        mitigation:
          "Streamline issue resolution workflows and allocate additional resources",
        timeline: "2-8 weeks",
        owner: "Operations Manager",
      },
    ];

    // Dynamic mitigation strategies based on actual risk levels
    const mitigationStrategies: MitigationStrategy[] = [
      {
        title: "Emergency Critical Issue Response",
        priority: criticalCount > 0 ? "immediate" : "short-term",
        cost: "high",
        effectiveness: Math.min(90 + criticalCount * 2, 100),
        description: `Address ${criticalCount} critical issue${criticalCount !== 1 ? "s" : ""} requiring immediate intervention through emergency protocols`,
      },
      {
        title: "Intervention Team Deployment",
        priority: needInterventionCount > 5 ? "immediate" : "short-term",
        cost: "medium",
        effectiveness: Math.min(85 + needInterventionCount, 100),
        description: `Deploy teams to handle ${needInterventionCount} issue${needInterventionCount !== 1 ? "s" : ""} needing intervention before escalation`,
      },
      {
        title: "Resolution Workflow Optimization",
        priority: avgResolutionTime > 7 ? "immediate" : "short-term",
        cost: avgResolutionTime > 10 ? "high" : "medium",
        effectiveness: Math.min(80 + (avgResolutionTime > 5 ? 10 : 0), 100),
        description: `Streamline processes to reduce current ${avgResolutionTime.toFixed(1)} day average resolution time`,
      },
      {
        title: "Preventive Maintenance System",
        priority:
          assessment.infrastructureScore < 50 ? "immediate" : "long-term",
        cost: "low",
        effectiveness: assessment.infrastructureScore < 50 ? 85 : 70,
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
          return "text-slate-500 bg-slate-500/10 border-slate-500/20";
      }
    };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case "immediate":
          return "text-red-600 bg-red-500/10 border-red-500/20";
        case "short-term":
          return "text-amber-600 bg-amber-500/10 border-amber-500/20";
        case "long-term":
          return "text-blue-600 bg-blue-500/10 border-blue-500/20";
        default:
          return "text-slate-600 bg-slate-500/10 border-slate-500/20";
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
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/30">
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
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
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
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
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
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
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
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
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

        {/* Risk Heatmap */}
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary opacity-80" />
              Risk Impact Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-5 gap-2">
              {/* Header */}
              <div></div>
              {["Very Low", "Low", "Medium", "High", "Very High"].map(
                (label, i) => (
                  <div
                    key={i}
                    className="text-xs text-center text-slate-500 dark:text-white/60 font-medium"
                  >
                    {label}
                  </div>
                ),
              )}

              {/* Rows */}
              {["Very Low", "Low", "Medium", "High", "Very High"].map(
                (probLabel, i) => (
                  <React.Fragment key={i}>
                    <div className="text-xs text-right text-slate-500 dark:text-white/60 font-medium pr-2 flex items-center justify-end">
                      {probLabel}
                    </div>
                    {[0, 1, 2, 3, 4].map((j) => {
                      const impact = (j + 1) * 20;
                      const probability = (5 - i) * 20;
                      const riskScore = (impact * probability) / 100;
                      const hasRisk = riskFactors.some(
                        (risk) =>
                          Math.abs(risk.impact - impact) < 20 &&
                          Math.abs(risk.probability - probability) < 20,
                      );

                      return (
                        <div
                          key={j}
                          className={cn(
                            "aspect-square rounded-lg border border-slate-200 dark:border-blue-500/20 flex items-center justify-center text-xs font-medium",
                            riskScore > 60
                              ? "bg-red-500/20 text-red-600 border-red-500/30"
                              : riskScore > 40
                                ? "bg-orange-500/20 text-orange-600 border-orange-500/30"
                                : riskScore > 20
                                  ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
                                  : "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
                            hasRisk && "ring-2 ring-primary/50",
                          )}
                        >
                          {hasRisk && <AlertCircle className="w-3 h-3" />}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ),
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-white/60">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"></div>
                  <span>Low Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30"></div>
                  <span>Medium Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"></div>
                  <span>High Risk</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Probability vs Impact</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);
