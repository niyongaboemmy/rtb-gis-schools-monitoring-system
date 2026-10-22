/** Recommendation tags and action statuses (server tag prefixes like [URGENT]). */
export type ActionStatus = "open" | "in_progress" | "done";

export interface RecommendationActionRow {
  id: string;
  recommendation: string;
  status: ActionStatus;
}

const TAGS: Record<string, { label: string; tone: string }> = {
  URGENT: { label: "Urgent", tone: "bg-red-500/12 text-red-600 dark:text-red-400" },
  CRITICAL: { label: "Critical", tone: "bg-orange-500/12 text-orange-600 dark:text-orange-400" },
  DATA: { label: "Data", tone: "bg-primary/10 text-primary dark:text-blue-300" },
  PLAN: { label: "Plan", tone: "bg-primary/10 text-primary dark:text-blue-300" },
  ACCESS: { label: "Access", tone: "bg-primary/10 text-primary dark:text-blue-300" },
  CAPACITY: { label: "Capacity", tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300" },
  COMPLIANCE: { label: "Compliance", tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300" },
  OPERATIONS: { label: "Operations", tone: "bg-slate-500/12 text-slate-600 dark:text-slate-300" },
  OK: { label: "On track", tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
};

export const STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

/** "[URGENT] Fix X" → { tag, text } */
export function parseRecommendation(rec: string) {
  const m = /^\s*\[([A-Z]+)\]\s*/.exec(rec);
  const key = m?.[1] ?? "";
  return { tag: TAGS[key] ?? null, text: rec.replace(/^\s*\[[A-Z]+\]\s*/, "").trim() };
}
