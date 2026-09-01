import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @ManyToOne(() => Role, (role) => role.users, { eager: true, nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'jsonb', nullable: true })
  location: {
    province?: string;
    district?: string;
    sector?: string;
    schoolId?: string;
    schoolName?: string;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'varchar', nullable: true, select: false })
  refreshToken: string | null;

  /** Google's stable subject id, set once an account is linked to Google.
   * Matching is done on verified email; this records the link. */
  @Column({ type: 'varchar', nullable: true })
  googleId: string | null;

  /** SHA-256 hash of the emailed verification code — the code itself only
   * ever lives in the email, never in the database. */
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  passwordResetExpiresAt: Date | null;

  /** Wrong guesses against the current code; caps brute-force on 6 digits. */
  @Column({ type: 'int', default: 0, select: false })
  passwordResetAttempts: number;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
