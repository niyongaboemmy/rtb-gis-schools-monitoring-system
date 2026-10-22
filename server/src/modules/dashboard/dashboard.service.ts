import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  buildingsNeedingAttention,
  issueReportsOnly,
  reportingOverview,
  ReportingOverview,
  ReportingPeriod,
  reportTrends,
  summariseIssueReports,
} from '../analytics/report-stats';
import type { AccessScope } from '../../common/scope/access-scope';
import { ReportingDashboardDto } from './dto/reporting-dashboard.dto';

/**
 * School dashboard — Issue Reports tab. Read-only: it never recalculates or
 * persists a score (the score lives on /analytics/schools/:id/metrics).
 */
@Injectable()
export class DashboardService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async reportingPayload(schoolId: string): Promise<ReportingDashboardDto> {
    const { rows, buildings } =
      await this.analyticsService.getSchoolReportingInputs(schoolId);
    const now = new Date();
    const trends = reportTrends(rows, now);
    const issues = issueReportsOnly(rows);
    const latest = issues.reduce<number | null>((max, r) => {
      const t = new Date(r.createdAt).getTime();
      return Number.isFinite(t) && (max === null || t > max) ? t : max;
    }, null);

    return {
      timestamp: now.toISOString(),
      data: {
        reports: {
          summary: summariseIssueReports(rows, now),
          months: trends.months,
          comparison: trends.comparison,
          categoryTags: trends.categoryTags,
          statusCounts: trends.statusCounts,
          lastReportDate:
            latest === null ? null : new Date(latest).toISOString(),
          buildingsAttention: buildingsNeedingAttention(
            rows,
            buildings.map((b) => ({
              id: b.id,
              name: b.name,
              yearBuilt: b.yearBuilt,
              condition: b.condition,
            })),
            3,
          ),
        },
      },
    };
  }

  /**
   * Reporting overview — Issue Reports across every active school in the
   * caller's scope for one period. Same rules as the school view.
   */
  async reportingOverview(
    period: ReportingPeriod,
    scope?: AccessScope,
  ): Promise<{ timestamp: string; data: ReportingOverview }> {
    const { schools, rows } =
      await this.analyticsService.getScopedReportingInputs(scope);
    const now = new Date();
    return {
      timestamp: now.toISOString(),
      data: reportingOverview(rows, schools, period, now),
    };
  }
}
