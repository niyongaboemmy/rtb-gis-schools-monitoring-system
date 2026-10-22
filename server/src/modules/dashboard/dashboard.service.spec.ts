import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import {
  ReportStatus,
  ReportType,
} from '../reports/entities/issue-report.entity';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

describe('DashboardService.reportingPayload', () => {
  const make = (rows: unknown[] | Error, buildings: unknown[] = []) => {
    const analytics = {
      getSchoolReportingInputs: jest.fn(() =>
        rows instanceof Error
          ? Promise.reject(rows)
          : Promise.resolve({ rows, buildings }),
      ),
      calculateSchoolScore: jest.fn(),
      getSchoolMetrics: jest.fn(),
    };
    return {
      service: new DashboardService(analytics as unknown as AnalyticsService),
      analytics,
    };
  };

  it('is read-only: never scores or recalculates', async () => {
    const { service, analytics } = make([]);
    await service.reportingPayload('s');
    expect(analytics.calculateSchoolScore).not.toHaveBeenCalled();
    expect(analytics.getSchoolMetrics).not.toHaveBeenCalled();
  });

  it('returns the real monthly series (not a zero-filled placeholder)', async () => {
    const { service } = make([
      { id: 'a', status: ReportStatus.PENDING, createdAt: daysAgo(0) },
      {
        id: 'b',
        status: ReportStatus.SOLVED,
        createdAt: daysAgo(0),
        resolvedAt: daysAgo(0),
      },
    ]);
    const res = await service.reportingPayload('s');
    const months = res.data.reports.months;
    expect(months).toHaveLength(12);
    expect(months[11].created).toBe(2);
    expect(res.data.reports.summary.total).toBe(2);
    expect(res.data.reports.summary.resolutionRate).toBe(50);
    expect(res.data).not.toHaveProperty('analytics');
  });

  it('summary and status counts agree and exclude change requests', async () => {
    const { service } = make([
      { id: 'a', status: ReportStatus.PENDING, createdAt: daysAgo(3) },
      {
        id: 'b',
        status: ReportStatus.PENDING,
        createdAt: daysAgo(3),
        type: ReportType.DATA_CHANGE_REQUEST,
      },
    ]);
    const { reports } = (await service.reportingPayload('s')).data;
    expect(reports.summary.total).toBe(1);
    expect(Object.values(reports.statusCounts).reduce((a, b) => a + b, 0)).toBe(
      reports.summary.total,
    );
  });

  it('avg resolution is null — not "0.0 days" — when nothing was resolved', async () => {
    const { service } = make([
      { id: 'a', status: ReportStatus.PENDING, createdAt: daysAgo(3) },
    ]);
    const { reports } = (await service.reportingPayload('s')).data;
    expect(reports.summary.avgResolutionDays).toBeNull();
    expect(reports.lastReportDate).not.toBeNull();
  });

  it('buildings needing attention: open reports only, then assessed poor/critical', async () => {
    const { service } = make(
      [
        {
          id: 'a',
          status: ReportStatus.SOLVED,
          createdAt: daysAgo(3),
          buildingId: 'b1',
        },
        {
          id: 'b',
          status: ReportStatus.NEED_INTERVENTION,
          createdAt: daysAgo(2),
          buildingId: 'b2',
          reporter: { firstName: 'Ada', lastName: 'K' },
        },
        {
          id: 'c',
          status: ReportStatus.PENDING,
          createdAt: daysAgo(1),
          buildingId: 'b3',
          type: ReportType.DATA_CHANGE_REQUEST,
        },
      ],
      [
        { id: 'b1', name: 'Solved only', condition: 'good' },
        { id: 'b2', name: 'Open issue', condition: null },
        { id: 'b3', name: 'Change request only', condition: null },
        { id: 'b4', name: 'Poor block', condition: 'poor' },
      ],
    );
    const list = (await service.reportingPayload('s')).data.reports
      .buildingsAttention;
    expect(list.map((r) => r.name)).toEqual(['Open issue', 'Poor block']);
    expect(list[0]).toMatchObject({
      severity: 'critical',
      intervention: 1,
      lastReporter: 'Ada K',
    });
  });

  it('propagates errors instead of rendering "0 reports"', async () => {
    const { service } = make(new NotFoundException('nope'));
    await expect(service.reportingPayload('s')).rejects.toThrow('nope');
  });
});
