export interface DecisionAssessmentSummary {
  overallScore: number;
  weightBreakdown: Array<{ category: string; score: number }>;
}
export interface AnalyticsMetrics {
  trendScore: number;
  perFeatureScores: Array<{ feature: string; score: number }>;
  // Optional time-series trends derived from backend (last 12 months, last 7 days)
  trends?: {
    monthly: number[];
    weekly: number[];
  };
}
/** Derived from IssueReport.status (no separate priority column in DB). */
export interface SeverityFromStatus {
  /** NEED_INTERVENTION */
  critical: number;
  /** FAILED */
  high: number;
  /** PENDING */
  medium: number;
  /** SOLVED (throughput / closed) */
  low: number;
}

export interface MonthStatusSnapshot {
  pending: number;
  needIntervention: number;
  solved: number;
  failed: number;
  /** Active (non-SOLVED) reports created in the month */
  activeCreated: number;
}

export interface ReportingMetrics {
  generatedReportCount: number;
  lastReportDate: string;
  avgResolutionTime?: number;
  trends?: {
    monthly: number[];
    weekly: number[];
  };
  categories?: {
    infrastructure: number;
    safety: number;
    maintenance: number;
    academic: number;
    other: number;
  };
  statusCounts?: {
    pending: number;
    needIntervention: number;
    solved: number;
    failed: number;
  };
  /** Counts mapped from enum statuses for priority-style UI */
  severityFromStatus?: SeverityFromStatus;
  /** Current calendar month vs previous calendar month (created-in-month) */
  monthComparison?: {
    current: MonthStatusSnapshot;
    previous: MonthStatusSnapshot;
    /** % change in activeCreated: current vs previous full month */
    activeChangePct: number | null;
    /** % change in solved count created in month */
    solvedChangePct: number | null;
  };
  /** Flat counts (same meaning as severityFromStatus) for older UI */
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}
export interface ReportingDashboardDto {
  timestamp: string;
  data: {
    decisionAssessment: DecisionAssessmentSummary;
    analytics: AnalyticsMetrics;
    reports: ReportingMetrics;
  };
}
