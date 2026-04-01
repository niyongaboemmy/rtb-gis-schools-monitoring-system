import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  AlertTriangle,
  Clock,
  BarChart3,
  Activity,
  Target,
  DollarSign,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";

interface ReportingAnalyticsProps {
  schoolId: string;
}

interface ReportData {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  trends: {
    monthly: number[];
    weekly: number[];
  };
  avgResolutionTime: number;
  categories: {
    infrastructure: number;
    safety: number;
    maintenance: number;
    academic: number;
    other: number;
  };
}

interface DecisionImpact {
  roi: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  timeToImpact: number;
  stakeholderImpact: number;
  budgetImpact: number;
  recommendations: string[];
}

export const ReportingAnalytics = React.memo(
  ({ schoolId }: ReportingAnalyticsProps) => {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [decisionImpact, setDecisionImpact] = useState<DecisionImpact | null>(
      null,
    );
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter">(
      "month",
    );

    useEffect(() => {
      const fetchReportingData = async () => {
        try {
          setLoading(true);
          // Fetch backend Reporting data
          const response = await api.get(`/api/v1/schools/dashboard/reporting?schoolId=${schoolId}`);
          const payload = response.data?.data ?? response.data ?? {};
          const reports = payload?.reports ?? {};
          const analytics = payload?.analytics ?? {};
          const decision = payload?.decisionAssessment ?? {};

          // Derive counts from the backend payload (fallback to 0 if missing)
          const total = (reports as any).generatedReportCount ?? 0;
          const open = (reports as any).open ?? 0;
          const inProgress = (reports as any).inProgress ?? 0;
          const resolved = (reports as any).resolved ?? 0;
          const critical = (reports as any).critical ?? 0;
          const high = (reports as any).high ?? 0;
          const medium = (reports as any).medium ?? 0;
          const low = (reports as any).low ?? 0;

          // Trends (from backend, if provided) otherwise keep empty arrays
          const monthly = (analytics as any).trends?.monthly ?? [];
          const weekly = (analytics as any).trends?.weekly ?? [];

          const avgResolutionTime = (reports as any).avgResolutionTime ?? (payload?.avgResolutionTime ?? 0);

          // Categories from backend if available
          const categories = (reports as any).categories ?? {
            infrastructure: 0,
            safety: 0,
            maintenance: 0,
            academic: 0,
            other: 0,
          };

          setReportData({
            total,
            open,
            inProgress,
            resolved,
            critical,
            high,
            medium,
            low,
            trends: { monthly, weekly },
            avgResolutionTime,
            categories,
          });

          // Dynamic decision impact derived from backend analytics (if available)
          setDecisionImpact({
            roi: (decision as any).overallScore ?? 0,
            riskLevel: ((decision as any).weightBreakdown?.[0]?.category ?? 'medium') as any,
            timeToImpact: 6,
            stakeholderImpact: (analytics as any).trendScore ?? 0,
            budgetImpact: (reports as any).budgetImpact ?? 0,
            recommendations:
              (decision as any).weightBreakdown?.length > 0
                ? ((decision as any).weightBreakdown?.map((w: any) => w.category) || [])
                : [
                    "Consider updating reporting cadence",
                  ],
          });
        } catch (error) {
          console.error("Failed to fetch reporting data:", error);
        } finally {
          setLoading(false);
        }
      };

      if (schoolId) {
        fetchReportingData();
      }
    }, [schoolId]);

    const getTrendIcon = (current: number, previous: number) => {
      if (current > previous)
        return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
      if (current < previous)
        return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      return <Minus className="w-4 h-4 text-slate-400" />;
    };

    const getRiskColor = (risk: string) => {
      switch (risk) {
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

    if (loading) {
      return (
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-100 dark:bg-white/5 rounded-2xl w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-slate-100 dark:bg-white/5 rounded-3xl"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-slate-800 dark:text-white/90 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/30">
                <FileText className="w-5 h-5 text-primary opacity-80" />
              </div>
              Reporting & Analytics
            </h3>
            <p className="text-sm text-slate-500 dark:text-white/60 mt-1">
              Real-time insights for strategic decision-making
            </p>
          </div>

          <div className="flex items-center gap-2">
            {["week", "month", "quarter"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-medium transition-all",
                  timeRange === range
                    ? "bg-primary text-white"
                    : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10",
                )}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Reports */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-all rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(
                      reportData?.trends.monthly[11] || 0,
                      reportData?.trends.monthly[10] || 0,
                    )}
                    <span className="text-xs text-slate-500">+12%</span>
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {reportData?.total || 0}
                </h4>
                <p className="text-sm text-slate-500 dark:text-white/60">
                  Total Reports
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-500">
                      {reportData?.resolved || 0} resolved
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-slate-500">
                      {reportData?.open || 0} open
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Critical Issues */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-all rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-xl bg-red-500/5 border border-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-red-500/10 text-red-600 border-red-500/20"
                  >
                    Action Required
                  </Badge>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {reportData?.critical || 0}
                </h4>
                <p className="text-sm text-slate-500 dark:text-white/60">
                  Critical Issues
                </p>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">High Priority</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {reportData?.high || 0}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                    <div
                      className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${((reportData?.critical || 0) / (reportData?.total || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Resolution Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-all rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <Clock className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-slate-500">-18%</span>
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {reportData?.avgResolutionTime || 0}
                </h4>
                <p className="text-sm text-slate-500 dark:text-white/60">
                  Avg Resolution (days)
                </p>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full w-3/4 transition-all duration-500" />
                    </div>
                    <span className="text-xs text-slate-500">75% target</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ROI Impact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-all rounded-3xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <DollarSign className="w-5 h-5 text-purple-500" />
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20"
                  >
                    High Impact
                  </Badge>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                  {decisionImpact?.roi || 0}%
                </h4>
                <p className="text-sm text-slate-500 dark:text-white/60">
                  Expected ROI
                </p>
                <div className="mt-3">
                  <div className="text-xs text-slate-500">
                    Budget Impact: $
                    {(decisionImpact?.budgetImpact || 0).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Detailed Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Issue Categories */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-primary opacity-80" />
                Issue Categories Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Object.entries(reportData?.categories || {}).map(
                  ([category, count]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-white/80 capitalize">
                          {category}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-white/60">
                          {count} issues
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(count / (reportData?.total || 1)) * 100}%`,
                          }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className={cn(
                            "h-2 rounded-full",
                            category === "infrastructure"
                              ? "bg-blue-500"
                              : category === "safety"
                                ? "bg-red-500"
                                : category === "maintenance"
                                  ? "bg-amber-500"
                                  : category === "academic"
                                    ? "bg-emerald-500"
                                    : "bg-slate-500",
                          )}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          {/* Decision Impact Assessment */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <Target className="w-5 h-5 text-primary opacity-80" />
                Decision Impact Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Risk Level */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-white/80">
                      Risk Level
                    </p>
                    <p className="text-xs text-slate-500 dark:text-white/60">
                      Current assessment
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "text-xs font-medium",
                      getRiskColor(decisionImpact?.riskLevel || "medium"),
                    )}
                  >
                    {decisionImpact?.riskLevel?.toUpperCase() || "MEDIUM"}
                  </Badge>
                </div>

                {/* Impact Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-slate-500 dark:text-white/60">
                        Stakeholder Impact
                      </span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {decisionImpact?.stakeholderImpact || 0}%
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-slate-500 dark:text-white/60">
                        Time to Impact
                      </span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {decisionImpact?.timeToImpact || 0} months
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">
                    Strategic Recommendations
                  </p>
                  <div className="space-y-2">
                    {decisionImpact?.recommendations
                      ?.slice(0, 3)
                      .map((rec, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                          <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                            {rec}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend Analysis */}
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <Activity className="w-5 h-5 text-primary opacity-80" />
              Reporting Trends & Patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-48 flex items-end justify-between gap-2">
                    {reportData?.trends?.monthly?.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ height: 0 }}
                  animate={{
                    height: `${(value / Math.max(...reportData.trends.monthly)) * 100}%`,
                  }}
                  transition={{ duration: 0.8, delay: index * 0.05 }}
                  className="flex-1 bg-linear-to-t from-blue-500 to-blue-500/30 rounded-t-lg relative group cursor-pointer"
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {value} reports
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-xs text-slate-500 dark:text-white/60">
              <span>Jan</span>
              <span>Mar</span>
              <span>May</span>
              <span>Jul</span>
              <span>Sep</span>
              <span>Nov</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);
