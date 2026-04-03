import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity,
  Target,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";
import {
  severityLabelFromStatus,
  type IssueSeverityLabel,
} from "../../lib/issueReportMetrics";

interface ReportingTabProps {
  schoolId: string;
}

interface ReportData {
  totalReports: number;
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
  statusCounts?: {
    pending: number;
    needIntervention: number;
    solved: number;
    failed: number;
  };
}

export const ReportingTab = React.memo(({ schoolId }: ReportingTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const [issueFilter, setIssueFilter] = useState<IssueSeverityLabel | "All">(
    "All",
  );
  const [loading, setLoading] = useState(true);

  const loadReportingData = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);

      const [dashRes, reportsRes] = await Promise.all([
        api.get(`/schools/dashboard/reporting?schoolId=${schoolId}`),
        api.get(`/reports?schoolId=${schoolId}&limit=200`),
      ]);

      const payload = dashRes.data?.data ?? dashRes.data ?? {};
      const reports = payload?.reports ?? {};
      const analytics = payload?.analytics ?? {};

      const totalReports = (reports as any).generatedReportCount ?? 0;
      const monthly = (analytics as any).trends?.monthly ?? [];
      const weekly = (analytics as any).trends?.weekly ?? [];
      const avgResolutionTime = (reports as any).avgResolutionTime ?? 0;

      const categories = (reports as any).categories ?? {
        infrastructure: 0,
        safety: 0,
        maintenance: 0,
        academic: 0,
        other: 0,
      };

      const statusCounts = (reports as any).statusCounts || {
        pending: 0,
        needIntervention: 0,
        solved: 0,
        failed: 0,
      };

      setReportData({
        totalReports,
        open: statusCounts.pending || 0,
        inProgress: statusCounts.needIntervention || 0,
        resolved: statusCounts.solved || 0,
        critical:
          (reports as any).severityFromStatus?.critical ??
          (reports as any).critical ??
          0,
        high:
          (reports as any).severityFromStatus?.high ??
          (reports as any).high ??
          0,
        medium:
          (reports as any).severityFromStatus?.medium ??
          (reports as any).medium ??
          0,
        low:
          (reports as any).severityFromStatus?.low ?? (reports as any).low ?? 0,
        trends: { monthly, weekly },
        avgResolutionTime,
        categories,
        statusCounts,
      });

      const raw = reportsRes.data?.data ?? [];
      setRecentIssues(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error("Failed to fetch reporting data:", error);
      setRecentIssues([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadReportingData();
  }, [loadReportingData]);

  const filteredIssues = useMemo(() => {
    const sorted = [...recentIssues].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (issueFilter === "All") return sorted;
    return sorted.filter(
      (r) => severityLabelFromStatus(r.status) === issueFilter,
    );
  }, [recentIssues, issueFilter]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-200 dark:border-blue-500/20">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "trends", label: "Trends", icon: TrendingUp },
          { id: "issues", label: "Issues", icon: AlertTriangle },
          { id: "performance", label: "Performance", icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeSubTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Based on Active Tab */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Status Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {reportData?.totalReports || 0}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/60">
                      Total Reports
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {reportData?.statusCounts?.pending || 0}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/60">
                      PENDING
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500/10">
                    <Activity className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {reportData?.statusCounts?.needIntervention || 0}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/60">
                      NEED INTERVENTION
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {reportData?.statusCounts?.solved || 0}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/60">
                      RESOLVED
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Priority Breakdown */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-primary" />
                Status-based severity (from IssueReport.status)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                    {reportData?.critical || 0}
                  </div>
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                    Critical
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Immediate action
                  </div>
                </div>

                <div className="text-center p-4 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/20">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                    {reportData?.high || 0}
                  </div>
                  <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    High
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Urgent
                  </div>
                </div>

                <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                    {reportData?.medium || 0}
                  </div>
                  <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Medium
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Standard
                  </div>
                </div>

                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    {reportData?.low || 0}
                  </div>
                  <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Low
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Minor
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Resolution Time */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                Average Resolution Time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {reportData?.avgResolutionTime?.toFixed(1) ?? "0.0"}
                  <span className="text-lg font-normal text-slate-500 dark:text-white/60 ml-2">
                    days
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-white/60">
                  Average time to resolve issues
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === "trends" && (
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              Reporting Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {loading ? (
                <div className="h-64 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20 flex items-center justify-center">
                  <div className="text-center text-slate-500 dark:text-white/60">
                    <BarChart3 className="w-12 h-12 mb-2" />
                    Loading trends data...
                  </div>
                </div>
              ) : reportData?.trends?.monthly?.length &&
                reportData?.trends?.monthly?.length > 0 ? (
                <>
                  <div className="h-64 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20 flex items-center justify-center">
                    <div className="text-center text-slate-500 dark:text-white/60">
                      <BarChart3 className="w-12 h-12 mb-2" />
                      Displaying {reportData?.trends?.monthly?.length || 0}{" "}
                      months of data
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Calculate peak month dynamically */}
                    {(() => {
                      const monthly = reportData?.trends?.monthly || [];
                      const maxCount = Math.max(...monthly);
                      const peakIndex = monthly.indexOf(maxCount);
                      const months = [
                        "Jan",
                        "Feb",
                        "Mar",
                        "Apr",
                        "May",
                        "Jun",
                        "Jul",
                        "Aug",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dec",
                      ];
                      // Calculate which month the peakIndex represents (0 = current month, 11 = 11 months ago)
                      const now = new Date();
                      const peakMonthIndex =
                        (now.getMonth() - (11 - peakIndex) + 12) % 12;
                      const peakMonthName = months[peakMonthIndex];

                      return (
                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                            Peak Month
                          </h4>
                          <p className="text-2xl font-bold text-primary">
                            {peakMonthName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-white/60">
                            {maxCount} reports filed
                          </p>
                        </div>
                      );
                    })()}
                    {/* Total reports in last 12 months */}
                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                        12-Month Total
                      </h4>
                      <p className="text-2xl font-bold text-primary">
                        {reportData?.trends?.monthly?.reduce(
                          (a, b) => a + b,
                          0,
                        ) || 0}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/60">
                        Total reports
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-64 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20 flex items-center justify-center">
                  <div className="text-center text-slate-500 dark:text-white/60">
                    <BarChart3 className="w-12 h-12 mb-2" />
                    No trends data available
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSubTab === "issues" && (
        <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Recent Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Filter Options */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/60">
                  <Filter className="w-4 h-4" />
                  <span>Filter by severity (from status):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["All", "Critical", "High", "Medium", "Low"] as const).map(
                    (key) => (
                      <Button
                        key={key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIssueFilter(key)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          issueFilter === key
                            ? "bg-primary text-white shadow-sm border-primary"
                            : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10",
                        )}
                      >
                        {key}
                      </Button>
                    ),
                  )}
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20 animate-pulse"
                    >
                      <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-slate-100 dark:bg-white/5 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredIssues.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-white/60 py-8 text-center">
                  {recentIssues.length === 0
                    ? "No issue reports for this school yet."
                    : "No issues match this filter."}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-white/50 mb-2">
                    Showing {filteredIssues.length} report
                    {filteredIssues.length !== 1 ? "s" : ""}
                    {issueFilter !== "All" ? ` (${issueFilter})` : ""}
                  </p>
                  {filteredIssues.map((issue) => {
                    const sev = severityLabelFromStatus(issue.status);
                    const buildingName = issue.building?.name;
                    const reporter = issue.reporter
                      ? [issue.reporter.firstName, issue.reporter.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || issue.reporter.email
                      : null;
                    const when = issue.createdAt
                      ? new Date(issue.createdAt).toLocaleString()
                      : "—";
                    return (
                      <div
                        key={issue.id}
                        className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1 line-clamp-2">
                              {issue.description?.trim()
                                ? issue.description
                                : `Report ${String(issue.id).slice(0, 8)}…`}
                            </h4>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-white/50">
                              <span>
                                Status:{" "}
                                <span className="font-medium text-slate-700 dark:text-white/70">
                                  {String(issue.status ?? "").replace(/_/g, " ")}
                                </span>
                              </span>
                              {buildingName ? (
                                <span>Building: {buildingName}</span>
                              ) : null}
                              {reporter ? <span>Reporter: {reporter}</span> : null}
                              <span>{when}</span>
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              "text-xs font-medium shrink-0",
                              sev === "Critical"
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : sev === "High"
                                  ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                  : sev === "Medium"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                            )}
                          >
                            {sev.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeSubTab === "performance" && (
        <div className="space-y-6">
          {/* Dynamic Performance Metrics */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <Target className="w-5 h-5 text-purple-500" />
                Resolution Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Resolution Rate */}
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    {(reportData?.totalReports || 0) > 0
                      ? (
                          ((reportData?.resolved || 0) /
                            (reportData?.totalReports || 1)) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </div>
                  <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Resolution Rate
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    {reportData?.resolved || 0} of{" "}
                    {reportData?.totalReports || 0}
                  </div>
                </div>

                {/* Response Time */}
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {reportData?.avgResolutionTime?.toFixed(1) ?? "0.0"}
                  </div>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Avg Days
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Resolution time
                  </div>
                </div>

                {/* Critical Issues */}
                <div className="text-center p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                    {reportData?.critical || 0}
                  </div>
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                    Critical
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Need attention
                  </div>
                </div>

                {/* Open Issues */}
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                    {reportData?.open || 0}
                  </div>
                  <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Open
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/60 mt-1">
                    Pending
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card className="border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/20">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                Complete Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {[
                  {
                    label: "Total",
                    value: reportData?.totalReports || 0,
                    color: "bg-slate-500",
                  },
                  {
                    label: "Open",
                    value: reportData?.open || 0,
                    color: "bg-amber-500",
                  },
                  {
                    label: "In Progress",
                    value: reportData?.inProgress || 0,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Resolved",
                    value: reportData?.resolved || 0,
                    color: "bg-emerald-500",
                  },
                  {
                    label: "Critical",
                    value: reportData?.critical || 0,
                    color: "bg-red-500",
                  },
                  {
                    label: "High",
                    value: reportData?.high || 0,
                    color: "bg-orange-500",
                  },
                  {
                    label: "Medium",
                    value: reportData?.medium || 0,
                    color: "bg-yellow-500",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="text-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/20"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${item.color} mx-auto mb-2`}
                    />
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {item.value}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/60">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            type="button"
            disabled={loading}
            onClick={() => void loadReportingData()}
          >
            <RefreshCw
              className={cn("w-3 h-3 mr-1", loading && "animate-spin")}
            />
            Refresh Data
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Export Report
          </Button>
        </div>
        <div className="text-xs text-slate-400 dark:text-white/60">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
});
