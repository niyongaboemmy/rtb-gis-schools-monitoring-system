import React from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Target,
  Clock,
  DollarSign,
  Users,
  HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { formatNumber, formatPercent } from "../../lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { MetricInfo } from "../metric-help/MetricInfo";

/** Shape of `riskAssessment` from GET /analytics/schools/:id/metrics (server: risk-assessment.ts). */
export interface RiskAssessmentData {
  indicative: true;
  impactScore: number;
  probabilityScore: number;
  overall: { score: number; level: RiskLevel; rule: string };
  factors: Array<{
    id: string;
    title: string;
    level: RiskLevel;
    impact: number;
    probability: number;
    riskScore: number;
    mitigation: string;
    timeline: string;
    owner: string;
    rule: string;
  }>;
  strategies: Array<{
    id: string;
    title: string;
    priority: "immediate" | "short-term" | "long-term";
    cost: "low" | "medium" | "high";
    effectiveness: number;
    description: string;
    rule: string;
  }>;
  rules: { impact: string; probability: string };
}

type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskAssessmentProps {
  /** Server-computed indicative risk. null → not available yet. */
  risk: RiskAssessmentData | null | undefined;
}

const LEVEL_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  immediate: "Immediate",
  "short-term": "Short term",
  "long-term": "Long term",
};

/** Small "rule" tooltip trigger — every indicative number shows how it was made. */
function RuleTip({ rule, label }: { rule: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: how is this worked out?`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-normal normal-case tracking-normal text-[12px] font-medium leading-snug">
        {rule}
      </TooltipContent>
    </Tooltip>
  );
}

export const RiskAssessment = React.memo(
  ({ risk }: RiskAssessmentProps) => {
    if (!risk) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center text-sm text-slate-500 dark:text-white/50">
          Indicative risk is not available yet. It appears once the school has been scored.
        </div>
      );
    }
    const riskFactors = risk.factors;
    const mitigationStrategies = risk.strategies;
    const overallRisk = risk.overall;

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


    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-medium text-slate-800 dark:text-white/90 flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                <Shield className="w-5 h-5 text-primary opacity-80" />
              </div>
              Risk & mitigation
              <Badge className="text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Indicative
              </Badge>
              <MetricInfo id="risk.overall" />
            </h3>
            <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
              Rules of thumb to help plan. Not part of the School Condition Score and not a measurement.
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatNumber(overallRisk.score)}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/60 flex items-center justify-end gap-1">
              Indicative risk
              <RuleTip rule={overallRisk.rule} label="Indicative risk" />
            </div>
            <Badge
              className={cn(
                "mt-1 text-xs font-medium",
                getRiskColor(overallRisk.level),
              )}
            >
              {LEVEL_LABEL[overallRisk.level] ?? overallRisk.level}
            </Badge>
          </div>
        </div>

        {/* Risk Matrix */}
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-primary opacity-80" />
              Risk factors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
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
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                          {risk.title}
                        </h4>
                        <RuleTip rule={risk.rule} label={risk.title} />
                        <Badge
                          className={cn(
                            "text-xs font-medium",
                            getRiskColor(risk.level),
                          )}
                        >
                          {LEVEL_LABEL[risk.level] ?? risk.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-white/60 mb-3">
                        {risk.mitigation}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatNumber(risk.riskScore)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/60">
                        Risk
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500 dark:text-white/60 flex items-center gap-1">
                          Impact
                          <MetricInfo id="risk.impact" size="xs" />
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-white tabular-nums">
                          {formatNumber(risk.impact)}
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
                        <span className="text-xs text-slate-500 dark:text-white/60 flex items-center gap-1">
                          Probability
                          <MetricInfo id="risk.probability" size="xs" />
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-white tabular-nums">
                          {formatNumber(risk.probability)}
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
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
              Mitigation options
              <MetricInfo id="risk.mitigation" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mitigationStrategies.map((strategy, index) => (
                <motion.div
                  key={strategy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2 flex items-center gap-1">
                        {strategy.title}
                        <RuleTip rule={strategy.rule} label={strategy.title} />
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-white/60 mb-3">
                        {strategy.description}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatPercent(strategy.effectiveness)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/60">
                        Est. effectiveness
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
                      {LEVEL_LABEL[strategy.priority] ?? strategy.priority}
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
                        {LEVEL_LABEL[strategy.cost] ?? strategy.cost} cost
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
