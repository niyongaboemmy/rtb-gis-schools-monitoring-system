import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Append-only activity log (WS11). Answers Action / By who / When / To whom.
 * Rows are hash-chained (`prev_hash` → `hash`); production blocks UPDATE and
 * DELETE with a trigger (migration 1788430000000).
 */
@Entity('audit_logs')
@Index('IDX_audit_actor', ['actorId'])
@Index('IDX_audit_target', ['targetType', 'targetId'])
@Index('IDX_audit_action', ['action'])
@Index('IDX_audit_created_at', ['createdAt'])
@Index('IDX_audit_subject_user', ['subjectUserId'])
export class AuditLog {
  /** Supplied by the app on insert so it can be covered by the hash. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', nullable: true })
  actorId: string;

  @Column({ name: 'actor_email', nullable: true })
  actorEmail: string;

  @Column({ name: 'actor_role', type: 'varchar', nullable: true })
  actorRole: string | null;

  @Column()
  action: string;

  /** success | failure | denied */
  @Column({ type: 'varchar', length: 16, default: 'success' })
  outcome: string;

  @Column({ name: 'target_type' })
  targetType: string;

  @Column({ name: 'target_id', nullable: true })
  targetId: string;

  @Column({ name: 'target_label', type: 'varchar', nullable: true })
  targetLabel: string | null;

  /** The person affected (e.g. the user whose role changed). */
  @Column({ name: 'subject_user_id', type: 'varchar', nullable: true })
  subjectUserId: string | null;

  /** Field-level diff: field → [before, after]. */
  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, [unknown, unknown]> | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 128, nullable: true })
  sessionId: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @Column({ name: 'prev_hash', type: 'varchar', length: 64, nullable: true })
  prevHash: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string | null;

  /**
   * Millisecond precision so the value round-trips through JS Dates exactly
   * (the hash and the pagination cursor depend on it). Set by the app inside
   * the chain lock, strictly increasing.
   */
  @Column({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'now()',
  })
  createdAt: Date;
}
