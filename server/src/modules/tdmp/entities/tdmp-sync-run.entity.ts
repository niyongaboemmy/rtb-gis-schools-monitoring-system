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
  unchanged: number;
  /** Existing local schools matched to TDMP by code for the first time. */
  linked: number;
  /** New TDMP schools not added because TDMP has no usable GPS for them. */
  skippedNoGps: number;
  failed: number;
  /** Linked schools TDMP no longer lists (marked inactive). */
  missing: number;
}

export const emptyTotals = (): TdmpSyncTotals => ({
  fetched: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  linked: 0,
  skippedNoGps: 0,
  failed: 0,
  missing: 0,
});

/** One run of the TDMP school sync (nightly or "Sync now"). */
@Entity('tdmp_sync_runs')
@Index('IDX_tdmp_sync_runs_startedAt', ['startedAt'])
export class TdmpSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  trigger: 'schedule' | 'manual';

  @Column({ type: 'varchar', length: 16 })
  status: 'running' | 'completed' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'jsonb' })
  totals: TdmpSyncTotals;

  /** First problems met (per-school failures, skipped schools). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors: string[];

  /** Email of whoever pressed "Sync now"; null for the nightly run. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  triggeredBy: string | null;
}
