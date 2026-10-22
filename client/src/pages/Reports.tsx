import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart2,
  FileSearch,
  FileSpreadsheet,
  GitPullRequestArrow,
  History,
  Hourglass,
  Inbox,
  ListChecks,
  RefreshCw,
  Siren,
  Workflow,
} from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { cn } from "../lib/utils";
import { formatNumber, formatPercent } from "../lib/format";
import { label } from "../lib/labels";
import { useToast } from "../components/ui/toast";
import { useAuthorization } from "../hooks/useAuthorization";
import { Permission } from "../lib/permissions";
import { DashboardError } from "../components/dashboard/DashboardStates";
import { FloatingStat } from "../components/dashboard/FloatingStat";
import { MetricInfo } from "../components/metric-help/MetricInfo";
import { BRAND, EASE } from "../components/school-dashboard/tokens";
import { GlassCard } from "../components/school-dashboard/GlassCard";
import { DetailModal } from "../components/school-dashboard/DetailModal";
import { StackBar } from "../components/school-dashboard/charts/StackBar";
import { EmptyNote } from "../components/school-dashboard/details/primitives";
import { ValidationList } from "../components/report-review/ValidationList";
import { ReportsDashboardSkeleton } from "../components/report-review/ReviewSkeleton";
import { ExportList, type ExportItem } from "../components/report-review/ExportList";
import { useReviewData } from "../components/report-review/useReviewData";
import { ageDays, categories, fullName, STATUS, type ReviewReport, type Status } from "../components/report-review/review-utils";

async function downloadBlob(path: string, filename: string) {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadReportsCsv(rows: ReviewReport[]) {
  const head = ["Report number", "School", "Province", "District", "Type", "Category", "Status", "Description", "Reported by", "Reported", "Resolved", "Reviewed by", "Reviewed", "Review note"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const iso = (v?: string | null) => (v ? new Date(v).toISOString() : "");
  const body = rows.map((r) =>
    [
      r.id,
      r.school?.name,
      r.school?.province,
      r.school?.district,
      label("reportType", r.type ?? "issue"),
      categories(r.issueCategory).join(", "),
      STATUS[r.status]?.label ?? r.status,
      r.description,
      fullName(r.reporter),
      iso(r.createdAt),
      iso(r.resolvedAt),
      fullName(r.reviewer),
      iso(r.reviewedAt),
      r.reviewNote,
    ]
      .map(esc)
      .join(","),
  );
  const url = URL.createObjectURL(new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `reports-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STAGES: { status: Status; label: string; hint: string }[] = [
  { status: "PENDING", label: "Waiting", hint: "not reviewed yet" },
  { status: "NEED_INTERVENTION", label: "Needs action", hint: "RTB or the district must act" },
  { status: "SOLVED", label: "Fixed", hint: "fixed and checked" },
  { status: "FAILED", label: "Not valid", hint: "not a real problem" },
];

/**
 * Reports dashboard — how validation is going: what waits, what was decided,
 * and the exports. The work itself happens on the Validation page.
 */
export default function Reports() {
  const { isAuthorized } = useAuthorization();
  const toast = useToast();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { rows, loaded, loading, error, load, stats, facilityTitle } = useReviewData();
  const canExport = isAuthorized(Permission.EXPORT_REPORTS);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState<string | null>(null);

  const issues = useMemo(() => rows.filter((r) => (r.type ?? "issue") === "issue"), [rows]);
  const waiting = useMemo(
    () => rows.filter((r) => r.status === "PENDING").sort((a, b) => (ageDays(b.createdAt) ?? 0) - (ageDays(a.createdAt) ?? 0)),
    [rows],
  );
  const recent = useMemo(
    () =>
      rows
        .filter((r) => r.reviewedAt && r.status !== "PENDING")
        .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime()),
    [rows],
  );

  // Notification links (/reports?report=<id>) open the report on the review page.
  const linked = searchParams.get("report");
  if (linked) return <Navigate to={`/reports/validate?report=${encodeURIComponent(linked)}`} replace />;
  if (!loaded) return <ReportsDashboardSkeleton />;

  const openValidation = (params: Record<string, string> = {}) =>
    navigate(`/reports/validate${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
  const count = (s: Status) => issues.filter((r) => r.status === s).length;

  const exports: ExportItem[] = [
    {
      key: "reports",
      icon: ListChecks,
      title: "All reports",
      description: `${formatNumber(rows.length)} reports with status, reviewer, decision date and note — CSV.`,
      format: ".csv",
      run: async () => downloadReportsCsv(rows),
    },
    {
      key: "schools",
      icon: FileSpreadsheet,
      title: "Schools master dataset",
      description: "Every school with location, classification, facilities, staffing and GIS status — Excel.",
      format: ".xlsx",
      run: () => downloadBlob("/schools/export", "schools-export.xlsx"),
    },
    {
      key: "assessments",
      icon: FileBarChart2,
      title: "Decision assessments",
      description: "Scores, priority bands, urgency and estimated budget per school — CSV.",
      format: ".csv",
      run: () => downloadBlob("/analytics/export", `rtb-assessments-${new Date().toISOString().split("T")[0]}.csv`),
    },
  ];
  const runExport = async (it: ExportItem) => {
    setExportBusy(it.key);
    try {
      await it.run();
      setExportDone(it.key);
      toast.success(`${it.title} exported`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not export ${it.title.toLowerCase()}.`));
    } finally {
      setExportBusy(null);
    }
  };

  const btn =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60";
  const tiles = [
    {
      label: "Waiting for review",
      value: stats.pending,
      caption: stats.oldest == null ? "nothing waiting" : `oldest waiting ${formatNumber(stats.oldest)} days`,
      icon: Inbox,
      go: { tab: "new", type: "issue" },
    },
    {
      label: "Needs action",
      value: stats.escalated,
      caption: "RTB or the district must act",
      icon: Siren,
      go: { tab: "escalated", type: "issue" },
      info: <MetricInfo id="reports.needsIntervention" size="xs" />,
    },
    {
      label: "Fixed",
      value: stats.rate,
      caption: `${formatNumber(stats.solved)} of ${formatNumber(stats.issues)} issues`,
      icon: CheckCircle2,
      pct: stats.rate,
      format: (n: number | null) => formatPercent(n),
      go: { tab: "history", type: "issue" },
      info: <MetricInfo id="reports.resolutionRate" size="xs" />,
    },
    {
      label: "Change requests",
      value: stats.requestsOpen,
      caption: `open · ${formatNumber(stats.requests)} in total`,
      icon: GitPullRequestArrow,
      go: { tab: "new", type: "data_change_request" },
    },
  ];

  return (
    <div className="relative space-y-5 pb-10">
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_24px_-10px_rgb(37_99_235/0.8)]">
            <FileSearch className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Reports</h1>
            <p className="text-[13px] text-slate-500 dark:text-white/55">Reports from your schools: what is waiting, and what was decided.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
            className={cn(btn, "px-2.5 text-slate-600 ring-1 ring-slate-900/10 hover:bg-white dark:text-white/70 dark:ring-white/12 dark:hover:bg-white/8")}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin motion-reduce:animate-none")} aria-hidden />
          </button>
          {canExport && (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className={cn(btn, "text-slate-700 ring-1 ring-slate-900/10 hover:bg-white dark:text-white/80 dark:ring-white/12 dark:hover:bg-white/8")}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          )}
          <Link to="/reports/validate" className={cn(btn, "bg-primary text-white hover:bg-primary/90")}>
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Review reports
            {stats.pending + stats.requestsOpen > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">{formatNumber(stats.pending + stats.requestsOpen)}</span>
            )}
          </Link>
        </div>
      </motion.header>

      {error && <DashboardError title="We couldn't load the reports" message={error} onRetry={() => void load()} retrying={loading} />}

      {/* ── Key figures (open the matching list on Validation) ──── */}
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((k, i) => (
          // A div, not a <button>: the tile holds its own ⓘ button.
          <div
            key={k.label}
            role="button"
            tabIndex={0}
            onClick={() => openValidation(k.go)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openValidation(k.go);
              }
            }}
            aria-label={`${k.label}: open the list`}
            className="cursor-pointer rounded-[1.4rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <FloatingStat
              index={i}
              compact
              label={k.label}
              value={k.value}
              format={k.format ?? ((n) => formatNumber(n))}
              caption={k.caption}
              percent={k.pct ?? null}
              icon={k.icon}
              tone="text-primary"
              color={BRAND}
              info={k.info}
            />
          </div>
        ))}
      </dl>

      {/* ── Validation pipeline ─────────────────────────────────── */}
      <GlassCard title="Where reports stand" icon={Workflow} index={0} info={<MetricInfo id="reports.openIssues" size="xs" />}>
        {issues.length === 0 ? (
          <EmptyNote title="No problem reports yet">Reports appear here as soon as schools file them.</EmptyNote>
        ) : (
          <>
            <StackBar
              max={issues.length}
              height={12}
              ariaLabel="Problem reports by stage"
              segments={STAGES.map((s) => ({
                key: s.status,
                value: count(s.status),
                color: STATUS[s.status].color,
                tip: (
                  <span>
                    {s.label}: <b>{formatNumber(count(s.status))}</b>
                  </span>
                ),
              }))}
            />
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {STAGES.map((s) => (
                <li key={s.status} className="rounded-2xl px-3.5 py-3 ring-1 ring-slate-900/6 dark:ring-white/8">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS[s.status].color }} aria-hidden />
                    {s.label}
                  </p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(count(s.status))}</span>
                    <span className="text-[11px] tabular-nums text-slate-400 dark:text-white/40">{formatPercent((count(s.status) / issues.length) * 100)}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-white/45">{s.hint}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/50">
              <Hourglass className="h-3.5 w-3.5" aria-hidden />
              {stats.medianDaysToDecision == null
                ? "No decisions recorded yet."
                : `Half of all reports get a decision within ${formatNumber(stats.medianDaysToDecision, 1)} days.`}
            </p>
          </>
        )}
      </GlassCard>

      {/* ── Waiting + recent decisions ──────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard
          title="Waiting the longest"
          icon={Inbox}
          index={1}
          actionLabel={waiting.length ? `All ${formatNumber(waiting.length)}` : undefined}
          onAction={waiting.length ? () => openValidation({ tab: "new" }) : undefined}
        >
          {waiting.length === 0 ? (
            <EmptyNote title="Nothing waiting for review" />
          ) : (
            <ValidationList rows={waiting.slice(0, 5)} selectedId={null} onSelect={(r) => openValidation({ report: r.id })} facilityTitle={facilityTitle} />
          )}
        </GlassCard>
        <GlassCard
          title="Recent decisions"
          icon={History}
          index={2}
          actionLabel={recent.length ? "History" : undefined}
          onAction={recent.length ? () => openValidation({ tab: "history" }) : undefined}
        >
          {recent.length === 0 ? (
            <EmptyNote title="No decisions yet">Reviewed reports and their notes appear here.</EmptyNote>
          ) : (
            <ValidationList rows={recent.slice(0, 5)} selectedId={null} onSelect={(r) => openValidation({ report: r.id })} facilityTitle={facilityTitle} history />
          )}
        </GlassCard>
      </div>

      {waiting.length > 0 && (
        <Link
          to="/reports/validate"
          className="group flex items-center justify-between gap-3 rounded-[1.75rem] bg-primary px-5 py-4 text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
        >
          <span>
            <span className="block text-sm font-semibold">Start reviewing</span>
            <span className="block text-xs text-white/75">
              {formatNumber(waiting.length)} report{waiting.length === 1 ? "" : "s"} waiting, oldest first
            </span>
          </span>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}

      <DetailModal isOpen={exportOpen} onClose={() => setExportOpen(false)} icon={Download} title="Export data" description="Downloads respect your access area." maxWidth="max-w-xl">
        <ExportList items={exports} busy={exportBusy} done={exportDone} onRun={(it) => void runExport(it)} />
      </DetailModal>
    </div>
  );
}
