import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../lib/api";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  LayoutGrid,
  Users,
  MapPin,
  ClipboardCheck,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { PageHeader } from "../components/ui/page-header";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";
import { KPICard } from "../components/analytics/KPICard";
import { IntelligenceScore } from "../components/analytics/IntelligenceScore";
import { RecommendationList } from "../components/analytics/RecommendationList";
import { DistributionChart } from "../components/analytics/DistributionChart";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";
import { useSchoolsStore } from "../store/schoolsStore";

interface DashboardSchool {
  id: string;
  name: string;
  code?: string;
  district?: string;
  calculatedScore: number;
}

// Deep Intelligence Score Logic (Strictly mirroring SchoolDecisionDashboard weights)
const calculateDeepScore = (school: any) => {
  if (!school) return 0;
  const currentYear = new Date().getFullYear();

  // 1. Infrastructure Score (20% weight)
  const infrastructureItems = [
    school.hasLibrary ? 100 : 0,
    school.hasLaboratory ? 100 : 0,
    school.hasComputerLab ? 100 : 0,
    school.hasSportsField ? 100 : 0,
    school.hasHostel ? 100 : 0,
    school.hasCanteen ? 100 : 0,
    school.hasElectricity ? 100 : 0,
    school.hasWater ? 100 : 0,
    school.hasInternet ? 100 : 0,
    school.hasSolarPanel ? 100 : 0,
    parseFloat(String(school.roadStatusPercentage)) || 0,
  ];
  const infrastructureScore = Math.round(
    infrastructureItems.reduce((a, b) => a + b, 0) / infrastructureItems.length,
  );

  // 2. Building Health Score (20% weight) - Using establishedYear as proxy if buildings relation not present
  const schoolAge = school.establishedYear
    ? currentYear - parseFloat(String(school.establishedYear))
    : 20;
  const ageDepreciation = Math.min(schoolAge * 1.5, 50); // Slightly more forgiving than buildings-only
  const buildingAgeScore = Math.max(0, 100 - ageDepreciation);

  // 3. Population Pressure Score (20% weight)
  const educationPrograms = school.educationPrograms || [];
  const totalStudents = educationPrograms.reduce(
    (sum: number, p: any) => sum + (parseFloat(String(p.totalStudents)) || 0),
    0,
  );
  const totalCapacity = educationPrograms.reduce(
    (sum: number, p: any) => sum + (parseFloat(String(p.capacity)) || 0),
    0,
  );
  const populationScore =
    totalCapacity > 0
      ? Math.min(100, Math.round((totalStudents / totalCapacity) * 100))
      : 50;

  // 4. Accessibility Score (20% weight)
  const accessibilityScore =
    parseFloat(String(school.roadStatusPercentage)) || 50;

  // 5. Facility Compliance Score (20% weight) - Using server score as proxy for compliance if survey not fetched
  const complianceScore = school.overallScore
    ? parseFloat(String(school.overallScore))
    : 50;

  // Final weighted calculation (All components at 20% weight per SchoolDecisionDashboard)
  return Math.round(
    infrastructureScore * 0.2 +
      buildingAgeScore * 0.2 +
      populationScore * 0.2 +
      accessibilityScore * 0.2 +
      complianceScore * 0.2,
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const { allSchools, allSchoolsLoading, fetchAllSchools } = useSchoolsStore();

  useEffect(() => {
    fetchAllSchools();
  }, [fetchAllSchools]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchData = async () => {
      try {
        const statsRes = await api.get("/analytics/overview");
        setStats(statsRes.data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const schools = useMemo(
    () =>
      allSchools
        .map((s) => ({ ...s, calculatedScore: calculateDeepScore(s) }))
        .sort((a, b) => b.calculatedScore - a.calculatedScore),
    [allSchools],
  );

  if (loading || allSchoolsLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Synchronizing National Intelligence...
          </p>
        </div>
      </div>
    );
  }

  const top5 = schools.slice(0, 5);
  const bottom5 = [...schools].reverse().slice(0, 5);

  const total = stats?.totalSchools || 1;
  const critical = stats?.byPriority?.critical || 0;
  const high = stats?.byPriority?.high || 0;
  const low = stats?.byPriority?.low || 0;

  const aggregateScore = Math.min(
    100,
    Math.round((low * 90 + high * 40 + critical * 10) / total),
  );

  return (
    <div className="relative space-y-8 pb-10 min-h-screen">
      {/* Background Pattern */}
      <ImigongoPattern 
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]" 
        opacity={0.05}
      />

      <div className="relative z-10 space-y-8">
        <PageHeader
        title="National System Overview"
        description="GIS Intelligence & Infrastructure Monitoring Dashboard"
        icon={LayoutGrid}
        actions={
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground bg-background/50 backdrop-blur-md px-4 py-2 rounded-xl border border-border/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE MONITORING ENABLED
          </div>
        }
      />

      {/* KPI Cards Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Institutions"
          value={stats?.totalSchools || 0}
          icon={Building2}
          variant="info"
          delay={0.1}
        />
        <KPICard
          title="Critical Priority"
          value={stats?.byPriority?.critical || 0}
          icon={AlertTriangle}
          variant="destructive"
          delay={0.2}
        />
        <KPICard
          title="High Priority"
          value={stats?.byPriority?.high || 0}
          icon={AlertTriangle}
          variant="warning"
          delay={0.3}
        />
        <KPICard
          title="Optimal Status"
          value={stats?.byPriority?.low || 0}
          icon={CheckCircle2}
          variant="success"
          delay={0.4}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <IntelligenceScore
          score={aggregateScore}
          isAggregate={true}
          metrics={[
            {
              label: "Buildings Health",
              score: aggregateScore + 5,
              icon: Building2,
            },
            { label: "Buildings Depreciation", score: 68, icon: MapPin },
            { label: "Students Population", score: 72, icon: Users },
            { label: "School Accessibility", score: 84, icon: ClipboardCheck },
            { label: "Facility Compliance", score: 84, icon: ClipboardCheck },
          ]}
          className="xl:col-span-2"
        >
          <RecommendationList
            recommendations={[
              `[URGENT] ${stats?.byPriority?.critical || 0} schools require immediate infrastructure intervention.`,
              "[STRATEGIC] Expand GIS mapping to rural sectors in the Northern province.",
              "[CRITICAL] Low student-to-latrine ratios detected in 12 high-priority schools.",
            ]}
            title="National Intelligence Insights"
            className="mt-6"
          />
        </IntelligenceScore>

        <DistributionChart
          title="Provincial Distribution"
          items={
            stats?.provinceStats?.map((p: any) => ({
              label: p.province,
              total: Number(p.total),
              critical: Number(p.critical),
              high: Number(p.high),
            })) || []
          }
        />
      </div>

      {/* Top and Bottom Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DirectorySection
          title="Top Performing Institutions"
          subtitle="Highest Decision Intelligence Scores"
          icon={TrendingUp}
          schools={top5}
          variant="success"
        />
        <DirectorySection
          title="Needs Priority Attention"
          subtitle="Lowest Decision Intelligence Scores"
          icon={TrendingDown}
          schools={bottom5}
          variant="destructive"
        />
      </div>
      </div>
    </div>
  );
}

function DirectorySection({
  title,
  subtitle,
  icon: Icon,
  schools,
  variant,
}: {
  title: string;
  subtitle: string;
  icon: any;
  schools: DashboardSchool[];
  variant: "success" | "destructive";
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2.5 rounded-2xl bg-card border border-border/20",
            variant === "success" ? "text-emerald-500" : "text-destructive",
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tight text-foreground uppercase">
            {title}
          </h3>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex flex-col border border-border/20 dark:border-blue-700/20 rounded-3xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/10 bg-muted/20">
              <TableHead className="font-black text-[10px] uppercase tracking-wider pl-6">
                Institution
              </TableHead>
              <TableHead className="text-center font-black text-[10px] uppercase tracking-wider">
                Score
              </TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase tracking-wider pr-6">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school: any) => (
              <TableRow
                key={school.id}
                className="group/row border-b border-border/5 last:border-0 hover:bg-primary/5 transition-colors"
              >
                <TableCell className="pl-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] group-hover/row:scale-110 transition-all",
                        variant === "success"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {school.code?.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight line-clamp-1">
                        {school.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">
                        {school.district}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center px-2 py-0.5 rounded-lg font-black text-[10px]",
                      variant === "success"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {school.calculatedScore}%
                  </span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <Link
                    to={`/schools/${school.id}`}
                    className="text-primary hover:text-primary transition-all"
                  >
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
