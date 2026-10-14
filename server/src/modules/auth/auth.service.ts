import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa.dto';
import { MailService } from '../mail/mail.service';
import { AuditService, type AuditEntry } from '../audit/audit.service';
import { SessionsService } from './sessions.service';
import { MfaService, type SecondFactor } from './mfa.service';
import { PasswordService } from './password.service';
import { deriveKey } from '../../common/security/crypto';
import {
  INVALID_CREDENTIALS,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  MFA_TOKEN_TTL_SECONDS,
  PRIVACY_NOTICE_VERSION,
} from './auth.constants';
import type { RequestMeta } from './request-meta';

/** How long an emailed verification code stays valid. */
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Wrong guesses allowed before the code is discarded. */
const MAX_OTP_ATTEMPTS = 5;

/** Columns that must never leave the server. */
const PRIVATE_USER_FIELDS = [
  'password',
  'refreshToken',
  'passwordResetToken',
  'passwordResetExpiresAt',
  'passwordResetAttempts',
  'passwordHistory',
  'failedLoginCount',
  'lockedUntil',
  'totpSecretEnc',
  'totpPendingSecretEnc',
  'totpLastUsedStep',
  'totpRecoveryCodes',
  'mfaEmailOtpHash',
  'mfaEmailOtpExpiresAt',
  'mfaEmailOtpAttempts',
  'googleId',
] as const;

export type SignInMethod = 'password' | 'google';

interface MfaTokenPayload {
  sub: string;
  purpose: 'mfa';
  stage: 'verify' | 'enroll';
  method: SignInMethod;
  jti: string;
}

/** Result of a completed sign-in; the controller moves `refreshToken` into a cookie. */
export interface SessionResult {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export type LoginResult =
  | SessionResult
  | {
      mfaRequired: true;
      mfaToken: string;
      methods: ('totp' | 'recovery' | 'email')[];
    }
  | { mfaEnrollmentRequired: true; mfaToken: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Lazily built so a missing GOOGLE_CLIENT_ID never blocks server start. */
  private googleClient: OAuth2Client | null = null;

  /** Redeemed MFA token ids (single instance; entries expire with the token). */
  private readonly usedMfaTokens = new Map<string, number>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly sessionsService: SessionsService,
    private readonly mfaService: MfaService,
    private readonly passwordService: PasswordService,
  ) {}

  // ── Password sign-in ─────────────────────────────────────────────────────

  async login(
    loginDto: LoginDto,
    meta: RequestMeta = {},
  ): Promise<LoginResult> {
    const email = this.normaliseEmail(loginDto.email);

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.password')
      .addSelect('user.location')
      .addSelect('user.failedLoginCount')
      .addSelect('user.lockedUntil')
      .where('user.email = :email', { email })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user) {
      this.audit({
        action: 'auth.login_failed',
        outcome: 'failure',
        targetType: 'user',
        meta: { reason: 'unknown_user', email },
        request: meta,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (this.isLocked(user)) {
      this.audit({
        action: 'auth.login_failed',
        outcome: 'denied',
        actor: { id: user.id, email: user.email },
        targetType: 'user',
        targetId: user.id,
        meta: { reason: 'locked' },
        request: meta,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const isPasswordValid = await user.validatePassword(loginDto.password);
    if (!isPasswordValid) {
      await this.registerFailure(user, 'bad_password', meta);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.completePrimaryAuth(user, 'password', meta);
  }

  /**
   * First factor passed. Decides whether a second factor (or enrolment) is
   * needed before a session is issued.
   */
  private async completePrimaryAuth(
    user: User,
    method: SignInMethod,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    if (user.totpEnabled) {
      return {
        mfaRequired: true,
        mfaToken: await this.signMfaToken(user.id, 'verify', method),
        methods: ['totp', 'recovery', 'email'],
      };
    }
    if (this.mfaService.isRequiredFor(user)) {
      return {
        mfaEnrollmentRequired: true,
        mfaToken: await this.signMfaToken(user.id, 'enroll', method),
      };
    }
    return this.issueSession(user, method, meta);
  }

  /** Creates a device session, clears failure counters and audits the login. */
  private async issueSession(
    user: User,
    method: SignInMethod | 'mfa',
    meta: RequestMeta,
    extraMeta: Record<string, unknown> = {},
  ): Promise<SessionResult> {
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    });

    const { session, refreshToken } = await this.sessionsService.create(
      user.id,
      meta,
      method,
    );
    const accessToken = await this.signAccessToken(user, session.id);

    this.audit({
      action: method === 'google' ? 'auth.google_login' : 'auth.login',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      meta: { method, ...extraMeta },
      request: { ...meta, sessionId: session.id },
    });

    return {
      user: this.publicUser(user),
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }

  // ── Second factor ────────────────────────────────────────────────────────

  async verifyMfa(dto: MfaVerifyDto, meta: RequestMeta = {}) {
    const payload = await this.readMfaToken(dto.mfaToken);
    const user = await this.loadForMfa(payload.sub);

    const factor: SecondFactor | null = dto.code
      ? { kind: 'totp', code: dto.code }
      : dto.recoveryCode
        ? { kind: 'recovery', code: dto.recoveryCode }
        : dto.emailCode
          ? { kind: 'email', code: dto.emailCode }
          : null;
    if (!factor) throw new BadRequestException('Enter a verification code.');
    if (payload.stage === 'enroll' && factor.kind !== 'email')
      throw new BadRequestException('Set up your authenticator app first.');

    const ok = await this.mfaService.verify(user.id, factor);
    if (!ok) {
      await this.registerFailure(user, `mfa_invalid_${factor.kind}`, meta);
      throw new UnauthorizedException('That code is not valid or has expired.');
    }

    this.consumeMfaToken(payload);
    if (factor.kind === 'recovery')
      this.audit({
        action: 'auth.mfa_recovery_used',
        actor: { id: user.id, email: user.email },
        targetType: 'user',
        targetId: user.id,
        request: meta,
      });
    return this.issueSession(user, payload.method, meta, { mfa: factor.kind });
  }

  /** Emails a sign-in code as an alternative to the authenticator app. */
  async sendMfaEmailCode(mfaToken: string, meta: RequestMeta = {}) {
    const payload = await this.readMfaToken(mfaToken);
    const user = await this.loadForMfa(payload.sub);
    try {
      const result = await this.mfaService.sendEmailCode(user);
      this.audit({
        action: 'auth.mfa_email_sent',
        actor: { id: user.id, email: user.email },
        targetType: 'user',
        targetId: user.id,
        request: meta,
      });
      return {
        message: `A sign-in code was sent to ${this.maskEmail(user.email)}.`,
        ...result,
      };
    } catch {
      throw new ServiceUnavailableException(
        'We could not send the email right now. Please try again in a moment.',
      );
    }
  }

  /** Enrolment during sign-in, for users that 2FA is mandatory for. */
  async startMfaEnrolment(mfaToken: string) {
    const payload = await this.readMfaToken(mfaToken, 'enroll');
    await this.loadForMfa(payload.sub);
    return this.mfaService.startEnrolment(payload.sub);
  }

  async confirmMfaEnrolment(
    mfaToken: string,
    code: string,
    meta: RequestMeta = {},
  ) {
    const payload = await this.readMfaToken(mfaToken, 'enroll');
    const user = await this.loadForMfa(payload.sub);
    let recoveryCodes: string[];
    try {
      ({ recoveryCodes } = await this.mfaService.confirmEnrolment(
        user.id,
        code,
      ));
    } catch (err) {
      await this.registerFailure(user, 'mfa_invalid_enroll', meta);
      throw err;
    }
    this.consumeMfaToken(payload);
    this.audit({
      action: 'auth.mfa_enabled',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      meta: { during: 'login' },
      request: meta,
    });
    void this.notify(user, 'Two-factor authentication turned on', [
      'Two-factor authentication was turned on for your account.',
    ]);
    const session = await this.issueSession(user, payload.method, meta, {
      mfa: 'enroll',
    });
    return { ...session, recoveryCodes };
  }

  // ── Session refresh / logout ─────────────────────────────────────────────

  /**
   * Rotates the refresh cookie. A legacy body token (pre-cookie clients) is
   * accepted once and converted into a session so nobody is signed out by
   * the upgrade.
   */
  async refresh(
    cookieToken: string | undefined,
    legacy: { userId?: string; refreshToken?: string } = {},
    meta: RequestMeta = {},
  ): Promise<SessionResult> {
    if (cookieToken) {
      const rotated = await this.sessionsService.rotate(cookieToken, meta);
      const user = await this.loadActiveUser(rotated.userId);
      if (!user) {
        await this.sessionsService.revoke(rotated.sessionId, 'inactive');
        throw new UnauthorizedException('Access denied');
      }
      return {
        user: this.publicUser(user),
        accessToken: await this.signAccessToken(user, rotated.sessionId),
        refreshToken: rotated.refreshToken,
        sessionId: rotated.sessionId,
      };
    }

    if (legacy.userId && legacy.refreshToken)
      return this.refreshLegacy(legacy.userId, legacy.refreshToken, meta);

    throw new UnauthorizedException('Access denied');
  }

  private async refreshLegacy(
    userId: string,
    token: string,
    meta: RequestMeta,
  ) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.refreshToken')
      .addSelect('user.location')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access denied');
    const isTokenValid = await bcrypt.compare(token, user.refreshToken);
    if (!isTokenValid) throw new UnauthorizedException('Access denied');

    // One-way migration: the legacy token is spent, a session takes over.
    await this.userRepository.update(user.id, { refreshToken: null });
    const { session, refreshToken } = await this.sessionsService.create(
      user.id,
      meta,
      'legacy',
    );
    return {
      user: this.publicUser(user),
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      sessionId: session.id,
    };
  }

  /** Revokes the cookie's session. Works with an expired access token. */
  async logout(
    cookieToken: string | undefined,
    meta: RequestMeta = {},
    fallbackUserId?: string,
  ) {
    const payload = cookieToken
      ? await this.sessionsService.peek(cookieToken)
      : null;
    if (payload) await this.sessionsService.revoke(payload.sid, 'logout');
    const userId = payload?.sub ?? fallbackUserId;
    if (userId) {
      // Also retire any pre-session legacy token.
      await this.userRepository.update(userId, { refreshToken: null });
      this.audit({
        action: 'auth.logout',
        actor: { id: userId },
        targetType: 'user',
        targetId: userId,
        request: { ...meta, sessionId: payload?.sid },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const rows = await this.sessionsService.listActive(userId);
    return rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      method: s.method,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(user: User, sessionId: string, meta: RequestMeta = {}) {
    const ok = await this.sessionsService.revokeOwn(user.id, sessionId, 'user');
    if (!ok) throw new NotFoundException('Session not found');
    this.audit({
      action: 'auth.session_revoked',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      meta: { sessionId },
      request: meta,
    });
    return { success: true };
  }

  async revokeOtherSessions(
    user: User,
    currentSessionId: string | undefined,
    meta: RequestMeta = {},
  ) {
    await this.sessionsService.revokeAll(
      user.id,
      'user_others',
      currentSessionId,
    );
    await this.userRepository.update(user.id, { refreshToken: null });
    this.audit({
      action: 'auth.session_revoked',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      meta: { scope: 'others' },
      request: meta,
    });
    return { success: true };
  }

  // ── Google ───────────────────────────────────────────────────────────────

  /**
   * Signs in with a Google ID token. The token is verified against Google's
   * public keys and our client id, so the client cannot forge an identity.
   *
   * Unknown addresses self-register with GOOGLE_DEFAULT_ROLE only when
   * GOOGLE_ALLOW_SELF_REGISTER is not "false" and the domain is in
   * GOOGLE_ALLOWED_DOMAINS (when set). Users with 2FA still pass the second
   * factor afterwards.
   */
  async loginWithGoogle(
    idToken: string,
    meta: RequestMeta = {},
  ): Promise<LoginResult> {
    const payload = await this.verifyGoogleIdToken(idToken);

    const email = this.normaliseEmail(payload.email ?? '');
    if (!email) throw new UnauthorizedException('Google account has no email');

    // Google asserts this; without it the address is unproven and could be
    // used to hijack an existing account that shares the same email.
    if (!payload.email_verified)
      throw new UnauthorizedException(
        'Your Google email address is not verified.',
      );

    let user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.lockedUntil')
      .addSelect('user.failedLoginCount')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      this.assertGoogleSelfRegistration(email, meta);
      user = await this.createUserFromGoogle(email, payload);
    } else {
      if (!user.isActive)
        throw new ForbiddenException(
          'This account is deactivated. Contact an administrator to restore access.',
        );
      if (user.googleUnlinkedAt)
        throw new ForbiddenException(
          'Google sign-in is turned off for this account. Sign in with your password, then link Google from your profile.',
        );
      if (user.googleId && user.googleId !== payload.sub)
        throw new UnauthorizedException(
          'This account is linked to a different Google identity.',
        );
      if (this.isLocked(user))
        throw new UnauthorizedException(INVALID_CREDENTIALS);
      // Backfill the link and avatar on an account created by other means.
      const patch: Partial<User> = {};
      if (!user.googleId) patch.googleId = payload.sub;
      if (!user.avatarUrl && payload.picture) patch.avatarUrl = payload.picture;
      if (Object.keys(patch).length) {
        await this.userRepository.update(user.id, patch);
        Object.assign(user, patch);
      }
    }

    return this.completePrimaryAuth(user, 'google', meta);
  }

  /** Links a Google identity to the signed-in account (same email only). */
  async linkGoogle(user: User, idToken: string, meta: RequestMeta = {}) {
    const payload = await this.verifyGoogleIdToken(idToken);
    const email = this.normaliseEmail(payload.email ?? '');
    if (!payload.email_verified || email !== this.normaliseEmail(user.email))
      throw new BadRequestException(
        'Use the Google account whose verified email matches your RTB GIS email.',
      );
    const other = await this.userRepository.findOne({
      where: { googleId: payload.sub },
    });
    if (other && other.id !== user.id)
      throw new ConflictException(
        'That Google account is linked to another user.',
      );
    await this.userRepository.update(user.id, {
      googleId: payload.sub,
      googleUnlinkedAt: null,
    });
    this.audit({
      action: 'auth.google_linked',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: meta,
    });
    return { googleLinked: true };
  }

  /** Unlinks Google; sign-in by Google is refused until re-linked. */
  async unlinkGoogle(user: User, meta: RequestMeta = {}) {
    await this.userRepository.update(user.id, {
      googleId: null,
      googleUnlinkedAt: new Date(),
    });
    this.audit({
      action: 'auth.google_unlinked',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: meta,
    });
    return { googleLinked: false };
  }

  private assertGoogleSelfRegistration(email: string, meta: RequestMeta) {
    const allowSelf =
      this.configService
        .get<string>('GOOGLE_ALLOW_SELF_REGISTER')
        ?.trim()
        .toLowerCase() !== 'false';
    const domains = (
      this.configService.get<string>('GOOGLE_ALLOWED_DOMAINS') ?? ''
    )
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    const domain = email.split('@')[1] ?? '';

    const reason = !allowSelf
      ? 'self_register_disabled'
      : domains.length && !domains.includes(domain)
        ? 'domain_not_allowed'
        : null;
    if (!reason) return;

    this.audit({
      action: 'auth.google_register_denied',
      outcome: 'denied',
      targetType: 'user',
      meta: { email, reason },
      request: meta,
    });
    throw new ForbiddenException(
      reason === 'domain_not_allowed'
        ? `Google sign-in is limited to ${domains.map((d) => '@' + d).join(', ')} addresses. Ask an administrator for an account.`
        : 'No account exists for this Google address. Ask an administrator to create one.',
    );
  }

  // ── Forgot / reset password ──────────────────────────────────────────────

  private get genericForgotResponse() {
    return (
      this.configService
        .get<string>('FORGOT_PASSWORD_GENERIC_RESPONSE')
        ?.trim()
        .toLowerCase() === 'true'
    );
  }

  /**
   * Emails a 6-digit verification code.
   *
   * By default this tells the caller when no account matches, and only
   * reports success once the mail actually left the server — a product
   * decision trading user-enumeration resistance for clear feedback, with
   * the 3-per-minute throttle limiting abuse. FORGOT_PASSWORD_GENERIC_RESPONSE
   * =true switches to one identical answer for every address (WS9.10).
   */
  async forgotPassword(email: string, meta: RequestMeta = {}) {
    const normalised = this.normaliseEmail(email);
    const generic = this.genericForgotResponse;
    const genericBody = {
      message:
        'If an account exists for that address, a verification code has been sent.',
      email: normalised,
      expiresInMinutes: OTP_TTL_MS / 60000,
      delivered: true,
    };

    const user = await this.userRepository.findOne({
      where: { email: normalised },
    });
    if (!user) {
      if (generic) return genericBody;
      throw new NotFoundException(
        `No account found for ${normalised}. Check the address or contact an administrator.`,
      );
    }
    if (!user.isActive) {
      if (generic) return genericBody;
      throw new ForbiddenException(
        'This account is deactivated. Contact an administrator to restore access.',
      );
    }

    try {
      await this.issueResetCode(user);
    } catch (err) {
      if (generic) {
        this.logger.error(`Reset email failed for user ${user.id}`);
        return genericBody;
      }
      throw err;
    }

    this.audit({
      action: 'auth.password_reset_requested',
      targetType: 'user',
      targetId: user.id,
      subjectUserId: user.id,
      meta: { email: user.email },
      request: meta,
    });

    if (generic) return genericBody;
    return {
      message: `Verification code sent to ${user.email}.`,
      email: user.email,
      expiresInMinutes: OTP_TTL_MS / 60000,
      // False in local dev without SMTP — the code is in the server log.
      delivered: this.mailService.isConfigured,
    };
  }

  /** Admin "send reset code" (WS10.4). */
  async sendAdminReset(
    userId: string,
    actor: { id: string; email: string },
    meta: RequestMeta = {},
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive)
      throw new BadRequestException(
        'Reactivate the account before sending a reset code.',
      );
    await this.issueResetCode(user, true);
    this.audit({
      action: 'user.send_reset',
      actor,
      targetType: 'user',
      targetId: user.id,
      targetLabel: user.email,
      subjectUserId: user.id,
      request: meta,
    });
    return {
      message: `A reset code was emailed to ${user.email}.`,
      delivered: this.mailService.isConfigured,
      expiresInMinutes: OTP_TTL_MS / 60000,
    };
  }

  /** Stores a fresh hashed code and emails it. Throws 503 if the mail fails. */
  private async issueResetCode(user: User, requestedByAdmin = false) {
    // randomInt is CSPRNG-backed; Math.random would be guessable.
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    // Only the SHA-256 hash is persisted, so a database leak cannot be
    // replayed against this endpoint. Issuing a code resets the attempt
    // counter, so a legitimate re-request clears an earlier lock-out.
    await this.userRepository.update(user.id, {
      passwordResetToken: this.hashOtp(otp),
      passwordResetExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      passwordResetAttempts: 0,
    });

    try {
      await this.mailService.sendPasswordResetOtp(
        user.email,
        user.firstName,
        otp,
        OTP_TTL_MS / 60000,
        { requestedByAdmin, resetUrl: this.resetUrl(user.email) },
      );
    } catch {
      // Never leave a live code behind for an email nobody received.
      await this.clearOtp(user.id);
      throw new ServiceUnavailableException(
        'We could not send the email right now. Please try again in a moment.',
      );
    }
  }

  private resetUrl(email: string): string | undefined {
    const base =
      this.configService.get<string>('APP_PUBLIC_URL')?.trim() ||
      (this.configService.get<string>('APP_CORS_ORIGINS') ?? '')
        .split(',')[0]
        ?.trim();
    if (!base) return undefined;
    return `${base.replace(/\/$/, '')}/forgot-password?email=${encodeURIComponent(email)}`;
  }

  /**
   * Checks a code without consuming it, so the UI can advance to the
   * new-password step. A wrong code still burns an attempt.
   */
  async verifyResetOtp(email: string, otp: string) {
    await this.consumeOtpAttempt(email, otp);
    return { valid: true };
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
    meta: RequestMeta = {},
  ) {
    const user = await this.consumeOtpAttempt(email, otp);

    // Policy + history; also clears lockout and the forced-change flag.
    await this.passwordService.setPassword(user.id, newPassword);
    await this.userRepository.update(user.id, {
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      passwordResetAttempts: 0,
      // Force re-authentication everywhere — a reset invalidates live sessions.
      refreshToken: null,
    });
    await this.sessionsService.revokeAll(user.id, 'password_reset');

    this.audit({
      action: 'auth.password_reset',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: meta,
    });

    return { message: 'Password updated. You can now sign in.' };
  }

  /** Self-service change (WS10.2): verify, apply policy, sign out other devices. */
  async changePassword(
    user: Pick<User, 'id' | 'email' | 'firstName'>,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
    meta: RequestMeta = {},
  ) {
    if (!(await this.passwordService.verifyCurrent(user.id, currentPassword))) {
      this.audit({
        action: 'auth.password_change_failed',
        outcome: 'failure',
        actor: { id: user.id, email: user.email },
        targetType: 'user',
        targetId: user.id,
        meta: { reason: 'bad_current_password' },
        request: meta,
      });
      throw new BadRequestException('Your current password is incorrect.');
    }
    await this.passwordService.setPassword(user.id, newPassword);
    await this.sessionsService.revokeAll(
      user.id,
      'password_change',
      currentSessionId,
    );
    await this.userRepository.update(user.id, { refreshToken: null });

    this.audit({
      action: 'auth.password_changed',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: { ...meta, sessionId: currentSessionId },
    });
    void this.notify(user, 'Your password was changed', [
      `The password for ${user.email} was changed on ${new Date().toUTCString()}${meta.ip ? ` from IP ${meta.ip}` : ''}.`,
      'Other signed-in devices were signed out.',
    ]);
    return { success: true, message: 'Password updated successfully' };
  }

  // ── Profile 2FA management ───────────────────────────────────────────────

  setupMfa(userId: string) {
    return this.mfaService.startEnrolment(userId);
  }

  async enableMfa(user: User, code: string, meta: RequestMeta = {}) {
    const result = await this.mfaService.confirmEnrolment(user.id, code);
    this.audit({
      action: 'auth.mfa_enabled',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: meta,
    });
    void this.notify(user, 'Two-factor authentication turned on', [
      'Two-factor authentication was turned on for your account.',
    ]);
    return result;
  }

  async disableMfa(
    user: User,
    password: string,
    code: string,
    meta: RequestMeta = {},
  ) {
    if (this.mfaService.isRequiredFor(user))
      throw new ForbiddenException(
        'Two-factor authentication is mandatory for your role and cannot be turned off.',
      );
    await this.mfaService.disable(user.id, password, code);
    this.audit({
      action: 'auth.mfa_disabled',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: meta,
    });
    void this.notify(user, 'Two-factor authentication turned off', [
      'Two-factor authentication was turned off for your account.',
    ]);
    return { success: true };
  }

  async regenerateRecoveryCodes(
    user: User,
    code: string,
    meta: RequestMeta = {},
  ) {
    const result = await this.mfaService.regenerateRecoveryCodes(user.id, code);
    this.audit({
      action: 'auth.mfa_recovery_regenerated',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      request: meta,
    });
    return result;
  }

  mfaStatus(user: User) {
    return this.mfaService.status(user.id).then((s) => ({
      ...s,
      required: this.mfaService.isRequiredFor(user),
    }));
  }

  /** Admin reset of a user's 2FA (WS10.7). Also signs them out everywhere. */
  async adminResetMfa(
    userId: string,
    actor: { id: string; email: string },
    meta: RequestMeta = {},
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.mfaService.clear(userId);
    await this.sessionsService.revokeAll(userId, 'mfa_reset');
    this.audit({
      action: 'auth.mfa_reset',
      actor,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      subjectUserId: userId,
      request: meta,
    });
    void this.notify(user, 'Two-factor authentication was reset', [
      'An administrator reset two-factor authentication on your account. You will be asked to set it up again at your next sign-in if your role requires it.',
    ]);
    return { success: true };
  }

  // ── Privacy notice (WS8.7) ───────────────────────────────────────────────

  async acceptPrivacy(user: User, version: string, meta: RequestMeta = {}) {
    if (version !== PRIVACY_NOTICE_VERSION)
      throw new BadRequestException(
        'Please reload the page to see the current privacy notice.',
      );
    const acceptedAt = new Date();
    await this.userRepository.update(user.id, {
      privacyAcceptedAt: acceptedAt,
      privacyVersion: version,
    });
    this.audit({
      action: 'auth.privacy_accepted',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      meta: { version },
      request: meta,
    });
    return { privacyAcceptedAt: acceptedAt, privacyVersion: version };
  }

  // ── Users & tokens ───────────────────────────────────────────────────────

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: ['role', 'role.accessLevel'],
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return user;
  }

  /** The user as returned to clients: no secrets, plus derived flags. */
  publicUser(user: User): Record<string, unknown> {
    const out: Record<string, unknown> = { ...user };
    for (const key of PRIVATE_USER_FIELDS) delete out[key];
    out.googleLinked = !!user.googleId;
    out.mfaRequired = this.mfaService.isRequiredFor(user);
    out.privacyNoticeVersion = PRIVACY_NOTICE_VERSION;
    return out;
  }

  private loadActiveUser(userId: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.location')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
  }

  private async loadForMfa(userId: string): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.location')
      .addSelect('user.failedLoginCount')
      .addSelect('user.lockedUntil')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
    if (!user)
      throw new UnauthorizedException(
        'Your sign-in expired. Please start again.',
      );
    if (this.isLocked(user))
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    return user;
  }

  private signAccessToken(user: User, sessionId: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  /**
   * The MFA token is signed with a key derived from JWT_SECRET for this one
   * purpose, so it can never verify as an access token (and JwtStrategy also
   * rejects any token carrying `purpose`).
   */
  private get mfaSecret(): string {
    return deriveKey(
      this.configService.get<string>('JWT_SECRET') ?? '',
      'rtb-gis/mfa-token/v1',
    ).toString('hex');
  }

  private signMfaToken(
    userId: string,
    stage: MfaTokenPayload['stage'],
    method: SignInMethod,
  ) {
    const payload: MfaTokenPayload = {
      sub: userId,
      purpose: 'mfa',
      stage,
      method,
      jti: crypto.randomUUID(),
    };
    return this.jwtService.signAsync(payload, {
      secret: this.mfaSecret,
      expiresIn: MFA_TOKEN_TTL_SECONDS,
    });
  }

  private async readMfaToken(token: string, stage?: MfaTokenPayload['stage']) {
    const expired = () =>
      new UnauthorizedException('Your sign-in expired. Please start again.');
    let payload: MfaTokenPayload & { exp?: number };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.mfaSecret,
      });
    } catch {
      throw expired();
    }
    if (payload?.purpose !== 'mfa' || !payload.sub || !payload.jti)
      throw expired();
    if (stage && payload.stage !== stage) throw expired();
    if (this.usedMfaTokens.has(payload.jti)) throw expired();
    return payload;
  }

  private consumeMfaToken(payload: MfaTokenPayload & { exp?: number }) {
    const now = Date.now();
    for (const [jti, exp] of this.usedMfaTokens)
      if (exp < now) this.usedMfaTokens.delete(jti);
    this.usedMfaTokens.set(
      payload.jti,
      (payload.exp ?? now / 1000 + MFA_TOKEN_TTL_SECONDS) * 1000,
    );
  }

  // ── Lockout ──────────────────────────────────────────────────────────────

  private isLocked(user: Pick<User, 'lockedUntil'>) {
    return (
      !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()
    );
  }

  /** Counts a failed password or second-factor attempt; locks at the limit. */
  private async registerFailure(
    user: Pick<User, 'id' | 'email' | 'failedLoginCount'>,
    reason: string,
    meta: RequestMeta,
  ) {
    const count = (user.failedLoginCount ?? 0) + 1;
    const lock = count >= MAX_FAILED_LOGINS;
    await this.userRepository.update(user.id, {
      failedLoginCount: lock ? 0 : count,
      ...(lock
        ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : {}),
    });
    (user as { failedLoginCount: number }).failedLoginCount = lock ? 0 : count;

    this.audit({
      action: 'auth.login_failed',
      outcome: 'failure',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      meta: { reason, attempt: count },
      request: meta,
    });
    if (lock)
      this.audit({
        action: 'auth.account_locked',
        outcome: 'denied',
        actor: { id: user.id, email: user.email },
        targetType: 'user',
        targetId: user.id,
        subjectUserId: user.id,
        meta: { minutes: LOCK_MINUTES, reason },
        request: meta,
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private audit(entry: AuditEntry) {
    this.auditService.record(entry);
  }

  /** Security notice emails fail soft: the action already happened. */
  private async notify(
    user: Pick<User, 'email' | 'firstName'>,
    subject: string,
    lines: string[],
  ) {
    try {
      await this.mailService.sendSecurityNotice(
        user.email,
        user.firstName,
        subject,
        lines,
      );
    } catch {
      this.logger.warn(`Could not send "${subject}" notice`);
    }
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }

  /** Verifies the ID token's signature, audience and expiry with Google. */
  private async verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId)
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server.',
      );

    this.googleClient ??= new OAuth2Client(clientId);

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('empty payload');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired Google sign-in.');
    }
  }

  /** Self-registers a Google identity with the configured default role. */
  private async createUserFromGoogle(email: string, payload: TokenPayload) {
    const roleName = this.configService
      .get<string>('GOOGLE_DEFAULT_ROLE', 'viewer')
      .trim();
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });
    if (!role)
      throw new ServiceUnavailableException(
        `Default role "${roleName}" is missing. Ask an administrator to seed roles.`,
      );

    // `password` is NOT NULL, and these accounts never sign in with one. A
    // random secret keeps password login unusable until the user resets it.
    const user = this.userRepository.create({
      email,
      firstName: payload.given_name || email.split('@')[0],
      lastName: payload.family_name || '',
      password: crypto.randomBytes(48).toString('hex'),
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
      isActive: true,
      role,
    } as Partial<User>);

    const saved = await this.userRepository.save(user);
    this.audit({
      action: 'auth.google_register',
      actor: { id: saved.id, email },
      targetType: 'user',
      targetId: saved.id,
      meta: { email, role: roleName },
    });
    return saved;
  }

  private normaliseEmail(email: string) {
    return (email ?? '').trim().toLowerCase();
  }

  private hashOtp(otp: string) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Validates a code against the stored hash. A 6-digit code is only 1M wide,
   * so every failure burns one of MAX_OTP_ATTEMPTS; exhausting them discards
   * the code entirely and the user must request a new one.
   *
   * Returns the user on success and throws otherwise. Every failure path uses
   * one identical message so the endpoint cannot be used to enumerate
   * accounts or tell "wrong code" from "no code pending".
   */
  private async consumeOtpAttempt(email: string, otp: string): Promise<User> {
    const invalid = () =>
      new BadRequestException(
        'That code is invalid or has expired. Please request a new one.',
      );

    if (!/^\d{6}$/.test(otp?.trim() ?? '')) throw invalid();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetToken')
      .addSelect('user.passwordResetExpiresAt')
      .addSelect('user.passwordResetAttempts')
      .where('user.email = :email', { email: this.normaliseEmail(email) })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user?.passwordResetToken || !user.passwordResetExpiresAt)
      throw invalid();

    if (user.passwordResetExpiresAt.getTime() <= Date.now()) {
      await this.clearOtp(user.id);
      throw invalid();
    }

    if ((user.passwordResetAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await this.clearOtp(user.id);
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    if (!this.matchesHash(this.hashOtp(otp.trim()), user.passwordResetToken)) {
      await this.userRepository.update(user.id, {
        passwordResetAttempts: (user.passwordResetAttempts ?? 0) + 1,
      });
      throw invalid();
    }

    return user;
  }

  /** Constant-time comparison of two hex digests of equal length. */
  private matchesHash(a: string, b: string) {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  private async clearOtp(userId: string) {
    await this.userRepository.update(userId, {
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      passwordResetAttempts: 0,
    });
  }
}
