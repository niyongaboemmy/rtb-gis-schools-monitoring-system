import {
  ReportStatus,
  ReportType,
} from '../reports/entities/issue-report.entity';
import {
  averageResolutionDays,
  kigaliMonthKey,
  lastKigaliMonths,
  pctChange,
  OverviewReportRow,
  reportingOverview,
  reportTrends,
  summariseIssueReports,
} from './report-stats';

const r = (
  id: string,
  status: ReportStatus,
  createdAt: string,
  extra: Record<string, unknown> = {},
) => ({ id, status, createdAt: new Date(createdAt), ...extra });

describe('Kigali calendar', () => {
  it('buckets by Africa/Kigali (UTC+2), not the server zone', () => {
    // 23:30 UTC on 31 Oct is already 01:30 on 1 Nov in Kigali.
    expect(kigaliMonthKey('2026-10-31T23:30:00Z')).toBe('2026-11');
    expect(kigaliMonthKey('2026-10-31T21:59:00Z')).toBe('2026-10');
  });

  it('last 12 months end with the current Kigali month, oldest first, with labels', () => {
    const months = lastKigaliMonths(new Date('2026-01-15T12:00:00Z'), 12);
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe('2025-02');
    expect(months[11]).toEqual({ key: '2026-01', label: 'Jan 2026' });
  });

  it('% change is null (not +100 %) when last month had none', () => {
    expect(pctChange(7, 0)).toBeNull();
    expect(pctChange(3, 2)).toBe(50);
  });
});

describe('summariseIssueReports', () => {
  const now = new Date('2026-10-21T10:00:00Z');
  it('excludes data change requests from every count', () => {
    const s = summariseIssueReports(
      [
        r('a', ReportStatus.PENDING, '2026-10-01T00:00:00Z'),
        r('b', ReportStatus.PENDING, '2026-10-01T00:00:00Z', {
          type: ReportType.DATA_CHANGE_REQUEST,
        }),
      ],
      now,
    );
    expect(s.total).toBe(1);
    expect(s.pending).toBe(1);
  });

  it('avg resolution: SOLVED only, negative durations dropped, null when none', () => {
    expect(
      averageResolutionDays([
        r('a', ReportStatus.SOLVED, '2026-10-01T00:00:00Z', {
          resolvedAt: new Date('2026-10-03T00:00:00Z'),
        }),
        // reopened report that kept an old date (pre-fix data)
        r('b', ReportStatus.PENDING, '2026-10-01T00:00:00Z', {
          resolvedAt: new Date('2026-10-30T00:00:00Z'),
        }),
        // resolution before creation: bad data
        r('c', ReportStatus.SOLVED, '2026-10-05T00:00:00Z', {
          resolvedAt: new Date('2026-10-01T00:00:00Z'),
        }),
      ]),
    ).toBe(2);
    expect(averageResolutionDays([])).toBeNull();
  });

  it('oldest open report age in days', () => {
    const s = summariseIssueReports(
      [
        r('a', ReportStatus.PENDING, '2026-09-21T10:00:00Z'),
        r('b', ReportStatus.SOLVED, '2026-01-01T00:00:00Z'),
      ],
      now,
    );
    expect(s.oldestOpenDays).toBe(30);
  });

  it('recentCritical: newest Needs Intervention first, max 5', () => {
    const rows = [1, 2, 3, 4, 5, 6].map((i) =>
      r(`n${i}`, ReportStatus.NEED_INTERVENTION, `2026-10-0${i}T00:00:00Z`),
    );
    const s = summariseIssueReports(rows, now);
    expect(s.recentCritical.map((x) => x.id)).toEqual([
      'n6',
      'n5',
      'n4',
      'n3',
      'n2',
    ]);
  });
});

describe('reportTrends', () => {
  const now = new Date('2026-10-21T10:00:00Z');
  it('counts filed and resolved per Kigali month and compares this vs last month', () => {
    const t = reportTrends(
      [
        r('a', ReportStatus.SOLVED, '2026-09-10T00:00:00Z', {
          resolvedAt: new Date('2026-10-02T00:00:00Z'),
          issueCategory: ['Safety', 'maintenance'],
        }),
        r('b', ReportStatus.PENDING, '2026-10-05T00:00:00Z', {
          issueCategory: ['safety'],
        }),
        r('c', ReportStatus.PENDING, '2026-10-06T00:00:00Z'),
        r('d', ReportStatus.PENDING, '2026-10-06T00:00:00Z', {
          type: ReportType.DATA_CHANGE_REQUEST,
        }),
      ],
      now,
    );
    const oct = t.months.find((m) => m.key === '2026-10')!;
    const sep = t.months.find((m) => m.key === '2026-09')!;
    expect(oct).toMatchObject({ created: 2, resolved: 1 });
    expect(sep).toMatchObject({ created: 1, resolved: 0 });
    expect(t.comparison.createdChangePct).toBe(100); // 2 vs 1
    expect(t.comparison.resolvedChangePct).toBeNull(); // 1 vs 0
    // tags are normalised and a report counts once per tag
    expect(t.categoryTags).toEqual({ safety: 2, maintenance: 1 });
    expect(t.statusCounts).toEqual({
      pending: 2,
      needIntervention: 0,
      solved: 1,
      failed: 0,
    });
  });
});

describe('reportingOverview (all schools in scope)', () => {
  const now = new Date('2026-10-22T10:00:00Z');
  const schools = [
    { id: 'a', name: 'Alpha TSS', district: 'Gasabo', province: 'Kigali City' },
    { id: 'b', name: 'Bravo VTC', district: 'Huye', province: 'Southern' },
    { id: 'c', name: 'Charlie TSS' },
  ];
  const rows: OverviewReportRow[] = [
    r('1', ReportStatus.NEED_INTERVENTION, '2026-10-20T08:00:00Z', {
      schoolId: 'b',
      description: 'Roof leak',
    }),
    r('2', ReportStatus.SOLVED, '2026-10-01T08:00:00Z', {
      schoolId: 'a',
      resolvedAt: new Date('2026-10-05T08:00:00Z'),
    }),
    r('3', ReportStatus.PENDING, '2026-10-10T08:00:00Z', { schoolId: 'a' }),
    r('4', ReportStatus.FAILED, '2026-10-15T08:00:00Z', { schoolId: 'a' }),
    // previous 30-day window
    r('5', ReportStatus.PENDING, '2026-09-10T08:00:00Z', { schoolId: 'a' }),
    // change requests are not issues
    r('6', ReportStatus.PENDING, '2026-10-12T08:00:00Z', {
      schoolId: 'c',
      type: ReportType.DATA_CHANGE_REQUEST,
    }),
  ] as OverviewReportRow[];

  it('uses the school-view rules: issues only, resolved ÷ all, failed counts as open', () => {
    const o = reportingOverview(rows, schools, '30d', now);
    expect(o.summary.total).toBe(4);
    expect(o.summary.resolutionRate).toBe(25);
    expect(o.summary.active).toBe(3);
    expect(o.schoolsAffected).toBe(2);
    expect(o.schoolCount).toBe(3);
    expect(o.previous).toEqual({ total: 1, resolved: 0, resolutionRate: 0 });
    expect(o.totalChangePct).toBe(300);
  });

  it('ranks schools by urgency and lists urgent reports with the school name', () => {
    const o = reportingOverview(rows, schools, '30d', now);
    expect(o.schools.map((s) => s.name)).toEqual(['Bravo VTC', 'Alpha TSS']);
    expect(o.schools[1]).toMatchObject({
      total: 3,
      open: 2,
      resolved: 1,
      resolutionRate: 33,
    });
    expect(o.urgent).toEqual([
      expect.objectContaining({
        id: '1',
        schoolName: 'Bravo VTC',
        description: 'Roof leak',
      }),
    ]);
  });

  it('buckets the trend by Kigali day / week / month', () => {
    const d = reportingOverview(rows, schools, '30d', now);
    expect(d.bucket).toBe('day');
    expect(d.trend).toHaveLength(30);
    expect(d.trend.reduce((a, b) => a + b.created, 0)).toBe(4);
    expect(d.trend.reduce((a, b) => a + b.resolved, 0)).toBe(1);
    expect(reportingOverview(rows, schools, '90d', now).trend).toHaveLength(13);
    const m = reportingOverview(rows, schools, '12m', now);
    expect(m.bucket).toBe('month');
    expect(m.trend.at(-1)).toMatchObject({
      key: '2026-10',
      created: 4,
      resolved: 1,
    });
    expect(reportingOverview(rows, schools, 'all', now).previous).toBeNull();
  });
});
