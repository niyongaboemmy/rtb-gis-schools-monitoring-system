import { motion, useReducedMotion } from "framer-motion";
import { Check, ListChecks } from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE } from "./tokens";
import {
  STATUS_LABEL,
  parseRecommendation,
  type ActionStatus,
  type RecommendationActionRow,
} from "./recommendation-utils";

interface Props {
  items: string[];
  actions: RecommendationActionRow[];
  onToggle: (rec: string) => void;
  /** Show only the first n (summary); the rest open in a modal. */
  limit?: number;
  onViewAll?: () => void;
  /** false → read-only (no MANAGE_DECISIONS). */
  canEdit?: boolean;
  /** Inside a titled card: no own header, tighter rows, 2-line clamp. */
  compact?: boolean;
  /** Inside a dialog that shows the progress itself: no own header, full rows. */
  bare?: boolean;
}

/**
 * Server recommendations as an action checklist: each line cycles
 * Open → In progress → Done (persisted as a recommendation action).
 */
export function Recommendations({ items, actions, onToggle, limit, onViewAll, canEdit = true, compact = false, bare = false }: Props) {
  const reduce = useReducedMotion();
  const shown = limit ? items.slice(0, limit) : items;
  const done = items.filter((r) => actions.find((a) => a.recommendation === r)?.status === "done").length;

  return (
    <div className="space-y-2.5">
      <div className={cn("flex items-center justify-between gap-2", (compact || bare) && "sr-only")}>
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden />
          Next actions
        </h3>
        {items.length > 0 && (
          <span className="text-xs tabular-nums text-slate-500 dark:text-white/50">
            {done}/{items.length} done
          </span>
        )}
      </div>

      {compact && items.length > 0 && (
        // Progress at a glance: done / in progress / open
        <div className="flex items-center gap-2">
          <div className="flex h-1.5 flex-1 gap-[2px] overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8" role="img" aria-label={`${done} of ${items.length} done`}>
            {(["done", "in_progress"] as const).map((st) => {
              const n = items.filter((r) => (actions.find((a) => a.recommendation === r)?.status ?? "open") === st).length;
              return n ? (
                <motion.span
                  key={st}
                  className={cn("h-full", st === "done" ? "bg-emerald-500" : "bg-amber-500")}
                  initial={{ width: 0 }}
                  animate={{ width: `${(n / items.length) * 100}%` }}
                  transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}
                />
              ) : null;
            })}
          </div>
          <span className="text-[13px] tabular-nums text-slate-500 dark:text-white/50">
            {done}/{items.length}
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <p className="rounded-2xl bg-slate-900/3 p-3 text-sm text-slate-500 dark:bg-white/4 dark:text-white/55">
          No recommendations at this time.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((rec, i) => {
            const status: ActionStatus = actions.find((a) => a.recommendation === rec)?.status ?? "open";
            const { tag, text } = parseRecommendation(rec);
            return (
              <motion.li
                key={rec}
                initial={reduce ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease: EASE }}
                className={cn(
                  "flex items-start gap-3 rounded-2xl bg-slate-900/3 transition-colors hover:bg-slate-900/5 dark:bg-white/4 dark:hover:bg-white/6",
                  compact ? "px-3 py-2" : "p-3",
                )}
              >
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onToggle(rec)}
                  aria-label={`Status ${STATUS_LABEL[status]}${canEdit ? " — activate to move to the next status" : ""}`}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-default",
                    status === "done"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : status === "in_progress"
                        ? "border-amber-500 bg-amber-500/15"
                        : "border-slate-300 dark:border-white/20",
                  )}
                >
                  {status === "done" && <Check className="h-3.5 w-3.5" aria-hidden />}
                  {status === "in_progress" && <span className="h-2 w-2 rounded-sm bg-amber-500" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    title={compact ? text : undefined}
                    className={cn(
                      "text-[15px] leading-relaxed",
                      compact && "line-clamp-1 leading-snug",
                      status === "done"
                        ? "text-slate-400 line-through dark:text-white/35"
                        : "text-slate-700 dark:text-white/80",
                    )}
                  >
                    {tag && (
                      <span className={cn("mr-1.5 inline-block rounded-md px-1.5 py-px align-[1px] text-[12px] font-semibold no-underline", tag.tone)}>
                        {tag.label}
                      </span>
                    )}
                    {text}
                  </p>
                  {status !== "open" && (
                    <span className="text-[12px] font-medium text-slate-500 dark:text-white/50">{STATUS_LABEL[status]}</span>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {onViewAll && items.length > shown.length && (
        <button
          type="button"
          onClick={onViewAll}
          className="w-full rounded-xl py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          View all {items.length} recommendations
        </button>
      )}
    </div>
  );
}
