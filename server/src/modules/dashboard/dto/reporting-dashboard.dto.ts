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
export interface ReportingMetrics {
  generatedReportCount: number;
  lastReportDate: string;
}
export interface ReportingDashboardDto {
  timestamp: string;
  data: {
    decisionAssessment: DecisionAssessmentSummary;
    analytics: AnalyticsMetrics;
    reports: ReportingMetrics;
  };
}
