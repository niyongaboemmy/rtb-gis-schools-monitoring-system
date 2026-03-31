import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import {
  Building2,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { api } from "../lib/api";
import { Modal } from "../components/ui/modal";
import { Button } from "../components/ui/button";

// Dashboard Components
import { DecisionIntelligenceScore } from "../components/dashboard/DecisionIntelligenceScore";
import { FacilityBreakdownSection } from "../components/dashboard/FacilityBreakdownSection";
import { SchoolStatsCards } from "../components/dashboard/SchoolStatsCards";
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
  const [facilitySurvey, setFacilitySurvey] = useState<any[]>([]);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);

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

  const getAssessment = useCallback(() => {
    if (!schoolData?.calculatedAssessment)
      return { priorityLevel: "medium", recommendations: [] };

    const infrastructureScore =
      schoolData.calculatedAssessment.infrastructureScore || 0;
    const overallScore = schoolData.calculatedAssessment.overallScore || 0;

    return {
      ...schoolData.calculatedAssessment,
      priorityLevel:
        overallScore < 40 ? "critical" : overallScore < 70 ? "high" : "medium",
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
      ].filter(Boolean),
    };
  }, [schoolData]);

  const assessment = getAssessment();

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
            sData.calculatedAssessment?.infrastructureScore ?? 50,
          overallScore: sData.calculatedAssessment?.overallScore ?? 65,
          depreciation: sData.calculatedAssessment?.depreciation ?? 20,
          populationPressureScore:
            sData.calculatedAssessment?.populationPressureScore ?? 45,
        };

        setSchool(sData);

        try {
          const surveyRes = await api.get(`/schools/${id}/survey`);
          setFacilitySurvey(surveyRes.data || []);
        } catch (e) {
          console.log("Survey data not available");
        }
      } catch (error) {
        console.error("Failed to fetch school", error);
      } finally {
        setLoading(false);
      }
    },
    [id],
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
      {/* Modern Dashboard Header */}
      <div className="relative group mb-12">
        <div className="absolute -inset-x-20 -top-20 h-64 bg-primary/5 dark:bg-primary/2 blur-[120px] rounded-full pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10 border-b border-slate-200 dark:border-blue-500/20 pb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-medium text-slate-800 dark:text-white/90 tracking-tight">
              Strategic <span className="text-primary/80">intelligence</span>{" "}
              Dashboard
            </h2>
            <div className="flex items-center gap-4 mt-4">
              <p className="text-[11px] font-normal text-slate-500 dark:text-white/30 tracking-wide">
                Instance: {schoolData.name || "Unidentified asset"}
              </p>
              <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-white/10" />
              <p className="text-[11px] font-medium text-primary/60 dark:text-primary/40 tracking-wide">
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
                  <p className="text-base font-medium text-slate-900 dark:text-white/80">+12.4%</p>
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
            <div className="text-[10px] font-normal text-slate-400 dark:text-white/10 pr-2">
              Sync latency: 42ms · t-ref:{" "}
              {new Date().toISOString().split("T")[1].slice(0, 8)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <DecisionIntelligenceScore assessment={assessment} />

          <FacilityBreakdownSection buildings={buildings} />
        </div>

        <div className="space-y-8">
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

          <div className="relative rounded-[32px] overflow-hidden group">
            {/* Professional Gradient Border & Background */}
            <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
              <div className="w-full h-full bg-white dark:bg-gray-900/80 backdrop-blur-3xl rounded-[calc(2rem-1px)]" />
            </div>

            <div className="relative z-10 p-8">
              <h3 className="text-sm font-medium text-primary/70 dark:text-primary/60 mb-6 flex items-center gap-3">
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
                  <p className="text-xs text-slate-400 dark:text-white/20 italic text-center py-6">
                    No critical interventions recommended at this time.
                  </p>
                )}
              </div>
            </div>
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
            with the 2D digital twin environment.
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
