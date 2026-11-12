import { ConflictException } from '@nestjs/common';
import { TdmpSyncService, kigaliTimeToday } from './tdmp-sync.service';
import fixtures from './__fixtures__';
import type { TdmpSchool } from './tdmp.types';
import {
  SchoolStatus,
  SchoolType,
  type School,
} from '../schools/entities/school.entity';
import type { TdmpSyncRun } from './entities/tdmp-sync-run.entity';
import type { TdmpBand } from './tdmp-school.mapper';

// ── An in-memory `schools` repository that understands the TypeORM
// operators the service uses (Not, In, IsNull) ─────────────────────────────
type Op = { _type: string; _value?: unknown };
const isOp = (v: unknown): v is Op =>
  !!v && typeof v === 'object' && '_type' in v;

function matches(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = row[k] ?? null;
    if (!isOp(cond)) return v === cond;
    if (cond._type === 'isNull') return v === null;
    if (cond._type === 'in') return (cond._value as unknown[]).includes(v);
    if (cond._type === 'not') {
      const inner = cond._value;
      return isOp(inner) ? !matches(row, { [k]: inner }) : v !== inner;
    }
    throw new Error(`operator ${cond._type} not faked`);
  });
}

function schoolRepo(seed: Partial<School>[] = []) {
  const rows: School[] = seed.map(
    (s, i) => ({ id: `s${i + 1}`, ...s }) as School,
  );
  let next = rows.length + 1;
  const find = (where?: unknown) => {
    const list = Array.isArray(where) ? where : where ? [where] : [{}];
    return rows.filter((r) =>
      list.some((w) => matches(r as never, w as never)),
    );
  };
  return {
    rows,
    find: jest.fn(async (opts?: { where?: unknown }) => find(opts?.where)),
    findOne: jest.fn(
      async (opts: { where: unknown }) => find(opts.where)[0] ?? null,
    ),
    findOneOrFail: jest.fn(
      async (opts: { where: unknown }) => find(opts.where)[0],
    ),
    count: jest.fn(async (opts: { where: unknown }) => find(opts.where).length),
    create: jest.fn((v: Partial<School>) => ({ ...v }) as School),
    save: jest.fn(async (v: School) => {
      if (!v.id) {
        v.id = `s${next++}`;
        rows.push(v);
      }
      return v;
    }),
    update: jest.fn(async (id: string, patch: Partial<School>) => {
      Object.assign(rows.find((r) => r.id === id) ?? {}, patch);
    }),
    remove: jest.fn(),
  };
}

function runRepo() {
  const rows: TdmpSyncRun[] = [];
  return {
    rows,
    create: jest.fn((v: Partial<TdmpSyncRun>) => ({ ...v }) as TdmpSyncRun),
    save: jest.fn(async (v: TdmpSyncRun) => {
      if (!v.id) {
        v.id = `run${rows.length + 1}`;
        v.startedAt = new Date();
        rows.push(v);
      }
      return v;
    }),
    update: jest.fn(),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => rows),
    count: jest.fn(async () => 0),
    createQueryBuilder: jest.fn(() => ({
      where: () => ({ getCount: async () => 0 }),
    })),
  };
}

const live = (
  k: keyof typeof fixtures.list,
  over: Partial<TdmpSchool> = {},
): TdmpSchool => ({
  ...fixtures.list[k],
  ...over,
});

/** TDMP as the sync sees it. */
function fakeSource(opts: {
  rows: TdmpSchool[];
  bands?: Record<string, TdmpBand>;
  details?: Record<string, TdmpSchool | null>;
  materialisedAt?: string;
}) {
  return {
    probe: jest.fn(async () => ({
      lastMaterialisedAt: opts.materialisedAt ?? '2026-11-12T06:00:34+02:00',
    })),
    sweep: jest.fn(async () => ({
      rows: opts.rows,
      meta: {
        lastMaterialisedAt: opts.materialisedAt ?? '2026-11-12T06:00:34+02:00',
      },
    })),
    bands: jest.fn(async () => new Map(Object.entries(opts.bands ?? {}))),
    school: jest.fn(async (code: string) =>
      code in (opts.details ?? {})
        ? opts.details![code]
        : (opts.rows.find((r) => r.schoolCode === code) ?? null),
    ),
  };
}

const lockRunner = () => ({
  connect: jest.fn(),
  query: jest.fn(async (sql: string) =>
    sql.includes('try_advisory') ? [{ locked: true }] : [],
  ),
  release: jest.fn(),
});

function setup(opts: {
  seed?: Partial<School>[];
  source: ReturnType<typeof fakeSource>;
  config?: Record<string, unknown>;
  lock?: ReturnType<typeof lockRunner>;
}) {
  const schools = schoolRepo(opts.seed);
  const runs = runRepo();
  const settings = {
    findOne: jest.fn(async () => null),
    create: jest.fn((v: object) => ({
      autoSync: true,
      probeIntervalMinutes: 60,
      dailyRunAt: '07:15',
      lastProbeAt: null,
      ...v,
    })),
    save: jest.fn(async (v: object) => v),
  };
  const events = { emit: jest.fn() };
  const audit = { record: jest.fn() };
  const lock = opts.lock ?? lockRunner();
  const dataSource = {
    createQueryRunner: () => lock,
    query: jest.fn(async () => []),
  };
  const config = {
    syncEnabled: true,
    ignoreSources: ['access_scope_test', 'manual_seed'],
    detailBudget: 60,
    detailMaxAgeMs: 7 * 86_400_000,
    syncConcurrency: 2,
    ...opts.config,
  };
  const service = new TdmpSyncService(
    schools as never,
    runs as never,
    settings as never,
    opts.source as never,
    config as never,
    events as never,
    dataSource as never,
    audit as never,
  );
  /** Starts a run and waits for it to finish. */
  const sync = async (dryRun = false) => {
    const run = await service.start('manual', 'admin@rtb.gov.rw', { dryRun });
    for (let i = 0; i < 200 && service.isRunning; i++)
      await new Promise((r) => setTimeout(r, 2));
    return run;
  };
  return { service, schools, runs, events, audit, lock, settings, sync };
}

const existing = (over: Partial<School> = {}): Partial<School> => ({
  code: '270501',
  name: 'ACEJ Karama TSS',
  type: SchoolType.TSS,
  status: SchoolStatus.ACTIVE,
  province: 'Southern Province',
  district: 'Muhanga',
  sector: 'Muhanga',
  latitude: -2.07,
  longitude: 29.72,
  tdmpSchoolCode: null,
  tdmpSchoolId: null,
  tdmpData: null,
  ...over,
});

describe('TdmpSyncService — a full run', () => {
  it('links by code, keeps GIS location, records a report and releases the lock', async () => {
    const source = fakeSource({
      rows: [live('tvetActive')],
      bands: { '270501': 'TSS' },
      details: { '270501': fixtures.detail270501 },
    });
    const { schools, sync, lock, events } = setup({
      seed: [existing()],
      source,
    });
    const run = await sync();

    expect(run.status).toBe('completed');
    expect(run.totals).toMatchObject({
      fetched: 1,
      linked: 1,
      failed: 0,
      details: 1,
    });
    const s = schools.rows[0];
    expect(s).toMatchObject({
      tdmpSchoolCode: '270501',
      tdmpSchoolId: 292,
      name: 'ACEJ KARAMA',
      establishedYear: 1984,
      districtId: 14,
      ownership: 'Gov Aided',
      totalStudents: 1136,
      latitude: -2.07, // RTB GIS location kept
      longitude: 29.72,
    });
    expect(s.tdmpData?.detailFetchedAt).toBeTruthy();
    expect(run.report?.newLinks[0]).toMatchObject({
      code: '270501',
      localName: 'ACEJ Karama TSS',
    });
    expect(run.report?.tdmpMaterialisedAt).toBe('2026-11-12T06:00:34+02:00');
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: 's1',
    });
    expect(lock.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1)',
      expect.any(Array),
    );
    expect(lock.release).toHaveBeenCalled();
  });

  it('writes nothing on the second run when TDMP did not change (hash)', async () => {
    const source = fakeSource({
      rows: [live('tvetActive')],
      bands: { '270501': 'TSS' },
      details: { '270501': fixtures.detail270501 },
    });
    const { schools, sync, events } = setup({ seed: [existing()], source });
    await sync();
    schools.save.mockClear();
    events.emit.mockClear();
    source.school.mockClear();

    const second = await sync();
    expect(second.totals).toMatchObject({
      unchanged: 1,
      updated: 0,
      details: 0,
    });
    expect(schools.save).not.toHaveBeenCalled();
    expect(schools.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalledWith(
      'school.updated',
      expect.anything(),
    );
    expect(source.school).not.toHaveBeenCalled();
  });

  it('a name change updates the school without a rescore; a learner change rescored', async () => {
    const rows = [live('tvetActive')];
    const source = fakeSource({
      rows,
      bands: { '270501': 'TSS' },
      details: { '270501': fixtures.detail270501 },
    });
    const { sync, events } = setup({ seed: [existing()], source });
    await sync();

    events.emit.mockClear();
    rows[0] = live('tvetActive', { schoolName: 'ACEJ KARAMA TVET' });
    const renamed = await sync();
    expect(renamed.totals.updated).toBe(1);
    expect(renamed.report?.changes[0].fields).toEqual(['name']);
    expect(events.emit).not.toHaveBeenCalledWith(
      'school.updated',
      expect.anything(),
    );

    rows[0] = live('tvetActive', {
      schoolName: 'ACEJ KARAMA TVET',
      counts: { students: 1200, teachers: 33 },
    });
    await sync();
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: 's1',
    });
  });

  it('dry run reports what would change and writes nothing', async () => {
    const source = fakeSource({
      rows: [live('tvetActive'), live('tvetPrivate'), live('testSource')],
      bands: { '270501': 'TSS', '270601': 'VTC' },
      details: {
        '270501': fixtures.detail270501,
        '270601': { ...live('tvetPrivate'), gpsLat: null, gpsLong: null },
      },
    });
    const { schools, sync } = setup({
      seed: [
        existing(),
        existing({
          code: 'TSS-SOU-001',
          name: 'Mushishiro VTC',
          district: 'Muhanga',
        }),
      ],
      source,
    });
    const run = await sync(true);

    expect(run.dryRun).toBe(true);
    expect(schools.save).not.toHaveBeenCalled();
    expect(schools.update).not.toHaveBeenCalled();
    expect(run.totals).toMatchObject({
      linked: 1,
      skippedNoGps: 1,
      skipped: 1,
    });
    expect(run.report?.needsLocation.map((s) => s.code)).toEqual(['270601']);
    expect(run.report?.skipped[0]).toMatchObject({ code: 'SCOPE-DIST-GASABO' });
    expect(run.report?.gisOnly.map((s) => s.code)).toEqual(['TSS-SOU-001']);
  });

  it('suggests a TDMP code for a GIS-only school with a similar name', async () => {
    const source = fakeSource({
      rows: [live('tvetPrivate')],
      details: {
        '270601': { ...live('tvetPrivate'), gpsLat: null, gpsLong: null },
      },
    });
    const { sync } = setup({
      seed: [
        existing({
          code: 'TSS-SOU-002',
          name: 'ACODES Mushishiro',
          district: 'Muhanga',
        }),
      ],
      source,
    });
    const run = await sync(true);
    expect(run.report?.gisOnly[0].reason).toBe(
      'suggest:270601|ACODES MUSHISHIRO',
    );
  });

  it('creates a TDMP-only school at TDMP GPS, marked as such', async () => {
    const source = fakeSource({
      rows: [live('tvetActive')],
      bands: { '270501': 'VTC' },
      details: { '270501': fixtures.detail270501 },
    });
    const { schools, sync } = setup({ source });
    const run = await sync();
    expect(run.totals.created).toBe(1);
    expect(schools.rows[0]).toMatchObject({
      type: SchoolType.VTC,
      locationSource: 'tdmp',
      latitude: -2.071518,
      longitude: 29.726629,
    });
  });
});

describe('TdmpSyncService — schools missing from TDMP (F11)', () => {
  const linked = (code: string, over: Partial<School> = {}) =>
    existing({
      code,
      name: `School ${code}`,
      tdmpSchoolCode: code,
      tdmpSchoolId: Number(code),
      tdmpData: {},
      ...over,
    });
  // Enough linked schools that one missing stays under the 20% guard.
  const others = ['1', '2', '3', '4', '5', '6'].map((n) => linked(`10000${n}`));
  const listed = others.map((o) =>
    live('tvetActive', { schoolCode: o.code!, id: Number(o.code) }),
  );

  it('flags a school still in TDMP but out of the TVET list, without deactivating it', async () => {
    const source = fakeSource({
      rows: listed,
      details: {
        '270501': live('tvetActive', { schoolCategory: 'unfetched' }),
      },
    });
    const { schools, sync } = setup({
      seed: [...others, linked('270501')],
      source,
    });
    const run = await sync();
    const s = schools.rows.find((r) => r.code === '270501')!;
    expect(s.status).toBe(SchoolStatus.ACTIVE);
    expect(s.tdmpData).toMatchObject({ missingFromTdmp: true, missingRuns: 0 });
    expect(run.totals).toMatchObject({ missing: 1, deactivated: 0 });
  });

  it('deactivates only after TDMP answers 404 on two runs in a row', async () => {
    const source = fakeSource({ rows: listed, details: { '270501': null } });
    const { schools, sync, events } = setup({
      seed: [...others, linked('270501')],
      source,
    });
    const s = () => schools.rows.find((r) => r.code === '270501')!;

    await sync();
    expect(s().status).toBe(SchoolStatus.ACTIVE);
    expect(s().tdmpData?.missingRuns).toBe(1);

    const second = await sync();
    expect(s().status).toBe(SchoolStatus.INACTIVE);
    expect(second.totals.deactivated).toBe(1);
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: s().id,
    });
  });

  it('deactivates at once when TDMP says INACTIVE', async () => {
    const source = fakeSource({
      rows: listed,
      details: { '270501': live('inactive', { schoolCode: '270501' }) },
    });
    const { schools, sync } = setup({
      seed: [...others, linked('270501')],
      source,
    });
    await sync();
    expect(schools.rows.find((r) => r.code === '270501')!.status).toBe(
      SchoolStatus.INACTIVE,
    );
  });

  it('leaves everything alone when too many schools vanish at once', async () => {
    const source = fakeSource({ rows: [], details: {} });
    const { schools, sync } = setup({
      seed: [...others, linked('270501')],
      source,
    });
    const run = await sync();
    expect(schools.rows.every((r) => r.status === SchoolStatus.ACTIVE)).toBe(
      true,
    );
    expect(run.errors.join(' ')).toMatch(/left as they are/);
    expect(source.school).not.toHaveBeenCalled();
  });
});

describe('TdmpSyncService — locking and scheduling', () => {
  it('refuses to start when another process holds the lock', async () => {
    const lock = lockRunner();
    lock.query.mockResolvedValueOnce([{ locked: false }]);
    const { service } = setup({ source: fakeSource({ rows: [] }), lock });
    await expect(service.start('manual', null)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(lock.release).toHaveBeenCalled();
    expect(service.isRunning).toBe(false);
  });

  it('a failed run still releases the lock and records the error', async () => {
    const source = fakeSource({ rows: [] });
    source.sweep.mockRejectedValueOnce(new Error('TDMP /schools answered 500'));
    const { sync, lock, audit } = setup({ source });
    const run = await sync();
    expect(run.status).toBe('failed');
    expect(run.errors).toContain('TDMP /schools answered 500');
    expect(lock.release).toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled(); // manual runs are audited by the route
  });

  it('kigaliTimeToday turns HH:mm Kigali into the right instant', () => {
    const now = new Date('2026-11-12T03:00:00Z'); // 05:00 in Kigali
    expect(kigaliTimeToday(now, '07:15').toISOString()).toBe(
      '2026-11-12T05:15:00.000Z',
    );
    // 23:30 UTC is already the next day in Kigali
    expect(
      kigaliTimeToday(new Date('2026-11-12T23:30:00Z'), '07:15').toISOString(),
    ).toBe('2026-11-13T05:15:00.000Z');
  });

  it('tick: runs the daily sync once the time has passed', async () => {
    const { service, settings } = setup({ source: fakeSource({ rows: [] }) });
    settings.findOne.mockResolvedValue({
      autoSync: true,
      probeIntervalMinutes: 60,
      dailyRunAt: '07:15',
      lastProbeAt: new Date(),
    } as never);
    expect(await service.tick(new Date('2026-11-12T05:20:00Z'))).toBe(
      'schedule',
    );
  });

  it('tick: probe starts a run only when TDMP re-materialised', async () => {
    const source = fakeSource({
      rows: [],
      materialisedAt: '2026-11-12T06:00:34+02:00',
    });
    const { service, settings, runs } = setup({ source });
    settings.findOne.mockResolvedValue({
      autoSync: true,
      probeIntervalMinutes: 60,
      dailyRunAt: '23:59',
      lastProbeAt: null,
    } as never);
    runs.findOne.mockResolvedValue({
      report: { tdmpMaterialisedAt: '2026-11-11T06:00:10+02:00' },
    } as never);
    expect(await service.tick(new Date('2026-11-12T08:00:00Z'))).toBe('probe');
  });

  it('tick: nothing when TDMP data is what we last synced', async () => {
    const source = fakeSource({
      rows: [],
      materialisedAt: '2026-11-12T06:00:34+02:00',
    });
    const { service, settings, runs } = setup({ source });
    settings.findOne.mockResolvedValue({
      autoSync: true,
      probeIntervalMinutes: 60,
      dailyRunAt: '23:59',
      lastProbeAt: null,
    } as never);
    runs.findOne.mockResolvedValue({
      report: { tdmpMaterialisedAt: '2026-11-12T06:00:34+02:00' },
    } as never);
    expect(await service.tick(new Date('2026-11-12T08:00:00Z'))).toBeNull();
  });

  it('tick: does nothing when automatic sync is paused', async () => {
    const source = fakeSource({ rows: [] });
    const { service, settings } = setup({ source });
    settings.findOne.mockResolvedValue({ autoSync: false } as never);
    expect(await service.tick()).toBeNull();
    expect(source.probe).not.toHaveBeenCalled();
  });

  it('tick: waits for the probe interval', async () => {
    const source = fakeSource({ rows: [] });
    const { service, settings } = setup({ source });
    const now = new Date('2026-11-12T08:00:00Z');
    settings.findOne.mockResolvedValue({
      autoSync: true,
      probeIntervalMinutes: 60,
      dailyRunAt: '23:59',
      lastProbeAt: new Date(now.getTime() - 10 * 60_000),
    } as never);
    expect(await service.tick(now)).toBeNull();
    expect(source.probe).not.toHaveBeenCalled();
  });

  it('settings: rejects an interval or time outside the allowed values', async () => {
    const { service } = setup({ source: fakeSource({ rows: [] }) });
    await expect(
      service.updateSettings({ probeIntervalMinutes: 7 }, null),
    ).rejects.toThrow(/probeIntervalMinutes/);
    await expect(
      service.updateSettings({ dailyRunAt: '25:00' }, null),
    ).rejects.toThrow(/HH:mm/);
    await expect(
      service.updateSettings(
        { autoSync: false, dailyRunAt: '06:30', probeIntervalMinutes: 30 },
        'a@b',
      ),
    ).resolves.toMatchObject({
      autoSync: false,
      dailyRunAt: '06:30',
      probeIntervalMinutes: 30,
      updatedBy: 'a@b',
    });
  });
});

describe('TdmpSyncService.importWithLocation', () => {
  const noGps = { ...live('tvetPrivate'), gpsLat: null, gpsLong: null };

  it('adds a TDMP school without GPS at the given point, linked and manual', async () => {
    const source = fakeSource({ rows: [noGps], bands: { '270601': 'VTC' } });
    const { service, schools, events } = setup({ source });
    const school = await service.importWithLocation('270601', -2.05, 29.75);
    expect(school).toMatchObject({
      tdmpSchoolCode: '270601',
      name: 'ACODES MUSHISHIRO',
      type: SchoolType.VTC,
      latitude: -2.05,
      longitude: 29.75,
      locationSource: 'manual',
    });
    expect(schools.rows).toHaveLength(1);
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: school.id,
    });
  });

  it('refuses a point outside Rwanda or with swapped coordinates', async () => {
    const { service } = setup({ source: fakeSource({ rows: [noGps] }) });
    await expect(
      service.importWithLocation('270601', 48.8, 2.35),
    ).rejects.toThrow(/outside Rwanda/);
    await expect(
      service.importWithLocation('270601', 29.75, -2.05),
    ).rejects.toThrow(/swapped/);
  });

  it('refuses a school that is already in RTB GIS', async () => {
    const { service } = setup({
      seed: [existing({ code: '270601', tdmpSchoolCode: '270601' })],
      source: fakeSource({ rows: [noGps] }),
    });
    await expect(
      service.importWithLocation('270601', -2.05, 29.75),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
