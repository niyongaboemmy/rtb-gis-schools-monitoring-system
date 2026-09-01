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
import { User } from './user.entity';

export enum VerificationType {
  EMAIL = 'email',
  PASSWORD_RESET = 'password_reset',
  PHONE = 'phone',
}

@Entity('user_verifications')
@Index(['token'])
@Index(['userId'])
@Index(['userId', 'type'])
export class UserVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: VerificationType,
    default: VerificationType.EMAIL,
  })
  type: VerificationType;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ nullable: true })
  usedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isValid(): boolean {
    return !this.isUsed && !this.isExpired();
  }
}
