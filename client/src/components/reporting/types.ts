import type { ReportSummary } from "../dashboard/types";

/** GET /schools/dashboard/reporting/overview → data (server: report-stats.ts reportingOverview). */
export type ReportingPeriod = "30d" | "90d" | "12m" | "all";

export interface ReportingOverviewData {
  period: ReportingPeriod;
  from: string | null;
  to: string;
  bucket: "day" | "week" | "month";
  summary: Omit<ReportSummary, "recentCritical">;
  statusCounts: { pending: number; needIntervention: number; solved: number; failed: number };
  schoolsAffected: number;
  schoolCount: number;
  previous: { total: number; resolved: number; resolutionRate: number | null } | null;
  totalChangePct: number | null;
  trend: Array<{ key: string; label: string; created: number; resolved: number }>;
  schools: Array<{
    schoolId: string;
    name: string;
    code: string | null;
    district: string | null;
    province: string | null;
    total: number;
    open: number;
    needIntervention: number;
    resolved: number;
    resolutionRate: number | null;
    oldestOpenDays: number | null;
  }>;
  urgent: Array<{
    id: string;
    schoolId: string;
    schoolName: string;
    description: string;
    facilityId: string | null;
    createdAt: string;
  }>;
}

export const PERIOD_LABEL: Record<ReportingPeriod, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
  all: "All time",
};
