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
  RefreshCw,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { SkeletonCards } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";
import { formatDateTime, formatNumber, formatPercent } from "../../lib/format";
import { label } from "../../lib/labels";
import {
  normalizeReportStatus,
  type IssueReportLike,
} from "../../lib/issueReportMetrics";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { MetricId } from "../metric-help/metrics";
import { DashboardError } from "./DashboardStates";

interface ReportingTabProps {
  schoolId: string;
}

type StatusKey = "PENDING" | "NEED_INTERVENTION" | "FAILED" | "SOLVED";
const STATUS_ORDER: StatusKey[] = ["PENDING", "NEED_INTERVENTION", "FAILED", "SOLVED"];

/** Subset of GET /schools/dashboard/reporting → data.reports used here. */
interface ReportingPayload {
  generatedReportCount?: number;
  avgResolutionTime?: number;
  trends?: { monthly?: number[]; weekly?: number[] };
  statusCounts?: { pending: number; needIntervention: number; solved: number; failed: number };
}

interface IssueRow extends IssueReportLike {
  id: string;
  description?: string | null;
  building?: { name?: string | null } | null;
}

interface ReportData {
  totalReports: number;
  monthly: number[];
  avgResolutionTime: number | null;
  counts: Record<StatusKey, number>;
}

const STATUS_STYLE: Record<StatusKey, { tone: string; icon: React.ComponentType<{ className?: string }>; metricId?: MetricId }> = {
  PENDING: { tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock },
  NEED_INTERVENTION: { tone: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20", icon: Activity, metricId: "reports.needsIntervention" },
  FAILED: { tone: "text-slate-600 dark:text-slate-300 bg-slate-500/10 border-slate-500/20", icon: XCircle },
  SOLVED: { tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle, metricId: "reports.resolved" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ReportingTab = React.memo(({ schoolId }: ReportingTabProps) => {
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [recentIssues, setRecentIssues] = useState<IssueRow[]>([]);
  const [issueFilter, setIssueFilter] = useState<StatusKey | "All">("All");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const loadReportingData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [dashRes, reportsRes] = await Promise.all([
        api.get(`/schools/dashboard/reporting?schoolId=${schoolId}`),
        api.get(`/reports?schoolId=${schoolId}&limit=200`),
      ]);

      const payload = dashRes.data?.data ?? dashRes.data ?? {};
      const reports: ReportingPayload = payload?.reports ?? {};
      const sc = reports.statusCounts ?? { pending: 0, needIntervention: 0, solved: 0, failed: 0 };

      setReportData({
        totalReports: reports.generatedReportCount ?? 0,
        monthly: payload?.analytics?.trends?.monthly ?? reports.trends?.monthly ?? [],
        avgResolutionTime:
          typeof reports.avgResolutionTime === "number" && sc.solved > 0
            ? reports.avgResolutionTime
            : null,
        counts: {
          PENDING: sc.pending ?? 0,
          NEED_INTERVENTION: sc.needIntervention ?? 0,
          FAILED: sc.failed ?? 0,
          SOLVED: sc.solved ?? 0,
        },
      });

      const raw = reportsRes.data?.data ?? [];
      setRecentIssues(Array.isArray(raw) ? raw : []);
      setLoadedAt(new Date());
    } catch (error) {
      console.error("Failed to fetch reporting data:", error);
      setLoadError(true);
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
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
    if (issueFilter === "All") return sorted;
    return sorted.filter((r) => normalizeReportStatus(r.status) === issueFilter);
  }, [recentIssues, issueFilter]);

  // Last 12 months, oldest first (server returns index 11 = current month).
  const monthlyChart = useMemo(() => {
    const monthly = reportData?.monthly ?? [];
    const now = new Date();
    return monthly.map((count, i) => ({
      month: MONTHS[(now.getMonth() - (monthly.length - 1 - i) + 120) % 12],
      reports: count,
    }));
  }, [reportData]);

  const total = reportData?.totalReports ?? 0;
  const resolved = reportData?.counts.SOLVED ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : null;
  const openCount =
    (reportData?.counts.PENDING ?? 0) +
    (reportData?.counts.NEED_INTERVENTION ?? 0) +
    (reportData?.counts.FAILED ?? 0);

  if (loadError && !reportData) {
    return (
      <DashboardError
        title="We couldn't load the Issue Reports"
        onRetry={() => void loadReportingData()}
        retrying={loading}
      />
    );
  }

  const cardCls = "border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 rounded-2xl overflow-hidden";

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div role="tablist" aria-label="Issue Report views" className="flex gap-2 p-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-200 dark:border-blue-500/12 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "trends", label: "Trends", icon: TrendingUp },
          { id: "issues", label: "Reports", icon: AlertTriangle },
          { id: "performance", label: "Resolution", icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeSubTab === tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
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

      {loading && !reportData && <SkeletonCards count={5} className="lg:grid-cols-5" />}

      {activeSubTab === "overview" && reportData && (
        <div className="space-y-6">
          {total === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center">
              <p className="font-medium text-slate-800 dark:text-white">No Issue Reports for this school yet</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
                School users can report a problem from the Reporting page. Reports appear here as soon as they are filed.
              </p>
            </div>
          )}
          {/* Status Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className={cn(cardCls, "col-span-2 md:col-span-1")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatNumber(total)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-white/60">All Issue Reports</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {STATUS_ORDER.map((key) => {
              const st = STATUS_STYLE[key];
              return (
                <Card key={key} className={cardCls}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-xl border", st.tone)}>
                        <st.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatNumber(reportData.counts[key])}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1">
                          {label("reportStatus", key)}
                          {st.metricId && <MetricInfo id={st.metricId} size="xs" />}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Avg Resolution Time */}
          <Card className={cardCls}>
            <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
              <CardTitle className="text-base font-medium flex items-center gap-3">
                <Activity className="w-5 h-5 text-blue-500" />
                Average resolution time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2 tabular-nums">
                  {reportData.avgResolutionTime == null ? "—" : formatNumber(reportData.avgResolutionTime, 1)}
                  {reportData.avgResolutionTime != null && (
                    <span className="text-lg font-normal text-slate-500 dark:text-white/60 ml-2">days</span>
                  )}
                </div>
                <div className="text-sm text-slate-600 dark:text-white/60">
                  {reportData.avgResolutionTime == null
                    ? "No Resolved reports yet to measure."
                    : "From report to Resolved, averaged over Resolved reports"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === "trends" && reportData && (
        <Card className={cardCls}>
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              Reports filed per month
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {monthlyChart.some((m) => m.reports > 0) ? (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
                      <RechartsTooltip
                        formatter={(v) => [formatNumber(Number(v)), "Reports"]}
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="reports" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {(() => {
                    const peak = monthlyChart.reduce((a, b) => (b.reports > a.reports ? b : a), monthlyChart[0]);
                    return (
                      <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/12">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Busiest month</h4>
                        <p className="text-2xl font-bold text-primary">{peak.month}</p>
                        <p className="text-xs text-slate-600 dark:text-white/60">{formatNumber(peak.reports)} reports filed</p>
                      </div>
                    );
                  })()}
                  <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/12">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Last 12 months</h4>
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {formatNumber(monthlyChart.reduce((a, b) => a + b.reports, 0))}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-white/60">Reports filed</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-600 dark:text-white/60">
                <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
                No reports filed in the last 12 months.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSubTab === "issues" && (
        <Card className={cardCls}>
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Recent Issue Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/60">
                  <Filter className="w-4 h-4" />
                  <span>Filter by status:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["All", ...STATUS_ORDER] as const).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={issueFilter === key}
                      onClick={() => setIssueFilter(key)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        issueFilter === key
                          ? "bg-primary text-white shadow-sm border-primary"
                          : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10",
                      )}
                    >
                      {key === "All" ? "All" : label("reportStatus", key)}
                    </Button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/12 animate-pulse motion-reduce:animate-none"
                    >
                      <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-slate-100 dark:bg-white/5 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredIssues.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-white/60 py-8 text-center">
                  {recentIssues.length === 0
                    ? "No Issue Reports for this school yet."
                    : "No reports match this filter."}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-white/50 mb-2">
                    Showing {formatNumber(filteredIssues.length)} report
                    {filteredIssues.length !== 1 ? "s" : ""}
                    {issueFilter !== "All" ? ` (${label("reportStatus", issueFilter)})` : ""}
                  </p>
                  {filteredIssues.map((issue) => {
                    const st = normalizeReportStatus(issue.status) as StatusKey;
                    const tone = STATUS_STYLE[st]?.tone ?? STATUS_STYLE.PENDING.tone;
                    const buildingName = issue.building?.name;
                    const reporter = issue.reporter
                      ? [issue.reporter.firstName, issue.reporter.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || issue.reporter.email
                      : null;
                    return (
                      <div
                        key={issue.id}
                        className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-blue-500/12"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1 line-clamp-2 break-words">
                              {issue.description?.trim()
                                ? issue.description
                                : `Report ${String(issue.id).slice(0, 8)}…`}
                            </h4>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-white/50">
                              {buildingName ? <span>Building: {buildingName}</span> : null}
                              {reporter ? <span>Reporter: {reporter}</span> : null}
                              <span>{formatDateTime(issue.createdAt ?? null)}</span>
                            </div>
                          </div>
                          <Badge className={cn("text-xs font-medium shrink-0 border", tone)}>
                            {label("reportStatus", String(issue.status ?? ""))}
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

      {activeSubTab === "performance" && reportData && (
        <Card className={cardCls}>
          <CardHeader className="border-b border-slate-100 dark:border-blue-500/12">
            <CardTitle className="text-base font-medium flex items-center gap-3">
              <Target className="w-5 h-5 text-purple-500" />
              Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1 tabular-nums">
                  {resolutionRate == null ? "—" : formatPercent(resolutionRate)}
                </div>
                <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                  Resolution Rate
                  <MetricInfo id="reports.resolutionRate" size="xs" />
                </div>
                <div className="text-xs text-slate-600 dark:text-white/60 mt-1">
                  {formatNumber(resolved)} of {formatNumber(total)} Resolved
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/12">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1 tabular-nums">
                  {reportData.avgResolutionTime == null ? "—" : formatNumber(reportData.avgResolutionTime, 1)}
                </div>
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400">Average days to resolve</div>
              </div>
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1 tabular-nums">
                  {formatNumber(openCount)}
                </div>
                <div className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                  Open issues
                  <MetricInfo id="reports.openIssues" size="xs" />
                </div>
                <div className="text-xs text-slate-600 dark:text-white/60 mt-1">
                  Pending + Needs Intervention + Failed
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          type="button"
          disabled={loading}
          onClick={() => void loadReportingData()}
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
        <div className="text-xs text-slate-600 dark:text-white/60">
          {loadError ? "Refresh failed — showing earlier data. " : ""}
          Last updated: {loadedAt ? formatDateTime(loadedAt) : "—"}
        </div>
      </div>
    </div>
  );
});
