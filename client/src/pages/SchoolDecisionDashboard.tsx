import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Socket } from "socket.io-client";
import { connectSocket } from "../lib/socket";
import { useParams, Link } from "react-router-dom";
import { useGoBack } from "../hooks/useGoBack";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import {
  Activity,
  Building2,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  CheckCircle,
  CheckCircle2,
} from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { formatDate, formatNumber, formatPercent } from "../lib/format";
import { label } from "../lib/labels";
import { useToast } from "../components/ui/toast";
import { MetricInfo } from "../components/metric-help/MetricInfo";
import {
  DashboardError,
  DashboardSkeleton,
} from "../components/dashboard/DashboardStates";
import {
  buildBuildingsAttention,
  rollupIssueReports,
  formatTrendPct,
  formatDaysAgo,
  type IssueReportLike,
} from "../lib/issueReportMetrics";
import type { SchoolMetrics } from "../components/dashboard/types";
import type { FacilityBuilding } from "../components/dashboard/FacilityBreakdownSection";

// Dashboard Components
import { DecisionIntelligenceScore } from "../components/dashboard/DecisionIntelligenceScore";
import { FacilityBreakdownSection } from "../components/dashboard/FacilityBreakdownSection";
import { SchoolStatsCards } from "../components/dashboard/SchoolStatsCards";
import { ReportingTab } from "../components/dashboard/ReportingTab";
import { RiskAssessment } from "../components/dashboard/RiskAssessment";
import SchoolMap from "../components/SchoolMap";

/** The school record as returned by GET /schools/:id (only fields used here are typed). */
interface SchoolRecord {
  id: string;
  name?: string;
  code?: string;
  buildings?: FacilityBuilding[];
  [key: string]: unknown;
}

interface RecommendationActionRow {
  id: string;
  recommendation: string;
  status: "open" | "in_progress" | "done";
}

interface ScoresUpdatedEvent {
  overallScore: number;
  infrastructureScore: number;
  buildingAgeScore: number;
  accessibilityScore: number;
  populationPressureScore: number;
  priorityLevel: SchoolMetrics["priorityLevel"];
}

interface SchoolDecisionDashboardProps {
  id?: string;
  standalone?: boolean;
  onUpdateSchool?: (update: Partial<SchoolRecord>) => void;
  onBuildingClick?: (building: FacilityBuilding) => void;
}

const ACTION_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

export default function SchoolDecisionDashboard({
  id: propId,
  standalone = true,
  onUpdateSchool: propOnUpdateSchool,
  onBuildingClick,
}: SchoolDecisionDashboardProps = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const goBack = useGoBack("/schools");
  const { user } = useAuthStore();
  const id = propId || paramId || user?.location?.schoolId;

  const toast = useToast();
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  /** Server metrics — GET /analytics/schools/:id/metrics (single source, WS1.4). */
  const [metrics, setMetrics] = useState<SchoolMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  /** HTTP status of a failed load (0 = network/other), or null when loaded. */
  const [loadError, setLoadError] = useState<number | null>(null);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [reportingData, setReportingData] = useState<{
    rawReports: IssueReportLike[];
    monthComparison: ReturnType<typeof rollupIssueReports>["monthComparison"] | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"main" | "reporting">("main");
  const [actions, setActions] = useState<RecommendationActionRow[]>([]);

  const lastFetchedId = useRef<string | null>(null);

  const schoolData = school;
  const buildings = useMemo(() => schoolData?.buildings || [], [schoolData]);
  const reportSummary = metrics?.reportSummary ?? null;

  // Everything shown below comes from the server metrics payload. The client
  // no longer recomputes scores, priority, recommendations, totals or ratios.
  const assessment: Partial<SchoolMetrics> = metrics ?? {};

  const buildingsAttention = useMemo(
    () =>
      buildBuildingsAttention(
        buildings,
        reportingData?.rawReports ?? [],
        3,
      ),
    [buildings, reportingData?.rawReports],
  );

  const fetchReportingData = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get(`/reports?schoolId=${id}&limit=1000`);
      const reports = response.data?.data ?? [];
      const rollup = rollupIssueReports(reports);

      // Counts and rates come from the server reportSummary; the browser only
      // keeps the raw list (for the building ranking) and the month comparison.
      setReportingData({
        rawReports: reports,
        monthComparison: rollup.monthComparison,
      });
    } catch (error) {
      console.error("Failed to fetch reporting data:", error);
      setReportingData({ rawReports: [], monthComparison: null });
    }
  }, [id]);

  const fetchActions = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/analytics/schools/${id}/actions`);
      setActions(res.data ?? []);
    } catch {
      // best-effort — actions are optional metadata
    }
  }, [id]);

  const toggleAction = useCallback(
    async (recommendation: string) => {
      if (!id) return;
      const existing = actions.find((a) => a.recommendation === recommendation);
      try {
        if (!existing) {
          const res = await api.post(`/analytics/schools/${id}/actions`, {
            recommendation,
          });
          setActions((prev) => [...prev, res.data]);
          toast.success(`Recommendation marked ${ACTION_STATUS_LABEL[res.data?.status] ?? "Open"}`);
        } else {
          const nextStatus =
            existing.status === "open"
              ? "in_progress"
              : existing.status === "in_progress"
                ? "done"
                : "open";
          const res = await api.patch(`/analytics/actions/${existing.id}`, {
            status: nextStatus,
          });
          setActions((prev) =>
            prev.map((a) => (a.id === existing.id ? res.data : a)),
          );
          toast.success(`Recommendation marked ${ACTION_STATUS_LABEL[nextStatus]}`);
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not update this recommendation. Please try again."));
      }
    },
    [id, actions, toast],
  );

  // 2. Data Fetching
  const fetchSchool = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const [schoolRes, metricsRes] = await Promise.all([
          api.get(`/schools/${id}`),
          api.get(`/analytics/schools/${id}/metrics`).catch(() => null),
        ]);
        setSchool(schoolRes.data);
        setMetrics(metricsRes?.data ?? null);
        await Promise.all([fetchReportingData(), fetchActions()]);
      } catch (error) {
        console.error("Failed to fetch school", error);
        setLoadError(
          (error as { response?: { status?: number } })?.response?.status ?? 0,
        );
      } finally {
        setLoading(false);
      }
    },
    [id, fetchReportingData, fetchActions],
  );

  useEffect(() => {
    if (id && lastFetchedId.current !== id) {
      fetchSchool();
      lastFetchedId.current = id;
    }
  }, [id, fetchSchool]);

  const showScoreToast = useCallback(() => {
    toast.success("Scores updated");
  }, [toast]);

  const recalculateScores = useCallback(async () => {
    if (!id) return;
    try {
      await api.post(`/analytics/schools/${id}/recalculate`);
      await fetchSchool(true);
      showScoreToast();
    } catch {
      toast.error("Scores could not be recalculated. They will update on the next change.");
    }
  }, [id, fetchSchool, showScoreToast, toast]);

  const handleUpdateSchool = useCallback(
    (update: Partial<SchoolRecord>) => {
      setSchool((prev) => (prev ? { ...prev, ...update } : prev));
      recalculateScores();
      if (propOnUpdateSchool) propOnUpdateSchool(update);
    },
    [recalculateScores, propOnUpdateSchool],
  );

  useEffect(() => {
    if (!id) return;

    const socket: Socket = connectSocket();

    // Join on every (re)connect so the room survives network drops.
    const schoolRoom = `school:${id}`;
    socket.on("connect", () => socket.emit("join", schoolRoom));

    socket.on("scores:updated", (update: ScoresUpdatedEvent) => {
      // Patch the server-computed scores in place; the full metrics payload
      // (gaps, risk, totals) refreshes on the next fetch.
      setMetrics((prev) =>
        prev
          ? {
              ...prev,
              overallScore: update.overallScore,
              infrastructureScore: update.infrastructureScore,
              buildingAgeScore: update.buildingAgeScore,
              accessibilityScore: update.accessibilityScore,
              populationPressureScore: update.populationPressureScore,
              priorityLevel: update.priorityLevel,
            }
          : prev,
      );
      showScoreToast();
    });

    return () => {
      socket.emit("leave", schoolRoom);
      socket.disconnect();
    };
  }, [id, showScoreToast]);

  // 3. Render Logic
  if (loading) {
    return <DashboardSkeleton cards={4} label="Loading school dashboard…" className="p-4 md:p-8" />;
  }

  if (loadError !== null) {
    // Access and missing-record errors won't fix themselves on retry.
    if (loadError === 403 || loadError === 404) {
      return (
        <DashboardError
          className="m-4 md:m-8"
          title={loadError === 403 ? "This school is outside your access area" : "School not found"}
          message={
            loadError === 403
              ? "Your account can only open schools in its assigned area. Ask an administrator if you need wider access."
              : "It may have been removed. Go back to the schools directory to pick another one."
          }
        />
      );
    }
    return (
      <DashboardError
        className="m-4 md:m-8"
        title="We couldn't load this school"
        onRetry={() => fetchSchool()}
      />
    );
  }

  if (!schoolData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-6 text-center">
        <div className="p-5 rounded-full bg-red-500/5 border border-red-500/10">
          <AlertTriangle className="w-12 h-12 text-red-500/40" />
        </div>
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-slate-800 dark:text-white/90">
            School not found
          </h2>
          <p className="text-sm font-normal text-slate-500 dark:text-white/50 mt-2">
            It may have been removed, or it is outside your access level.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full mt-2 font-medium text-[12px] px-6">
          <Link to="/schools">Back to schools</Link>
        </Button>
      </div>
    );
  }

  if (standalone) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-100">
        <SchoolMap
          school={school}
          buildings={buildings}
          onUpdateSchool={handleUpdateSchool}
          onClose={goBack}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="container mx-auto space-y-8 pb-12 px-2 md:px-6 pt-16 bg-transparent"
    >
      {/* Tab Navigation */}
      <div role="tablist" aria-label="School dashboard sections" className="flex gap-2 p-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-200 dark:border-blue-500/12 mb-8 overflow-x-auto">
        {[
          { id: "main", label: "Overview", icon: Activity },
          { id: "reporting", label: "Issue Reports", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as "main" | "reporting")}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Based on Active Tab */}
      {activeTab === "main" && (
        <div>
          <div className="space-y-8">
            {/* Modern Dashboard Header */}
            <div className="relative group mb-12">
              <div className="absolute -inset-x-20 -top-20 h-64 bg-primary/5 dark:bg-primary/2 blur-[120px] rounded-full pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10 border-b border-slate-200 dark:border-blue-500/12 pb-10">
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium text-slate-800 dark:text-white tracking-tight break-words">
                    {schoolData.name || "School"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4">
                    <p className="text-[12px] font-normal text-slate-600 dark:text-white/60 tracking-wide">
                      School dashboard
                    </p>
                    {schoolData.code && (
                      <>
                        <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/10" />
                        <p className="text-[12px] font-medium text-primary tracking-wide">
                          Code {schoolData.code}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/50 pr-2">
                    Scores as of {metrics?.calculatedAt ? formatDate(metrics.calculatedAt) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!metrics && (
            <div role="status" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              Scores are not available right now. School details are shown; try again later for scores.
            </div>
          )}
          {/* Data completeness warning — shown when fewer than 60 % of key fields are populated */}
          {(metrics?.dataCompletenessScore ?? 100) < 60 && (
            <div role="status" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 font-medium flex flex-wrap items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Data completeness: <strong>{formatPercent(metrics?.dataCompletenessScore ?? null)}</strong>. Some
                scores are estimated. Complete the school profile to improve accuracy.
              </span>
              <MetricInfo id="school.dataCompleteness" size="xs" />
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            <div className="xl:col-span-2 space-y-8 min-w-0">
              <DecisionIntelligenceScore assessment={assessment} />
              <FacilityBreakdownSection buildings={buildings} />
              <RiskAssessment risk={metrics?.riskAssessment} />
            </div>

            <div className="space-y-8 min-w-0">
              {/* Resolution Rate Card */}
              <div className="relative rounded-[32px] overflow-hidden group">
                <div className="absolute inset-0 bg-linear-to-b from-emerald-500/30 to-emerald-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
                  <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(2rem-1px)]" />
                </div>
                <div className="relative z-10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400 flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-100 dark:bg-white/5 border border-emerald-500/20">
                        <CheckCircle className="w-4 h-4 opacity-70" />
                      </div>
                      Resolution Rate
                      <MetricInfo id="reports.resolutionRate" size="xs" />
                    </h3>
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                      5% of the score
                    </span>
                  </div>
                  {reportSummary?.resolutionRate == null ? (
                    <p className="text-sm text-slate-600 dark:text-white/60">
                      No Issue Reports yet. The score uses a neutral 50 for this part until reports exist.
                    </p>
                  ) : (
                    <div className="flex items-end gap-4">
                      <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
                        {formatPercent(reportSummary.resolutionRate)}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="text-[11px] text-slate-600 dark:text-white/60 mb-1.5">
                          {formatNumber(reportSummary.resolved)} of {formatNumber(reportSummary.total)} reports Resolved
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${reportSummary.resolutionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reporting Summary Section */}
              <div className="relative rounded-[32px] overflow-hidden group">
                {/* Professional Gradient Border & Background */}
                <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
                  <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(2rem-1px)]" />
                </div>

                <div className="relative z-10 p-5 sm:p-8">
                  <h3 className="text-sm font-medium text-primary/70 dark:text-blue-500 mb-6 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-blue-500/12">
                      <FileText className="w-4 h-4 opacity-60" />
                    </div>
                    Issue Reports summary
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1">
                            Open issues
                            <MetricInfo id="reports.openIssues" size="xs" />
                          </span>
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(reportSummary?.active ?? 0)}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            (reportingData?.monthComparison?.activeChangePct ?? 0) > 0
                              ? "text-amber-600"
                              : "text-emerald-600",
                          )}
                        >
                          New this month:{" "}
                          {formatTrendPct(
                            reportingData?.monthComparison?.activeChangePct,
                          )}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1">
                            Resolved
                            <MetricInfo id="reports.resolved" size="xs" />
                          </span>
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatNumber(reportSummary?.resolved ?? 0)}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-white/50 flex items-center gap-1">
                          {formatTrendPct(
                            reportingData?.monthComparison?.solvedChangePct,
                          )}
                          <MetricInfo id="reports.monthComparison" size="xs" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1">
                          {label("reportStatus", "NEED_INTERVENTION")}
                          <MetricInfo id="reports.needsIntervention" size="xs" />
                        </span>
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">
                          {formatNumber(reportSummary?.critical ?? 0)}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 dark:text-white/60 mb-1">
                            Resolution rate
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                style={{
                                  width: `${reportSummary?.resolutionRate ?? 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-900 dark:text-white tabular-nums">
                              {formatPercent(reportSummary?.resolutionRate ?? null)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buildings with Critical Reports */}
              <div className="relative rounded-[32px] overflow-hidden group">
                {/* Professional Gradient Border & Background */}
                <div className="absolute inset-0 bg-linear-to-b from-red-500/30 to-red-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
                  <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(2rem-1px)]" />
                </div>

                <div className="relative z-10 p-8">
                  <h3 className="text-sm font-medium text-red-600/70 dark:text-red-500 mb-6 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-red-100 dark:bg-white/5 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 opacity-60" />
                    </div>
                    Buildings needing attention
                    <MetricInfo id="reports.buildingsAttention" size="xs" />
                  </h3>
                  <div className="space-y-3">
                    {buildingsAttention.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-white/50 px-1">
                        No buildings need attention: no open Issue Reports are linked to a building and none is in poor or critical condition.
                      </p>
                    ) : (
                      buildingsAttention.map((row, index) => (
                        <motion.div
                          key={row.buildingId}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => {
                            const b = buildings.find(
                              (x) => x.id === row.buildingId,
                            );
                            if (b) onBuildingClick?.(b);
                          }}
                          role={onBuildingClick ? "button" : undefined}
                          tabIndex={onBuildingClick ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (!onBuildingClick || (e.key !== "Enter" && e.key !== " ")) return;
                            e.preventDefault();
                            const b = buildings.find((x) => x.id === row.buildingId);
                            if (b) onBuildingClick(b);
                          }}
                          className={`p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/12 hover:bg-slate-100 dark:hover:bg-white/10 transition-all ${onBuildingClick ? "cursor-pointer" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="shrink-0 w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-red-500" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {row.name}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-white/60">
                                  {row.yearBuilt
                                    ? `Built ${row.yearBuilt}`
                                    : "Year unknown"}
                                </p>
                              </div>
                            </div>
                            <Badge
                              className={cn(
                                "text-xs font-medium",
                                row.severityLabel === "critical"
                                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                                  : row.severityLabel === "high"
                                    ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                              )}
                            >
                              {label("priority", row.severityLabel)}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-slate-500 dark:text-white/60 mb-1">
                                Pending
                              </p>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {row.pending}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-white/60 mb-1">
                                Needs Intervention
                              </p>
                              <p className="font-medium text-red-600 dark:text-red-400">
                                {row.intervention}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-white/60 mb-1">
                                Last reporter
                              </p>
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {row.lastReportAt
                                  ? `${row.reporterLabel} · ${formatDaysAgo(row.lastReportAt)}`
                                  : row.reporterLabel}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <SchoolStatsCards metrics={metrics} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "reporting" && id && <ReportingTab schoolId={id} />}

      {activeTab === "main" && (
        <motion.div className="relative rounded-[32px] overflow-hidden group">
          <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
            <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(2rem-1px)]" />
          </div>

          <div className="relative z-10 p-8">
            <h3 className="text-sm font-medium text-primary/70 dark:text-blue-500 mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-blue-500/12">
                <ClipboardCheck className="w-4 h-4 opacity-60" />
              </div>
              Recommendations
            </h3>
            <div className="space-y-3">
              {assessment.recommendations?.map((rec: string, i: number) => {
                const action = actions.find((a) => a.recommendation === rec);
                const status: string = action?.status ?? "open";
                const statusColors: Record<string, string> = {
                  open:        "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 border-slate-200 dark:border-white/6",
                  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  done:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                };
                const statusLabel = ACTION_STATUS_LABEL;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="relative group/rec p-px rounded-2xl overflow-hidden transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-linear-to-br from-blue-500/40 to-blue-500/0 opacity-10 group-hover/rec:opacity-30 transition-opacity" />
                    <div className="absolute inset-px bg-white/80 dark:bg-white/2 backdrop-blur-2xl rounded-[calc(1rem-1px)] transition-colors" />

                    <div className="relative p-4 z-10 flex items-start gap-3">
                      {/* Action status toggle checkbox */}
                      <button
                        onClick={() => toggleAction(rec)}
                        title={`Status: ${statusLabel[status]} — click to advance`}
                        aria-label={`Recommendation status: ${statusLabel[status]}. Activate to move to the next status.`}
                        className={cn(
                          "shrink-0 mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all",
                          statusColors[status],
                        )}
                      >
                        {status === "done" && (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {status === "in_progress" && (
                          <div className="w-2 h-2 rounded-sm bg-amber-500" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-normal leading-relaxed transition-colors italic",
                          status === "done"
                            ? "line-through text-slate-300 dark:text-white/20"
                            : "text-slate-500 dark:text-white/50 group-hover/rec:text-slate-900 dark:group-hover/rec:text-white/80",
                        )}>
                          {rec}
                        </p>
                      </div>

                      <span className={cn(
                        "shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                        statusColors[status],
                      )}>
                        {statusLabel[status]}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {(!assessment.recommendations ||
                assessment.recommendations.length === 0) && (
                <p className="text-xs text-slate-400 dark:text-white/70 italic text-center py-6">
                  No recommendations at this time.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <Modal
          isOpen={isBuildingModalOpen}
          onClose={() => setIsBuildingModalOpen(false)}
          title={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/5 text-primary">
                <Building2 className="w-5 h-5 opacity-60" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white/90">
                  Asset report
                </h3>
                <p className="text-[10px] font-normal text-white/30 tracking-wide mt-0.5">
                  Asset intelligence report
                </p>
              </div>
            </div>
          }
          maxWidth="max-w-md"
        >
          <div className="p-5 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-white/2 flex items-center justify-center mx-auto border border-blue-500/12">
              <GraduationCap className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-xs font-normal text-slate-500 dark:text-white/40 italic leading-relaxed">
              Detailed asset lifecycle analytics for this block are synchronised
              with 2D digital twin environment.
            </p>
            <Button
              onClick={() => setIsBuildingModalOpen(false)}
              className="w-full rounded-full font-medium"
            >
              Acknowledge
            </Button>
          </div>
        </Modal>

    </motion.div>
  );
}
