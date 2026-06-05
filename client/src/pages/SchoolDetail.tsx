import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Map,
  BarChart3,
  Info,
  Zap,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Hash,
  School,
  Upload,
  ClipboardList,
  Eye,
  Box,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { hasPermission, Permission } from "../lib/permissions";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import SchoolMap from "../components/SchoolMap";
import { DecisionIntelligenceScore } from "../components/dashboard/DecisionIntelligenceScore";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "buildings" | "map" | "analytics" | "actions";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "buildings", label: "Buildings", icon: Building2 },
  { id: "map", label: "Map", icon: Map },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "actions", label: "Actions", icon: Zap },
];

const CONDITION_STYLES: Record<string, string> = {
  GOOD: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  FAIR: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  POOR: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  CRITICAL: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  UNDER_CONSTRUCTION: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAssessment(school: any, metrics: any) {
  const currentYear = new Date().getFullYear();
  const buildings: any[] = school.buildings ?? [];

  let avgAge = 0;
  if (buildings.length > 0) {
    const ages = buildings
      .filter((b) => b.yearBuilt)
      .map((b) => currentYear - parseFloat(String(b.yearBuilt)));
    avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  }

  const tStudents =
    school.educationPrograms?.reduce(
      (sum: number, p: any) => sum + (parseFloat(String(p.totalStudents)) || 0),
      0,
    ) ?? 0;

  const tStaff =
    (parseFloat(String(school.maleTeachers)) || 0) +
    (parseFloat(String(school.femaleTeachers)) || 0) +
    (parseFloat(String(school.maleAdminStaff)) || 0) +
    (parseFloat(String(school.femaleAdminStaff)) || 0) +
    (parseFloat(String(school.maleSupportStaff)) || 0) +
    (parseFloat(String(school.femaleSupportStaff)) || 0);

  if (metrics) {
    return {
      ...school.calculatedAssessment,
      infrastructureScore: metrics.infrastructureScore,
      buildingAgeScore: metrics.buildingAgeScore,
      populationPressureScore: metrics.populationPressureScore,
      accessibilityScore: metrics.accessibilityScore,
      facilityComplianceScore: metrics.facilityComplianceScore,
      overallScore: metrics.overallScore,
      depreciation: metrics.depreciation,
      averageBuildingAge: metrics.avgBuildingAge ?? avgAge,
      totalStudents: metrics.totalStudents ?? tStudents,
      totalStaff: metrics.totalStaff ?? tStaff,
      urgencyMonths: metrics.urgencyMonths,
      recommendations: metrics.recommendations?.length > 0
        ? metrics.recommendations
        : school.calculatedAssessment?.recommendations,
    };
  }

  return {
    ...school.calculatedAssessment,
    averageBuildingAge: avgAge,
    totalStudents: tStudents,
    totalStaff: tStaff,
    infrastructureScore: parseFloat(String(school.calculatedAssessment?.infrastructureScore)) || 50,
    buildingAgeScore: parseFloat(String(school.calculatedAssessment?.buildingAgeScore)) || 50,
    populationPressureScore: parseFloat(String(school.calculatedAssessment?.populationPressureScore)) || 45,
    accessibilityScore: parseFloat(String(school.calculatedAssessment?.accessibilityScore)) || 50,
    facilityComplianceScore: parseFloat(String(school.calculatedAssessment?.facilityComplianceScore)) || 50,
    overallScore: parseFloat(String(school.calculatedAssessment?.overallScore)) || 65,
    depreciation: parseFloat(String(school.calculatedAssessment?.depreciation)) || 20,
    recommendations: school.calculatedAssessment?.recommendations ?? [],
  };
}

// ── Sub-sections ─────────────────────────────────────────────────────────────

function OverviewField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | undefined | null }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5">
      <div className="p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
        <Icon className="w-4 h-4 text-slate-500 dark:text-white/40" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400 dark:text-white/40 tracking-wide uppercase mb-0.5">
          {label}
        </p>
        <p className="text-[14px] font-medium text-slate-800 dark:text-white/80 truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function OverviewTab({ school }: { school: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <OverviewField icon={School} label="Name" value={school.name} />
      <OverviewField icon={Hash} label="Code" value={school.code} />
      <OverviewField icon={Building2} label="Type" value={school.type} />
      <OverviewField icon={MapPin} label="Province" value={school.province} />
      <OverviewField icon={MapPin} label="District" value={school.district} />
      {school.sector && <OverviewField icon={MapPin} label="Sector" value={school.sector} />}
      <OverviewField icon={Phone} label="Phone" value={school.contactPhone} />
      <OverviewField icon={Mail} label="Email" value={school.contactEmail} />
      <OverviewField icon={Calendar} label="Established" value={school.yearEstablished ? String(school.yearEstablished) : undefined} />
    </div>
  );
}

function BuildingsTab({ buildings }: { buildings: any[] }) {
  if (!buildings.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-white/30">
        <Building2 className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No buildings recorded yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {buildings.map((b, i) => {
        const condition: string = (b.condition ?? "").toUpperCase();
        const conditionStyle = CONDITION_STYLES[condition] ?? "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <motion.div
            key={b.id ?? i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <Building2 className="w-4 h-4 text-slate-400 dark:text-white/30" />
                </div>
                <span className="text-[13px] font-medium text-slate-800 dark:text-white/80 truncate max-w-35">
                  {b.name || `Building ${i + 1}`}
                </span>
              </div>
              {condition && (
                <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0", conditionStyle)}>
                  {condition}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-white/40">
              {b.type && <span>Type: <span className="text-slate-700 dark:text-white/60">{b.type}</span></span>}
              {b.yearBuilt && <span>Built: <span className="text-slate-700 dark:text-white/60">{b.yearBuilt}</span></span>}
              {b.floors && <span>Floors: <span className="text-slate-700 dark:text-white/60">{b.floors}</span></span>}
              {b.area && <span>Area: <span className="text-slate-700 dark:text-white/60">{b.area} m²</span></span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function MapTab({ school }: { school: any }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10" style={{ height: 480 }}>
      <SchoolMap school={school} isEmbed />
    </div>
  );
}

function AnalyticsTab({
  assessment,
  schoolId,
  onRefresh,
}: {
  assessment: any;
  schoolId: string;
  onRefresh: () => void;
}) {
  const [recalculating, setRecalculating] = useState(false);

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <div>
          <p className="font-semibold text-foreground">No analytics data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Run a recalculation to generate the decision intelligence score for this school.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={recalculating}
          onClick={async () => {
            setRecalculating(true);
            try {
              await api.post(`/analytics/schools/${schoolId}/recalculate`);
              onRefresh();
            } catch {
              // ignore — user can retry
            } finally {
              setRecalculating(false);
            }
          }}
          className="rounded-full"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${recalculating ? "animate-spin" : ""}`} />
          {recalculating ? "Calculating…" : "Calculate Now"}
        </Button>
      </div>
    );
  }

  return <DecisionIntelligenceScore assessment={assessment} />;
}

function ActionsTab({ id, user }: { id: string; user: any }) {
  const can2D3D = hasPermission(user, Permission.SCHOOL_VIEW_2D3D_MAP);
  const canKmz = hasPermission(user, Permission.UPLOAD_KMZ);
  const canSurvey = hasPermission(user, Permission.RUN_FACILITY_SURVEY);

  const actions = [
    {
      label: "2D Map Viewer",
      description: "Explore building footprints and campus layout on a 2D map",
      icon: Eye,
      href: `/schools/${id}/3dview`,
      allowed: can2D3D,
      permission: Permission.SCHOOL_VIEW_2D3D_MAP,
    },
    {
      label: "3D Explorer",
      description: "Interactive 3D campus model with CesiumJS",
      icon: Box,
      href: `/schools/${id}/3d-explorer`,
      allowed: can2D3D,
      permission: Permission.SCHOOL_VIEW_2D3D_MAP,
      newTab: true,
    },
    {
      label: "Facility Survey",
      description: "Run or view a structured condition survey for this school",
      icon: ClipboardList,
      href: `/schools/${id}/decision`,
      allowed: canSurvey,
      permission: Permission.RUN_FACILITY_SURVEY,
    },
    {
      label: "KMZ Upload",
      description: "Upload KMZ/KML files to update building geometries",
      icon: Upload,
      href: `/schools/${id}/kmz`,
      allowed: canKmz,
      permission: Permission.UPLOAD_KMZ,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {actions.map((action, i) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
        >
          {action.allowed ? (
            <Link
              to={action.href}
              target={action.newTab ? "_blank" : undefined}
              rel={action.newTab ? "noopener noreferrer" : undefined}
              className="group flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 hover:border-primary/30 dark:hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-white/4 transition-all"
            >
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors shrink-0">
                <action.icon className="w-5 h-5 text-slate-500 dark:text-white/40 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-slate-800 dark:text-white/80">{action.label}</p>
                <p className="text-[12px] text-slate-500 dark:text-white/40 mt-0.5 leading-relaxed">{action.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-white/20 group-hover:text-primary/60 transition-colors shrink-0" />
            </Link>
          ) : (
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-white/1 border border-slate-100 dark:border-white/5 opacity-50 cursor-not-allowed">
              <div className="p-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
                <action.icon className="w-5 h-5 text-slate-400 dark:text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-slate-600 dark:text-white/50">{action.label}</p>
                <p className="text-[12px] text-slate-400 dark:text-white/30 mt-0.5">
                  Requires <span className="font-mono">{action.permission}</span> permission
                </p>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SchoolDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [school, setSchool] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchool = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [schoolRes, metricsRes] = await Promise.all([
        api.get(`/schools/${id}`),
        api.get(`/analytics/schools/${id}/metrics`).catch(() => null),
      ]);
      const sData = schoolRes.data;
      const computed = buildAssessment(sData, metricsRes?.data ?? null);
      sData.calculatedAssessment = computed;
      setSchool(sData);
      setAssessment(computed);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load school");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSchool();
  }, [fetchSchool]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-red-500 dark:text-red-400 text-sm">{error ?? "School not found"}</p>
        <Button variant="outline" onClick={fetchSchool}>Retry</Button>
      </div>
    );
  }

  const priorityScore = Math.min(100, Math.max(0, Math.round(Number(assessment?.overallScore ?? 0))));
  const scoreColor =
    priorityScore >= 70 ? "text-emerald-600 dark:text-emerald-400" :
    priorityScore >= 50 ? "text-blue-600 dark:text-blue-400" :
    "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{school.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[12px] text-slate-500 dark:text-white/40 font-mono">{school.code}</span>
            {school.type && (
              <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0.5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40">
                {school.type}
              </Badge>
            )}
            {school.province && (
              <span className="text-[12px] text-slate-400 dark:text-white/30 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {school.province}{school.district ? `, ${school.district}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-3xl font-semibold tabular-nums", scoreColor)}>{priorityScore}</span>
          <span className="text-sm text-slate-400 dark:text-white/30">/ 100</span>
          <span className="text-[11px] text-slate-400 dark:text-white/30 ml-1">score</span>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all",
              activeTab === tab.id
                ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60",
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {activeTab === "overview" && <OverviewTab school={school} />}
        {activeTab === "buildings" && <BuildingsTab buildings={school.buildings ?? []} />}
        {activeTab === "map" && <MapTab school={school} />}
        {activeTab === "analytics" && (
          <AnalyticsTab assessment={assessment} schoolId={id!} onRefresh={fetchSchool} />
        )}
        {activeTab === "actions" && <ActionsTab id={id!} user={user} />}
      </motion.div>
    </div>
  );
}
