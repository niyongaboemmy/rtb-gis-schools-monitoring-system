import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DataSource,
  In,
  IsNull,
  Not,
  Repository,
  type QueryRunner,
} from 'typeorm';
import { School, SchoolStatus } from '../schools/entities/school.entity';
import { checkPoint } from '../schools/location/school-location.rules';
import { AuditService } from '../audit/audit.service';
import { TdmpConfig } from './tdmp.config';
import { TdmpSchoolSource } from './tdmp-school.source';
import { TdmpUnavailableError } from './tdmp-api.client';
import {
  changedFields,
  initialLocation,
  mapTdmpSchool,
  touchesScoring,
  type TdmpBand,
  type TdmpSchoolBundle,
} from './tdmp-school.mapper';
import { normaliseTdmpSchool } from './tdmp-school.normalise';
import type { TdmpSchool } from './tdmp.types';
import {
  emptyReport,
  emptyTotals,
  TdmpSyncRun,
  type TdmpReportSchool,
  type TdmpRunProgress,
  type TdmpRunReport,
  type TdmpRunTrigger,
  type TdmpSyncTotals,
} from './entities/tdmp-sync-run.entity';
import {
  PROBE_INTERVALS,
  TDMP_SETTINGS_ID,
  TdmpSettings,
} from './entities/tdmp-settings.entity';

export type SyncOutcome =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'linked'
  | 'skippedNoGps';

/** Errors kept on a run row. */
const MAX_RUN_ERRORS = 50;
/** Schools kept per report list. */
const MAX_REPORT_ROWS = 500;

/**
 * Never touch more than this share of linked schools as "missing" in one
 * run: a sudden mass disappearance means a filter or TDMP problem.
 */
const MAX_MISSING_SHARE = 0.2;

/** A 404 must repeat on this many runs before a school is set inactive. */
const MISSING_RUNS_TO_DEACTIVATE = 2;

/** pg advisory lock id for "a TDMP sync is running" (any process). */
const SYNC_LOCK_KEY = 738_810_001;

/** Africa/Kigali is UTC+2 all year (no daylight saving). */
const KIGALI_OFFSET_MS = 2 * 3_600_000;

/** Progress is written to the run row at most this often. */
const PROGRESS_SAVE_MS = 1500;

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

/** Today's `HH:mm` (Kigali) as an instant. */
export function kigaliTimeToday(now: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const local = new Date(now.getTime() + KIGALI_OFFSET_MS);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      h,
      m,
    ) - KIGALI_OFFSET_MS,
  );
}

/** Words of a school name, for suggesting a TDMP match. */
function nameWords(name: string): Set<string> {
  const STOP = new Set([
    'school',
    'tvet',
    'tss',
    'vtc',
    'de',
    'des',
    'du',
    'la',
    'le',
    'and',
    'the',
    'technical',
    'secondary',
  ]);
  return new Set(
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

function similarity(a: string, b: string): number {
  const x = nameWords(a);
  const y = nameWords(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

const sameName = (a?: string | null, b?: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

interface RunContext {
  run: TdmpSyncRun;
  dryRun: boolean;
  totals: TdmpSyncTotals;
  report: TdmpRunReport;
  note: (msg: string) => void;
  detailsLeft: number;
}

/**
 * Copies school information from TDMP into `schools`. TDMP-owned columns are
 * overwritten; location and everything GIS stay ours. Runs automatically
 * (see `tick`) and on demand from the TDMP admin page.
 */
@Injectable()
export class TdmpSyncService {
  private readonly logger = new Logger(TdmpSyncService.name);
  private running: string | null = null;
  private lastProgressSave = 0;

  constructor(
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    @InjectRepository(TdmpSyncRun)
    private readonly runs: Repository<TdmpSyncRun>,
    @InjectRepository(TdmpSettings)
    private readonly settingsRepo: Repository<TdmpSettings>,
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

  // ── Settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<TdmpSettings> {
    const found = await this.settingsRepo.findOne({
      where: { id: TDMP_SETTINGS_ID },
    });
    if (found) return found;
    return this.settingsRepo.save(
      this.settingsRepo.create({ id: TDMP_SETTINGS_ID, updatedBy: null }),
    );
  }

  async updateSettings(
    patch: Partial<
      Pick<TdmpSettings, 'autoSync' | 'probeIntervalMinutes' | 'dailyRunAt'>
    >,
    by: string | null,
  ): Promise<TdmpSettings> {
    const s = await this.getSettings();
    if (patch.probeIntervalMinutes !== undefined) {
      if (
        !(PROBE_INTERVALS as readonly number[]).includes(
          patch.probeIntervalMinutes,
        )
      )
        throw new BadRequestException(
          `probeIntervalMinutes must be one of ${PROBE_INTERVALS.join(', ')}`,
        );
      s.probeIntervalMinutes = patch.probeIntervalMinutes;
    }
    if (patch.dailyRunAt !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.dailyRunAt))
        throw new BadRequestException('dailyRunAt must be HH:mm (24 h)');
      s.dailyRunAt = patch.dailyRunAt;
    }
    if (patch.autoSync !== undefined) s.autoSync = patch.autoSync;
    s.updatedBy = by;
    return this.settingsRepo.save(s);
  }

  // ── Automatic runs ───────────────────────────────────────────────────────

  /**
   * Every 5 minutes: decide whether an automatic run is due. Two reasons:
   * TDMP re-materialised its data since our last run (seen by the probe), or
   * the daily run time passed and today's daily run has not happened yet.
   */
  @Cron('*/5 * * * *', { name: 'tdmp-sync-tick', timeZone: 'Africa/Kigali' })
  async tick(now = new Date()): Promise<TdmpRunTrigger | null> {
    if (!this.config.syncEnabled || this.running) return null;
    try {
      const settings = await this.getSettings();
      if (!settings.autoSync) return null;
      const trigger = await this.dueTrigger(settings, now);
      if (trigger) await this.start(trigger, null);
      return trigger;
    } catch (err) {
      if (!(err instanceof ConflictException))
        this.logger.error(
          `TDMP auto-sync tick failed: ${(err as Error).message}`,
        );
      return null;
    }
  }

  private async dueTrigger(
    settings: TdmpSettings,
    now: Date,
  ): Promise<TdmpRunTrigger | null> {
    const dailyAt = kigaliTimeToday(now, settings.dailyRunAt);
    if (now >= dailyAt) {
      const todays = await this.runs
        .createQueryBuilder('r')
        .where('r.trigger = :t AND r.dryRun = false AND r.startedAt >= :at', {
          t: 'schedule',
          at: dailyAt,
        })
        .getCount();
      if (!todays) return 'schedule';
    }

    const intervalMs = settings.probeIntervalMinutes * 60_000;
    if (
      settings.lastProbeAt &&
      now.getTime() - new Date(settings.lastProbeAt).getTime() < intervalMs
    )
      return null;

    settings.lastProbeAt = now;
    try {
      const meta = await this.source.probe();
      settings.lastSeenMaterialisedAt = meta.lastMaterialisedAt ?? null;
    } finally {
      await this.settingsRepo.save(settings);
    }
    const seen = settings.lastSeenMaterialisedAt;
    if (!seen) return null;
    const last = await this.lastSuccessfulRun();
    return last?.report?.tdmpMaterialisedAt === seen ? null : 'probe';
  }

  private lastSuccessfulRun(): Promise<TdmpSyncRun | null> {
    return this.runs.findOne({
      where: { status: 'completed', dryRun: false },
      order: { startedAt: 'DESC' },
    });
  }

  // ── Runs ─────────────────────────────────────────────────────────────────

  /** Starts a sync in the background and returns its run row. */
  async start(
    trigger: TdmpRunTrigger,
    triggeredBy: string | null,
    opts: { dryRun?: boolean } = {},
  ): Promise<TdmpSyncRun> {
    this.assertEnabled();
    if (this.running)
      throw new ConflictException('A TDMP sync is already running.');
    this.running = 'starting';
    let lock: QueryRunner | null = null;
    try {
      lock = await this.acquireLock();
      const run = await this.runs.save(
        this.runs.create({
          trigger,
          status: 'running',
          dryRun: !!opts.dryRun,
          totals: emptyTotals(),
          errors: [],
          report: null,
          progress: { phase: 'list', done: 0, total: 0 },
          triggeredBy,
          finishedAt: null,
        }),
      );
      this.running = run.id;
      void this.execute(run, lock);
      return run;
    } catch (err) {
      this.running = null;
      await this.releaseLock(lock);
      throw err;
    }
  }

  /**
   * A session-level pg advisory lock, so a second process (CLI, another
   * instance) can't run a sync at the same time. Held by one connection for
   * the whole run.
   */
  private async acquireLock(): Promise<QueryRunner> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    const rows: Array<{ locked: boolean }> = await qr.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [SYNC_LOCK_KEY],
    );
    if (!rows?.[0]?.locked) {
      await qr.release();
      throw new ConflictException('A TDMP sync is already running.');
    }
    return qr;
  }

  private async releaseLock(qr: QueryRunner | null): Promise<void> {
    if (!qr) return;
    try {
      await qr.query('SELECT pg_advisory_unlock($1)', [SYNC_LOCK_KEY]);
    } catch {
      // The lock dies with the connection anyway.
    }
    try {
      await qr.release();
    } catch {
      // Already released.
    }
  }

  async status() {
    const [lastRun, current, linkedSchools, unlinkedSchools, settings] =
      await Promise.all([
        this.runs.findOne({ where: {}, order: { startedAt: 'DESC' } }),
        this.running && this.running !== 'starting'
          ? this.runs.findOne({ where: { id: this.running } })
          : Promise.resolve(null),
        this.schools.count({ where: { tdmpSchoolCode: Not(IsNull()) } }),
        this.schools.count({ where: { tdmpSchoolCode: IsNull() } }),
        this.getSettings(),
      ]);
    const lastSuccess = await this.lastSuccessfulRun();
    const now = new Date();
    let nextDaily = kigaliTimeToday(now, settings.dailyRunAt);
    if (nextDaily <= now)
      nextDaily = new Date(nextDaily.getTime() + 86_400_000);
    return {
      enabled: {
        login: this.config.loginEnabled,
        sync: this.config.syncEnabled,
      },
      authMode: this.config.authMode,
      running: this.isRunning,
      currentRun: current,
      lastRun,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      linkedSchools,
      unlinkedSchools,
      settings: {
        autoSync: settings.autoSync,
        probeIntervalMinutes: settings.probeIntervalMinutes,
        dailyRunAt: settings.dailyRunAt,
        lastProbeAt: settings.lastProbeAt,
        tdmpMaterialisedAt: settings.lastSeenMaterialisedAt,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
        probeIntervals: PROBE_INTERVALS,
        nextDailyRunAt: settings.autoSync ? nextDaily : null,
      },
    };
  }

  listRuns(limit = 10) {
    return this.runs.find({
      order: { startedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  async getRun(id: string): Promise<TdmpSyncRun> {
    const run = await this.runs.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Sync run not found');
    return run;
  }

  /** Local schools not linked to TDMP yet, with whether they hold GIS work. */
  async unlinked() {
    const rows = await this.schools.find({
      where: { tdmpSchoolCode: IsNull() },
      select: ['id', 'code', 'name', 'district'],
      order: { name: 'ASC' },
    });
    const withGis = await this.schoolsWithGisData(rows.map((r) => r.id));
    // Name-based suggestions from the latest run that listed GIS-only schools.
    const lastReport = await this.runs.findOne({
      where: { status: 'completed' },
      order: { startedAt: 'DESC' },
    });
    const suggestions = new Map(
      (lastReport?.report?.gisOnly ?? [])
        .filter((g) => g.schoolId && g.reason?.startsWith('suggest:'))
        .map((g) => [g.schoolId!, g.reason!.slice('suggest:'.length)]),
    );
    return rows.map((r) => {
      const hint = suggestions.get(r.id);
      const [code, ...name] = hint ? hint.split('|') : [];
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        district: r.district,
        hasGisData: withGis.has(r.id),
        suggestion: hint
          ? { schoolCode: code, schoolName: name.join('|') }
          : null,
      };
    });
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

  /**
   * Adds a TDMP school that the sync could not place (TDMP has no usable
   * GPS for it) at a location a person gives. Everything else comes from
   * TDMP and the school is linked straight away; the location is RTB GIS's
   * own (`manual`), so later syncs never move it.
   */
  async importWithLocation(
    schoolCode: string,
    latitude: unknown,
    longitude: unknown,
  ): Promise<School> {
    this.assertEnabled();
    const point = checkPoint(latitude, longitude);
    if ('error' in point) throw new BadRequestException(point.error);
    const bundle = await this.fetch(schoolCode.trim());
    const code = bundle.school.schoolCode;
    const existing = await this.schools.findOne({
      where: [
        { tdmpSchoolCode: code },
        { tdmpSchoolId: bundle.school.id },
        { code },
      ],
    });
    if (existing)
      throw new ConflictException(
        `"${existing.name}" already has TDMP code ${code}. Open it instead.`,
      );
    const school = this.schools.create({
      latitude: point.lat,
      longitude: point.lng,
      locationSource: 'manual',
      locationUpdatedAt: new Date(),
    });
    const { school: saved } = await this.applyDetailed(bundle, school);
    if (saved?.id) this.events.emit('school.updated', { schoolId: saved.id });
    return this.schools.findOneOrFail({ where: { tdmpSchoolCode: code } });
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

  /** The TDMP record (detail + band) for a code, or 404 / 503. */
  async fetch(schoolCode: string): Promise<TdmpSchoolBundle> {
    let raw: TdmpSchool | null;
    let bands: Map<string, TdmpBand> | null = null;
    try {
      raw = await this.source.school(schoolCode);
      if (raw) bands = await this.source.bands().catch(() => null);
    } catch (err) {
      if (err instanceof TdmpUnavailableError)
        throw new ServiceUnavailableException(
          'TDMP is not reachable right now. Try again later.',
        );
      throw err;
    }
    if (!raw)
      throw new NotFoundException(
        `TDMP has no school with code ${schoolCode}.`,
      );
    const n = normaliseTdmpSchool(raw);
    if (!n.ok)
      throw new ConflictException(
        `TDMP school ${schoolCode} can't be used: ${n.reason}.`,
      );
    return {
      school: n.school,
      band: bands ? (bands.get(n.school.schoolCode) ?? null) : undefined,
      detailFetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Writes one TDMP school into `schools`. `target` forces which local row
   * receives it (manual link / refresh / matched by the run); otherwise the
   * row is found by TDMP link, then by an unlinked school with the same code,
   * else created. `dryRun` computes the outcome without writing.
   */
  async apply(
    bundle: TdmpSchoolBundle,
    target?: School,
    dryRun = false,
  ): Promise<SyncOutcome> {
    return (await this.applyDetailed(bundle, target, dryRun)).outcome;
  }

  private async applyDetailed(
    bundle: TdmpSchoolBundle,
    target?: School,
    dryRun = false,
  ): Promise<{
    outcome: SyncOutcome;
    changed: string[];
    school: School | null;
  }> {
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
      if (!point) return { outcome: 'skippedNoGps', changed: [], school: null };
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
      school.tdmpData?.hash !== tdmpData.hash ||
      !!school.tdmpData?.missingFromTdmp;

    if (school.id && !outcome && !changed.length && !relinked && !dataChanged) {
      // Only the sync time moves. Raw SQL: no audited save for a no-op, and
      // `updatedAt` keeps meaning "last real change".
      if (!dryRun)
        await this.dataSource.query(
          'UPDATE "schools" SET "tdmpSyncedAt" = now() WHERE "id" = $1',
          [school.id],
        );
      return { outcome: 'unchanged', changed, school };
    }
    if (dryRun) return { outcome: outcome ?? 'updated', changed, school };

    Object.assign(school, fields, {
      tdmpSchoolCode: s.schoolCode,
      tdmpSchoolId: s.id,
      tdmpData,
      tdmpSyncedAt: new Date(),
    });
    const saved = await this.schools.save(school);
    if (outcome === 'created' || touchesScoring(changed))
      this.events.emit('school.updated', { schoolId: saved.id });
    return { outcome: outcome ?? 'updated', changed, school: saved };
  }

  private async execute(run: TdmpSyncRun, lock: QueryRunner): Promise<void> {
    const totals = emptyTotals();
    const errors: string[] = [];
    const report = emptyReport();
    const push = (list: TdmpReportSchool[], row: TdmpReportSchool) => {
      if (list.length < MAX_REPORT_ROWS) list.push(row);
    };
    const ctx: RunContext = {
      run,
      dryRun: run.dryRun,
      totals,
      report,
      note: (msg: string) => {
        if (errors.length < MAX_RUN_ERRORS) errors.push(msg);
      },
      detailsLeft: this.config.detailBudget,
    };
    try {
      await this.progress(
        run,
        totals,
        { phase: 'list', done: 0, total: 0 },
        true,
      );
      const { rows, meta } = await this.source.sweep();
      report.tdmpMaterialisedAt = meta.lastMaterialisedAt ?? null;
      totals.fetched = rows.length;

      await this.progress(
        run,
        totals,
        { phase: 'bands', done: 0, total: 0 },
        true,
      );
      let bands: Map<string, TdmpBand> | null = null;
      try {
        bands = await this.source.bands();
      } catch (err) {
        if (err instanceof TdmpUnavailableError) throw err;
        ctx.note(
          `TSS / VTC bands not read (${(err as Error).message}); school types kept.`,
        );
      }

      // Every code TDMP listed counts as "seen", even rows we skip.
      const seen = new Set<string>();
      const valid: Array<{ raw: TdmpSchool; school: TdmpSchool }> = [];
      for (const raw of rows) {
        const n = normaliseTdmpSchool(raw, this.config.ignoreSources);
        if (n.ok) {
          seen.add(n.school.schoolCode);
          valid.push({ raw, school: n.school });
        } else {
          if (n.code) seen.add(n.code);
          totals.skipped++;
          push(report.skipped, {
            code: n.code ?? '—',
            name: String(raw?.schoolName ?? ''),
            reason: n.reason,
          });
        }
      }

      const locals = await this.schools.find();
      const byTdmpCode = new Map<string, School>();
      const byTdmpId = new Map<number, School>();
      const byCode = new Map<string, School>();
      for (const l of locals) {
        if (l.tdmpSchoolCode) byTdmpCode.set(l.tdmpSchoolCode, l);
        if (l.tdmpSchoolId != null) byTdmpId.set(l.tdmpSchoolId, l);
        if (!l.tdmpSchoolCode && l.code) byCode.set(l.code, l);
      }
      const matchedLocalIds = new Set<string>();
      const unmatchedTdmp: TdmpSchool[] = [];

      let done = 0;
      await eachLimit(
        valid,
        this.config.syncConcurrency,
        async ({ raw, school }) => {
          const code = school.schoolCode;
          try {
            const local =
              byTdmpCode.get(code) ??
              (school.id != null ? byTdmpId.get(school.id) : undefined) ??
              byCode.get(code) ??
              (school.tmisSchoolCode
                ? byCode.get(school.tmisSchoolCode)
                : undefined) ??
              null;
            if (local) matchedLocalIds.add(local.id);
            else unmatchedTdmp.push(school);
            const band = bands ? (bands.get(code) ?? null) : undefined;
            const bundle = await this.withDetail(raw, school, band, local, ctx);
            if (!bundle) return;
            // Read before applying: apply() updates the loaded entity in place.
            const localName = local?.name;

            const { outcome, changed } = await this.applyDetailed(
              bundle,
              local ?? undefined,
              ctx.dryRun,
            );
            totals[outcome]++;
            const entry: TdmpReportSchool = {
              code,
              name: bundle.school.schoolName,
              district: bundle.school.location?.districtName ?? null,
              schoolId: local?.id,
              localName:
                localName && !sameName(localName, bundle.school.schoolName)
                  ? localName
                  : undefined,
            };
            if (outcome === 'skippedNoGps') {
              push(report.needsLocation, {
                ...entry,
                reason: 'TDMP has no GPS inside Rwanda',
              });
            } else if (outcome === 'created') {
              push(report.created, entry);
            } else if (outcome === 'linked') {
              push(report.newLinks, { ...entry, fields: changed });
            } else if (outcome === 'updated' && changed.length) {
              push(report.changes, { ...entry, fields: changed });
            }
          } catch (err) {
            if (err instanceof TdmpUnavailableError) throw err;
            totals.failed++;
            ctx.note(`${code}: ${(err as Error).message}`);
          } finally {
            done++;
            await this.progress(run, totals, {
              phase: 'schools',
              done,
              total: valid.length,
            });
          }
        },
      );

      if (totals.failed === 0) await this.handleMissing(seen, locals, ctx);
      else
        ctx.note('Missing-school check skipped because some schools failed.');

      // Local schools TDMP doesn't know, with a name-based suggestion.
      for (const l of locals) {
        if (l.tdmpSchoolCode || matchedLocalIds.has(l.id)) continue;
        let best: TdmpSchool | null = null;
        let bestScore = 0;
        for (const t of unmatchedTdmp) {
          const score =
            similarity(l.name, t.schoolName) +
            (sameName(l.district, t.location?.districtName) ? 0.15 : 0);
          if (score > bestScore) {
            best = t;
            bestScore = score;
          }
        }
        push(report.gisOnly, {
          code: l.code,
          name: l.name,
          district: l.district,
          schoolId: l.id,
          reason:
            best && bestScore >= 0.35
              ? `suggest:${best.schoolCode}|${best.schoolName}`
              : undefined,
        });
      }
      run.status = 'completed';
    } catch (err) {
      run.status = 'failed';
      ctx.note((err as Error).message);
      this.logger.error(`TDMP sync failed: ${(err as Error).message}`);
    } finally {
      run.totals = totals;
      run.errors = errors;
      run.report = report;
      run.progress = null;
      run.finishedAt = new Date();
      try {
        await this.runs.save(run);
      } catch (err) {
        this.logger.error(`TDMP sync run not saved: ${(err as Error).message}`);
      }
      this.running = null;
      await this.releaseLock(lock);
      if (run.trigger !== 'manual')
        this.audit.record({
          action: 'tdmp.sync',
          outcome: run.status === 'completed' ? 'success' : 'failure',
          targetType: 'school',
          meta: {
            runId: run.id,
            trigger: run.trigger,
            dryRun: run.dryRun,
            ...totals,
          },
        });
      this.events.emit('tdmp.sync.finished', {
        runId: run.id,
        status: run.status,
      });
    }
  }

  /**
   * The bundle for one listed school, reading the detail record when it is
   * needed: a school new to us (GPS to place it), a first link, or a stored
   * detail older than TDMP_DETAIL_MAX_AGE_DAYS while the per-run budget lasts.
   */
  private async withDetail(
    raw: TdmpSchool,
    school: TdmpSchool,
    band: TdmpBand | null | undefined,
    local: School | null,
    ctx: RunContext,
  ): Promise<TdmpSchoolBundle | null> {
    const fetchedAt = local?.tdmpData?.detailFetchedAt;
    const stale =
      !fetchedAt ||
      Date.now() - new Date(fetchedAt).getTime() > this.config.detailMaxAgeMs;
    const required = !local || !local.tdmpSchoolCode;
    const wanted = required || (stale && ctx.detailsLeft > 0);

    if (wanted) {
      if (!required) ctx.detailsLeft--;
      const detail = await this.source.school(school.schoolCode);
      ctx.totals.details++;
      if (detail) {
        const merged = normaliseTdmpSchool({
          ...raw,
          ...detail,
          ownership: raw.ownership ?? detail.ownership,
        });
        if (merged.ok)
          return {
            school: merged.school,
            band,
            detailFetchedAt: new Date().toISOString(),
          };
      }
    }
    // Carry the detail-only facts we already hold, so the hash stays stable.
    return {
      school: {
        ...school,
        establishmentDate:
          school.establishmentDate ??
          local?.tdmpData?.establishmentDate ??
          null,
        currentAcademicYear:
          school.currentAcademicYear ??
          school.academicYear ??
          local?.tdmpData?.academicYear ??
          null,
      },
      band,
      detailFetchedAt: fetchedAt ?? null,
    };
  }

  /**
   * Linked schools absent from TDMP's list. Absent from a *filtered* list is
   * not proof of closure (a category glitch drops a school out of
   * `categoryGroup=TVET`), so each one is looked up: inactive only when TDMP
   * says INACTIVE, or answers 404 on consecutive runs. Otherwise flagged.
   */
  private async handleMissing(
    seen: Set<string>,
    locals: School[],
    ctx: RunContext,
  ): Promise<void> {
    const linked = locals.filter((s) => s.tdmpSchoolCode);
    const missing = linked.filter(
      (s) =>
        !seen.has(s.tdmpSchoolCode!) &&
        !(s.status === SchoolStatus.INACTIVE && s.tdmpData?.missingFromTdmp),
    );
    if (!missing.length) return;
    if (missing.length > Math.max(5, linked.length * MAX_MISSING_SHARE)) {
      ctx.note(
        `${missing.length} linked schools were not in TDMP's list — left as they are (check TDMP_SCHOOL_FILTER).`,
      );
      return;
    }
    let done = 0;
    for (const school of missing) {
      const code = school.tdmpSchoolCode!;
      await this.progress(ctx.run, ctx.totals, {
        phase: 'missing',
        done: done++,
        total: missing.length,
      });
      const detail = await this.source.school(code);
      ctx.totals.details++;
      const runs = detail ? 0 : (school.tdmpData?.missingRuns ?? 0) + 1;
      const closed =
        (detail && (detail.isActive ?? '').toUpperCase() === 'INACTIVE') ||
        runs >= MISSING_RUNS_TO_DEACTIVATE;
      const reason = !detail
        ? `TDMP has no school ${code} (${runs} run${runs > 1 ? 's' : ''} in a row)`
        : closed
          ? 'TDMP marks it inactive'
          : 'Still in TDMP, but no longer in the TVET list';
      if (closed) ctx.totals.deactivated++;
      else ctx.totals.missing++;
      if (ctx.report.missing.length < MAX_REPORT_ROWS)
        ctx.report.missing.push({
          code,
          name: school.name,
          district: school.district,
          schoolId: school.id,
          reason: closed ? `${reason} — set inactive` : reason,
        });
      if (ctx.dryRun) continue;

      const wasActive = school.status !== SchoolStatus.INACTIVE;
      school.tdmpData = {
        ...(school.tdmpData ?? {}),
        missingFromTdmp: true,
        missingRuns: runs,
      };
      if (closed) school.status = SchoolStatus.INACTIVE;
      await this.schools.save(school);
      if (closed && wasActive)
        this.events.emit('school.updated', { schoolId: school.id });
    }
  }

  /** Records progress on the run row (throttled) so the admin page can show it. */
  private async progress(
    run: TdmpSyncRun,
    totals: TdmpSyncTotals,
    p: TdmpRunProgress,
    force = false,
  ): Promise<void> {
    run.progress = p;
    run.totals = { ...totals };
    const now = Date.now();
    if (!force && now - this.lastProgressSave < PROGRESS_SAVE_MS) return;
    this.lastProgressSave = now;
    try {
      await this.runs.update(run.id, { progress: p, totals: run.totals });
    } catch {
      // Progress is best effort; the final save records the result.
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
