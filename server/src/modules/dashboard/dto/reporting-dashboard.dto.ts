import type {
  BuildingAttentionRow,
  IssueReportSummary,
  MonthBucket,
  ReportTrends,
  StatusCounts,
} from '../../analytics/report-stats';

/**
 * GET /schools/dashboard/reporting — the Issue Reports tab. Every figure is
 * computed server-side from the same uncapped set of Issue Reports as the
 * overview card (`/analytics/schools/:id/metrics` → reportSummary), so the two
 * always agree. Data change requests are excluded; months are Kigali months.
 */
export interface ReportingMetrics {
  /** Same object as metrics.reportSummary. */
  summary: IssueReportSummary;
  /** Last 12 Kigali months, oldest first, with display labels. */
  months: MonthBucket[];
  /** This month vs last month: reports filed and reports resolved. */
  comparison: ReportTrends['comparison'];
  /** Category TAG counts (a report with two categories counts in both). */
  categoryTags: Record<string, number>;
  statusCounts: StatusCounts;
  /** Most recent Issue Report creation time (ISO), or null. */
  lastReportDate: string | null;
  /** Top buildings by open Issue Reports, then assessed poor/critical condition. */
  buildingsAttention: BuildingAttentionRow[];
}

export interface ReportingDashboardDto {
  timestamp: string;
  data: { reports: ReportingMetrics };
}
