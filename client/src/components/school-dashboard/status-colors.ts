/**
 * Status colours for the school dashboard. Reserved for state (never for
 * decoration) and always shown next to a text label. Cards and detail dialogs
 * read them from here so a status looks the same everywhere.
 */

/** Issue Report statuses, worst first. `api` is the status value on a report. */
export const REPORT_STATUS = [
  { key: "needIntervention", api: "NEED_INTERVENTION", label: "Needs action", short: "Needs action", color: "#ef4444" },
  { key: "pending", api: "PENDING", label: "Waiting", short: "Waiting", color: "#f59e0b" },
  { key: "failed", api: "FAILED", label: "Not valid", short: "Not valid", color: "#94a3b8" },
  { key: "solved", api: "SOLVED", label: "Fixed", short: "Fixed", color: "#10b981" },
] as const;

export type ReportStatusKey = (typeof REPORT_STATUS)[number]["key"];

/** Building conditions, best first; "none" = not assessed. */
export const CONDITIONS = [
  { key: "good", label: "Good", color: "#10b981" },
  { key: "fair", label: "Fair", color: "#f59e0b" },
  { key: "poor", label: "Poor", color: "#f97316" },
  { key: "critical", label: "Critical", color: "#ef4444" },
  { key: "none", label: "Not checked", color: "#94a3b8" },
] as const;

export type ConditionKey = (typeof CONDITIONS)[number]["key"];

/** Indicative risk levels; "unknown" = the input data is missing. */
export const RISK_LEVEL: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical", color: "#ef4444" },
  high: { label: "High", color: "#f97316" },
  medium: { label: "Medium", color: "#f59e0b" },
  low: { label: "Low", color: "#10b981" },
  unknown: { label: "No data", color: "#94a3b8" },
};

/** Facility survey compliance per item; "none" = not surveyed yet. */
export const COMPLIANCE = [
  { key: "compliant", label: "Meets standard", color: "#10b981" },
  { key: "partial", label: "Partly meets", color: "#f59e0b" },
  { key: "non_compliant", label: "Doesn't meet", color: "#ef4444" },
  { key: "none", label: "Not checked yet", color: "#94a3b8" },
] as const;

export type ComplianceKey = (typeof COMPLIANCE)[number]["key"];

/** Site-map (KMZ) processing state. */
export const SITE_MAP: Record<string, { label: string; color: string }> = {
  completed: { label: "Site map ready", color: "#10b981" },
  processing: { label: "Processing site map", color: "#2563eb" },
  failed: { label: "Site map failed", color: "#ef4444" },
  pending: { label: "No site map yet", color: "#94a3b8" },
};

/** Neutral grey for "no data". */
export const NO_DATA = "#94a3b8";
