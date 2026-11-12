import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface TdmpSyncTotals {
  /** Schools TDMP returned. */
  fetched: number;
  created: number;
  updated: number;
  /** TDMP record unchanged since the last run (nothing written). */
  unchanged: number;
  /** Existing local schools matched to TDMP by code for the first time. */
  linked: number;
  /** New TDMP schools not added because TDMP has no usable GPS for them. */
  skippedNoGps: number;
  /** TDMP rows left out: test data, no code, no district. */
  skipped: number;
  failed: number;
  /** Linked schools TDMP no longer lists (flagged, still active). */
  missing: number;
  /** Linked schools TDMP confirmed closed or gone (set inactive). */
  deactivated: number;
  /** School detail records read this run. */
  details: number;
}

export const emptyTotals = (): TdmpSyncTotals => ({
  fetched: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  linked: 0,
  skippedNoGps: 0,
  skipped: 0,
  failed: 0,
  missing: 0,
  deactivated: 0,
  details: 0,
});

/** One school in a run report. */
export interface TdmpReportSchool {
  code: string;
  name: string;
  district?: string | null;
  /** Our school id, when there is one. */
  schoolId?: string;
  /** Our name, when it differs from TDMP's. */
  localName?: string;
  /** Fields that change (dry run) or changed. */
  fields?: string[];
  reason?: string;
}

/**
 * What a run found, for the admin page: the first-link review (dry run) and
 * the schools that need a person (no GPS, missing, name conflicts).
 */
export interface TdmpRunReport {
  /** TDMP's own data time for the list that was read. */
  tdmpMaterialisedAt?: string | null;
  /** Schools that change (dry run: would change). */
  changes: TdmpReportSchool[];
  /** Local schools matched by code for the first time. */
  newLinks: TdmpReportSchool[];
  /** In TDMP, not in RTB GIS, with GPS (created / would be created). */
  created: TdmpReportSchool[];
  /** In TDMP, not in RTB GIS, no usable GPS: needs a location first. */
  needsLocation: TdmpReportSchool[];
  /** Linked schools TDMP no longer lists, or confirmed closed. */
  missing: TdmpReportSchool[];
  /** Local schools TDMP does not know (no link, no code match). */
  gisOnly: TdmpReportSchool[];
  /** TDMP rows left out (test data, no code / district). */
  skipped: TdmpReportSchool[];
}

export const emptyReport = (): TdmpRunReport => ({
  changes: [],
  newLinks: [],
  created: [],
  needsLocation: [],
  missing: [],
  gisOnly: [],
  skipped: [],
});

/** Where a running sync is; null once it finished. */
export interface TdmpRunProgress {
  phase: 'list' | 'bands' | 'schools' | 'missing';
  done: number;
  total: number;
}

export type TdmpRunTrigger = 'schedule' | 'probe' | 'manual';

/** One run of the TDMP school sync (automatic or "Sync now"). */
@Entity('tdmp_sync_runs')
@Index('IDX_tdmp_sync_runs_startedAt', ['startedAt'])
export class TdmpSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `schedule` = daily run, `probe` = TDMP data changed, `manual` = a person. */
  @Column({ type: 'varchar', length: 16 })
  trigger: TdmpRunTrigger;

  @Column({ type: 'varchar', length: 16 })
  status: 'running' | 'completed' | 'failed';

  /** A dry run reads TDMP and reports what would change; it writes nothing. */
  @Column({ type: 'boolean', default: false })
  dryRun: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'jsonb' })
  totals: TdmpSyncTotals;

  /** First problems met (per-school failures, skipped schools). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors: string[];

  @Column({ type: 'jsonb', nullable: true })
  report: TdmpRunReport | null;

  @Column({ type: 'jsonb', nullable: true })
  progress: TdmpRunProgress | null;

  /** Email of whoever pressed "Sync now"; null for automatic runs. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  triggeredBy: string | null;
}
