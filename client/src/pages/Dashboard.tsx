import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api, apiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/toast";
import {
  Building2,
  Users,
  MapPin,
  ClipboardCheck,
  Download,
  ArrowUpRight,
  Globe2,
  Loader2,
  MapPinned,
  GraduationCap,
} from "lucide-react";
import { IntelligenceScore } from "../components/analytics/IntelligenceScore";
import { RecommendationList } from "../components/analytics/RecommendationList";
import { Link, useNavigate } from "react-router-dom";
import { useSchoolsStore, calculatedScore } from "../store/schoolsStore";
import { useAuthStore } from "../store/authStore";
import { hasPermission } from "../lib/permissions";
import { Button } from "../components/ui/button";
import { RwandaBackdrop, type ProvinceSummary } from "../components/dashboard/RwandaBackdrop";
import { NationalDashboardSkeleton } from "../components/dashboard/NationalDashboardSkeleton";
import { ProvinceDistrictsDialog } from "../components/dashboard/ProvinceDistrictsDialog";
import { FloatingStat } from "../components/dashboard/FloatingStat";
import { PriorityDonut } from "../components/dashboard/PriorityDonut";
import { HeroTitle } from "../components/dashboard/HeroTitle";
import { SchoolRankings, splitRankings } from "../components/dashboard/SchoolRankings";
import { RankingQuickInfo } from "../components/dashboard/RankingQuickInfo";
import { motion } from "framer-motion";
import { PRIORITY_META, type MapSchool } from "../components/maps/schoolMap";
import { formatNumber, formatPercent } from "../lib/format";
import { modelOf, weightOf } from "../lib/scoring";
import { MetricInfo } from "../components/metric-help/MetricInfo";
import type { MetricId } from "../components/metric-help/metrics";
import type { HierarchyItem, NationalOverview } from "../components/dashboard/types";
import type { LucideIcon } from "lucide-react";
import {
  DashboardEmpty,
  DashboardError,
} from "../components/dashboard/DashboardStates";

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
  const fetchedRef = useRef(false);
  const mapSlotRef = useRef<HTMLDivElement>(null);

  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { allSchools, allSchoolsLoading, fetchAllSchools, invalidateAllSchools } =
    useSchoolsStore();

  // Province drill-down (from the map): districts for the clicked province.
  const [openProvince, setOpenProvince] = useState<ProvinceSummary | null>(null);
  const [districts, setDistricts] = useState<HierarchyItem[] | null>(null);
  const [districtsError, setDistrictsError] = useState(false);
  const handleProvinceClick = useCallback(async (p: ProvinceSummary) => {
    setOpenProvince(p);
    setDistricts(null);
    setDistrictsError(false);
    try {
      const res = await api.get<{ items?: HierarchyItem[] }>("/analytics/hierarchy", {
        params: { province: p.province },
      });
      setDistricts(res.data.items ?? []);
    } catch {
      setDistrictsError(true);
    }
  }, []);

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

  // Rankings must reflect the same scores as the overview: refetch the list on
  // every visit instead of reusing a session-long cache.
  useEffect(() => {
    invalidateAllSchools();
    fetchAllSchools();
  }, [fetchAllSchools, invalidateAllSchools]);

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

  // Every active school with a location, scored or not, for the backdrop map.
  const mapSchools = useMemo(
    () => allSchools.filter((s) => (s.status ?? "active") === "active") as MapSchool[],
    [allSchools],
  );

  if (loading || allSchoolsLoading) {
    return <NationalDashboardSkeleton />;
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

  const { top: top5, bottom: bottom5 } = splitRankings(schools);

  // Server-computed values only — nothing is derived from raw records here.
  const scoredCount: number = stats.scoredSchoolCount ?? 0;
  const aggregateScore = scoredCount > 0 ? num(stats.nationalAvgScore) : null;

  const model = modelOf(stats.scoringModel);
  const gaps = stats.dataGaps;
  const gapNote = (n: number | undefined) =>
    n && n > 0 ? `Estimated for ${n} of ${scoredCount} school${scoredCount === 1 ? "" : "s"}` : null;
  const avg = (v: unknown) => (scoredCount > 0 ? num(v) : null);
  const coverage = scoredCount > 0 ? num(stats.avgDataCoverage) : null;
  const unassessed = stats.byPriority?.unassessed ?? 0;
  const prioritySegments = [
    ...(["critical", "high", "medium", "low"] as const).map((key) => ({
      key,
      label: PRIORITY_META[key].label,
      value: stats.byPriority?.[key] ?? 0,
      color: PRIORITY_META[key].color,
    })),
    // Not-yet-scored schools are part of the network too; never hide them.
    ...(unassessed > 0
      ? [{ key: "unassessed", label: "Not assessed", value: unassessed, color: "#94a3b8" }]
      : []),
  ];
  const provinceCount = (stats.provinceStats ?? []).filter((p) => p.province).length;

  return (
    <div className="relative space-y-8 pb-10 min-h-screen">
      {/* Rwanda as the page's quiet background: fixed behind the content
          area (below the header, right of the sidebar) while cards scroll over it. */}
      <RwandaBackdrop
        schools={mapSchools}
        anchor={mapSlotRef}
        onSchoolClick={(s) => navigate(`/schools/${s.id}/decision`)}
        provinces={stats?.provinceStats?.map((p) => ({ ...p, avgScore: num(p.avgScore) }))}
        onProvinceClick={(p) => void handleProvinceClick(p)}
        className="fixed top-14 bottom-0 right-0 left-[var(--app-shell-inset,0px)] z-0 transition-[left] duration-200"
      />

      <ProvinceDistrictsDialog
        open={!!openProvince}
        province={openProvince}
        districts={districts}
        error={districtsError}
        onClose={() => setOpenProvince(null)}
      />

      {/* Pointer events pass through empty space to the map (school dots are
          clickable); every real block below opts back in. */}
      <div className="pointer-events-none relative z-10 space-y-8 [&>*:not([data-pass])]:pointer-events-auto">
        {/* ── Hero: title row; then the map stage — full width, Rwanda centred,
            nothing on top of it; then the priority ring + network snapshot. ── */}
        <section data-pass className="relative flex flex-col gap-4">
          {/* Command bar: one floating glass capsule — identity, live status and
              actions — centred over the top of the map. */}
          <div className="pointer-events-none! z-20 flex justify-center lg:absolute lg:inset-x-0 lg:top-0">
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative flex w-full max-w-fit flex-nowrap items-center gap-1.5 rounded-full bg-white/35 p-1.5 shadow-float backdrop-blur-2xl backdrop-saturate-[1.8] transition-colors duration-300 hover:bg-white/50 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
          >
            {/* Identity */}
            <div className="flex items-center gap-2.5 pl-1.5 pr-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.7)]">
                <Globe2 className="h-[18px] w-[18px]" aria-hidden />
                <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                </span>
              </span>
              <HeroTitle />
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-1.5">
              {hasPermission(user, "EXPORT_REPORTS") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExport}
                  disabled={exporting}
                  aria-label={exporting ? "Exporting CSV…" : "Export CSV"}
                  className="h-10 w-10 rounded-full hover:bg-slate-900/5 dark:hover:bg-white/10"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                </Button>
              )}
              <Button asChild aria-label="Explore map" className="group h-10 gap-1.5 rounded-full pl-2 pr-2 sm:pl-4 sm:pr-3">
                <Link to="/map">
                  <span className="hidden sm:inline">Explore map</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              </Button>
            </div>
          </motion.div>
          </div>

          {/* Map stage. From xl the side space becomes two rails — priority ring
              on the left, network counters on the right — and the map's slot
              is the centre column, so the cards never cover the country. */}
          <div className="pointer-events-none! relative hidden lg:grid lg:h-[max(560px,calc(100dvh-6rem))] lg:grid-cols-1 xl:grid-cols-[clamp(220px,15vw,270px)_minmax(0,1fr)_clamp(220px,15vw,270px)] xl:gap-4">
            {/* Bottom padding lifts the ring above centre, level with the map's
                body now that the country is pinned to the top of its slot. */}
            <div className="pointer-events-auto hidden min-h-0 flex-col justify-center pb-[clamp(6rem,18vh,11rem)] xl:flex">
                <PriorityDonut
                  vertical
                  footer={<RankingQuickInfo score={aggregateScore} top={top5[0]} bottom={bottom5[0]} />}
                  segments={prioritySegments}
                />
            </div>

            <div ref={mapSlotRef} className="relative min-h-0">
              <p className="pointer-events-auto absolute bottom-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/40 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-xl dark:bg-white/5 dark:text-white/45">
                <MapPinned className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-semibold text-foreground dark:text-white/80">Rwanda</span>·{" "}
                {formatNumber(provinceCount)} province{provinceCount === 1 ? "" : "s"} ·{" "}
                {formatNumber(mapSchools.length)} schools · tap a province
              </p>
            </div>

            <div className="pointer-events-auto hidden min-h-0 flex-col justify-center xl:flex">
                {/* Network snapshot — server-side aggregates only */}
                <dl className="grid gap-3">
                  {(
                    [
                      { label: "Survey coverage", caption: "of schools surveyed", value: num(stats.surveyCompletionRate), pct: true, id: "national.surveyCoverage", icon: ClipboardCheck, tone: "text-sky-500 dark:text-sky-400", color: "#0ea5e9" },
                      { label: "Map coverage", caption: "with a site model", value: num(stats.kmzCoverageRate), pct: true, id: "national.mapCoverage", icon: MapPinned, tone: "text-violet-500 dark:text-violet-400", color: "#8b5cf6" },
                      { label: "Students", caption: "enrolled", value: num(stats.totalStudents), pct: false, id: "national.totalStudents", icon: GraduationCap, tone: "text-emerald-500 dark:text-emerald-400", color: "#10b981" },
                      { label: "Teachers", caption: "teaching staff", value: num(stats.totalTeachers), pct: false, id: "national.totalTeachers", icon: Users, tone: "text-amber-500 dark:text-amber-400", color: "#f59e0b" },
                    ] satisfies Array<{ label: string; caption: string; value: number | null; pct: boolean; id: MetricId; icon: LucideIcon; tone: string; color: string }>
                  ).map((stat, i) => (
                    <FloatingStat
                      key={stat.label}
                      index={i}
                      compact
                      label={stat.label}
                      caption={stat.caption}
                      value={stat.value}
                      format={stat.pct ? (n) => formatPercent(n) : (n) => formatNumber(n)}
                      percent={stat.pct ? stat.value : null}
                      icon={stat.icon}
                      tone={stat.tone}
                      color={stat.color}
                      info={<MetricInfo id={stat.id} size="xs" />}
                    />
                  ))}
                </dl>
            </div>
          </div>

          <div className="pointer-events-auto grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2.65fr)] xl:hidden">
            <PriorityDonut
              className="h-full"
              segments={prioritySegments}
            />
            {/* Network snapshot — server-side aggregates only */}
            <dl className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
              {(
                [
                  { label: "Survey coverage", caption: "of schools surveyed", value: num(stats.surveyCompletionRate), pct: true, id: "national.surveyCoverage", icon: ClipboardCheck, tone: "text-sky-500 dark:text-sky-400", color: "#0ea5e9" },
                  { label: "Map coverage", caption: "with a site model", value: num(stats.kmzCoverageRate), pct: true, id: "national.mapCoverage", icon: MapPinned, tone: "text-violet-500 dark:text-violet-400", color: "#8b5cf6" },
                  { label: "Students", caption: "enrolled", value: num(stats.totalStudents), pct: false, id: "national.totalStudents", icon: GraduationCap, tone: "text-emerald-500 dark:text-emerald-400", color: "#10b981" },
                  { label: "Teachers", caption: "teaching staff", value: num(stats.totalTeachers), pct: false, id: "national.totalTeachers", icon: Users, tone: "text-amber-500 dark:text-amber-400", color: "#f59e0b" },
                ] satisfies Array<{ label: string; caption: string; value: number | null; pct: boolean; id: MetricId; icon: LucideIcon; tone: string; color: string }>
              ).map((stat, i) => (
                <FloatingStat
                  key={stat.label}
                  index={i}
                  compact
                  label={stat.label}
                  caption={stat.caption}
                  value={stat.value}
                  format={stat.pct ? (n) => formatPercent(n) : (n) => formatNumber(n)}
                  percent={stat.pct ? stat.value : null}
                  icon={stat.icon}
                  tone={stat.tone}
                  color={stat.color}
                  info={<MetricInfo id={stat.id} size="xs" />}
                />
              ))}
            </dl>
          </div>
        </section>

      <div className="grid gap-6 grid-cols-1">
        <IntelligenceScore
          score={aggregateScore}
          isAggregate={true}
          assessedCount={scoredCount}
          model={model}
          coverage={coverage}
          metrics={[
            {
              label: "Infrastructure",
              weight: weightOf("infrastructure", model),
              score: avg(stats.nationalAvgInfraScore),
              icon: Building2,
              metricId: "national.avgInfrastructure",
              estimatedNote: gapNote(gaps?.infrastructure),
            },
            {
              label: "Building age",
              weight: weightOf("buildingAge", model),
              score: avg(stats.nationalAvgAgeScore),
              icon: MapPin,
              metricId: "national.avgBuildingAgeScore",
              estimatedNote: gapNote(gaps?.buildingAge),
            },
            {
              label: "Compliance",
              weight: weightOf("facilityCompliance", model),
              score: avg(stats.nationalAvgComplianceScore),
              icon: ClipboardCheck,
              metricId: "national.avgFacilityCompliance",
              estimatedNote: gapNote(gaps?.facilityCompliance),
            },
            {
              label: "Accessibility",
              weight: weightOf("accessibility", model),
              score: avg(stats.nationalAvgAccessScore),
              icon: MapPin,
              metricId: "national.avgAccessibility",
              estimatedNote: gapNote(gaps?.accessibility),
            },
            {
              label: "Population pressure",
              weight: weightOf("population", model),
              score: avg(stats.nationalAvgPopScore),
              icon: Users,
              metricId: "national.avgPopulation",
              estimatedNote: gapNote(gaps?.population),
            },
            {
              label: "Issue resolution",
              weight: weightOf("resolution", model),
              score: avg(stats.nationalAvgResolutionScore),
              icon: ClipboardCheck,
              metricId: "component.resolution",
              estimatedNote: gapNote(gaps?.resolution),
            },
            {
              label: "Capacity use",
              // Σ students ÷ Σ capacity (server). null → no capacity on record.
              score: num(stats.nationalCapacityUtilisation),
              unit: "percent",
              emptyText: "No data yet",
              icon: Users,
              metricId: "national.capacityUtilisation",
            },
          ]}
          className="xl:col-span-2"
          appendix={<SchoolRankings top={top5} bottom={bottom5} embedded />}
        >
          <RecommendationList
            recommendations={
              Array.isArray(stats?.nationalRecommendations) &&
              stats.nationalRecommendations.length > 0
                ? stats.nationalRecommendations
                : ["No recommendations yet. Recalculate scores on the Decisions page to generate them."]
            }
            title="Recommended actions"
          />
        </IntelligenceScore>

      </div>

      </div>
    </div>
  );
}
