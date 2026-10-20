import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api, apiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/toast";
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
import { formatDate, formatNumber, formatPercent, formatScore } from "../lib/format";
import { MetricInfo } from "../components/metric-help/MetricInfo";
import type { MetricId } from "../components/metric-help/metrics";
import type { HierarchyItem, NationalOverview, ProvinceStat } from "../components/dashboard/types";
import type { LucideIcon } from "lucide-react";
import {
  DashboardEmpty,
  DashboardError,
  DashboardSkeleton,
} from "../components/dashboard/DashboardStates";

interface DashboardSchool {
  id: string;
  name: string;
  code?: string;
  district?: string;
  calculatedScore: number;
  overallScore?: number | string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function Dashboard() {
  const [stats, setStats] = useState<NationalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<{ items?: HierarchyItem[] } | null>(null);
  const fetchedRef = useRef(false);

  const navigate = useNavigate();
  const toast = useToast();
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
      } catch (err) {
        setDrillData(null);
        toast.error(apiErrorMessage(err, `Could not load districts for ${province}`));
      }
    },
    [selectedProvince, toast],
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
      toast.success("School scores exported to CSV");
    } catch (err) {
      console.error("Export failed", err);
      toast.error(apiErrorMessage(err, "Could not export the school scores. Please try again."));
    } finally {
      setExporting(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllSchools();
  }, [fetchAllSchools]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const statsRes = await api.get("/analytics/overview");
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to load data", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchOverview();
  }, [fetchOverview]);

  const schools = useMemo(
    () =>
      allSchools
        // Analytics reflect the operating network only — drop inactive /
        // under-renovation schools (server does the same for every aggregate).
        .filter((s) => (s.status ?? "active") === "active")
        // Rankings only make sense for scored schools; unscored ones would
        // otherwise sort to the bottom as a fake 0.
        .filter((s) => num(s.overallScore) !== null)
        .map((s) => ({ ...s, calculatedScore: calculatedScore(s) }))
        .sort((a, b) => b.calculatedScore - a.calculatedScore),
    [allSchools],
  );

  if (loading || allSchoolsLoading) {
    return <DashboardSkeleton cards={5} label="Loading national dashboard…" className="pt-4" />;
  }

  if (loadError || !stats) {
    return (
      <DashboardError
        className="mt-8"
        title="We couldn't load the national dashboard"
        onRetry={fetchOverview}
      />
    );
  }

  if ((stats.totalSchools ?? 0) === 0) {
    return (
      <DashboardEmpty
        className="mt-8"
        icon={Building2}
        title="No schools to show yet"
        description={
          <>
            There are no active schools in your area. Add a school, or set an
            existing school's status to Active, and its scores will appear here.
          </>
        }
        actionLabel="Go to schools"
        actionTo="/schools"
      />
    );
  }

  const top5 = schools.slice(0, 5);
  const bottom5 = [...schools].reverse().slice(0, 5);

  // Server-computed values only — nothing is derived from raw records here.
  const scoredCount: number = stats.scoredSchoolCount ?? 0;
  const aggregateScore = scoredCount > 0 ? num(stats.nationalAvgScore) : null;
  const infraGaps: number = stats.dataGaps?.infrastructure ?? 0;
  const popGaps: number = stats.dataGaps?.population ?? 0;
  const gapNote = (n: number) =>
    n > 0 ? `Estimated for ${n} of ${scoredCount} school${scoredCount === 1 ? "" : "s"}` : null;

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
          schools={schools}
          variant="hero"
          interactive
          title="National School Network"
          subtitle="Condition of Rwanda's TVET schools at a glance"
          href="/map"
          hrefLabel="Open national map"
          onSchoolClick={(s) => navigate(`/schools/${s.id}/decision`)}
          className="-mt-5 w-[calc(100vw-var(--app-shell-inset,0px))] ml-[calc((100%-100vw+var(--app-shell-inset,0px))/2)] transition-[width,margin] duration-200 md:-mt-7"
        />

        <PageHeader
        title="National Overview"
        description="School Condition Scores and Intervention Priorities for the active schools in your area"
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
                <Download className="w-3.5 h-3.5" aria-hidden />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            )}
            <div className="text-[10px] font-black tracking-widest text-muted-foreground bg-background/50 backdrop-blur-md px-4 py-2 rounded-xl border border-border/20">
              Scores as of{" "}
              {stats?.lastCalculatedAt ? formatDate(stats.lastCalculatedAt) : "—"}
            </div>
          </div>
        }
      />

      {/* KPI Cards Section */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Active schools"
          value={formatNumber(stats.totalSchools)}
          subValue={
            stats.byPriority?.unassessed
              ? `${formatNumber(stats.byPriority.unassessed)} not assessed yet`
              : undefined
          }
          icon={Building2}
          variant="info"
          delay={0.1}
          metricId="national.totalSchools"
          className="col-span-2 lg:col-span-1"
        />
        <KPICard
          title="Critical priority"
          value={formatNumber(stats.byPriority?.critical ?? 0)}
          subValue="Score below 35"
          icon={AlertTriangle}
          variant="destructive"
          delay={0.2}
          metricId="national.priorityCount"
        />
        <KPICard
          title="High priority"
          value={formatNumber(stats.byPriority?.high ?? 0)}
          subValue="Score 35–54"
          icon={AlertTriangle}
          variant="warning"
          delay={0.3}
          metricId="national.priorityCount"
        />
        <KPICard
          title="Medium priority"
          value={formatNumber(stats.byPriority?.medium ?? 0)}
          subValue="Score 55–74"
          icon={AlertTriangle}
          variant="warning"
          delay={0.35}
          metricId="national.priorityCount"
        />
        <KPICard
          title="Low priority"
          value={formatNumber(stats.byPriority?.low ?? 0)}
          subValue="Score 75 or more"
          icon={CheckCircle2}
          variant="success"
          delay={0.4}
          metricId="national.priorityCount"
        />
      </div>

      {/* Coverage data strip — sourced entirely from server-side aggregates */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border border-border/10 rounded-2xl p-2 sm:py-2 sm:px-4 bg-muted/10">
        {(
          [
            ["Survey Coverage", formatPercent(num(stats.surveyCompletionRate)), "national.surveyCoverage"],
            ["Map Coverage", formatPercent(num(stats.kmzCoverageRate)), "national.mapCoverage"],
            ["Total students", formatNumber(num(stats.totalStudents)), "national.totalStudents"],
            ["Total teachers", formatNumber(num(stats.totalTeachers)), "national.totalTeachers"],
          ] as Array<[string, string, MetricId]>
        ).map(([labelText, value, id]) => (
          <div key={labelText} className="flex flex-wrap items-center justify-center gap-x-1.5 min-w-0 text-center">
            <dt className="truncate">{labelText}:</dt>
            <dd className="text-foreground font-black tabular-nums">{value}</dd>
            <MetricInfo id={id} size="xs" />
          </div>
        ))}
      </dl>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <IntelligenceScore
          score={aggregateScore}
          isAggregate={true}
          assessedCount={scoredCount}
          metrics={[
            {
              label: "Infrastructure",
              score: scoredCount > 0 ? num(stats.nationalAvgInfraScore) : null,
              icon: Building2,
              metricId: "national.avgInfrastructure",
              estimatedNote: gapNote(infraGaps),
            },
            {
              label: "Building Age Score",
              score: scoredCount > 0 ? num(stats.nationalAvgAgeScore) : null,
              icon: MapPin,
              metricId: "national.avgBuildingAgeScore",
            },
            {
              label: "Facility Compliance",
              score: scoredCount > 0 ? num(stats.nationalAvgComplianceScore) : null,
              icon: ClipboardCheck,
              metricId: "national.avgFacilityCompliance",
            },
            {
              label: "Accessibility",
              score: scoredCount > 0 ? num(stats.nationalAvgAccessScore) : null,
              icon: MapPin,
              metricId: "national.avgAccessibility",
            },
            {
              label: "Population Pressure",
              score: scoredCount > 0 ? num(stats.nationalAvgPopScore) : null,
              icon: Users,
              metricId: "national.avgPopulation",
              estimatedNote: gapNote(popGaps),
            },
            {
              label: "Capacity Utilisation",
              // Σ students ÷ Σ capacity (server). null → no capacity on record.
              score: num(stats.nationalCapacityUtilisation),
              unit: "percent",
              emptyText: "No capacity data yet",
              icon: Users,
              metricId: "national.capacityUtilisation",
            },
          ]}
          className="xl:col-span-2"
        >
          <RecommendationList
            recommendations={
              Array.isArray(stats?.nationalRecommendations) &&
              stats.nationalRecommendations.length > 0
                ? stats.nationalRecommendations
                : ["No recommendations yet. Recalculate scores on the Decisions page to generate them."]
            }
            title="National recommendations"
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
                : "Schools by province"
            }
            selectedLabel={selectedProvince}
            onItemClick={!selectedProvince ? handleProvinceClick : undefined}
            items={
              drillData?.items?.map((d: HierarchyItem) => ({
                label:    d.label,
                total:    Number(d.total),
                critical: Number(d.critical),
                high:     Number(d.high),
                avgScore: d.avgScore,
              })) ??
              stats?.provinceStats?.map((p: ProvinceStat) => ({
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
          title="Highest scores"
          subtitle="Top 5 School Condition Scores"
          icon={TrendingUp}
          schools={top5}
          variant="success"
        />
        <DirectorySection
          title="Lowest scores"
          subtitle="Bottom 5 School Condition Scores"
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
  icon: LucideIcon;
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
          <h3 className="flex items-center gap-1 text-lg font-black tracking-tight text-foreground uppercase">
            {title}
            <MetricInfo id="national.rankings" />
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
              <TableHead className="font-black text-[10px] uppercase tracking-wider pl-4 pr-2 sm:pl-6 sm:pr-6">
                Institution
              </TableHead>
              <TableHead className="text-center font-black text-[10px] uppercase tracking-wider px-2 sm:px-6">
                Score
              </TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase tracking-wider pl-2 pr-4 sm:pl-6 sm:pr-6">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  No scored schools yet. Scores appear after a school's data is entered and recalculated.
                </TableCell>
              </TableRow>
            )}
            {schools.map((school) => (
              <TableRow
                key={school.id}
                className="group/row border-b border-border/5 last:border-0 hover:bg-primary/5 transition-colors"
              >
                <TableCell className="pl-4 pr-2 sm:pl-6 sm:pr-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] group-hover/row:scale-110 transition-all",
                        variant === "success"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {school.code?.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground leading-tight line-clamp-2 sm:line-clamp-1">
                        {school.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">
                        {school.district}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center px-2 sm:px-6">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center px-2 py-0.5 rounded-lg font-black text-[10px]",
                      variant === "success"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {formatScore(school.calculatedScore)}
                  </span>
                </TableCell>
                <TableCell className="text-right pl-2 pr-4 sm:pl-6 sm:pr-6">
                  <Link
                    to={`/schools/${school.id}/decision`}
                    aria-label={`Open ${school.name} dashboard`}
                    className="text-primary hover:text-primary transition-all"
                  >
                    <ArrowRight className="w-4 h-4 ml-auto" aria-hidden />
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
