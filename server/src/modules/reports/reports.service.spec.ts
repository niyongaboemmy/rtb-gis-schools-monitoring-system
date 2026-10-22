import { ForbiddenException } from '@nestjs/common';
import { ReportsService, applyStatus } from './reports.service';
import {
  IssueReport,
  ReportStatus,
  ReportType,
} from './entities/issue-report.entity';

function makeService(existing?: Partial<IssueReport>) {
  const saved: Partial<IssueReport>[] = [];
  const repo = {
    create: jest.fn((d: Partial<IssueReport>) => ({ ...d })),
    save: jest.fn((r: Partial<IssueReport>) => {
      saved.push(r);
      return Promise.resolve({ id: 'rep-1', ...r });
    }),
    findOne: jest.fn(() =>
      Promise.resolve(
        existing ? { id: 'rep-1', school: {}, ...existing } : null,
      ),
    ),
    manager: {
      findOne: jest.fn(() =>
        Promise.resolve({
          id: 's2',
          province: 'P',
          district: 'Other',
          sector: 'X',
        }),
      ),
      createQueryBuilder: jest.fn(),
    },
  };
  const gateway = { emitReportStatusChanged: jest.fn() };
  const events = { emit: jest.fn() };
  const service = new ReportsService(
    repo as never,
    {} as never,
    gateway as never,
    events as never,
  );
  return { service, repo, saved, gateway, events };
}

const analyst = {
  role: { name: 'gis_analyst', permissions: ['EDIT_SCHOOL_LOCATION'] },
};
const manager = { role: { name: 'admin', permissions: ['MANAGE_REPORTS'] } };

describe('ReportsService (WS7.7)', () => {
  it('files a change request as a data_change_request routed to gis_analyst', async () => {
    const { service, saved } = makeService();
    await service.createChangeRequest(
      's1',
      {
        fields: [
          { field: 'latitude', currentValue: -1.9, proposedValue: -1.95 },
        ],
        reason: 'Pin is on the wrong plot',
      },
      'u1',
    );
    expect(saved[0]).toMatchObject({
      schoolId: 's1',
      type: ReportType.DATA_CHANGE_REQUEST,
      assignedRole: 'gis_analyst',
      status: ReportStatus.PENDING,
      reportedBy: 'u1',
      itemId: 'latitude',
    });
    expect(saved[0].description).toContain('latitude: -1.9 → -1.95');
  });

  it('lets a GIS analyst resolve a change request but not an issue report', async () => {
    const cr = makeService({
      type: ReportType.DATA_CHANGE_REQUEST,
      reportedBy: 'u1',
    });
    await expect(
      cr.service.updateStatus('rep-1', ReportStatus.SOLVED, undefined, analyst),
    ).resolves.toMatchObject({ status: ReportStatus.SOLVED });
    expect(cr.gateway.emitReportStatusChanged).toHaveBeenCalled();

    const issue = makeService({ type: ReportType.ISSUE });
    await expect(
      issue.service.updateStatus(
        'rep-1',
        ReportStatus.SOLVED,
        undefined,
        analyst,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      issue.service.updateStatus(
        'rep-1',
        ReportStatus.SOLVED,
        undefined,
        manager,
      ),
    ).resolves.toBeDefined();
  });

  it('refuses an issue report for a school outside the caller scope', async () => {
    const { service } = makeService();
    const scope = {
      rank: 50,
      slug: 'school' as const,
      levelName: 'School',
      schoolId: 's1',
      province: 'P',
      district: 'Home',
      sector: 'S',
      isNational: false,
      enforced: true,
    };
    await expect(
      service.create(
        { schoolId: 's2', facilityId: 'f', itemId: 'i', description: 'd' },
        'u1',
        scope,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('report status transitions (resolution date)', () => {
  it('entering SOLVED stamps resolvedAt; leaving SOLVED clears it', () => {
    const r: { status: ReportStatus; resolvedAt?: Date | null } = {
      status: ReportStatus.PENDING,
    };
    applyStatus(r, ReportStatus.SOLVED);
    expect(r.resolvedAt).toBeInstanceOf(Date);
    applyStatus(r, ReportStatus.PENDING); // reopened
    expect(r.resolvedAt).toBeNull();
  });

  it('a re-solve gets a fresh date; SOLVED → SOLVED keeps the original', () => {
    const first = new Date('2026-01-01T00:00:00Z');
    const r = { status: ReportStatus.SOLVED, resolvedAt: first };
    applyStatus(r, ReportStatus.SOLVED);
    expect(r.resolvedAt).toBe(first);
    applyStatus(r, ReportStatus.FAILED);
    applyStatus(r, ReportStatus.SOLVED);
    expect(r.resolvedAt).not.toBe(first);
  });

  it('a report created as SOLVED gets a resolution date and triggers a rescore', async () => {
    const { service, saved, events } = makeService();
    await service.create(
      { schoolId: 's1', status: ReportStatus.SOLVED } as never,
      'u1',
    );
    expect(saved[0].resolvedAt).toBeInstanceOf(Date);
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: 's1',
    });
  });

  it('a status change triggers a rescore of the school', async () => {
    const { service, events } = makeService({
      schoolId: 's1',
      status: ReportStatus.PENDING,
      type: ReportType.ISSUE,
    });
    await service.updateStatus(
      'rep-1',
      ReportStatus.SOLVED,
      undefined,
      manager,
    );
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: 's1',
    });
  });
});
