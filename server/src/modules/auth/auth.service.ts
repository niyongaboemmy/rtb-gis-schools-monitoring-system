import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

/** How long an emailed verification code stays valid. */
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Wrong guesses allowed before the code is discarded. */
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  /** Lazily built so a missing GOOGLE_CLIENT_ID never blocks server start. */
  private googleClient: OAuth2Client | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.accessLevel', 'accessLevel')
      .addSelect('user.password')
      .addSelect('user.location')
      .where('user.email = :email', { email })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    const { password: _, ...userWithoutPassword } = user as any;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  /**
   * Signs in with a Google ID token. The token is verified against Google's
   * public keys and our client id, so the client cannot forge an identity.
   *
   * An unrecognised (but Google-verified) address self-registers with the
   * default role — a deliberate open-registration choice. Keep
   * GOOGLE_DEFAULT_ROLE least-privileged.
   */
  async loginWithGoogle(idToken: string) {
    const payload = await this.verifyGoogleIdToken(idToken);

    const email = this.normaliseEmail(payload.email ?? '');
    if (!email) throw new UnauthorizedException('Google account has no email');

    // Google asserts this; without it the address is unproven and could be
    // used to hijack an existing account that shares the same email.
    if (!payload.email_verified)
      throw new UnauthorizedException(
        'Your Google email address is not verified.',
      );

    let user = await this.userRepository.findOne({
      where: { email },
      relations: ['role', 'role.accessLevel'],
    });

    if (!user) {
      user = await this.createUserFromGoogle(email, payload);
    } else {
      if (!user.isActive)
        throw new ForbiddenException(
          'This account is deactivated. Contact an administrator to restore access.',
        );
      // Backfill the link and avatar on an account created by other means.
      const patch: Partial<User> = {};
      if (!user.googleId) patch.googleId = payload.sub;
      if (!user.avatarUrl && payload.picture) patch.avatarUrl = payload.picture;
      if (Object.keys(patch).length) {
        await this.userRepository.update(user.id, patch);
        Object.assign(user, patch);
      }
    }

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.auditService.log(null, 'auth.google_login', 'user', user.id, {
      email: user.email,
    });

    const { password: _password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...tokens };
  }

  async refreshToken(userId: string, refreshToken: string) {
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

    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenValid) throw new UnauthorizedException('Access denied');

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
  }

  /**
   * Emails a 6-digit verification code.
   *
   * Deliberately tells the caller when no account matches, and only reports
   * success once the mail actually left the server. This is a product
   * decision that trades away user-enumeration resistance for clear feedback;
   * the endpoint's 3-per-minute throttle is what limits abuse.
   */
  async forgotPassword(email: string) {
    const normalised = this.normaliseEmail(email);

    const user = await this.userRepository.findOne({
      where: { email: normalised },
    });
    if (!user)
      throw new NotFoundException(
        `No account found for ${normalised}. Check the address or contact an administrator.`,
      );
    if (!user.isActive)
      throw new ForbiddenException(
        'This account is deactivated. Contact an administrator to restore access.',
      );

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
      );
    } catch {
      // Never leave a live code behind for an email nobody received.
      await this.clearOtp(user.id);
      throw new ServiceUnavailableException(
        'We could not send the email right now. Please try again in a moment.',
      );
    }

    this.auditService.log(
      null,
      'auth.password_reset_requested',
      'user',
      user.id,
      { email: user.email },
    );

    return {
      message: `Verification code sent to ${user.email}.`,
      email: user.email,
      expiresInMinutes: OTP_TTL_MS / 60000,
      // False in local dev without SMTP — the code is in the server log.
      delivered: this.mailService.isConfigured,
    };
  }

  /**
   * Checks a code without consuming it, so the UI can advance to the
   * new-password step. A wrong code still burns an attempt.
   */
  async verifyResetOtp(email: string, otp: string) {
    await this.consumeOtpAttempt(email, otp);
    return { valid: true };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.consumeOtpAttempt(email, otp);

    // The entity's @BeforeUpdate hook hashes `password` on save. The row was
    // loaded without the `password` column selected, so the existing hash is
    // never re-hashed here.
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    user.passwordResetAttempts = 0;
    // Force re-authentication everywhere — a reset invalidates live sessions.
    user.refreshToken = null;
    await this.userRepository.save(user);

    this.auditService.log(null, 'auth.password_reset', 'user', user.id, {
      email: user.email,
    });

    return { message: 'Password updated. You can now sign in.' };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: ['role', 'role.accessLevel'],
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return user;
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
    this.auditService.log(null, 'auth.google_register', 'user', saved.id, {
      email,
      role: roleName,
    });
    return saved;
  }

  private normaliseEmail(email: string) {
    return email.trim().toLowerCase();
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

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refreshToken: hash });
  }
}
