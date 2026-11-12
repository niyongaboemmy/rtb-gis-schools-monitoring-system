import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * When the TDMP school sync runs on its own, edited in the TDMP admin page.
 * One row (`id = 'default'`); kept in the database rather than env vars so an
 * admin can pause or reschedule the sync without a deploy.
 */
@Entity('tdmp_settings')
export class TdmpSettings {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  /** Master switch for every automatic run. "Sync now" always works. */
  @Column({ type: 'boolean', default: true })
  autoSync: boolean;

  /** How often to ask TDMP whether its data changed (minutes). */
  @Column({ type: 'int', default: 60 })
  probeIntervalMinutes: number;

  /** Daily full run, Kigali time "HH:mm"; runs even if the probe saw nothing. */
  @Column({ type: 'varchar', length: 5, default: '07:15' })
  dailyRunAt: string;

  /** Last time the freshness probe asked TDMP. */
  @Column({ type: 'timestamptz', nullable: true })
  lastProbeAt: Date | null;

  /** `meta.lastMaterialisedAt` seen by the last probe. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  lastSeenMaterialisedAt: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updatedBy: string | null;
}

export const TDMP_SETTINGS_ID = 'default';

export const PROBE_INTERVALS = [15, 30, 60, 180, 360] as const;
