import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
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

@Entity('issue_reports')
export class IssueReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

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

  @Column({ nullable: true })
  issueCategory: string; // The chosen predefined issue

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reported_by' })
  reporter: User;

  @Column({ name: 'reported_by', nullable: true })
  reportedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[]; // URLs to images

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
