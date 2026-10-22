import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, GitPullRequestArrow, MessageSquareText, Paperclip } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import { StatusPill } from "../school-dashboard/details/primitives";
import { ageDays, ageTone, categories, fieldLabel, fullName, isOpen, REVIEW_VERB, STATUS, type ReviewReport } from "./review-utils";

interface Props {
  rows: ReviewReport[];
  selectedId: string | null;
  onSelect: (r: ReviewReport) => void;
  facilityTitle: (id?: string) => string | null;
  /** History rows show the decision, the reviewer and the note. */
  history?: boolean;
  /** Add small headings by age ("Over a month old", "This month", "This week"). */
  grouped?: boolean;
  /** Show the status pill (off when every row has the same status). */
  showStatus?: boolean;
}

const AGE_TEXT = {
  ok: "text-slate-500 dark:text-white/50",
  watch: "text-amber-600/90 dark:text-amber-300/80",
  overdue: "text-red-500/90 dark:text-red-300/80",
};

const initials = (name?: string) =>
  (name ?? "?")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Which age group a row belongs to (open reports: by filing date; history: by decision date). */
function groupOf(r: ReviewReport, history?: boolean): string {
  if (history) {
    const d = ageDays(r.reviewedAt ?? r.updatedAt ?? r.createdAt);
    return d != null && d <= 7 ? "Decided this week" : "Earlier";
  }
  const d = ageDays(r.createdAt);
  return d == null ? "Waiting" : d > 30 ? "Over a month old" : d > 7 ? "This month" : "This week";
}

/**
 * Reports as a list group: the school, what was reported and how long it has
 * waited (or, in history, the decision taken). Rows ease in and respond to
 * hover and press.
 */
export function ValidationList({ rows, selectedId, onSelect, facilityTitle, history, grouped, showStatus = true }: Props) {
  const reduce = useReducedMotion();
  const groups = rows.map((r) => (grouped ? groupOf(r, history) : null));

  return (
    <ul aria-label={history ? "Reviewed reports" : "Reports to review"} className="space-y-1.5">
      {rows.map((r, i) => {
        const st = STATUS[r.status] ?? STATUS.PENDING;
        const days = ageDays(r.createdAt);
        const tone = ageTone(days, isOpen(r.status));
        const cr = r.type === "data_change_request";
        const what = cr
          ? `Change: ${(r.changeRequest?.fields ?? []).map((f) => fieldLabel(f.field)).join(", ") || "school record"}`
          : [facilityTitle(r.facilityId), categories(r.issueCategory)[0]].filter(Boolean).join(" · ") || "Problem";
        const on = r.id === selectedId;
        // A heading where the group changes from the row before.
        const heading = groups[i] && groups[i] !== groups[i - 1] ? groups[i] : null;
        const showReview = history || (r.status === "NEED_INTERVENTION" && r.reviewedAt);

        return (
          <Fragment key={r.id}>
            {heading && (
              <li
                aria-hidden
                className={cn(
                  "px-1 pb-0.5 text-xs text-slate-500 dark:text-white/45",
                  i > 0 && "pt-3",
                  heading === "Over a month old" && "text-red-500/80 dark:text-red-300/70",
                )}
              >
                {heading}
              </li>
            )}
            <motion.li
              data-id={r.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.button
                type="button"
                onClick={() => onSelect(r)}
                aria-current={on ? "true" : undefined}
                whileTap={reduce ? undefined : { scale: 0.99 }}
                className={cn(
                  "group relative flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left ring-1 transition-[background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  on
                    ? "bg-primary/[0.07] ring-primary/30 dark:bg-primary/15"
                    : "bg-white/70 ring-slate-900/6 hover:-translate-y-px hover:bg-white hover:ring-slate-900/12 dark:bg-white/[0.03] dark:ring-white/8 dark:hover:bg-white/[0.06] dark:hover:ring-white/15",
                )}
              >
                {/* School badge, tinted by status */}
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-medium transition-transform duration-300 group-hover:scale-105"
                  style={{ background: `color-mix(in srgb, ${st.color} 10%, transparent)`, color: `color-mix(in srgb, ${st.color} 85%, currentColor)` }}
                  aria-hidden
                >
                  {cr ? <GitPullRequestArrow className="h-4.5 w-4.5" /> : initials(r.school?.name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-slate-900 dark:text-white/90">{r.school?.name ?? "Unknown school"}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-white/50">{what}</span>
                  {showReview ? (
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
                      <MessageSquareText className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate">
                        {REVIEW_VERB[r.status] ?? st.label}
                        {fullName(r.reviewer) && ` by ${fullName(r.reviewer)}`}
                        {r.reviewedAt && ` · ${formatDate(r.reviewedAt)}`}
                        {r.reviewNote && ` — “${r.reviewNote}”`}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-1 flex items-center gap-2">
                      <span className="line-clamp-1 min-w-0 flex-1 text-[13px] text-slate-600 dark:text-white/60">{r.description || "No description"}</span>
                      {(r.attachments?.length ?? 0) > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-slate-400 dark:text-white/40" title={`${r.attachments!.length} attachment(s)`}>
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {r.attachments!.length}
                        </span>
                      )}
                    </span>
                  )}
                </span>

                {/* How long it has waited (open reports) and/or the status */}
                <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  {!history && isOpen(r.status) && (
                    <span className={cn("text-right text-xs tabular-nums", AGE_TEXT[tone])} title={`Filed ${formatDate(r.createdAt)}`}>
                      {days == null ? "—" : days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}
                      {tone === "overdue" && <span className="block text-[11px] opacity-80">overdue</span>}
                    </span>
                  )}
                  {showStatus && <StatusPill color={st.color}>{st.label}</StatusPill>}
                </span>
                {/* Phones: the wait as a compact figure */}
                {!history && isOpen(r.status) && (
                  <span className={cn("shrink-0 text-[11px] tabular-nums sm:hidden", AGE_TEXT[tone])}>{days == null ? "—" : `${days}d`}</span>
                )}

                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    on ? "bg-primary/90 text-white" : "bg-slate-900/[0.04] text-slate-400 group-hover:bg-primary/90 group-hover:text-white dark:bg-white/6 dark:text-white/40",
                  )}
                  aria-hidden
                >
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.button>
            </motion.li>
          </Fragment>
        );
      })}
    </ul>
  );
}
