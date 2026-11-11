import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { School, SchoolStatus } from '../schools/entities/school.entity';
import { AuditService } from '../audit/audit.service';
import { TdmpConfig } from './tdmp.config';
import { TdmpSchoolSource } from './tdmp-school.source';
import { TdmpUnavailableError } from './tdmp-api.client';
import {
  changedFields,
  initialLocation,
  mapTdmpSchool,
  type TdmpSchoolBundle,
} from './tdmp-school.mapper';
import {
  emptyTotals,
  TdmpSyncRun,
  type TdmpSyncTotals,
} from './entities/tdmp-sync-run.entity';

export type SyncOutcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'linked'
  | 'skippedNoGps';

/** Errors kept on a run row. */
const MAX_RUN_ERRORS = 50;

/**
 * Never deactivate more than this share of linked schools in one run: a
 * sudden mass "missing" means a filter or TDMP problem, not real closures.
 */
const MAX_MISSING_SHARE = 0.2;

async function eachLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) await fn(items[next++]);
    },
  );
  await Promise.all(workers);
}

/**
 * Copies school information from TDMP into `schools`. TDMP-owned columns are
 * overwritten; GPS and everything GIS stay ours. Runs nightly and on demand.
 */
@Injectable()
export class TdmpSyncService {
  private readonly logger = new Logger(TdmpSyncService.name);
  private running: string | null = null;

  constructor(
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    @InjectRepository(TdmpSyncRun)
    private readonly runs: Repository<TdmpSyncRun>,
    private readonly source: TdmpSchoolSource,
    private readonly config: TdmpConfig,
    private readonly events: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  get isRunning(): boolean {
    return this.running !== null;
  }

  /** TDMP_API_KEY is set and the sync is not switched off. */
  get enabled(): boolean {
    return this.config.syncEnabled;
  }

  @Cron('0 1 * * *', { name: 'tdmp-school-sync', timeZone: 'Africa/Kigali' })
  async nightly(): Promise<void> {
    if (!this.config.syncEnabled || this.running) return;
    await this.start('schedule', null).catch((err) =>
      this.logger.error(`Nightly TDMP sync not started: ${err.message}`),
    );
  }

  /** Starts a full sync in the background and returns its run row. */
  async start(
    trigger: TdmpSyncRun['trigger'],
    triggeredBy: string | null,
  ): Promise<TdmpSyncRun> {
    this.assertEnabled();
    if (this.running)
      throw new ConflictException('A TDMP sync is already running.');
    const run = await this.runs.save(
      this.runs.create({
        trigger,
        status: 'running',
        totals: emptyTotals(),
        errors: [],
        triggeredBy,
        finishedAt: null,
      }),
    );
    this.running = run.id;
    void this.execute(run);
    return run;
  }

  async status() {
    const [lastRun, linkedSchools, unlinkedSchools] = await Promise.all([
      this.runs.findOne({ where: {}, order: { startedAt: 'DESC' } }),
      this.schools.count({ where: { tdmpSchoolCode: Not(IsNull()) } }),
      this.schools.count({ where: { tdmpSchoolCode: IsNull() } }),
    ]);
    return {
      enabled: {
        login: this.config.loginEnabled,
        sync: this.config.syncEnabled,
      },
      authMode: this.config.authMode,
      running: this.isRunning,
      lastRun,
      linkedSchools,
      unlinkedSchools,
    };
  }

  listRuns(limit = 10) {
    return this.runs.find({
      order: { startedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  /** Local schools not linked to TDMP yet, with whether they hold GIS work. */
  async unlinked() {
    const rows = await this.schools.find({
      where: { tdmpSchoolCode: IsNull() },
      select: ['id', 'code', 'name', 'district'],
      order: { name: 'ASC' },
    });
    const withGis = await this.schoolsWithGisData(rows.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      district: r.district,
      hasGisData: withGis.has(r.id),
    }));
  }

  /**
   * Links a local school to a TDMP school code and refreshes it from TDMP.
   * If the sync already created a separate row for that code and that row
   * holds no GIS work, it is removed so the local school takes its place.
   */
  async link(schoolId: string, schoolCode: string): Promise<School> {
    this.assertEnabled();
    const school = await this.schools.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const bundle = await this.fetch(schoolCode.trim());

    const other = await this.schools.findOne({
      where: [
        { tdmpSchoolCode: bundle.school.schoolCode, id: Not(schoolId) },
        { tdmpSchoolId: bundle.school.id, id: Not(schoolId) },
        { code: bundle.school.schoolCode, id: Not(schoolId) },
      ],
    });
    if (other) {
      const busy = await this.schoolsWithGisData([other.id]);
      if (busy.has(other.id))
        throw new ConflictException(
          `"${other.name}" is already linked to ${bundle.school.schoolCode} and has its own GIS data.`,
        );
      await this.schools.remove(other);
      this.events.emit('school.deleted', { schoolId: other.id });
    }

    school.tdmpSchoolCode = null;
    await this.apply(bundle, school);
    return this.schools.findOneOrFail({ where: { id: schoolId } });
  }

  /** Re-reads one linked school from TDMP. */
  async refresh(schoolId: string): Promise<School> {
    this.assertEnabled();
    const school = await this.schools.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (!school.tdmpSchoolCode)
      throw new ConflictException('This school is not linked to TDMP.');
    await this.apply(await this.fetch(school.tdmpSchoolCode), school);
    return this.schools.findOneOrFail({ where: { id: schoolId } });
  }

  /** The TDMP record for a code, or 404 / 503. */
  async fetch(schoolCode: string): Promise<TdmpSchoolBundle> {
    let bundle: TdmpSchoolBundle | null;
    try {
      bundle = await this.source.bundle(schoolCode);
    } catch (err) {
      if (err instanceof TdmpUnavailableError)
        throw new ServiceUnavailableException(
          'TDMP is not reachable right now. Try again later.',
        );
      throw err;
    }
    if (!bundle)
      throw new NotFoundException(
        `TDMP has no school with code ${schoolCode}.`,
      );
    return bundle;
  }

  /**
   * Writes one TDMP school into `schools`. `target` forces which local row
   * receives it (manual link / refresh); otherwise the row is found by TDMP
   * link, then by an unlinked school with the same code, else created.
   */
  async apply(bundle: TdmpSchoolBundle, target?: School): Promise<SyncOutcome> {
    const s = bundle.school;
    let school: School | null = target ?? null;
    let outcome: SyncOutcome | null = null;

    if (!school)
      school = await this.schools.findOne({
        where: [{ tdmpSchoolCode: s.schoolCode }, { tdmpSchoolId: s.id }],
      });
    if (!school) {
      const codes = [s.schoolCode, s.tmisSchoolCode].filter(
        (c): c is string => !!c,
      );
      school = await this.schools.findOne({
        where: { code: In(codes), tdmpSchoolCode: IsNull() },
      });
      if (school) outcome = 'linked';
    }
    if (!school) {
      const point = initialLocation(s);
      if (!point) return 'skippedNoGps';
      school = this.schools.create({
        ...point,
        locationSource: 'tdmp',
        locationUpdatedAt: new Date(),
      });
      outcome = 'created';
    } else if (!school.tdmpSchoolCode && !outcome) {
      outcome = 'linked';
    }

    const clash = await this.schools.findOne({
      where: school.id
        ? { code: s.schoolCode, id: Not(school.id) }
        : { code: s.schoolCode },
    });
    if (clash)
      throw new ConflictException(
        `Code ${s.schoolCode} is already used by "${clash.name}". Link that school instead.`,
      );

    const { fields, tdmpData } = mapTdmpSchool(bundle, school);
    const changed = changedFields(school, fields);
    const relinked =
      school.tdmpSchoolCode !== s.schoolCode || school.tdmpSchoolId !== s.id;
    const dataChanged =
      JSON.stringify(school.tdmpData ?? null) !== JSON.stringify(tdmpData);

    if (school.id && !outcome && !changed.length && !relinked && !dataChanged) {
      // Only the sync time moves; skip the audited save for a no-op.
      await this.schools.update(school.id, { tdmpSyncedAt: new Date() });
      return 'unchanged';
    }

    Object.assign(school, fields, {
      tdmpSchoolCode: s.schoolCode,
      tdmpSchoolId: s.id,
      tdmpData,
      tdmpSyncedAt: new Date(),
    });
    const saved = await this.schools.save(school);
    if (changed.length || outcome === 'created')
      this.events.emit('school.updated', { schoolId: saved.id });
    return outcome ?? 'updated';
  }

  private async execute(run: TdmpSyncRun): Promise<void> {
    const totals = emptyTotals();
    const errors: string[] = [];
    const note = (msg: string) => {
      if (errors.length < MAX_RUN_ERRORS) errors.push(msg);
    };
    try {
      const codes: string[] = [];
      for await (const s of this.source.listSchools())
        if (s?.schoolCode) codes.push(s.schoolCode);
      totals.fetched = codes.length;

      await eachLimit(codes, this.config.syncConcurrency, async (code) => {
        try {
          const bundle = await this.source.bundle(code);
          if (!bundle) throw new Error('not found');
          const outcome = await this.apply(bundle);
          totals[outcome]++;
          if (outcome === 'skippedNoGps')
            note(`${code}: not added — TDMP has no GPS inside Rwanda`);
        } catch (err) {
          totals.failed++;
          note(`${code}: ${(err as Error).message}`);
        }
      });

      if (totals.failed === 0) await this.markMissing(codes, totals, note);
      else note('Missing-school check skipped because some schools failed.');
      run.status = 'completed';
    } catch (err) {
      run.status = 'failed';
      note((err as Error).message);
      this.logger.error(`TDMP sync failed: ${(err as Error).message}`);
    } finally {
      run.totals = totals;
      run.errors = errors;
      run.finishedAt = new Date();
      await this.runs.save(run).catch(() => undefined);
      this.running = null;
      if (run.trigger === 'schedule')
        this.audit.record({
          action: 'tdmp.sync',
          outcome: run.status === 'completed' ? 'success' : 'failure',
          targetType: 'school',
          meta: { runId: run.id, trigger: run.trigger, ...totals },
        });
    }
  }

  /** Linked schools TDMP no longer lists become inactive. */
  private async markMissing(
    listed: string[],
    totals: TdmpSyncTotals,
    note: (msg: string) => void,
  ): Promise<void> {
    const seen = new Set(listed);
    const linked = await this.schools.find({
      where: { tdmpSchoolCode: Not(IsNull()) },
    });
    const missing = linked.filter(
      (s) => !seen.has(s.tdmpSchoolCode!) && !s.tdmpData?.missingFromTdmp,
    );
    if (!missing.length) return;
    if (missing.length > Math.max(5, linked.length * MAX_MISSING_SHARE)) {
      note(
        `${missing.length} linked schools were not in TDMP's list — not deactivated (check TDMP_SCHOOL_FILTER).`,
      );
      return;
    }
    for (const school of missing) {
      school.status = SchoolStatus.INACTIVE;
      school.tdmpData = { ...(school.tdmpData ?? {}), missingFromTdmp: true };
      await this.schools.save(school);
      this.events.emit('school.updated', { schoolId: school.id });
      totals.missing++;
      note(`${school.tdmpSchoolCode}: no longer listed by TDMP — set inactive`);
    }
  }

  /** Ids (of `ids`) that hold GIS work we must not throw away. */
  private async schoolsWithGisData(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT s.id FROM schools s
        WHERE s.id = ANY($1::uuid[])
          AND (s."kmzFilePath" IS NOT NULL OR s."kmz2dFilePath" IS NOT NULL
            OR s."tifFilePath" IS NOT NULL OR s."modelBytes" IS NOT NULL
            OR EXISTS (SELECT 1 FROM school_buildings b WHERE b.school_id = s.id)
            OR EXISTS (SELECT 1 FROM school_boundaries d WHERE d.school_id = s.id)
            OR EXISTS (SELECT 1 FROM issue_reports r WHERE r.school_id = s.id)
            OR EXISTS (SELECT 1 FROM site_features f WHERE f.school_id = s.id))`,
      [ids],
    );
    return new Set(rows.map((r) => r.id));
  }

  private assertEnabled() {
    if (!this.config.syncEnabled)
      throw new ServiceUnavailableException(
        'TDMP sync is not configured (TDMP_API_KEY).',
      );
  }
}
