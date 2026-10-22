import { REPORT_STATUS } from "../school-dashboard/status-colors";

export type Status = "PENDING" | "SOLVED" | "NEED_INTERVENTION" | "FAILED";
export type ReportKind = "issue" | "data_change_request";

interface Person {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

/** One row of GET /reports (school, building, reporter and reviewer joined). */
export interface ReviewReport {
  id: string;
  schoolId: string;
  facilityId?: string;
  itemId?: string;
  buildingId?: string | null;
  issueCategory?: string | string[] | null;
  description?: string | null;
  status: Status;
  type?: ReportKind;
  attachments?: string[] | null;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reporter?: Person | null;
  reviewer?: Person | null;
  building?: { name?: string | null } | null;
  school?: { id?: string; name?: string; district?: string; province?: string } | null;
  assignedRole?: string | null;
  changeRequest?: {
    fields: { field: string; currentValue: unknown; proposedValue: unknown }[];
    reason: string;
  } | null;
}

export const STATUS = Object.fromEntries(REPORT_STATUS.map((s) => [s.api, s])) as Record<
  Status,
  (typeof REPORT_STATUS)[number]
>;

export type ActionKey = "escalate" | "resolve" | "invalid" | "reopen" | "approve" | "reject";

export interface ReviewAction {
  key: ActionKey;
  status: Status;
  label: string;
  hint: string;
  /** Keyboard shortcut (single letter). */
  shortcut: string;
  /** A note is required: the school sees why. */
  needsNote?: boolean;
  tone: "danger" | "success" | "neutral";
}

const A: Record<ActionKey, ReviewAction> = {
  escalate: { key: "escalate", status: "NEED_INTERVENTION", label: "Needs action", hint: "RTB or the district must act", shortcut: "e", tone: "danger" },
  resolve: { key: "resolve", status: "SOLVED", label: "Mark fixed", hint: "The problem was fixed and checked", shortcut: "r", tone: "success" },
  invalid: { key: "invalid", status: "FAILED", label: "Not valid", hint: "Not a real problem, or reported twice", shortcut: "i", needsNote: true, tone: "neutral" },
  reopen: { key: "reopen", status: "PENDING", label: "Reopen", hint: "Send it back to the waiting list", shortcut: "o", tone: "neutral" },
  approve: { key: "approve", status: "SOLVED", label: "Approve", hint: "The change was made in the school record", shortcut: "r", tone: "success" },
  reject: { key: "reject", status: "FAILED", label: "Reject", hint: "The change will not be made", shortcut: "i", needsNote: true, tone: "neutral" },
};

/** The decisions that make sense for a report in its current state. */
export function actionsFor(r: Pick<ReviewReport, "status" | "type">): ReviewAction[] {
  if (r.type === "data_change_request") {
    return r.status === "SOLVED" || r.status === "FAILED" ? [A.reopen] : [A.approve, A.reject];
  }
  if (r.status === "PENDING") return [A.escalate, A.resolve, A.invalid];
  if (r.status === "NEED_INTERVENTION") return [A.resolve, A.invalid, { ...A.reopen, label: "Back to waiting" }];
  return [A.reopen];
}

export const fullName = (p?: Person | null): string | null => {
  if (!p) return null;
  const n = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return n || p.email || null;
};

export const fieldLabel = (field: string) => field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export const categories = (c: ReviewReport["issueCategory"]): string[] => (Array.isArray(c) ? c.filter(Boolean) : c ? [c] : []);

/** Whole days since a date (0 = today). */
export const ageDays = (iso: string | null | undefined, now = Date.now()): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86_400_000)) : null;
};

/** Ageing tone for an open report: ≤7 d fine, ≤30 d watch, older overdue. */
export const ageTone = (days: number | null, open: boolean): "ok" | "watch" | "overdue" =>
  !open || days == null || days <= 7 ? "ok" : days <= 30 ? "watch" : "overdue";

export const isOpen = (s: Status) => s === "PENDING" || s === "NEED_INTERVENTION";

/** How a review reads, by the status it left the report in. */
export const REVIEW_VERB: Record<string, string> = {
  PENDING: "Reopened",
  NEED_INTERVENTION: "Sent for action",
  SOLVED: "Marked fixed",
  FAILED: "Marked not valid",
};
