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

export enum PriorityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('decision_assessments')
export class DecisionAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => School, (school) => school.assessments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column()
  schoolId: string;

  // Scoring components (0-100)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  infrastructureScore: number; // 35% weight

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  buildingAgeScore: number; // 25% weight

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  accessibilityScore: number; // 10% weight

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  populationPressureScore: number; // 10% weight

  @Column({ type: 'float', nullable: true, default: null })
  facilityComplianceScore: number | null; // 15% weight

  @Column({ type: 'float', nullable: true, default: null })
  resolutionRateScore: number | null; // 5% weight

  @Column({ default: false })
  hasInfraDataGap: boolean;

  @Column({ default: false })
  hasPopDataGap: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  overallScore: number; // weighted total

  @Column({ type: 'enum', enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  priorityLevel: PriorityLevel;

  // Recommendations
  @Column({ type: 'text', nullable: true })
  primaryRecommendation: string;

  @Column({ type: 'jsonb', nullable: true })
  recommendations: string[];

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  estimatedBudgetRwf: number;

  @Column({ type: 'int', nullable: true })
  urgencyMonths: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  scoreBreakdown: object;

  @Column({ nullable: true })
  assessedById: string;

  @Column({ nullable: true })
  validUntil: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
