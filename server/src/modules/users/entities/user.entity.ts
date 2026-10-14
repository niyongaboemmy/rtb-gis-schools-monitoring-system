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
   * Matching is done on verified email; this records the link. Not exposed
   * in API responses beyond "linked or not" (see AuthService.publicUser). */
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

  // ── Password policy (WS10.1–10.3) ─────────────────────────────────────────

  /** bcrypt hashes of the previous passwords, newest first (max 5). */
  @Column({ type: 'jsonb', nullable: true, select: false })
  passwordHistory: string[] | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt: Date | null;

  /** Set for admin-created / imported accounts; cleared by a password change. */
  @Column({ type: 'boolean', default: false })
  mustChangePassword: boolean;

  // ── Lockout (WS9.5) ───────────────────────────────────────────────────────

  /** Consecutive failed sign-in attempts (password or second factor). */
  @Column({ type: 'int', default: 0, select: false })
  failedLoginCount: number;

  @Column({ type: 'timestamp', nullable: true, select: false })
  lockedUntil: Date | null;

  // ── Two-factor authentication (WS10.5–10.8) ───────────────────────────────

  @Column({ type: 'boolean', default: false })
  totpEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  totpEnabledAt: Date | null;

  /** AES-256-GCM encrypted TOTP seed (see common/security/crypto.ts). */
  @Column({ type: 'varchar', nullable: true, select: false })
  totpSecretEnc: string | null;

  /** Seed generated during enrolment, promoted once a code confirms it. */
  @Column({ type: 'varchar', nullable: true, select: false })
  totpPendingSecretEnc: string | null;

  /** Last accepted 30 s time-step — stops a code being replayed. */
  @Column({ type: 'bigint', nullable: true, select: false })
  totpLastUsedStep: string | null;

  /** SHA-256 hashes of the unused single-use recovery codes. */
  @Column({ type: 'jsonb', nullable: true, select: false })
  totpRecoveryCodes: string[] | null;

  /** Email-code second factor: SHA-256 of the code, expiry and guesses. */
  @Column({ type: 'varchar', nullable: true, select: false })
  mfaEmailOtpHash: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  mfaEmailOtpExpiresAt: Date | null;

  @Column({ type: 'int', default: 0, select: false })
  mfaEmailOtpAttempts: number;

  // ── Google link (WS10.9) ──────────────────────────────────────────────────

  /** Set when the user unlinks Google; blocks auto re-linking by email. */
  @Column({ type: 'timestamp', nullable: true })
  googleUnlinkedAt: Date | null;

  // ── Privacy notice (WS8.7) ────────────────────────────────────────────────

  @Column({ type: 'timestamp', nullable: true })
  privacyAcceptedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  privacyVersion: string | null;

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
