import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, GitPullRequestArrow, MessageSquareText, Paperclip } from "lucide-react";
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

/** Wait chip per age tone (theme status tokens). */
const AGE_CHIP = {
  ok: "bg-slate-900/[0.04] text-muted-foreground dark:bg-white/[0.05]",
  watch: "bg-warning/12 text-warning",
  overdue: "bg-destructive/10 text-destructive",
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
 * Reports as one list group: hairline-divided rows inside a single surface,
 * with quiet age headings. Each row: school, what was reported, how long it
 * has waited (or, in history, the decision). Rows ease in; hover tints.
 */
export function ValidationList({ rows, selectedId, onSelect, facilityTitle, history, grouped, showStatus = true }: Props) {
  const reduce = useReducedMotion();
  const groups = rows.map((r) => (grouped ? groupOf(r, history) : null));

  return (
    <ul
      aria-label={history ? "Reviewed reports" : "Reports to review"}
      className="divide-y divide-slate-900/[0.06] overflow-hidden rounded-2xl bg-white/70 ring-1 ring-inset ring-slate-900/[0.06] dark:divide-white/[0.06] dark:bg-white/[0.03] dark:ring-white/[0.08]"
    >
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
        const waited = days == null ? "—" : days === 0 ? "Today" : `${days}d`;

        return (
          <Fragment key={r.id}>
            {heading && (
              <li
                aria-hidden
                className={cn(
                  "bg-slate-900/[0.025] px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground dark:bg-white/[0.025]",
                  heading === "Over a month old" && "text-destructive/80",
                )}
              >
                {heading}
              </li>
            )}
            <motion.li
              data-id={r.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => onSelect(r)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "group flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors focus-visible:bg-primary/[0.06]",
                  on ? "bg-primary/[0.07] dark:bg-primary/15" : "hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.04]",
                )}
              >
                {/* School badge, tinted by status */}
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
                  style={{ background: `color-mix(in srgb, ${st.color} 12%, transparent)`, color: `color-mix(in srgb, ${st.color} 85%, currentColor)` }}
                  aria-hidden
                >
                  {cr ? <GitPullRequestArrow className="h-4 w-4" /> : initials(r.school?.name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px]", on ? "text-primary" : "text-foreground")}>
                    {r.school?.name ?? "Unknown school"}
                  </span>
                  {showReview ? (
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquareText className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate">
                        {REVIEW_VERB[r.status] ?? st.label}
                        {fullName(r.reviewer) && ` by ${fullName(r.reviewer)}`}
                        {r.reviewedAt && ` · ${formatDate(r.reviewedAt)}`}
                        {r.reviewNote && ` — “${r.reviewNote}”`}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="shrink-0">{what}</span>
                      <span aria-hidden className="text-muted-foreground/40">·</span>
                      <span className="truncate">{r.description || "No description"}</span>
                      {(r.attachments?.length ?? 0) > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-muted-foreground/70" title={`${r.attachments!.length} attachment(s)`}>
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {r.attachments!.length}
                        </span>
                      )}
                    </span>
                  )}
                </span>

                {/* Status (when mixed) and how long it has waited */}
                {showStatus && (
                  <span className="hidden shrink-0 sm:block">
                    <StatusPill color={st.color}>{st.label}</StatusPill>
                  </span>
                )}
                {!history && isOpen(r.status) && (
                  <span
                    className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] tabular-nums", AGE_CHIP[tone])}
                    title={`Filed ${formatDate(r.createdAt)}`}
                  >
                    {waited}
                    {tone === "overdue" && <span className="hidden sm:inline"> overdue</span>}
                  </span>
                )}

                <ChevronRight
                  aria-hidden
                  className={cn(
                    "h-4 w-4 shrink-0 transition-[transform,color] duration-200 group-hover:translate-x-0.5",
                    on ? "text-primary" : "text-muted-foreground/50 group-hover:text-foreground",
                  )}
                />
              </button>
            </motion.li>
          </Fragment>
        );
      })}
    </ul>
  );
}
