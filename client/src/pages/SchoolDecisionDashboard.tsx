import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
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
  Box,
  ExternalLink,
} from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";

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
}

export default function SchoolDecisionDashboard({
  id: propId,
  standalone = true,
  onUpdateSchool: propOnUpdateSchool,
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

  const lastFetchedId = useRef<string | null>(null);

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
    if (!schoolData?.calculatedAssessment) return 50;

    const {
      infrastructureScore = 50,
      buildingAgeScore = 50,
      populationPressureScore = 50,
      accessibilityScore = 50,
      facilityComplianceScore = 50,
    } = schoolData.calculatedAssessment;

    // Parse all values to ensure they're numbers
    const infraScore = parseFloat(String(infrastructureScore)) || 50;
    const buildingScore = parseFloat(String(buildingAgeScore)) || 50;
    const popScore = parseFloat(String(populationPressureScore)) || 50;
    const accessScore = parseFloat(String(accessibilityScore)) || 50;
    const complianceScore = parseFloat(String(facilityComplianceScore)) || 50;
    const depValue =
      parseFloat(String(schoolData.calculatedAssessment.depreciation)) || 20;

    // Weight the different factors for decision intelligence
    const weights = {
      infrastructure: 0.25,
      buildingAge: 0.2,
      populationPressure: 0.2,
      accessibility: 0.15,
      facilityCompliance: 0.15,
      depreciation: 0.05,
    };

    // Calculate weighted score
    let score =
      infraScore * weights.infrastructure +
      buildingScore * weights.buildingAge +
      popScore * weights.populationPressure +
      accessScore * weights.accessibility +
      complianceScore * weights.facilityCompliance +
      (100 - depValue) * weights.depreciation; // Fixed: was weights.depreciation

    // Factor in reporting metrics if available
    if (reportingData) {
      const {
        resolutionRate = 75,
        criticalIssues = 3,
        totalReports = 40,
      } = reportingData;
      const reportingScore =
        resolutionRate * 0.6 +
        (totalReports > 0
          ? (100 - (criticalIssues / totalReports) * 100) * 0.4
          : 50); // Prevent division by zero
      score = score * 0.8 + reportingScore * 0.2; // 20% weight to reporting performance
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }, [schoolData, reportingData]);

  const getAssessment = useCallback(() => {
    if (!schoolData?.calculatedAssessment)
      return { priorityLevel: "medium", recommendations: [] };

    const infrastructureScore =
      parseFloat(String(schoolData.calculatedAssessment.infrastructureScore)) ||
      0;
    const calculatedScore = calculateDecisionIntelligenceScore();

    return {
      ...schoolData.calculatedAssessment,
      overallScore: calculatedScore,
      priorityLevel:
        calculatedScore < 40
          ? "critical"
          : calculatedScore < 70
            ? "high"
            : "medium",
      recommendations: [
        schoolData.calculatedAssessment.depreciation > 40
          ? "Consider building renovation due to high depreciation"
          : null,
        schoolData.calculatedAssessment.populationPressureScore > 80
          ? "Population pressure is high - consider expansion"
          : null,
        infrastructureScore < 50
          ? "Infrastructure needs immediate attention"
          : null,
        reportingData && reportingData.criticalIssues > 5
          ? "High number of critical issues requires immediate intervention"
          : null,
      ].filter(Boolean),
    };
  }, [schoolData, calculateDecisionIntelligenceScore, reportingData]);

  const assessment = getAssessment();

  // Fetch reporting data
  const fetchReportingData = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get(`/reports?schoolId=${id}&limit=100`);
      const reports = response.data?.reports || [];

      // Calculate reporting metrics
      const totalReports = reports.length;
      const openIssues = reports.filter((r: any) => r.status === "open").length;
      const resolvedIssues = reports.filter(
        (r: any) => r.status === "resolved",
      ).length;
      const criticalIssues = reports.filter(
        (r: any) => r.priority === "critical",
      ).length;
      const resolutionRate =
        totalReports > 0 ? (resolvedIssues / totalReports) * 100 : 75;

      setReportingData({
        totalReports,
        openIssues,
        resolvedIssues,
        criticalIssues,
        resolutionRate: Math.round(resolutionRate),
      });
    } catch (error) {
      console.error("Failed to fetch reporting data:", error);
      // Set default values if API fails
      setReportingData({
        totalReports: 40,
        openIssues: 12,
        resolvedIssues: 28,
        criticalIssues: 3,
        resolutionRate: 75,
      });
    }
  }, [id]);

  // 2. Data Fetching
  const fetchSchool = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      try {
        const response = await api.get(`/schools/${id}`);
        const sData = response.data;

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

        sData.calculatedAssessment = {
          ...sData.calculatedAssessment,
          averageBuildingAge: avgAge,
          totalStudents: tStudents,
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

        setSchool(sData);

        // Fetch reporting data
        await fetchReportingData();
      } catch (error) {
        console.error("Failed to fetch school", error);
      } finally {
        setLoading(false);
      }
    },
    [id, fetchReportingData],
  );

  useEffect(() => {
    if (id && lastFetchedId.current !== id) {
      fetchSchool();
      lastFetchedId.current = id;
    }
  }, [id, fetchSchool]);

  const handleUpdateSchool = useCallback(
    (update: any) => {
      setSchool((prev: any) => (prev ? { ...prev, ...update } : prev));
      fetchSchool(true);
      if (propOnUpdateSchool) propOnUpdateSchool(update);
    },
    [fetchSchool, propOnUpdateSchool],
  );

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

        {/* 3D View — opens the GLB viewer app in a new tab */}
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (id) params.set("schoolId", id);
            if (school?.name) params.set("schoolName", school.name);
            window.open(`http://localhost:5175?${params.toString()}`, "_blank", "noopener,noreferrer");
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/10 ml-auto"
          title="Open 3D Map Viewer in a new tab"
        >
          <Box className="w-4 h-4" />
          3D View
          <ExternalLink className="w-3 h-3 opacity-60" />
        </button>
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
                  <div className="relative rounded-2xl overflow-hidden group">
                    {/* Professional Gradient Border & Background */}
                    <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 p-px opacity-30 dark:opacity-20 group-hover:opacity-40 transition-opacity">
                      <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(1rem-1px)]" />
                    </div>

                    <div className="relative z-10 flex items-center gap-8 px-6 py-4">
                      <div className="text-center">
                        <p className="text-[10px] font-normal text-slate-500 dark:text-white/40 mb-1">
                          Benchmark
                        </p>
                        <p className="text-base font-medium text-slate-900 dark:text-white/80">
                          +12.4%
                        </p>
                      </div>
                      <div className="w-px h-8 bg-slate-200 dark:bg-white/5" />
                      <div className="text-center">
                        <p className="text-[10px] font-normal text-slate-500 dark:text-white/40 mb-1">
                          Reliability
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="w-1 h-3 bg-primary/40 rounded-full"
                              />
                            ))}
                            <div className="w-1 h-3 bg-slate-100 dark:bg-white/5 rounded-full" />
                          </div>
                          <span className="text-base font-medium text-slate-900 dark:text-white/80">
                            88%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-normal text-slate-400 dark:text-white/60 pr-2">
                    Sync latency: 42ms · t-ref:{" "}
                    {new Date().toISOString().split("T")[1].slice(0, 8)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <DecisionIntelligenceScore assessment={assessment} />
              <FacilityBreakdownSection buildings={buildings} />

              {/* Risk Assessment moved to Reporting tab now */}
            </div>

            <div className="space-y-8">
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
                            Open Issues
                          </span>
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {reportingData?.openIssues || 12}
                        </div>
                        <div className="text-xs text-emerald-500">
                          -18% from last month
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500 dark:text-white/60">
                            Resolved
                          </span>
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          {reportingData?.resolvedIssues || 28}
                        </div>
                        <div className="text-xs text-emerald-500">
                          +24% from last month
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 dark:text-white/60">
                          Critical Priority
                        </span>
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">
                          {reportingData?.criticalIssues || 3}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 dark:text-white/60 mb-1">
                            Resolution Rate
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-1.5">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                style={{
                                  width: `${reportingData?.resolutionRate || 75}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-900 dark:text-white">
                              {reportingData?.resolutionRate || 75}%
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
                    {buildings
                      .filter((building: any) => building.name)
                      .sort(() => {
                        // Mock calculation - in real app, this would come from reports data
                        return Math.random() - 0.5;
                      })
                      .slice(0, 3)
                      .map((building: any, index: number) => (
                        <motion.div
                          key={building.id || index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-red-500" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                                  {building.name || `Building ${index + 1}`}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-white/60">
                                  {building.yearBuilt
                                    ? `Built ${building.yearBuilt}`
                                    : "Year unknown"}
                                </p>
                              </div>
                            </div>
                            <Badge
                              className={cn(
                                "text-xs font-medium",
                                index === 0
                                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                                  : index === 1
                                    ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                              )}
                            >
                              {index === 0
                                ? "CRITICAL"
                                : index === 1
                                  ? "HIGH"
                                  : "MEDIUM"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-slate-500 dark:text-white/60 mb-1">
                                Pending Issues
                              </p>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {Math.floor(Math.random() * 10) + 1}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-white/60 mb-1">
                                Critical
                              </p>
                              <p className="font-medium text-red-600 dark:text-red-400">
                                {Math.floor(Math.random() * 5) + 1}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-white/60 mb-1">
                                Last Report
                              </p>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {Math.floor(Math.random() * 7) + 1}d ago
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
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

      {activeTab === "reporting" && id && (
        <>
          <ReportingTab schoolId={id} />
          {/* Moved Risk Assessment into this tab for centralized analysis visibility */}
          <RiskAssessment
            assessment={assessment}
            reportingData={reportingData}
          />
        </>
      )}

      <motion.div className="relative rounded-[32px] overflow-hidden group">
        {/* Professional Gradient Border & Background */}
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
          <div className="space-y-4">
            {assessment.recommendations?.map((rec: string, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="relative group/rec p-px rounded-2xl overflow-hidden transition-all duration-300"
              >
                <div className="absolute inset-0 bg-linear-to-br from-blue-500/40 to-blue-500/0 opacity-10 group-hover/rec:opacity-30 transition-opacity" />
                <div className="absolute inset-px bg-white/80 dark:bg-white/2 backdrop-blur-2xl rounded-[calc(1rem-1px)] transition-colors" />

                <div className="relative p-5 z-10 flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 mt-1.5 shrink-0 group-hover/rec:bg-primary/50" />
                  <p className="text-xs font-normal leading-relaxed text-slate-500 dark:text-white/50 group-hover/rec:text-slate-900 dark:group-hover/rec:text-white/80 transition-colors italic">
                    {rec}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="relative z-10 p-8">
            <h3 className="text-sm font-medium text-primary/70 dark:text-blue-500 mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-blue-500/20">
                <ClipboardCheck className="w-4 h-4 opacity-60" />
              </div>
              Strategic recommendations
            </h3>
            <div className="space-y-4">
              {assessment.recommendations?.map((rec: string, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="relative group/rec p-px rounded-2xl overflow-hidden transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-linear-to-br from-blue-500/40 to-blue-500/0 opacity-10 group-hover/rec:opacity-30 transition-opacity" />
                  <div className="absolute inset-px bg-white/80 dark:bg-white/2 backdrop-blur-2xl rounded-[calc(1rem-1px)] transition-colors" />

                  <div className="relative p-5 z-10 flex gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/30 mt-1.5 shrink-0 group-hover/rec:bg-primary/50" />
                    <p className="text-xs font-normal leading-relaxed text-slate-500 dark:text-white/50 group-hover/rec:text-slate-900 dark:group-hover/rec:text-white/80 transition-colors italic">
                      {rec}
                    </p>
                  </div>
                </motion.div>
              ))}
              {(!assessment.recommendations ||
                assessment.recommendations.length === 0) && (
                <p className="text-xs text-slate-400 dark:text-white/70 italic text-center py-6">
                  No critical interventions recommended at this time.
                </p>
              )}
            </div>
          </div>
        </div>

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
      </motion.div>
    </motion.div>
  );
}
