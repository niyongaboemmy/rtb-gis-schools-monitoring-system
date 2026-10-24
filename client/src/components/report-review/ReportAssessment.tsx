import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Building2, CalendarDays, Camera, Check, Copy, GitPullRequestArrow, MapPinned, MessageSquareText, Tag, UserRound } from "lucide-react";
import { cn } from "../../lib/utils";
import { viewerLink } from "../../lib/viewer-tools";
import { formatDate, formatDateTime } from "../../lib/format";
import { FilePreview } from "../ui/file-preview";
import { StatusPill } from "../school-dashboard/details/primitives";
import { EASE } from "../school-dashboard/tokens";
import { actionsFor, ageDays, categories, fieldLabel, fullName, REVIEW_VERB, STATUS, type ReviewAction, type ReviewReport } from "./review-utils";

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "(empty)" : typeof v === "object" ? JSON.stringify(v) : String(v));

interface Props {
  report: ReviewReport;
  facilityTitle: string | null;
  itemLabel: string | null;
  /** null → read-only (no permission to decide). */
  onDecide: ((action: ReviewAction, note: string) => Promise<void>) | null;
  busy?: boolean;
  autoAdvance?: boolean;
  onAutoAdvanceChange?: (v: boolean) => void;
  /** Keyboard shortcuts for decisions are active. */
  shortcuts?: boolean;
  /** Where the decision bar sticks while scrolling (e.g. below the app bar). */
  pinClassName?: string;
  /** Link to the building on the school map (off inside the map itself). */
  showMapLink?: boolean;
}

/**
 * One report, laid out for an assessment: what was reported and the evidence
 * first, then the facts, the last review, and the decision with a note.
 * Render with `key={report.id}` so each report starts with an empty note.
 */
export function ReportAssessment({ report: r, facilityTitle, itemLabel, onDecide, busy, autoAdvance, onAutoAdvanceChange, shortcuts, pinClassName = "top-0", showMapLink = true }: Props) {
  const reduce = useReducedMotion();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const st = STATUS[r.status] ?? STATUS.PENDING;
  const cr = r.type === "data_change_request";
  const actions = actionsFor(r);
  const days = ageDays(r.createdAt);
  const cats = categories(r.issueCategory);
  const reviewer = fullName(r.reviewer);
  const files = (r.attachments ?? []).filter(Boolean);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const noted = note.trim().length > 0;

  // The next thing to do is write the note: put the cursor there.
  useEffect(() => {
    if (onDecide) noteRef.current?.focus({ preventScroll: true });
    // Once per report (the component is keyed by report id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (a: ReviewAction) => {
    if (!onDecide || busy) return;
    if (a.needsNote && !note.trim()) {
      setNoteError(`Add a short note: the school sees why it was ${a.key === "reject" ? "rejected" : "marked not valid"}.`);
      document.getElementById(noteId)?.focus();
      return;
    }
    setNoteError(null);
    await onDecide(a, note.trim());
  };

  // E / R / I / O — only when typing elsewhere is not in progress.
  useEffect(() => {
    if (!shortcuts || !onDecide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const a = actions.find((x) => x.shortcut === e.key.toLowerCase());
      if (a) {
        e.preventDefault();
        void decide(a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <motion.article
      key={r.id}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex min-h-full flex-col"
      aria-label={`Report from ${r.school?.name ?? "school"}`}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill color={st.color}>{st.label}</StatusPill>
          {cr && (
            <StatusPill>
              <GitPullRequestArrow className="h-3 w-3 text-primary" aria-hidden />
              Change request
            </StatusPill>
          )}
          <span className="text-[13px] text-slate-500 dark:text-white/50">
            Filed {formatDate(r.createdAt)}
            {days != null && ` · ${days === 0 ? "today" : `${days} days ago`}`}
          </span>
        </div>
        <h2 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-white">
          {cr ? "Request to change the school record" : [facilityTitle, itemLabel].filter(Boolean).join(" — ") || "Issue report"}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 text-[15px] text-slate-600 dark:text-white/60">
          <span className="font-medium text-slate-800 dark:text-white/85">{r.school?.name ?? "Unknown school"}</span>
          {(r.school?.district || r.school?.province) && <span>· {[r.school?.district, r.school?.province].filter(Boolean).join(", ")}</span>}
          {r.schoolId && (
            <Link to={`/schools/${r.schoolId}/decision`} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              Open school <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
          {showMapLink && r.schoolId && r.buildingId && (
            <Link
              to={viewerLink("2d", r.schoolId, { buildingId: r.buildingId, reportId: r.id })}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <MapPinned className="h-3 w-3" aria-hidden /> On the map
            </Link>
          )}
        </p>
      </header>

      {/* ── What was reported (the highlight) ─────────────────────── */}
      <div className="mt-5">
        {cr ? (
          <motion.section
            aria-labelledby={`${noteId}-what`}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.05, ease: EASE }}
            className="relative overflow-hidden rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-primary/25 dark:bg-primary/10"
          >
            <h3 id={`${noteId}-what`} className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-primary dark:text-blue-300">
              <GitPullRequestArrow className="h-3.5 w-3.5" aria-hidden /> Requested change
            </h3>
            <div className="mt-2.5 overflow-hidden rounded-xl bg-white ring-1 ring-slate-900/6 dark:bg-white/[0.04] dark:ring-white/8">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/[0.03] text-left text-[13px] text-slate-500 dark:bg-white/[0.03] dark:text-white/45">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Field</th>
                    <th scope="col" className="px-3 py-2 font-medium">Now</th>
                    <th scope="col" className="px-3 py-2 font-medium">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/5 dark:divide-white/6">
                  {(r.changeRequest?.fields ?? []).map((f) => (
                    <tr key={f.field} className="align-top">
                      <th scope="row" className="px-3 py-2 text-left font-medium text-slate-800 dark:text-white/85">{fieldLabel(f.field)}</th>
                      <td className="break-all px-3 py-2 text-slate-500 line-through decoration-slate-400/60 dark:text-white/45">{show(f.currentValue)}</td>
                      <td className="break-all px-3 py-2 font-semibold text-slate-900 dark:text-white">{show(f.proposedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.changeRequest?.reason && (
              <p className="mt-2.5 break-words text-sm leading-relaxed text-slate-900 dark:text-white">
                <span className="font-semibold">Why: </span>
                {r.changeRequest.reason}
              </p>
            )}
          </motion.section>
        ) : (
          <motion.section
            aria-labelledby={`${noteId}-what`}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.05, ease: EASE }}
            className="relative overflow-hidden rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-primary/25 dark:bg-primary/10 dark:ring-primary/30"
          >
            <h3 id={`${noteId}-what`} className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-primary dark:text-blue-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Reported problem
            </h3>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm font-medium leading-relaxed text-slate-900 sm:text-[15px] dark:text-white">
              {r.description || "No description was given."}
            </p>
            {cats.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Categories">
                {cats.map((c) => (
                  <li key={c} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[13px] font-medium text-slate-700 ring-1 ring-primary/20 dark:bg-white/8 dark:text-white/80 dark:ring-white/10">
                    <Tag className="h-3 w-3 text-primary dark:text-blue-300" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        )}
      </div>

      {/* ── Validate (pinned while the evidence scrolls) ─────────── */}
      <div className={cn("sticky z-10 -mx-1 mt-3 px-1 pb-3 pt-1", pinClassName)}>
        {onDecide ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: EASE }}
            className="relative space-y-2.5 rounded-2xl bg-[#eef3fd] p-3.5 dark:bg-[hsl(224_40%_11%)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your decision</h3>
              <ol className="flex items-center gap-3 text-[13px] text-slate-500 dark:text-white/55">
                <li className={cn("inline-flex items-center gap-1 transition-colors", noted && "text-primary dark:text-blue-300")}>
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[12px] font-semibold text-white transition-colors duration-300",
                      noted ? "bg-primary" : "bg-primary/70",
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={noted ? "done" : "todo"}
                        initial={reduce ? false : { scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={reduce ? undefined : { scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 26 }}
                        className="flex"
                      >
                        {noted ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> : "1"}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  Write a note
                </li>
                <li className={cn("inline-flex items-center gap-1 transition-colors", noted && "font-medium text-slate-800 dark:text-white/85")}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">2</span>
                  Choose an action
                </li>
              </ol>
            </div>
            <label htmlFor={noteId} className="block text-xs font-medium text-slate-700 dark:text-white/75">
              Note for the school <span className="font-normal text-slate-400 dark:text-white/40">— needed for “Not valid”</span>
            </label>
            <textarea
              id={noteId}
              ref={noteRef}
              onKeyDown={(e) => {
                // Esc leaves the note so the letter shortcuts work again.
                if (e.key === "Escape") {
                  e.stopPropagation();
                  e.currentTarget.blur();
                }
              }}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError(null);
              }}
              maxLength={1000}
              rows={3}
              placeholder="What did you find? What happens next?"
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? `${noteId}-err` : undefined}
              className={cn(
                "w-full resize-none rounded-xl bg-white px-3 py-2.5 text-sm text-slate-900 ring-1 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-white/[0.06] dark:text-white",
                noteError ? "ring-destructive/60" : "ring-slate-900/10 dark:ring-white/15",
              )}
            />
            {noteError && (
              <p id={`${noteId}-err`} role="alert" className="text-xs text-destructive">
                {noteError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {actions.map((a, i) => (
                <motion.button
                  key={a.key}
                  type="button"
                  whileHover={reduce || busy ? undefined : { y: -1 }}
                  whileTap={reduce || busy ? undefined : { scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  disabled={busy}
                  onClick={() => void decide(a)}
                  title={a.hint}
                  aria-keyshortcuts={shortcuts ? a.shortcut.toUpperCase() : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60",
                    // One brand colour for the main action; the label says what it does.
                    i === 0 && "bg-primary text-white hover:bg-primary/90",
                    i > 0 && "bg-slate-900/5 text-slate-800 hover:bg-slate-900/10 dark:bg-white/8 dark:text-white/85 dark:hover:bg-white/12",
                  )}
                >
                  {a.label}
                  {shortcuts && (
                    <kbd aria-hidden className={cn("hidden rounded px-1 font-mono sm:inline text-[12px] uppercase", i === 0 ? "bg-white/20" : "bg-slate-900/8 dark:bg-white/10")}>{a.shortcut}</kbd>
                  )}
                </motion.button>
              ))}
              {onAutoAdvanceChange && (
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-slate-500 dark:text-white/50">
                  <input type="checkbox" checked={!!autoAdvance} onChange={(e) => onAutoAdvanceChange(e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
                  Next report after deciding
                </label>
              )}
            </div>
          </motion.div>
        ) : (
          <p className="rounded-2xl bg-slate-900/[0.03] p-3 text-xs text-slate-500 dark:bg-white/[0.04] dark:text-white/50">
            You can view this report. Only report managers can change it.
          </p>
        )}
      </div>
      <div className="mt-3 space-y-6">
        {/* ── Evidence ──────────────────────────────────────────── */}
        {!cr && (
          <section aria-label="Photos and files" className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 dark:text-white/50">
              <Camera className="h-3.5 w-3.5" aria-hidden /> Photos and files {files.length > 0 && `· ${files.length}`}
            </h3>
            {files.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-white/12 dark:text-white/45">
                No photos or files attached — consider asking the school for a photo before marking it fixed.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {files.map((url, i) => (
                  <FilePreview key={url} url={url} filename={`Photo ${i + 1}`} showDetails={false} className="aspect-[4/3] overflow-hidden rounded-xl" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Facts ─────────────────────────────────────────────── */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl p-4 ring-1 ring-slate-900/6 dark:ring-white/8">
          {!cr && (
            <>
              <Fact icon={Building2} label="Building" value={r.building?.name || "Whole campus"} />
              <Fact icon={Tag} label="Facility" value={[facilityTitle, itemLabel].filter(Boolean).join(" · ") || "—"} />
            </>
          )}
          <Fact icon={UserRound} label="Reported by" value={fullName(r.reporter) ?? "—"} />
          <Fact icon={CalendarDays} label="Filed" value={formatDateTime(r.createdAt)} />
          {r.resolvedAt && <Fact icon={Check} label="Resolved" value={formatDateTime(r.resolvedAt)} />}
          <div className="min-w-0">
            <dt className="text-[13px] text-slate-500 dark:text-white/45">Report number</dt>
            <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs text-slate-700 dark:text-white/75">
              {r.id.slice(0, 8)}
              <button
                type="button"
                aria-label={copied ? "Report number copied" : "Copy the full report number"}
                onClick={() =>
                  void navigator.clipboard?.writeText(r.id).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  })
                }
                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-900/5 hover:text-primary dark:hover:bg-white/8"
              >
                {copied ? <Check className="h-3 w-3 text-primary" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              </button>
            </dd>
          </div>
        </dl>

        {/* ── Last review ───────────────────────────────────────── */}
        {(r.reviewedAt || r.reviewNote) && (
          <section aria-label="Last review" className="flex gap-3 rounded-2xl bg-primary/[0.05] p-3.5 ring-1 ring-primary/15 dark:bg-primary/10">
            <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-blue-300" aria-hidden />
            <div className="min-w-0 text-[15px]">
              <p className="text-slate-700 dark:text-white/80">
                <b className="font-semibold">{REVIEW_VERB[r.status] ?? st.label}</b>
                {reviewer && <> by {reviewer}</>}
                {r.reviewedAt && <span className="text-slate-500 dark:text-white/50"> · {formatDateTime(r.reviewedAt)}</span>}
              </p>
              {r.reviewNote && <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-800 dark:text-white/85">“{r.reviewNote}”</p>}
            </div>
          </section>
        )}
      </div>

    </motion.article>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[13px] text-slate-500 dark:text-white/45">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[15px] font-medium text-slate-900 dark:text-white/90">{value}</dd>
    </div>
  );
}
