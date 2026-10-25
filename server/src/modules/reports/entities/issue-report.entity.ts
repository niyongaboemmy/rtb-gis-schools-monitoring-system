import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { SchoolBuilding } from '../../schools/entities/school-building.entity';
import { User } from '../../users/entities/user.entity';

export enum ReportStatus {
  PENDING = 'PENDING',
  SOLVED = 'SOLVED',
  NEED_INTERVENTION = 'NEED_INTERVENTION',
  FAILED = 'FAILED',
}

/** What kind of report this is (WS7.7). */
export enum ReportType {
  /** A facility / infrastructure issue filed from the school. */
  ISSUE = 'issue',
  /** A request to change a locked school field (location, buildings, …). */
  DATA_CHANGE_REQUEST = 'data_change_request',
}

/** Payload of a data change request. */
export interface ChangeRequestPayload {
  fields: {
    field: string;
    currentValue: unknown;
    proposedValue: unknown;
  }[];
  reason: string;
}

@Entity('issue_reports')
export class IssueReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Index('IDX_issue_reports_school_id')
  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => SchoolBuilding, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'building_id' })
  building: SchoolBuilding;

  @Column({ name: 'building_id', nullable: true })
  buildingId: string;

  @Column()
  facilityId: string; // The slug/ID from FacilityEntity

  @Column()
  itemId: string; // The ID from FacilityItem

  @Column({ type: 'jsonb', nullable: true })
  issueCategory: string[]; // Multiple chosen predefined issues

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  @Index('IDX_issue_reports_status')
  status: ReportStatus;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reported_by' })
  reporter: User;

  @Column({ name: 'reported_by', nullable: true })
  reportedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[]; // URLs to images

  @Index('IDX_issue_reports_type')
  @Column({
    type: 'varchar',
    length: 40,
    default: ReportType.ISSUE,
  })
  type: ReportType;

  /** Field changes requested (only for DATA_CHANGE_REQUEST reports). */
  @Column({ type: 'jsonb', nullable: true })
  changeRequest: ChangeRequestPayload | null;

  /** Role expected to act on the report, e.g. `gis_analyst`. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  assignedRole: string | null;

  @Column({ nullable: true })
  resolvedAt: Date;

  /** Reviewer's note from the last status change (why it was triaged so). */
  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  /** When a reviewer last changed the status. */
  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Index('IDX_issue_reports_createdAt')
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
