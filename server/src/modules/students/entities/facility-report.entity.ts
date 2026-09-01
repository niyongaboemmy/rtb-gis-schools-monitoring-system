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
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';

export enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity('facility_reports')
@Index(['schoolId'])
@Index(['studentId'])
@Index(['status'])
@Index(['priority'])
@Index(['createdAt'])
export class FacilityReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column('uuid')
  schoolId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column('uuid', { nullable: true })
  studentId: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  facilityCategory: string;

  @Column({
    type: 'enum',
    enum: ReportPriority,
    default: ReportPriority.MEDIUM,
  })
  priority: ReportPriority;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[];

  @Column({ nullable: true })
  buildingId: string;

  @Column({ nullable: true })
  contactName: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isPending(): boolean {
    return this.status === ReportStatus.PENDING;
  }

  isResolved(): boolean {
    return this.status === ReportStatus.RESOLVED;
  }
}
