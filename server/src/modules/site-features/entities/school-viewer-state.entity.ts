import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

/**
 * Per-school 3D viewer state: the shared camera "home", building pin
 * placements, and the 3D measurements / annotations drawn on the model.
 *
 * Replaces the unauthenticated `viewer-state.json` the file-server used to
 * accept from any client. One row per school; the last writer wins.
 */
@Entity('school_viewer_states')
export class SchoolViewerState {
  @PrimaryColumn({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @OneToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @Column({ type: 'jsonb', nullable: true })
  home: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'building_pins', default: () => "'{}'" })
  buildingPins: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  annotations: unknown[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  measures: unknown[];

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
