import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('score_history')
@Index(['schoolId', 'recordedAt'])
export class ScoreHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  schoolId: string;

  // All scores stored as float — parsed on write, never stored as raw strings
  @Column({ type: 'float' })
  overallScore: number;

  @Column({ type: 'float' })
  infrastructureScore: number;

  @Column({ type: 'float' })
  buildingAgeScore: number;

  @Column({ type: 'float' })
  accessibilityScore: number;

  @Column({ type: 'float' })
  populationPressureScore: number;

  @Column({ type: 'float', nullable: true })
  facilityComplianceScore: number | null;

  @Column({ type: 'float', nullable: true })
  resolutionRateScore: number | null;

  @CreateDateColumn()
  recordedAt: Date;
}
