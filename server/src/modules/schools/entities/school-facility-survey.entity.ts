import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { School } from './school.entity';

export enum ComplianceLevel {
  COMPLIANT = 'compliant',
  PARTIAL = 'partial',
  NON_COMPLIANT = 'non_compliant',
}

@Entity('school_facility_surveys')
@Unique(['school', 'facilityId', 'itemId'])
export class SchoolFacilitySurvey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column()
  schoolId: string;

  @Column()
  facilityId: string;

  @Column()
  itemId: string;

  @Column({
    type: 'enum',
    enum: ComplianceLevel,
    default: ComplianceLevel.NON_COMPLIANT,
  })
  compliance: ComplianceLevel;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  inspectedBy: string;

  @Column({ nullable: true })
  inspectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
