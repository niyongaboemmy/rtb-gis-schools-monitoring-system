import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Paperclip, Plus } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/toast";
import { useSchoolsStore } from "../../store/schoolsStore";
import { REPORTS_CHANGED_EVENT } from "../../hooks/usePendingReviewCount";
import { EASE } from "../school-dashboard/tokens";
import { ReportAssessment } from "../report-review/ReportAssessment";
import { ageDays, ageTone, categories, isOpen, STATUS, type ReviewAction, type ReviewReport } from "../report-review/review-utils";

interface BuildingReportingTabProps {
  /** This building's reports (from the map's shared list). */
  reports: ReviewReport[];
  loaded: boolean;
  /** Open this report first (deep link or map badge). */
  initialReportId?: string | null;
  /** May this user decide on a report? */
  canDecide: (r: ReviewReport) => boolean;
  /** Link to the Review reports page (users who can open it). */
  canOpenReview: boolean;
  /** Show "Report a problem" (CREATE_REPORT). */
  onNew?: () => void;
  /** A decision was saved: update the shared list. */
  onPatched: (id: string, next: Partial<ReviewReport>) => void;
}

type Filter = "open" | "all";

const AGE_TEXT = {
  ok: "text-slate-500 dark:text-white/50",
  watch: "text-slate-600 dark:text-white/65",
  overdue: "text-primary dark:text-blue-300",
};

/** Open reports first (oldest first), then the rest (newest first). */
function order(rows: ReviewReport[]): ReviewReport[] {
  const t = (r: ReviewReport) => new Date(r.createdAt).getTime() || 0;
  const open = rows.filter((r) => isOpen(r.status)).sort((a, b) => t(a) - t(b));
  const done = rows.filter((r) => !isOpen(r.status)).sort((a, b) => t(b) - t(a));
  return [...open, ...done];
}

/**
 * A building's reports in two steps, like the Review reports page: the list,
 * then one report with the decision panel (for users who may decide). After a
 * decision it moves to the next open report.
 */
export function BuildingReportingTab({ reports, loaded, initialReportId, canDecide, canOpenReview, onNew, onPatched }: BuildingReportingTabProps) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const { facilities, fetchFacilities } = useSchoolsStore();
  const openCount = reports.filter((r) => isOpen(r.status)).length;
  const [filter, setFilter] = useState<Filter>(openCount > 0 || !loaded ? "open" : "all");
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId ?? null);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!facilities?.length) void fetchFacilities();
  }, [facilities?.length, fetchFacilities]);

  const facilityById = useMemo(() => new Map((facilities ?? []).map((f) => [f.facilityId, f])), [facilities]);
  const facilityTitle = (id?: string) => (id ? facilityById.get(id)?.title ?? id.replace(/[_-]/g, " ") : null);
  const itemLabel = (fid?: string, iid?: string) => (fid && iid ? facilityById.get(fid)?.items?.find((it) => it.id === iid)?.label ?? null : null);

  const all = useMemo(() => order(reports), [reports]);
  // Nothing open: show everything rather than an empty list.
  const effective: Filter = openCount === 0 ? "all" : filter;
  const rows = effective === "open" ? all.filter((r) => isOpen(r.status)) : all;
  const selected = selectedId ? all.find((r) => r.id === selectedId) ?? null : null;
  // Step through the list the report was opened from (or all, for a deep link).
  const stepList = selected && rows.some((r) => r.id === selected.id) ? rows : all;
  const pos = selected ? stepList.findIndex((r) => r.id === selected.id) : -1;

  const open = (r: ReviewReport | undefined, d = 1) => {
    if (!r) return;
    setDir(d);
    setSelectedId(r.id);
  };

  const decide = async (r: ReviewReport, action: ReviewAction, note: string) => {
    setBusy(true);
    try {
      const res = await api.patch(`/reports/${r.id}/status`, { status: action.status, ...(note ? { note } : {}) });
      const saved = res.data as Partial<ReviewReport> | undefined;
      onPatched(r.id, {
        status: action.status,
        reviewNote: note || null,
        reviewedAt: saved?.reviewedAt ?? new Date().toISOString(),
        reviewer: saved?.reviewer ?? r.reviewer,
        resolvedAt: saved?.resolvedAt ?? (action.status === "SOLVED" ? new Date().toISOString() : null),
      });
      toast.success(STATUS[action.status]?.label ?? "Saved");
      window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT));
      // Next open report, or back to the list.
      const next = all.find((x) => x.id !== r.id && isOpen(x.status));
      if (next) open(next, 1);
      else {
        setDir(-1);
        setSelectedId(null);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update the report. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading reports">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        {selected ? (
          <motion.div
            key={`r:${selected.id}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -16, transition: { duration: 0.1 } }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <div className="mb-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDir(-1);
                  setSelectedId(null);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All reports
              </button>
              <span className="ml-auto text-[13px] tabular-nums text-slate-400 dark:text-white/40">
                {pos + 1} of {stepList.length}
              </span>
              <IconBtn label="Previous report" disabled={pos <= 0} onClick={() => open(stepList[pos - 1], -1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </IconBtn>
              <IconBtn label="Next report" disabled={pos >= stepList.length - 1} onClick={() => open(stepList[pos + 1], 1)}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </IconBtn>
              {canOpenReview && (
                <Link
                  to={`/reports/validate?report=${selected.id}`}
                  aria-label="Open in Review reports"
                  title="Open in Review reports"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-primary dark:text-white/55 dark:hover:bg-white/8"
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
            <ReportAssessment
              key={selected.id}
              report={selected}
              facilityTitle={facilityTitle(selected.facilityId)}
              itemLabel={itemLabel(selected.facilityId, selected.itemId)}
              onDecide={canDecide(selected) ? (a, note) => decide(selected, a, note) : null}
              busy={busy}
              showMapLink={false}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -16, transition: { duration: 0.1 } }}
            transition={{ duration: 0.24, ease: EASE }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              {openCount > 0 && reports.length > openCount ? (
                <div role="group" aria-label="Show" className="inline-flex rounded-full bg-slate-900/5 p-0.5 dark:bg-white/6">
                  {(
                    [
                      ["open", "Open", openCount],
                      ["all", "All", reports.length],
                    ] as const
                  ).map(([k, l, n]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={effective === k}
                      onClick={() => setFilter(k)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs transition-colors",
                        effective === k ? "bg-white text-slate-900 ring-1 ring-slate-900/5 dark:bg-white/12 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-white/55",
                      )}
                    >
                      {l} <span className="tabular-nums opacity-60">{n}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-white/50">
                  {reports.length === 0 ? "No reports" : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
                </p>
              )}
              {onNew && (
                <motion.button
                  type="button"
                  onClick={onNew}
                  whileTap={reduce ? undefined : { scale: 0.96 }}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Report a problem
                </motion.button>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-900/[0.03] px-4 py-8 text-center dark:bg-white/[0.03]">
                <ClipboardCheck className="h-6 w-6 text-slate-300 dark:text-white/25" aria-hidden />
                <p className="text-[15px] text-slate-700 dark:text-white/80">No problems reported</p>
                <p className="text-xs text-slate-500 dark:text-white/50">Reports for this building show here.</p>
              </div>
            ) : (
              <ul className="space-y-1.5" aria-label="Reports">
                {rows.map((r, i) => {
                  const st = STATUS[r.status] ?? STATUS.PENDING;
                  const days = ageDays(r.createdAt);
                  const tone = ageTone(days, isOpen(r.status));
                  const what = [facilityTitle(r.facilityId), categories(r.issueCategory)[0]].filter(Boolean).join(" · ");
                  return (
                    <motion.li
                      key={r.id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.035, 0.3), ease: EASE }}
                    >
                      <button
                        type="button"
                        onClick={() => open(r, 1)}
                        className="group flex w-full items-start gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-left ring-1 ring-slate-900/6 transition-[background-color,box-shadow] hover:bg-white hover:ring-slate-900/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/[0.03] dark:ring-white/8 dark:hover:bg-white/[0.06]"
                      >
                        <span
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] dark:bg-primary/15"
                          aria-hidden
                        >
                          <span className={cn("h-2 w-2 rounded-full", isOpen(r.status) && !reduce && "animate-pulse")} style={{ background: st.color }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[15px] leading-snug text-slate-800 dark:text-white/85">{r.description || "No description"}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-white/45">
                            <span className="text-slate-700 dark:text-white/75">{st.label}</span>
                            {what && <span className="truncate">· {what}</span>}
                            {(r.attachments?.length ?? 0) > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-0.5">
                                · <Paperclip className="h-3 w-3" aria-hidden />
                                {r.attachments!.length}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className={cn("shrink-0 pt-0.5 text-[13px] tabular-nums", AGE_TEXT[tone])}>{days == null ? "" : days === 0 ? "Today" : `${days}d`}</span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-35 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white"
    >
      {children}
    </button>
  );
}
