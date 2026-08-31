import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Download,
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
import { Link, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";
import { useSchoolsStore, calculatedScore } from "../store/schoolsStore";
import { useAuthStore } from "../store/authStore";
import { hasPermission } from "../lib/permissions";
import { Button } from "../components/ui/button";
import { SchoolCoverMap } from "../components/maps/SchoolCoverMap";

interface DashboardSchool {
  id: string;
  name: string;
  code?: string;
  district?: string;
  calculatedScore: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<any>(null);
  const fetchedRef = useRef(false);

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { allSchools, allSchoolsLoading, fetchAllSchools } = useSchoolsStore();

  const handleProvinceClick = useCallback(
    async (province: string) => {
      if (selectedProvince === province) {
        setSelectedProvince(null);
        setDrillData(null);
        return;
      }
      setSelectedProvince(province);
      try {
        const res = await api.get("/analytics/hierarchy", {
          params: { province },
        });
        setDrillData(res.data);
      } catch {
        setDrillData(null);
      }
    },
    [selectedProvince],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const response = await api.get("/analytics/export", {
        responseType: "blob",
      });
      const blob = new Blob([response.data as BlobPart], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rtb-schools-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  }, []);

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
        .map((s) => ({ ...s, calculatedScore: calculatedScore(s) }))
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

  // Server-computed arithmetic mean — no synthetic formula on the client
  const aggregateScore = Math.min(
    100,
    Math.max(0, Math.round(parseFloat(String(stats?.nationalAvgScore)) || 0)),
  );

  return (
    <div className="relative space-y-8 pb-10 min-h-screen">
      {/* Background Pattern */}
      <ImigongoPattern 
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]" 
        opacity={0.05}
      />

      <div className="relative z-10 space-y-8">
        {/* ── Cover map — full-bleed NASA-style locator hero ── */}
        <SchoolCoverMap
          schools={allSchools}
          variant="hero"
          interactive
          title="National School Network"
          subtitle="Live infrastructure intelligence across Rwanda's TVET institutions"
          href="/map"
          hrefLabel="Open national map"
          onSchoolClick={(s) => navigate(`/schools/${s.id}`)}
          className="-mt-5 w-[calc(100vw-var(--app-shell-inset,0px))] ml-[calc((100%-100vw+var(--app-shell-inset,0px))/2)] transition-[width,margin] duration-200 md:-mt-7"
        />

        <PageHeader
        title="National System Overview"
        description="GIS Intelligence & Infrastructure Monitoring Dashboard"
        icon={LayoutGrid}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {hasPermission(user, "EXPORT_REPORTS") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="rounded-xl text-[10px] font-black uppercase tracking-wider h-8 px-3 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            )}
            <div className="text-[10px] font-black tracking-widest text-muted-foreground bg-background/50 backdrop-blur-md px-4 py-2 rounded-xl border border-border/20">
              SCORES AS OF{" "}
              {stats?.lastCalculatedAt
                ? new Date(stats.lastCalculatedAt).toLocaleDateString("en-RW", {
                    dateStyle: "medium",
                  })
                : new Date().toLocaleDateString("en-RW", {
                    dateStyle: "medium",
                  })}
            </div>
          </div>
        }
      />

      {/* KPI Cards Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          title="Medium Priority"
          value={stats?.byPriority?.medium || 0}
          icon={AlertTriangle}
          variant="warning"
          delay={0.35}
        />
        <KPICard
          title="Optimal Status"
          value={stats?.byPriority?.low || 0}
          icon={CheckCircle2}
          variant="success"
          delay={0.4}
        />
      </div>

      {/* Coverage data strip — sourced entirely from server-side aggregates */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border/10 rounded-2xl py-2 px-4 bg-muted/10">
        <span>
          Survey coverage:{" "}
          <strong className="text-foreground">
            {stats?.surveyCompletionRate != null ? `${stats.surveyCompletionRate}%` : "—"}
          </strong>
        </span>
        <span className="text-border/40">·</span>
        <span>
          GIS coverage:{" "}
          <strong className="text-foreground">
            {stats?.kmzCoverageRate != null ? `${stats.kmzCoverageRate}%` : "—"}
          </strong>
        </span>
        <span className="text-border/40">·</span>
        <span>
          Total students:{" "}
          <strong className="text-foreground">
            {stats?.totalStudents != null
              ? Number(stats.totalStudents).toLocaleString()
              : "—"}
          </strong>
        </span>
        <span className="text-border/40">·</span>
        <span>
          Total teachers:{" "}
          <strong className="text-foreground">
            {stats?.totalTeachers != null
              ? Number(stats.totalTeachers).toLocaleString()
              : "—"}
          </strong>
        </span>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <IntelligenceScore
          score={aggregateScore}
          isAggregate={true}
          metrics={[
            {
              label: "National Health Score",
              // Server-computed arithmetic mean — no synthetic formula
              score: aggregateScore,
              icon: Building2,
            },
            {
              label: "Buildings Depreciation",
              // 100 − avg building-age score: higher age score = newer stock = less depreciation
              score: Math.min(100, Math.max(0, Math.round(
                100 - (parseFloat(String(stats?.nationalAvgAgeScore)) || 50)
              ))),
              icon: MapPin,
            },
            {
              label: "Capacity Utilisation",
              // Server-side: totalStudents ÷ totalCapacity — null until that field is wired
              score: stats?.nationalCapacityUtilisation != null
                ? Math.min(100, Math.max(0, Math.round(
                    parseFloat(String(stats.nationalCapacityUtilisation))
                  )))
                : null,
              icon: Users,
            },
            {
              label: "School Accessibility",
              score: Math.min(100, Math.max(0, Math.round(
                parseFloat(String(stats?.nationalAvgAccessScore)) || 0
              ))),
              icon: ClipboardCheck,
            },
            {
              label: "Facility Compliance",
              score: Math.min(100, Math.max(0, Math.round(
                parseFloat(String(stats?.nationalAvgComplianceScore)) || 0
              ))),
              icon: ClipboardCheck,
            },
          ]}
          className="xl:col-span-2"
        >
          <RecommendationList
            recommendations={
              Array.isArray(stats?.nationalRecommendations) &&
              stats.nationalRecommendations.length > 0
                ? stats.nationalRecommendations
                : ["No recommendations available — run a full recalculation to generate insights."]
            }
            title="National Intelligence Insights"
            className="mt-6"
          />
        </IntelligenceScore>

        <div className="flex flex-col gap-4">
          {selectedProvince && (
            <button
              onClick={() => { setSelectedProvince(null); setDrillData(null); }}
              className="text-[10px] font-black uppercase tracking-widest text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
            >
              ← Back to National
            </button>
          )}
          <DistributionChart
            className="flex-1 h-auto min-h-0"
            title={
              selectedProvince
                ? `${selectedProvince} — Districts`
                : "Provincial Distribution"
            }
            selectedLabel={selectedProvince}
            onItemClick={!selectedProvince ? handleProvinceClick : undefined}
            items={
              drillData?.items?.map((d: any) => ({
                label:    d.label,
                total:    Number(d.total),
                critical: Number(d.critical),
                high:     Number(d.high),
                avgScore: d.avgScore,
              })) ??
              stats?.provinceStats?.map((p: any) => ({
                label:    p.province,
                total:    Number(p.total),
                critical: Number(p.critical),
                high:     Number(p.high),
                avgScore: p.avgScore,
              })) ??
              []
            }
          />
        </div>
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

      <div className="flex flex-col border border-border/20 dark:border-blue-700/12 rounded-3xl bg-card/60 backdrop-blur-sm overflow-hidden">
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
