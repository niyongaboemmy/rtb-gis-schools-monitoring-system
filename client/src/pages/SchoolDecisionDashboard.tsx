import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { api } from "../lib/api";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import {
  buildBuildingsAttention,
  rollupIssueReports,
  formatTrendPct,
  formatDaysAgo,
} from "../lib/issueReportMetrics";

// Dashboard Components
import { DecisionIntelligenceScore } from "../components/dashboard/DecisionIntelligenceScore";
import { FacilityBreakdownSection } from "../components/dashboard/FacilityBreakdownSection";
import { SchoolStatsCards } from "../components/dashboard/SchoolStatsCards";
import { ReportingTab } from "../components/dashboard/ReportingTab";
import { RiskAssessment } from "../components/dashboard/RiskAssessment";
import SchoolMap from "../components/SchoolMap";

interface SchoolDecisionDashboardProps {
  id?: string;
  standalone?: boolean;
  onUpdateSchool?: (update: any) => void;
  onBuildingClick?: (building: any) => void;
}

export default function SchoolDecisionDashboard({
  id: propId,
  standalone = true,
  onUpdateSchool: propOnUpdateSchool,
  onBuildingClick,
}: SchoolDecisionDashboardProps = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const id = propId || paramId || user?.location?.schoolId;

  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [reportingData, setReportingData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"main" | "reporting">("main");
  const [scoreToast, setScoreToast] = useState(false);
  const [actions, setActions] = useState<any[]>([]);

  const lastFetchedId = useRef<string | null>(null);
  const scoreToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Calculations & Derived State
  const schoolData = school;
  const buildings = schoolData?.buildings || [];
  const totalStudents = schoolData?.calculatedAssessment?.totalStudents || 0;
  const totalCapacity = schoolData?.calculatedAssessment?.totalCapacity || 0;
  const totalStaff = schoolData?.calculatedAssessment?.totalStaff || 0;
  const maleTeachers = parseFloat(String(schoolData?.maleTeachers)) || 0;
  const femaleTeachers = parseFloat(String(schoolData?.femaleTeachers)) || 0;
  const totalTeachers = maleTeachers + femaleTeachers;
  const avgBuildingYear = schoolData?.calculatedAssessment?.averageBuildingAge
    ? new Date().getFullYear() -
      schoolData.calculatedAssessment.averageBuildingAge
    : 0;

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return "--";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const calculateDecisionIntelligenceScore = useCallback(() => {
    const raw = schoolData?.calculatedAssessment?.overallScore ?? school?.overallScore ?? 0;
    return Math.min(100, Math.max(0, Math.round(Number(raw))));
  }, [schoolData, school]);

  const getAssessment = useCallback(() => {
    if (!schoolData?.calculatedAssessment)
      return { priorityLevel: "medium", recommendations: [], resolutionRate: null };

    const overallScore = calculateDecisionIntelligenceScore();
    const infrastructureScore =
      parseFloat(String(schoolData.calculatedAssessment.infrastructureScore)) || 0;

    // Derive resolution rate from the already-fetched reportingData
    const resolutionRate =
      (reportingData?.totalReports ?? 0) > 0
        ? Math.round(
            ((reportingData?.resolvedIssues ?? 0) / reportingData.totalReports) * 100,
          )
        : null;

    return {
      ...schoolData.calculatedAssessment,
      overallScore,
      resolutionRate,
      priorityLevel:
        overallScore < 35
          ? "critical"
          : overallScore < 55
            ? "high"
            : overallScore < 75
              ? "medium"
              : "low",
      recommendations: [
        infrastructureScore < 50
          ? "Infrastructure health is low — schedule building condition assessments"
          : null,
        schoolData.calculatedAssessment.populationPressureScore < 45
          ? "Elevated demographic pressure in catchment — review capacity planning"
          : null,
        schoolData.calculatedAssessment.buildingAgeScore < 40
          ? "Asset portfolio skews older — prioritize condition surveys and renewal"
          : null,
        (reportingData?.statusCounts?.needIntervention ?? 0) > 5
          ? "High number of reports flagged NEED_INTERVENTION — prioritize escalation"
          : null,
      ].filter(Boolean),
    };
  }, [schoolData, calculateDecisionIntelligenceScore, reportingData]);

  const assessment = getAssessment();

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

      setReportingData({
        rawReports: reports,
        totalReports: rollup.totalReports,
        openIssues: rollup.activeIssues,
        activeIssues: rollup.activeIssues,
        resolvedIssues: rollup.resolvedIssues,
        criticalIssues: rollup.needIntervention,
        resolutionRate: rollup.resolutionRate,
        statusCounts: rollup.statusCounts,
        monthComparison: rollup.monthComparison,
        avgResolutionTime: rollup.avgResolutionDays,
      });
    } catch (error) {
      console.error("Failed to fetch reporting data:", error);
      setReportingData({
        rawReports: [],
        totalReports: 0,
        openIssues: 0,
        activeIssues: 0,
        resolvedIssues: 0,
        criticalIssues: 0,
        resolutionRate: 100,
        statusCounts: {
          pending: 0,
          needIntervention: 0,
          solved: 0,
          failed: 0,
        },
        monthComparison: {
          current: {
            pending: 0,
            needIntervention: 0,
            solved: 0,
            failed: 0,
            activeCreated: 0,
          },
          previous: {
            pending: 0,
            needIntervention: 0,
            solved: 0,
            failed: 0,
            activeCreated: 0,
          },
          activeChangePct: null,
          solvedChangePct: null,
        },
        avgResolutionTime: 0,
      });
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
        }
      } catch {
        // silent — user can retry
      }
    },
    [id, actions],
  );

  // 2. Data Fetching
  const fetchSchool = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      try {
        const [schoolRes, metricsRes] = await Promise.all([
          api.get(`/schools/${id}`),
          api.get(`/analytics/schools/${id}/metrics`).catch(() => null),
        ]);
        const sData = schoolRes.data;
        const metrics = metricsRes?.data;

        const currentYear = new Date().getFullYear();
        let avgAge = 0;
        if (sData.buildings?.length > 0) {
          const ages = sData.buildings
            .filter((b: any) => b.yearBuilt)
            .map((b: any) => currentYear - parseFloat(String(b.yearBuilt)));
          avgAge =
            ages.length > 0
              ? Math.round(
                  ages.reduce((a: number, b: number) => a + b, 0) / ages.length,
                )
              : 0;
        }

        const tStudents =
          sData.educationPrograms?.reduce(
            (sum: number, p: any) =>
              sum + (parseFloat(String(p.totalStudents)) || 0),
            0,
          ) || 0;
        const tStaff =
          (parseFloat(String(sData.maleTeachers)) || 0) +
          (parseFloat(String(sData.femaleTeachers)) || 0) +
          (parseFloat(String(sData.maleAdminStaff)) || 0) +
          (parseFloat(String(sData.femaleAdminStaff)) || 0) +
          (parseFloat(String(sData.maleSupportStaff)) || 0) +
          (parseFloat(String(sData.femaleSupportStaff)) || 0);

        if (metrics) {
          sData.calculatedAssessment = {
            ...sData.calculatedAssessment,
            infrastructureScore: metrics.infrastructureScore,
            buildingAgeScore: metrics.buildingAgeScore,
            populationPressureScore: metrics.populationPressureScore,
            accessibilityScore: metrics.accessibilityScore,
            facilityComplianceScore: metrics.facilityComplianceScore,
            overallScore: metrics.overallScore,
            depreciation: metrics.depreciation,
            averageBuildingAge: metrics.avgBuildingAge ?? avgAge,
            totalStudents: metrics.totalStudents ?? tStudents,
            totalCapacity: metrics.totalCapacity ?? 0,
            totalStaff: metrics.totalStaff ?? tStaff,
            urgencyMonths: metrics.urgencyMonths,
            recommendations:
              metrics.recommendations?.length > 0
                ? metrics.recommendations
                : sData.calculatedAssessment?.recommendations,
            // Phase 3: completeness, timestamp, peer delta
            dataCompletenessScore: metrics.dataCompletenessScore,
            calculatedAt: metrics.calculatedAt,
            scoreDeltaFromDistrict: metrics.scoreDeltaFromDistrict,
            // Phase 4.5: server-computed risk matrix inputs
            riskImpactScore: metrics.riskImpactScore,
            riskProbabilityScore: metrics.riskProbabilityScore,
          };
        } else {
          sData.calculatedAssessment = {
            ...sData.calculatedAssessment,
            averageBuildingAge: avgAge,
            totalStudents: tStudents,
            totalCapacity:
              sData.educationPrograms?.reduce(
                (sum: number, p: any) =>
                  sum + (parseFloat(String(p.capacity)) || 0),
                0,
              ) || 0,
            totalStaff: tStaff,
            infrastructureScore:
              parseFloat(
                String(sData.calculatedAssessment?.infrastructureScore),
              ) || 50,
            buildingAgeScore:
              parseFloat(String(sData.calculatedAssessment?.buildingAgeScore)) ||
              50,
            populationPressureScore:
              parseFloat(
                String(sData.calculatedAssessment?.populationPressureScore),
              ) || 45,
            accessibilityScore:
              parseFloat(
                String(sData.calculatedAssessment?.accessibilityScore),
              ) || 50,
            facilityComplianceScore:
              parseFloat(
                String(sData.calculatedAssessment?.facilityComplianceScore),
              ) || 50,
            overallScore:
              parseFloat(String(sData.calculatedAssessment?.overallScore)) || 65,
            depreciation:
              parseFloat(String(sData.calculatedAssessment?.depreciation)) || 20,
          };
        }

        setSchool(sData);
        await Promise.all([fetchReportingData(), fetchActions()]);
      } catch (error) {
        console.error("Failed to fetch school", error);
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
    if (scoreToastTimerRef.current) clearTimeout(scoreToastTimerRef.current);
    setScoreToast(true);
    scoreToastTimerRef.current = setTimeout(() => setScoreToast(false), 3000);
  }, []);

  const recalculateScores = useCallback(async () => {
    if (!id) return;
    try {
      await api.post(`/analytics/schools/${id}/recalculate`);
      await fetchSchool(true);
      showScoreToast();
    } catch {
      // recalculate is best-effort; silent failure keeps the UX clean
    }
  }, [id, fetchSchool, showScoreToast]);

  const handleUpdateSchool = useCallback(
    (update: any) => {
      setSchool((prev: any) => (prev ? { ...prev, ...update } : prev));
      recalculateScores();
      if (propOnUpdateSchool) propOnUpdateSchool(update);
    },
    [recalculateScores, propOnUpdateSchool],
  );

  useEffect(() => {
    if (!id) return;

    const socket: Socket = io(window.location.origin, { withCredentials: true });

    // Join on every (re)connect so the room survives network drops.
    const schoolRoom = `school:${id}`;
    socket.on("connect", () => socket.emit("join", schoolRoom));

    socket.on("scores:updated", (assessment: any) => {
      setSchool((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          overallScore: assessment.overallScore,
          priorityLevel: assessment.priorityLevel,
          calculatedAssessment: {
            ...prev.calculatedAssessment,
            overallScore: assessment.overallScore,
            infrastructureScore: assessment.infrastructureScore,
            buildingAgeScore: assessment.buildingAgeScore,
            accessibilityScore: assessment.accessibilityScore,
            populationPressureScore: assessment.populationPressureScore,
            priorityLevel: assessment.priorityLevel,
          },
        };
      });
      showScoreToast();
    });

    return () => {
      socket.emit("leave", schoolRoom);
      socket.disconnect();
    };
  }, [id, showScoreToast]);

  // 3. Render Logic
  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b border-primary/30"></div>
        <p className="text-[11px] font-medium tracking-wide animate-pulse text-slate-400 dark:text-white/20">
          Synchronizing analytics...
        </p>
      </div>
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
            Institution not found
          </h2>
          <p className="text-sm font-normal text-slate-500 dark:text-white/30 mt-2">
            The requested school registry could not be located
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-full mt-2 font-medium text-[11px] px-6 border-blue-500/30 hover:bg-white/5"
        >
          <Link to="/schools">Return to registry</Link>
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
          onClose={() => navigate("/schools")}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="container mx-auto space-y-8 pb-12 px-2 md:px-6 pt-8 md:pt-16 bg-transparent"
    >
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-200 dark:border-blue-500/20 mb-8">
        {[
          { id: "main", label: "Main Dashboard", icon: Activity },
          { id: "reporting", label: "Reporting & Analytics", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "main" | "reporting")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
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

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10 border-b border-slate-200 dark:border-blue-500/20 pb-10">
                <div>
                  <h2 className="text-3xl md:text-4xl font-medium text-slate-800 dark:text-white tracking-tight">
                    Strategic <span className="text-primary">Intelligence</span>{" "}
                    Dashboard
                  </h2>
                  <div className="flex items-center gap-4 mt-4">
                    <p className="text-[11px] font-normal text-slate-500 dark:text-white/60 tracking-wide">
                      Instance: {schoolData.name || "Unidentified asset"}
                    </p>
                    <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-white/10" />
                    <p className="text-[11px] font-medium text-primary/60 dark:text-primary/60 tracking-wide">
                      Registry ID: {id?.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/40 pr-2">
                    SCORES AS OF{" "}
                    {schoolData?.calculatedAssessment?.calculatedAt
                      ? new Date(
                          schoolData.calculatedAssessment.calculatedAt,
                        ).toLocaleDateString("en-RW", { dateStyle: "medium" })
                      : new Date().toLocaleDateString("en-RW", {
                          dateStyle: "medium",
                        })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data completeness warning — shown when fewer than 60 % of key fields are populated */}
          {(schoolData?.calculatedAssessment?.dataCompletenessScore ?? 100) < 60 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Data completeness:{" "}
              <strong>
                {schoolData.calculatedAssessment.dataCompletenessScore}%
              </strong>{" "}
              — displayed scores may not reflect actual conditions. Complete the
              school profile to improve accuracy.
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <DecisionIntelligenceScore assessment={assessment} />
              <FacilityBreakdownSection buildings={buildings} />
              <RiskAssessment
                assessment={assessment}
                reportingData={{
                  ...reportingData,
                  critical: reportingData?.statusCounts?.needIntervention,
                  totalReports: reportingData?.totalReports,
                  avgResolutionTime: reportingData?.avgResolutionTime,
                }}
              />
            </div>

            <div className="space-y-8">
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
                    </h3>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                      Impacts Decision Score
                    </span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                      {reportingData?.resolutionRate ?? 0}
                      <span className="text-2xl font-medium">%</span>
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="text-[10px] text-slate-500 dark:text-white/50 mb-1.5">
                        {reportingData?.resolvedIssues ?? 0} of{" "}
                        {reportingData?.totalReports ?? 0} reports closed (SOLVED)
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${reportingData?.resolutionRate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reporting Summary Section */}
              <div className="relative rounded-[32px] overflow-hidden group">
                {/* Professional Gradient Border & Background */}
                <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
                  <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(2rem-1px)]" />
                </div>

                <div className="relative z-10 p-8">
                  <h3 className="text-sm font-medium text-primary/70 dark:text-blue-500 mb-6 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-blue-500/20">
                      <FileText className="w-4 h-4 opacity-60" />
                    </div>
                    Reporting Summary
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500 dark:text-white/60">
                            Active issues
                          </span>
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {reportingData?.activeIssues ?? reportingData?.openIssues ?? 0}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            (reportingData?.monthComparison?.activeChangePct ?? 0) > 0
                              ? "text-amber-600"
                              : "text-emerald-600",
                          )}
                        >
                          Active created (MTD vs last month):{" "}
                          {formatTrendPct(
                            reportingData?.monthComparison?.activeChangePct,
                          )}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500 dark:text-white/60">
                            Resolved (SOLVED)
                          </span>
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {reportingData?.resolvedIssues ?? 0}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-white/50">
                          {formatTrendPct(
                            reportingData?.monthComparison?.solvedChangePct,
                          )}{" "}
                          (reports created this month vs last)
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 dark:text-white/60">
                          NEED_INTERVENTION
                        </span>
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">
                          {reportingData?.statusCounts?.needIntervention ?? 0}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 dark:text-white/60 mb-1">
                            Resolution rate (SOLVED / all)
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                style={{
                                  width: `${reportingData?.resolutionRate ?? 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-900 dark:text-white">
                              {reportingData?.resolutionRate ?? 0}%
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
                    Buildings Requiring Attention
                  </h3>
                  <div className="space-y-3">
                    {buildingsAttention.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-white/50 px-1">
                        No building-linked issues or poor-condition blocks detected.
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
                              (x: any) => x.id === row.buildingId,
                            );
                            if (b) onBuildingClick?.(b);
                          }}
                          className={`p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-all ${onBuildingClick ? "cursor-pointer" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-red-500" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white">
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
                                row.severityLabel === "CRITICAL"
                                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                                  : row.severityLabel === "HIGH"
                                    ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                              )}
                            >
                              {row.severityLabel}
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
                                Intervention
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

              <SchoolStatsCards
                schoolData={schoolData}
                totalStudents={totalStudents}
                totalCapacity={totalCapacity}
                totalStaff={totalStaff}
                totalTeachers={totalTeachers}
                maleTeachers={maleTeachers}
                buildings={buildings}
                avgBuildingYear={avgBuildingYear}
                formatNumber={formatNumber}
              />
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
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-blue-500/20">
                <ClipboardCheck className="w-4 h-4 opacity-60" />
              </div>
              Strategic recommendations
            </h3>
            <div className="space-y-3">
              {assessment.recommendations?.map((rec: string, i: number) => {
                const action = actions.find((a) => a.recommendation === rec);
                const status: string = action?.status ?? "open";
                const statusColors: Record<string, string> = {
                  open:        "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 border-slate-200 dark:border-white/10",
                  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  done:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                };
                const statusLabel: Record<string, string> = {
                  open: "Open", in_progress: "In Progress", done: "Done",
                };

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
                  No critical interventions recommended at this time.
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
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-white/2 flex items-center justify-center mx-auto border border-blue-500/20">
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

      {/* Scores-updated toast */}
      <AnimatePresence>
        {scoreToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-6 right-6 z-200 flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-900/30 pointer-events-none"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium">Scores updated</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
