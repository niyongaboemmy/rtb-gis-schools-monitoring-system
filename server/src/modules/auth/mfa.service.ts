import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import {
  decryptString,
  deriveKey,
  encryptString,
  encryptedKeyId,
  hexDigestsEqual,
  parseKey,
  sha256Hex,
} from '../../common/security/crypto';
import { MFA_PRIVILEGED_PERMISSIONS } from './auth.constants';

const ISSUER = 'RTB GIS';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_EMAIL_CODE_ATTEMPTS = 5;

/** Key id stored with each ciphertext: env key vs. dev key derived from JWT_SECRET. */
const KEY_ID_ENV = 'k1';
const KEY_ID_DERIVED = 'd1';

/** RFC 6238, 30 s steps, accepting one step either side for clock drift. */
const totp = authenticator.clone({ step: 30, window: 1 });

export type SecondFactor =
  | { kind: 'totp'; code: string }
  | { kind: 'recovery'; code: string }
  | { kind: 'email'; code: string };

/**
 * TOTP two-factor authentication, recovery codes and the email-code fallback
 * (WS10.5–10.8). Secrets are AES-256-GCM encrypted at rest.
 */
@Injectable()
export class MfaService implements OnModuleInit {
  private readonly logger = new Logger(MfaService.name);
  private envKey: Buffer | null = null;
  private derivedKey: Buffer | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Resolves the encryption key at boot. A malformed key always fails boot;
   * a missing key fails boot in production and falls back to a key derived
   * from JWT_SECRET (with a warning) everywhere else.
   */
  onModuleInit() {
    const raw = this.configService.get<string>('TOTP_ENCRYPTION_KEY')?.trim();
    if (raw) {
      this.envKey = parseKey(raw, 'TOTP_ENCRYPTION_KEY');
      return;
    }
    if (this.configService.get<string>('NODE_ENV') === 'production')
      throw new Error(
        'TOTP_ENCRYPTION_KEY is required in production (32 bytes: openssl rand -hex 32).',
      );
    this.logger.warn(
      'TOTP_ENCRYPTION_KEY not set — deriving the 2FA encryption key from JWT_SECRET (development only).',
    );
  }

  // ── Policy ────────────────────────────────────────────────────────────────

  /** MFA_ENFORCE_PRIVILEGED, default on in production and off elsewhere. */
  get enforcePrivileged(): boolean {
    const raw = this.configService
      .get<string>('MFA_ENFORCE_PRIVILEGED')
      ?.trim()
      .toLowerCase();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /** True when the user's role holds a permission that requires 2FA. */
  isPrivileged(user: Pick<User, 'role'>): boolean {
    const perms: string[] =
      (user.role as { permissions?: string[] } | null)?.permissions ?? [];
    return perms.some((p) => MFA_PRIVILEGED_PERMISSIONS.includes(p));
  }

  /** True when this user must have TOTP before receiving a session. */
  isRequiredFor(user: Pick<User, 'role'>): boolean {
    return this.enforcePrivileged && this.isPrivileged(user);
  }

  // ── Enrolment ─────────────────────────────────────────────────────────────

  /** Generates a pending secret and returns what the authenticator app needs. */
  async startEnrolment(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.totpEnabled)
      throw new BadRequestException(
        'Two-factor authentication is already on. Turn it off first to re-enrol.',
      );

    const secret = totp.generateSecret(20);
    await this.userRepository.update(userId, {
      totpPendingSecretEnc: this.encrypt(secret),
    });
    const otpauthUrl = totp.keyuri(user.email, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      margin: 1,
      width: 240,
    });
    return { otpauthUrl, qrDataUrl, secret };
  }

  /** Confirms the pending secret with a code; returns fresh recovery codes. */
  async confirmEnrolment(userId: string, code: string) {
    const user = await this.loadSecrets(userId);
    if (!user.totpPendingSecretEnc)
      throw new BadRequestException(
        'Start the set-up again — no pending enrolment found.',
      );
    const secret = this.decrypt(user.totpPendingSecretEnc);
    const step = this.matchStep(code, secret);
    if (step === null)
      throw new BadRequestException(
        'That code is not valid. Check your device clock and try again.',
      );

    const { codes, hashes } = this.generateRecoveryCodes();
    await this.userRepository.update(userId, {
      totpEnabled: true,
      totpEnabledAt: new Date(),
      totpSecretEnc: user.totpPendingSecretEnc,
      totpPendingSecretEnc: null,
      totpLastUsedStep: String(step),
      totpRecoveryCodes: hashes,
    });
    return { recoveryCodes: codes };
  }

  /** Turns 2FA off. The caller verifies the password; this verifies a code. */
  async disable(userId: string, password: string, code: string) {
    const user = await this.loadSecrets(userId, true);
    if (!user.totpEnabled)
      throw new BadRequestException('Two-factor authentication is not on.');
    if (!(await bcrypt.compare(password ?? '', user.password)))
      throw new BadRequestException('Your password is incorrect.');
    const ok =
      (await this.verifyTotp(user, code)) ||
      (await this.useRecoveryCode(user, code));
    if (!ok) throw new BadRequestException('That code is not valid.');
    await this.clear(userId);
  }

  async regenerateRecoveryCodes(userId: string, code: string) {
    const user = await this.loadSecrets(userId);
    if (!user.totpEnabled)
      throw new BadRequestException('Two-factor authentication is not on.');
    if (!(await this.verifyTotp(user, code)))
      throw new BadRequestException('That code is not valid.');
    const { codes, hashes } = this.generateRecoveryCodes();
    await this.userRepository.update(userId, { totpRecoveryCodes: hashes });
    return { recoveryCodes: codes };
  }

  /** Removes every second-factor secret (user disable or admin reset). */
  async clear(userId: string) {
    await this.userRepository.update(userId, {
      totpEnabled: false,
      totpEnabledAt: null,
      totpSecretEnc: null,
      totpPendingSecretEnc: null,
      totpLastUsedStep: null,
      totpRecoveryCodes: null,
      mfaEmailOtpHash: null,
      mfaEmailOtpExpiresAt: null,
      mfaEmailOtpAttempts: 0,
    });
  }

  async status(userId: string) {
    const user = await this.loadSecrets(userId);
    return {
      enabled: !!user.totpEnabled,
      enabledAt: user.totpEnabledAt ?? null,
      recoveryCodesRemaining: user.totpRecoveryCodes?.length ?? 0,
    };
  }

  // ── Verification ──────────────────────────────────────────────────────────

  /** Checks one second factor for a user. Never throws on a wrong code. */
  async verify(userId: string, factor: SecondFactor): Promise<boolean> {
    const user = await this.loadSecrets(userId);
    switch (factor.kind) {
      case 'totp':
        return user.totpEnabled ? this.verifyTotp(user, factor.code) : false;
      case 'recovery':
        return user.totpEnabled
          ? this.useRecoveryCode(user, factor.code)
          : false;
      case 'email':
        return this.verifyEmailCode(user, factor.code);
    }
  }

  /** Emails a 6-digit sign-in code (fallback second factor). */
  async sendEmailCode(user: Pick<User, 'id' | 'email' | 'firstName'>) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.userRepository.update(user.id, {
      mfaEmailOtpHash: sha256Hex(code),
      mfaEmailOtpExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
      mfaEmailOtpAttempts: 0,
    });
    try {
      await this.mailService.sendLoginCode(
        user.email,
        user.firstName,
        code,
        EMAIL_CODE_TTL_MS / 60000,
      );
    } catch (err) {
      await this.userRepository.update(user.id, {
        mfaEmailOtpHash: null,
        mfaEmailOtpExpiresAt: null,
      });
      throw err;
    }
    return {
      expiresInMinutes: EMAIL_CODE_TTL_MS / 60000,
      delivered: this.mailService.isConfigured,
    };
  }

  private async verifyTotp(
    user: Pick<User, 'id' | 'totpSecretEnc' | 'totpLastUsedStep'>,
    code: string,
  ): Promise<boolean> {
    if (!user.totpSecretEnc) return false;
    const step = this.matchStep(code, this.decrypt(user.totpSecretEnc));
    if (step === null) return false;
    // Each code is single-use: reject a step at or before the last accepted.
    if (user.totpLastUsedStep != null && step <= Number(user.totpLastUsedStep))
      return false;
    await this.userRepository.update(user.id, {
      totpLastUsedStep: String(step),
    });
    return true;
  }

  private async useRecoveryCode(
    user: Pick<User, 'id' | 'totpRecoveryCodes'>,
    code: string,
  ): Promise<boolean> {
    const hashes = user.totpRecoveryCodes ?? [];
    const hash = sha256Hex(normaliseRecoveryCode(code));
    const index = hashes.findIndex((h) => hexDigestsEqual(h, hash));
    if (index < 0) return false;
    await this.userRepository.update(user.id, {
      totpRecoveryCodes: hashes.filter((_, i) => i !== index),
    });
    return true;
  }

  private async verifyEmailCode(
    user: Pick<
      User,
      'id' | 'mfaEmailOtpHash' | 'mfaEmailOtpExpiresAt' | 'mfaEmailOtpAttempts'
    >,
    code: string,
  ): Promise<boolean> {
    if (!user.mfaEmailOtpHash || !user.mfaEmailOtpExpiresAt) return false;
    const expired = user.mfaEmailOtpExpiresAt.getTime() <= Date.now();
    const exhausted =
      (user.mfaEmailOtpAttempts ?? 0) >= MAX_EMAIL_CODE_ATTEMPTS;
    if (expired || exhausted) {
      await this.userRepository.update(user.id, {
        mfaEmailOtpHash: null,
        mfaEmailOtpExpiresAt: null,
      });
      return false;
    }
    if (
      !/^\d{6}$/.test(code?.trim() ?? '') ||
      !hexDigestsEqual(sha256Hex(code.trim()), user.mfaEmailOtpHash)
    ) {
      await this.userRepository.update(user.id, {
        mfaEmailOtpAttempts: (user.mfaEmailOtpAttempts ?? 0) + 1,
      });
      return false;
    }
    await this.userRepository.update(user.id, {
      mfaEmailOtpHash: null,
      mfaEmailOtpExpiresAt: null,
      mfaEmailOtpAttempts: 0,
    });
    return true;
  }

  /** Returns the absolute 30 s step a code matches, or null. */
  private matchStep(code: string, secret: string): number | null {
    const token = (code ?? '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(token)) return null;
    const delta = totp.checkDelta(token, secret);
    if (delta === null) return null;
    return Math.floor(Date.now() / 30000) + delta;
  }

  private generateRecoveryCodes() {
    const codes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      let raw = '';
      for (let j = 0; j < 10; j++)
        raw += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    // ~49 bits each and single-use, so an unsalted SHA-256 is adequate.
    return {
      codes,
      hashes: codes.map((c) => sha256Hex(normaliseRecoveryCode(c))),
    };
  }

  private async loadSecrets(
    userId: string,
    withPassword = false,
  ): Promise<User> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.totpSecretEnc')
      .addSelect('user.totpPendingSecretEnc')
      .addSelect('user.totpLastUsedStep')
      .addSelect('user.totpRecoveryCodes')
      .addSelect('user.mfaEmailOtpHash')
      .addSelect('user.mfaEmailOtpExpiresAt')
      .addSelect('user.mfaEmailOtpAttempts')
      .where('user.id = :userId', { userId });
    if (withPassword) qb.addSelect('user.password');
    const user = await qb.getOne();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── Encryption ────────────────────────────────────────────────────────────

  private getDerivedKey(): Buffer {
    this.derivedKey ??= deriveKey(
      this.configService.get<string>('JWT_SECRET') ?? '',
      'rtb-gis/totp-secret/v1',
    );
    return this.derivedKey;
  }

  encrypt(plain: string): string {
    return this.envKey
      ? encryptString(plain, this.envKey, KEY_ID_ENV)
      : encryptString(plain, this.getDerivedKey(), KEY_ID_DERIVED);
  }

  decrypt(payload: string): string {
    const id = encryptedKeyId(payload);
    if (id === KEY_ID_ENV) {
      if (!this.envKey)
        throw new BadRequestException(
          '2FA key is not configured on this server.',
        );
      return decryptString(payload, this.envKey);
    }
    return decryptString(payload, this.getDerivedKey());
  }
}

export function normaliseRecoveryCode(code: string): string {
  return (code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
