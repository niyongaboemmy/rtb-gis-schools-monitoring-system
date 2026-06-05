import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ActionStatus = 'open' | 'in_progress' | 'done';

@Entity('recommendation_actions')
@Index(['schoolId'])
export class RecommendationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  schoolId: string;

  @Column('text')
  recommendation: string;

  @Column({ type: 'text', default: 'open' })
  status: ActionStatus;

  @Column({ type: 'text', nullable: true })
  assignedTo: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
