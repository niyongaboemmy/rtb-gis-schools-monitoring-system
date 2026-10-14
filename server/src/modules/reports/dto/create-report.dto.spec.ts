import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReportDto, UpdateReportDto } from './create-report.dto';

const base = {
  schoolId: '7f3c9a10-0000-4000-8000-000000000001',
  facilityId: 'f',
  itemId: 'i',
  description: 'Broken window',
};

async function errorsFor(cls: any, body: Record<string, unknown>) {
  const errs = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errs.map((e) => e.property);
}

describe('report attachment validation', () => {
  it('accepts file-server report paths, including a single multipart string', async () => {
    expect(
      await errorsFor(CreateReportDto, {
        ...base,
        attachments: ['/files/reports/asset-1-abc.jpg'],
      }),
    ).toEqual([]);
    expect(
      await errorsFor(CreateReportDto, {
        ...base,
        attachments: '/files/reports/report-1.png',
      }),
    ).toEqual([]);
  });

  it.each([
    'javascript:alert(1)',
    'https://evil.example/x.png',
    '/files/reports/../../etc/passwd',
    '/files/reports/..',
    '/files/kmz/x.kmz',
    '//evil.example/x.png',
  ])('rejects %s', async (bad) => {
    expect(
      await errorsFor(CreateReportDto, { ...base, attachments: [bad] }),
    ).toContain('attachments');
  });

  it('validates updates too and forbids changing school or status there', async () => {
    expect(
      await errorsFor(UpdateReportDto, { attachments: ['javascript:x'] }),
    ).toContain('attachments');
    expect(
      await errorsFor(UpdateReportDto, { schoolId: base.schoolId }),
    ).toContain('schoolId');
    expect(
      await errorsFor(UpdateReportDto, {
        description: 'x',
        issueCategory: ['a'],
      }),
    ).toEqual([]);
  });
});
