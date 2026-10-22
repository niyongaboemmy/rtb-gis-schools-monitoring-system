import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Socket } from "socket.io-client";
import { connectSocket } from "../lib/socket";
import { useParams, Link } from "react-router-dom";
import { useGoBack } from "../hooks/useGoBack";
import { useAuthStore } from "../store/authStore";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  FileText,
  Gauge,
  GraduationCap,
  ListChecks,
  MapPin,
  School,
  ShieldAlert,
  Users,
} from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { Button } from "../components/ui/button";
import { formatNumber, formatPercent, formatScore } from "../lib/format";
import { hasPermission } from "../lib/permissions";
import { cn } from "../lib/utils";
import { label } from "../lib/labels";
import { useToast } from "../components/ui/toast";
import { MetricInfo } from "../components/metric-help/MetricInfo";
import {
  DashboardError,
} from "../components/dashboard/DashboardStates";
import type { FacilityBuilding, ReportingData, SchoolMetrics } from "../components/dashboard/types";

// Dashboard Components
import { FloatingStat } from "../components/dashboard/FloatingStat";
import { SchoolHero, type DetailView } from "../components/school-dashboard/SchoolHero";
import { IssueReportsCard } from "../components/school-dashboard/IssueReportsCard";
import { RiskCard } from "../components/school-dashboard/RiskCard";
import { BuildingsCard } from "../components/school-dashboard/BuildingsCard";
import { DataQualityCard } from "../components/school-dashboard/DataQualityCard";
import { DetailModal } from "../components/school-dashboard/DetailModal";
import { ScoreBreakdown, ScoreSummary } from "../components/school-dashboard/ScoreBreakdown";
import { ReportsDetail, ReportsFooter, ReportsSummary } from "../components/school-dashboard/details/ReportsDetail";
import { RiskDetail, RiskSummary } from "../components/school-dashboard/details/RiskDetail";
import { BuildingsDetail, BuildingsSummary } from "../components/school-dashboard/details/BuildingsDetail";
import { ProfileDetail, ProfileSummary } from "../components/school-dashboard/details/ProfileDetail";
import { ActionsSummary } from "../components/school-dashboard/details/ActionsSummary";
import { ScoreFactorsCard } from "../components/school-dashboard/ScoreFactorsCard";
import { SchoolDashboardSkeleton } from "../components/school-dashboard/SchoolDashboardSkeleton";
import { GlassCard } from "../components/school-dashboard/GlassCard";
import { BRAND } from "../components/school-dashboard/tokens";
import { Recommendations } from "../components/school-dashboard/Recommendations";
import {
  STATUS_LABEL,
  type RecommendationActionRow,
} from "../components/school-dashboard/recommendation-utils";
import SchoolMap from "../components/SchoolMap";

/** The school record as returned by GET /schools/:id (only fields used here are typed). */
interface SchoolRecord {
  id: string;
  name?: string;
  code?: string;
  buildings?: FacilityBuilding[];
  [key: string]: unknown;
}

interface ScoresUpdatedEvent {
  overallScore: number;
  priorityLevel: SchoolMetrics["priorityLevel"];
}

interface SchoolDecisionDashboardProps {
  id?: string;
  /**
   * true  → full-screen page: renders the map shell (SchoolMap → School2DViewer),
   *         which mounts the embedded dashboard. Only the school record is
   *         loaded here.
   * false → the embedded dashboard itself: loads metrics, reporting and
   *         actions, and listens for live score changes.
   */
  standalone?: boolean;
  onUpdateSchool?: (update: Partial<SchoolRecord>) => void;
  onBuildingClick?: (building: FacilityBuilding) => void;
}

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
  const [loading, setLoading] = useState(Boolean(id));
  /** HTTP status of a failed load (0 = network/other), or null when loaded. */
  const [loadError, setLoadError] = useState<number | null>(null);
  /** GET /schools/dashboard/reporting — shared by the Overview card and the Issue Reports tab. */
  const [reporting, setReporting] = useState<ReportingData | null>(null);
  const [reportingLoading, setReportingLoading] = useState(false);
  const [reportingError, setReportingError] = useState(false);
  const [reportingLoadedAt, setReportingLoadedAt] = useState<Date | null>(null);
  /** Which detail dialog is open (summaries live on the page; detail in dialogs). */
  const [view, setView] = useState<DetailView | null>(null);
  const closeView = useCallback(() => setView(null), []);
  /** Bumped by the Issue Reports dialog's Refresh to reload its report list. */
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);
  const [actions, setActions] = useState<RecommendationActionRow[]>([]);

  const lastFetchedId = useRef<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [pastHero, setPastHero] = useState(false);
  const metricsRef = useRef<SchoolMetrics | null>(null);
  metricsRef.current = metrics;

  const schoolData = school;
  const buildings = useMemo(() => schoolData?.buildings || [], [schoolData]);
  const reportSummary = metrics?.reportSummary ?? null;


  const fetchReporting = useCallback(async () => {
    if (!id) return;
    setReportingLoading(true);
    setReportingError(false);
    try {
      const res = await api.get(`/schools/dashboard/reporting`, {
        params: { schoolId: id },
      });
      setReporting(res.data?.data?.reports ?? null);
      setReportingLoadedAt(new Date());
    } catch (error) {
      console.error("Failed to fetch reporting data:", error);
      setReportingError(true);
    } finally {
      setReportingLoading(false);
    }
  }, [id]);

  const fetchMetrics = useCallback(async () => {
    if (!id) return null;
    const res = await api
      .get(`/analytics/schools/${id}/metrics`)
      .catch(() => null);
    const next: SchoolMetrics | null = res?.data ?? null;
    setMetrics(next);
    return next;
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
          toast.success(`Recommendation marked ${STATUS_LABEL[res.data?.status as keyof typeof STATUS_LABEL] ?? "Open"}`);
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
          toast.success(`Recommendation marked ${STATUS_LABEL[nextStatus]}`);
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not update this recommendation. Please try again."));
      }
    },
    [id, actions, toast],
  );

  // 2. Data Fetching — the standalone shell only needs the school record; the
  // embedded dashboard loads the analytics (no duplicate requests).
  const fetchSchool = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const schoolRes = await api.get(`/schools/${id}`);
        setSchool(schoolRes.data);
        if (!standalone) {
          await Promise.all([fetchMetrics(), fetchReporting(), fetchActions()]);
        }
      } catch (error) {
        console.error("Failed to fetch school", error);
        setLoadError(
          (error as { response?: { status?: number } })?.response?.status ?? 0,
        );
      } finally {
        setLoading(false);
      }
    },
    [id, standalone, fetchMetrics, fetchReporting, fetchActions],
  );

  useEffect(() => {
    if (id && lastFetchedId.current !== id) {
      fetchSchool();
      lastFetchedId.current = id;
    }
  }, [id, fetchSchool]);

  // Edits made on the map / form: keep the local record in sync. The server
  // rescores the school on every scoring-input write and pushes
  // `scores:updated`, so no explicit recalculation call is made here.
  // Show the nav fade only after the hero has scrolled under the viewer nav.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), {
      rootMargin: "-96px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [school]);

  const handleUpdateSchool = useCallback(
    (update: Partial<SchoolRecord>) => {
      setSchool((prev) => (prev ? { ...prev, ...update } : prev));
      if (propOnUpdateSchool) propOnUpdateSchool(update);
    },
    [propOnUpdateSchool],
  );

  useEffect(() => {
    // Only the embedded dashboard (the one that shows scores) listens.
    if (!id || standalone) return;

    const socket: Socket = connectSocket();
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Join on every (re)connect so the room survives network drops.
    const schoolRoom = `school:${id}`;
    socket.on("connect", () => socket.emit("join", schoolRoom));

    socket.on("scores:updated", (update: ScoresUpdatedEvent) => {
      // Refetch the full payload (components, gaps, coverage, risk,
      // recommendations) so every figure moves together. Debounced: a burst of
      // edits produces one refresh and at most one toast.
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const before = metricsRef.current;
        const next = await fetchMetrics();
        void fetchReporting();
        if (
          next &&
          (before?.overallScore !== update.overallScore ||
            before?.priorityLevel !== update.priorityLevel)
        ) {
          toast.success(`Scores updated: ${formatScore(next.overallScore)} (${label("priority", next.priorityLevel)})`);
        }
      }, 400);
    });

    return () => {
      if (timer) clearTimeout(timer);
      socket.emit("leave", schoolRoom);
      socket.disconnect();
    };
  }, [id, standalone, fetchMetrics, fetchReporting, toast]);

  // 3. Render Logic
  if (!id) {
    return (
      <DashboardError
        className="m-4 md:m-8"
        title="No school is assigned to your account"
        message="Your school dashboard opens once an administrator links your account to a school."
      />
    );
  }

  if (loading) {
    // Mirror the final layout: full-screen viewer shell when standalone (the
    // map viewer replaces it), inline inside the viewer's Dashboard tab.
    // Portaled: the route transition's transform would otherwise trap `fixed`
    // inside the app layout (sidebar showing, then a jump).
    return standalone ? (
      createPortal(
        <div className="fixed inset-0 z-100 overflow-hidden bg-slate-50 dark:bg-gray-950">
          <SchoolDashboardSkeleton variant="page" />
        </div>,
        document.body,
      )
    ) : (
      <SchoolDashboardSkeleton />
    );
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

  const canManageActions = hasPermission(user, "MANAGE_DECISIONS");
  const schoolName = schoolData.name || "School";
  const m = metrics;
  const recommendations = m?.recommendations ?? [];
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

  return (
    <div className="relative min-h-full">
      {/* Ambient backdrop — the same calm depth as the national dashboard */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/15" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[32rem] rounded-full bg-primary/10 blur-[120px]" />
      </div>
      {/* Fade under the viewer's floating nav — only once the hero has scrolled away */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none sticky top-0 z-30 -mb-24 h-24 bg-linear-to-b from-slate-50 from-40% via-slate-50/85 to-transparent transition-opacity duration-300 dark:from-gray-950 dark:from-40% dark:via-gray-950/85",
          pastHero ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Full-bleed hero at the very top (it clears the viewer nav itself) */}
      <div ref={heroRef}>
      <SchoolHero
        name={schoolData.name || "School"}
        code={schoolData.code}
        district={typeof schoolData.district === "string" ? schoolData.district : undefined}
        province={typeof schoolData.province === "string" ? schoolData.province : undefined}
        mapped={schoolData.kmzStatus === "completed"}
        metrics={m}
        onOpen={setView}
      />
      </div>

      <div className="relative mx-auto -mt-4 max-w-[1400px] space-y-5 px-4 pb-10 sm:-mt-6 sm:px-8 lg:px-10">

        {!m && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Scores are not available right now. School details are shown; try again later.
          </p>
        )}

        {/* KPI strip — tap any for the full school profile */}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Students", value: m?.totalStudents ?? null, caption: isNum(m?.capacityUtilisation) ? `${formatPercent(m.capacityUtilisation)} full` : "no capacity", pct: isNum(m?.capacityUtilisation) ? Math.min(100, m.capacityUtilisation) : null, icon: GraduationCap, id: "school.totalStudents" as const },
            { label: "Teachers", value: m?.totalTeachers ?? null, caption: isNum(m?.studentToTeacherRatio) ? `${formatNumber(m.studentToTeacherRatio, 1)} : 1` : "—", pct: null, icon: Users, id: "school.studentTeacherRatio" as const },
            { label: "Buildings", value: m?.buildingCount ?? null, caption: isNum(m?.assessedBuildingCount) ? `${formatNumber(m.assessedBuildingCount)} checked` : "—", pct: isNum(m?.assessedBuildingCount) && isNum(m?.buildingCount) && m.buildingCount > 0 ? (m.assessedBuildingCount / m.buildingCount) * 100 : null, icon: Building2, id: "school.buildingCount" as const },
            { label: "Open issues", value: reportSummary?.active ?? null, caption: reportSummary?.resolutionRate == null ? "none yet" : `${formatPercent(reportSummary.resolutionRate)} fixed`, pct: reportSummary?.resolutionRate ?? null, icon: FileText, id: "reports.openIssues" as const },
            { label: "Road access", value: isNum(m?.roadStatusPercentage) ? m.roadStatusPercentage : null, caption: isNum(m?.roadStatusPercentage) ? "all-season" : "not recorded", pct: isNum(m?.roadStatusPercentage) ? m.roadStatusPercentage : null, icon: MapPin, id: "school.roadAccess" as const, percent: true },
            { label: "Programmes", value: m?.educationProgramsCount ?? null, caption: "trades", pct: null, icon: ClipboardCheck, id: "school.programmes" as const },
          ].map((k, idx) => (
            <div
              key={k.label}
              role="button"
              tabIndex={0}
              onClick={() => setView(k.label === "Open issues" ? "reports" : "profile")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setView(k.label === "Open issues" ? "reports" : "profile");
                }
              }}
              aria-label={`${k.label}: open details`}
              className={cn(
                "cursor-pointer rounded-[1.4rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                // Phones show the four essentials; the rest are in the profile dialog.
                idx >= 4 && "hidden sm:block",
              )}
            >
              <FloatingStat
                index={idx}
                compact
                label={k.label}
                caption={k.caption}
                value={k.value}
                format={k.percent ? (n) => formatPercent(n) : (n) => formatNumber(n)}
                percent={k.pct}
                icon={k.icon}
                tone="text-primary"
                color={BRAND}
                info={<MetricInfo id={k.id} size="xs" />}
              />
            </div>
          ))}
        </dl>

        {/* Summaries — two rows of three short cards; every detail opens in a dialog */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ScoreFactorsCard metrics={m} onOpen={() => setView("score")} index={0} />
          <GlassCard
            title="Next actions"
            icon={ListChecks}
            tone="text-primary"
            actionLabel={recommendations.length > 3 ? `All ${recommendations.length}` : "Open"}
            onAction={() => setView("actions")}
            index={1}
          >
            <Recommendations
              items={recommendations}
              actions={actions}
              onToggle={toggleAction}
              canEdit={canManageActions}
              limit={3}
              compact
            />
          </GlassCard>
          <IssueReportsCard summary={reportSummary} reporting={reporting} onOpen={() => setView("reports")} index={2} />
          <BuildingsCard
            buildings={buildings}
            assessedCount={m?.assessedBuildingCount ?? null}
            attention={reporting?.buildingsAttention ?? null}
            onOpen={() => setView("buildings")}
            onBuildingClick={onBuildingClick}
            index={3}
          />
          <RiskCard risk={m?.riskAssessment} onOpen={() => setView("risk")} index={4} />
          <DataQualityCard metrics={m} index={5} />
        </div>
      </div>

      {/* ── Detail dialogs ─────────────────────────────────────────────── */}
      <DetailModal
        isOpen={view === "score"}
        onClose={closeView}
        icon={Gauge}
        eyebrow={schoolName}
        title="Score breakdown"
        description="How each part adds to the School Condition Score. Parts without data are marked."
        summary={<ScoreSummary metrics={m} />}
        maxWidth="max-w-4xl"
      >
        <ScoreBreakdown metrics={m} />
      </DetailModal>

      <DetailModal
        isOpen={view === "reports"}
        onClose={closeView}
        icon={FileText}
        eyebrow={schoolName}
        title="Reported problems"
        description="Status, monthly trend and the latest reports for this school."
        summary={<ReportsSummary data={reporting} />}
        footer={
          <ReportsFooter
            onRefresh={() => {
              void fetchReporting();
              setReportsRefreshKey((k) => k + 1);
            }}
            busy={reportingLoading}
            error={reportingError}
            loadedAt={reportingLoadedAt}
          />
        }
        maxWidth="max-w-4xl"
      >
        <ReportsDetail
          schoolId={id}
          data={reporting}
          loading={reportingLoading}
          error={reportingError}
          onRetry={() => void fetchReporting()}
          refreshKey={reportsRefreshKey}
        />
      </DetailModal>

      <DetailModal
        isOpen={view === "risk"}
        onClose={closeView}
        icon={ShieldAlert}
        eyebrow={schoolName}
        title="Risks and how to reduce them"
        description="An estimate to help plan — not part of the School Condition Score."
        summary={<RiskSummary risk={m?.riskAssessment} />}
        maxWidth="max-w-5xl"
      >
        <RiskDetail risk={m?.riskAssessment} />
      </DetailModal>

      <DetailModal
        isOpen={view === "buildings"}
        onClose={closeView}
        icon={Building2}
        eyebrow={schoolName}
        title="Buildings"
        description="Condition of every building. Only buildings with a recorded condition count toward the score."
        summary={<BuildingsSummary buildings={buildings} metrics={m} />}
        maxWidth="max-w-4xl"
      >
        <BuildingsDetail
          buildings={buildings}
          onBuildingClick={
            onBuildingClick
              ? (b) => {
                  closeView();
                  onBuildingClick(b);
                }
              : undefined
          }
        />
      </DetailModal>

      <DetailModal
        isOpen={view === "profile"}
        onClose={closeView}
        icon={School}
        eyebrow={schoolName}
        title="School profile"
        description="Enrolment, staff, campus and access — as recorded for this school."
        summary={<ProfileSummary metrics={m} />}
        maxWidth="max-w-4xl"
      >
        <ProfileDetail metrics={m} />
      </DetailModal>

      <DetailModal
        isOpen={view === "actions"}
        onClose={closeView}
        icon={ListChecks}
        eyebrow={schoolName}
        title="Recommendations"
        description={
          canManageActions
            ? "Tap a box to move a recommendation along: Open → In progress → Done."
            : "Rule-based, from the scores. Ask a decision manager to update their status."
        }
        summary={<ActionsSummary items={recommendations} actions={actions} />}
        maxWidth="max-w-2xl"
      >
        <Recommendations items={recommendations} actions={actions} onToggle={toggleAction} canEdit={canManageActions} bare />
      </DetailModal>
    </div>
  );
}
