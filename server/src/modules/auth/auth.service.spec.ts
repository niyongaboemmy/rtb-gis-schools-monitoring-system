/* eslint-disable @typescript-eslint/unbound-method -- jest assertions on mocked methods */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AuthService, type SessionResult } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from './sessions.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { INVALID_CREDENTIALS, LOCK_MINUTES } from './auth.constants';

// Module-level mock: replaces bcryptjs for every test in this file so the
// legacy refresh path can control bcrypt.compare without real hashing.
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Google token verification hits Google's public keys over the network;
// stub the client so tests control the decoded payload.
const mockVerifyIdToken = jest.fn();
const mockGetTokenInfo = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    getTokenInfo: (...args: unknown[]) => mockGetTokenInfo(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Builds a mock query-builder chain whose final `.getOne()` is controllable. */
function makeQb(resolvedUser: User | null | (() => Promise<User | null>)) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne:
      typeof resolvedUser === 'function'
        ? jest.fn(resolvedUser)
        : jest.fn().mockResolvedValue(resolvedUser),
  };
}

/** Builds a minimal User-shaped object. `validatePassword` is a jest.fn so
 *  login tests can control it independently of bcrypt. */
function buildUser(
  overrides: Partial<User & { validatePassword: jest.Mock }> = {},
): User {
  return {
    id: 'user-uuid-1',
    firstName: 'Alice',
    lastName: 'Test',
    email: 'alice@rtb.gov.rw',
    password: '$2a$12$hashed',
    isActive: true,
    refreshToken: '$2a$10$hashedRefreshToken',
    role: { name: 'admin', permissions: [] } as any,
    location: null as any,
    phone: null as any,
    department: null as any,
    avatarUrl: null as any,
    lastLoginAt: null as any,
    failedLoginCount: 0,
    lockedUntil: null,
    totpEnabled: false,
    googleId: null,
    googleUnlinkedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    validatePassword: jest.fn().mockResolvedValue(true),
    hashPassword: jest.fn(),
    fullName: 'Alice Test',
    ...overrides,
  } as unknown as User;
}

/** Assembles the testing module with injectable mocks and returns the service. */
async function makeService(
  userRepoOverrides: Record<string, jest.Mock> = {},
  config: Record<string, string> = {},
) {
  const userRepo: Record<string, jest.Mock> = {
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    create: jest.fn((dto: Partial<User>) => ({ id: 'new-id', ...dto })),
    ...userRepoOverrides,
  };
  // By default the query builder resolves like findOne, so tests that only
  // stub findOne work for both lookup styles.
  userRepo.createQueryBuilder ??= jest
    .fn()
    .mockImplementation(() => makeQb(() => userRepo.findOne()));

  const mailService = {
    send: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
    sendSecurityNotice: jest.fn().mockResolvedValue(undefined),
    sendLoginCode: jest.fn().mockResolvedValue(undefined),
    isConfigured: true,
  };

  const auditService = { log: jest.fn(), record: jest.fn() };

  const roleRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'role-viewer', name: 'viewer' }),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token-1'),
    verifyAsync: jest.fn(),
  };

  const sessionsService = {
    create: jest.fn().mockResolvedValue({
      session: { id: 'session-1' },
      refreshToken: 'refresh-token-1',
    }),
    rotate: jest.fn(),
    peek: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
    revokeOwn: jest.fn(),
    listActive: jest.fn().mockResolvedValue([]),
    refreshTtlMs: 7 * 86400e3,
  };

  const mfaService = {
    isRequiredFor: jest.fn().mockReturnValue(false),
    verify: jest.fn(),
    sendEmailCode: jest
      .fn()
      .mockResolvedValue({ expiresInMinutes: 10, delivered: true }),
    startEnrolment: jest.fn(),
    confirmEnrolment: jest.fn(),
    clear: jest.fn(),
    status: jest.fn(),
  };

  const passwordService = {
    setPassword: jest.fn().mockResolvedValue(undefined),
    verifyCurrent: jest.fn().mockResolvedValue(true),
    assertPolicy: jest.fn(),
  };

  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_DEFAULT_ROLE: 'viewer',
    JWT_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    ...config,
  };
  const configService = {
    get: jest.fn(
      (key: string, fallback?: unknown) => configValues[key] ?? fallback,
    ),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: userRepo },
      { provide: getRepositoryToken(Role), useValue: roleRepo },
      { provide: JwtService, useValue: jwtService },
      { provide: ConfigService, useValue: configService },
      { provide: MailService, useValue: mailService },
      { provide: AuditService, useValue: auditService },
      { provide: SessionsService, useValue: sessionsService },
      { provide: MfaService, useValue: mfaService },
      { provide: PasswordService, useValue: passwordService },
    ],
  }).compile();

  return {
    service: module.get(AuthService),
    userRepo,
    jwtService,
    configService,
    mailService,
    auditService,
    roleRepo,
    sessionsService,
    mfaService,
    passwordService,
  };
}

const actions = (audit: { record: jest.Mock }) =>
  audit.record.mock.calls.map((c) => (c[0] as { action: string }).action);

// ---------------------------------------------------------------------------
// §1: password login
// ---------------------------------------------------------------------------

describe('AuthService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('issues a session (access token + refresh token for the cookie) on valid credentials', async () => {
    const user = buildUser();
    const { service, sessionsService, auditService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    const result = (await service.login(
      { email: 'Alice@rtb.gov.rw', password: 'pw' },
      { ip: '10.0.0.1', userAgent: 'jest' },
    )) as SessionResult;

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(result.sessionId).toBe('session-1');
    expect(sessionsService.create).toHaveBeenCalledWith(
      user.id,
      { ip: '10.0.0.1', userAgent: 'jest' },
      'password',
    );
    expect(actions(auditService)).toContain('auth.login');
  });

  it('never returns secrets on the user object', async () => {
    const user = buildUser({ googleId: 'g-1', totpSecretEnc: 'x' } as never);
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    const result = (await service.login({
      email: 'alice@rtb.gov.rw',
      password: 'pw',
    })) as SessionResult;

    for (const key of ['password', 'refreshToken', 'googleId', 'totpSecretEnc'])
      expect(result.user[key]).toBeUndefined();
    expect(result.user.googleLinked).toBe(true);
  });

  it('clears the failure counter after a successful login', async () => {
    const user = buildUser({ failedLoginCount: 3 } as never);
    const { service, userRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await service.login({ email: 'alice@rtb.gov.rw', password: 'pw' });

    expect(userRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
    );
  });

  it('gives an unknown email the same generic error, audited without a password', async () => {
    const { service, auditService, sessionsService } = await makeService();

    await expect(
      service.login({ email: 'ghost@rtb.gov.rw', password: 'secret-pw' }),
    ).rejects.toThrow(INVALID_CREDENTIALS);

    expect(sessionsService.create).not.toHaveBeenCalled();
    const entry = auditService.record.mock.calls[0][0];
    expect(entry.action).toBe('auth.login_failed');
    expect(entry.meta.reason).toBe('unknown_user');
    expect(JSON.stringify(entry)).not.toContain('secret-pw');
  });
});

// ---------------------------------------------------------------------------
// §2: lockout (WS9.5)
// ---------------------------------------------------------------------------

describe('AuthService.login – lockout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('counts a wrong password', async () => {
    const user = buildUser({ failedLoginCount: 1 } as never);
    (user.validatePassword as jest.Mock).mockResolvedValue(false);
    const { service, userRepo, auditService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'bad' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepo.update).toHaveBeenCalledWith(user.id, {
      failedLoginCount: 2,
    });
    expect(auditService.record.mock.calls[0][0].meta.reason).toBe(
      'bad_password',
    );
  });

  it('locks the account for 15 minutes on the 5th failure', async () => {
    const user = buildUser({ failedLoginCount: 4 } as never);
    (user.validatePassword as jest.Mock).mockResolvedValue(false);
    const { service, userRepo, auditService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'bad' }),
    ).rejects.toThrow(INVALID_CREDENTIALS);

    const [, patch] = userRepo.update.mock.calls[0];
    expect(patch.failedLoginCount).toBe(0);
    const minutes = (patch.lockedUntil.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(LOCK_MINUTES - 1);
    expect(minutes).toBeLessThanOrEqual(LOCK_MINUTES);
    expect(actions(auditService)).toEqual([
      'auth.login_failed',
      'auth.account_locked',
    ]);
  });

  it('refuses a locked account even with the right password, without checking it', async () => {
    const user = buildUser({
      lockedUntil: new Date(Date.now() + 60_000),
    } as never);
    const { service, sessionsService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'pw' }),
    ).rejects.toThrow(INVALID_CREDENTIALS);
    expect(user.validatePassword).not.toHaveBeenCalled();
    expect(sessionsService.create).not.toHaveBeenCalled();
  });

  it('lets the user in once the lock has expired', async () => {
    const user = buildUser({
      lockedUntil: new Date(Date.now() - 1000),
    } as never);
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'pw' }),
    ).resolves.toHaveProperty('accessToken');
  });
});

// ---------------------------------------------------------------------------
// §3: two-step login (WS10.6 / 10.7)
// ---------------------------------------------------------------------------

describe('AuthService – second factor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an mfaToken instead of a session when 2FA is on', async () => {
    const user = buildUser({ totpEnabled: true } as never);
    const { service, sessionsService, jwtService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    jwtService.signAsync.mockResolvedValueOnce('mfa-token');

    const result = await service.login({
      email: 'alice@rtb.gov.rw',
      password: 'pw',
    });

    expect(result).toEqual({
      mfaRequired: true,
      mfaToken: 'mfa-token',
      methods: ['totp', 'recovery', 'email'],
    });
    expect(sessionsService.create).not.toHaveBeenCalled();
    // Purpose-scoped, short-lived, and NOT signed with the access-token secret.
    const [payload, options] = jwtService.signAsync.mock.calls[0];
    expect(payload).toMatchObject({
      sub: user.id,
      purpose: 'mfa',
      stage: 'verify',
    });
    expect(options.expiresIn).toBe(300);
    expect(options.secret).not.toBe('test-access-secret');
  });

  it('requires enrolment for a privileged user without 2FA when enforced', async () => {
    const user = buildUser();
    const { service, mfaService, jwtService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    mfaService.isRequiredFor.mockReturnValue(true);
    jwtService.signAsync.mockResolvedValueOnce('enrol-token');

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'pw' }),
    ).resolves.toEqual({
      mfaEnrollmentRequired: true,
      mfaToken: 'enrol-token',
    });
  });

  it('issues the session after a valid code, and the mfaToken cannot be replayed', async () => {
    const user = buildUser({ totpEnabled: true } as never);
    const { service, mfaService, jwtService, sessionsService } =
      await makeService({
        findOne: jest.fn().mockResolvedValue(user),
      });
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      purpose: 'mfa',
      stage: 'verify',
      method: 'password',
      jti: 'j-1',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    mfaService.verify.mockResolvedValue(true);

    const result = await service.verifyMfa({
      mfaToken: 't',
      code: '123456',
    });
    expect(result.accessToken).toBe('access-token-1');
    expect(sessionsService.create).toHaveBeenCalledTimes(1);
    expect(mfaService.verify).toHaveBeenCalledWith(user.id, {
      kind: 'totp',
      code: '123456',
    });

    await expect(
      service.verifyMfa({ mfaToken: 't', code: '123456' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('counts a wrong code toward lockout', async () => {
    const user = buildUser({ totpEnabled: true, failedLoginCount: 4 } as never);
    const { service, mfaService, jwtService, userRepo, auditService } =
      await makeService({
        findOne: jest.fn().mockResolvedValue(user),
      });
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      purpose: 'mfa',
      stage: 'verify',
      method: 'password',
      jti: 'j-2',
    });
    mfaService.verify.mockResolvedValue(false);

    await expect(
      service.verifyMfa({ mfaToken: 't', code: '000000' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepo.update.mock.calls[0][1].lockedUntil).toBeInstanceOf(Date);
    expect(actions(auditService)).toContain('auth.account_locked');
  });

  it('rejects a token without the mfa purpose (e.g. an access token)', async () => {
    const { service, jwtService } = await makeService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid-1',
      email: 'a@b',
      role: {},
    });

    await expect(
      service.verifyMfa({ mfaToken: 'access', code: '123456' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a recovery code and audits its use', async () => {
    const user = buildUser({ totpEnabled: true } as never);
    const { service, mfaService, jwtService, auditService } = await makeService(
      {
        findOne: jest.fn().mockResolvedValue(user),
      },
    );
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      purpose: 'mfa',
      stage: 'verify',
      method: 'password',
      jti: 'j-3',
    });
    mfaService.verify.mockResolvedValue(true);

    await service.verifyMfa({ mfaToken: 't', recoveryCode: 'abcde-fghjk' });
    expect(mfaService.verify).toHaveBeenCalledWith(user.id, {
      kind: 'recovery',
      code: 'abcde-fghjk',
    });
    expect(actions(auditService)).toContain('auth.mfa_recovery_used');
  });

  it('enrolment tokens cannot be used with an authenticator code before set-up', async () => {
    const user = buildUser();
    const { service, jwtService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      purpose: 'mfa',
      stage: 'enroll',
      method: 'password',
      jti: 'j-4',
    });

    await expect(
      service.verifyMfa({ mfaToken: 't', code: '123456' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// §4: refresh / logout (WS9.11, WS9.15)
// ---------------------------------------------------------------------------

describe('AuthService.refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rotates the cookie session and returns a new access token', async () => {
    const user = buildUser();
    const { service, sessionsService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    sessionsService.rotate.mockResolvedValue({
      userId: user.id,
      sessionId: 's-1',
      refreshToken: 'rt-2',
    });

    const result = await service.refresh('rt-1', {}, { ip: '1.1.1.1' });

    expect(sessionsService.rotate).toHaveBeenCalledWith('rt-1', {
      ip: '1.1.1.1',
    });
    expect(result).toMatchObject({
      accessToken: 'access-token-1',
      refreshToken: 'rt-2',
      sessionId: 's-1',
    });
  });

  it('revokes the session when its user was deactivated', async () => {
    const { service, sessionsService } = await makeService();
    sessionsService.rotate.mockResolvedValue({
      userId: 'u',
      sessionId: 's-1',
      refreshToken: 'rt-2',
    });

    await expect(service.refresh('rt-1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessionsService.revoke).toHaveBeenCalledWith('s-1', 'inactive');
  });

  it('migrates a valid legacy (localStorage) token into a session once', async () => {
    const user = buildUser();
    const { service, userRepo, sessionsService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.refresh(undefined, {
      userId: user.id,
      refreshToken: 'old',
    });

    expect(result.refreshToken).toBe('refresh-token-1');
    expect(userRepo.update).toHaveBeenCalledWith(user.id, {
      refreshToken: null,
    });
    expect(sessionsService.create).toHaveBeenCalledWith(user.id, {}, 'legacy');
  });

  it('[SEC-01] refuses a wrong legacy token', async () => {
    const { service, sessionsService } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });
    mockedBcrypt.compare.mockResolvedValue(false as never);

    await expect(
      service.refresh(undefined, {
        userId: 'user-uuid-1',
        refreshToken: 'stolen',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessionsService.create).not.toHaveBeenCalled();
  });

  it('refuses when neither a cookie nor a legacy token is given', async () => {
    const { service } = await makeService();
    await expect(service.refresh(undefined, {})).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService.logout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokes the cookie session and audits', async () => {
    const { service, sessionsService, auditService } = await makeService();
    sessionsService.peek.mockResolvedValue({ sub: 'user-uuid-1', sid: 's-9' });

    await service.logout('rt');

    expect(sessionsService.revoke).toHaveBeenCalledWith('s-9', 'logout');
    expect(actions(auditService)).toEqual(['auth.logout']);
  });
});

// ---------------------------------------------------------------------------
// §5: change / reset password (WS10.1–10.2)
// ---------------------------------------------------------------------------

describe('AuthService.changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('applies the policy, signs out other devices, emails a notice and audits', async () => {
    const user = buildUser();
    const {
      service,
      passwordService,
      sessionsService,
      mailService,
      auditService,
    } = await makeService();

    await service.changePassword(user, 'old', 'New-Pass@2026', 's-current', {
      ip: '1.2.3.4',
    });

    expect(passwordService.setPassword).toHaveBeenCalledWith(
      user.id,
      'New-Pass@2026',
    );
    expect(sessionsService.revokeAll).toHaveBeenCalledWith(
      user.id,
      'password_change',
      's-current',
    );
    expect(mailService.sendSecurityNotice).toHaveBeenCalledWith(
      user.email,
      'Alice',
      'Your password was changed',
      expect.any(Array),
    );
    expect(actions(auditService)).toEqual(['auth.password_changed']);
  });

  it('refuses a wrong current password', async () => {
    const { service, passwordService } = await makeService();
    passwordService.verifyCurrent.mockResolvedValue(false);

    await expect(
      service.changePassword(buildUser(), 'bad', 'New-Pass@2026'),
    ).rejects.toThrow(BadRequestException);
    expect(passwordService.setPassword).not.toHaveBeenCalled();
  });

  it('still succeeds when the notice email fails', async () => {
    const { service, mailService } = await makeService();
    mailService.sendSecurityNotice.mockRejectedValue(new Error('SMTP down'));

    await expect(
      service.changePassword(buildUser(), 'old', 'New-Pass@2026'),
    ).resolves.toMatchObject({
      success: true,
    });
  });
});

describe('AuthService.resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  const withOtp = (otp: string) =>
    buildUser({
      passwordResetToken: crypto.createHash('sha256').update(otp).digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
      passwordResetAttempts: 0,
    } as never);

  it('sets the password through the policy, clears the code and every session', async () => {
    const { service, userRepo, passwordService, sessionsService } =
      await makeService({
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(makeQb(withOtp('123456'))),
      });

    await expect(
      service.resetPassword('alice@rtb.gov.rw', '123456', 'New-Pass@2026'),
    ).resolves.toEqual({
      message: 'Password updated. You can now sign in.',
    });
    expect(passwordService.setPassword).toHaveBeenCalledWith(
      'user-uuid-1',
      'New-Pass@2026',
    );
    expect(userRepo.update).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ passwordResetToken: null, refreshToken: null }),
    );
    expect(sessionsService.revokeAll).toHaveBeenCalledWith(
      'user-uuid-1',
      'password_reset',
    );
  });

  it('does not change the password when the code is wrong', async () => {
    const { service, passwordService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(withOtp('123456'))),
    });

    await expect(
      service.resetPassword('alice@rtb.gov.rw', '000000', 'New-Pass@2026'),
    ).rejects.toThrow(BadRequestException);
    expect(passwordService.setPassword).not.toHaveBeenCalled();
  });
});

describe('AuthService.forgotPassword – generic mode (WS9.10)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('answers identically for unknown and known addresses', async () => {
    const env = { FORGOT_PASSWORD_GENERIC_RESPONSE: 'true' };
    const unknown = await makeService({}, env);
    const known = await makeService(
      { findOne: jest.fn().mockResolvedValue(buildUser()) },
      env,
    );

    const a = await unknown.service.forgotPassword('ghost@rtb.gov.rw');
    const b = await known.service.forgotPassword('ghost@rtb.gov.rw');

    expect(a).toEqual(b);
    expect(unknown.mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    expect(known.mailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// §6: Google hardening (WS10.9)
// ---------------------------------------------------------------------------

describe('AuthService.loginWithGoogle – hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'g-1',
        email: 'new@gmail.com',
        email_verified: true,
      }),
    });
  });

  it('refuses self-registration outside GOOGLE_ALLOWED_DOMAINS', async () => {
    const { service, userRepo, auditService } = await makeService(
      {},
      { GOOGLE_ALLOWED_DOMAINS: 'rtb.gov.rw' },
    );

    await expect(service.loginWithGoogle({ idToken: 't' })).rejects.toThrow(
      /limited to @rtb\.gov\.rw/,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(auditService.record.mock.calls[0][0]).toMatchObject({
      action: 'auth.google_register_denied',
      meta: { reason: 'domain_not_allowed' },
    });
  });

  it('allows self-registration inside an allowed domain', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'g-1',
        email: 'x@rtb.gov.rw',
        email_verified: true,
      }),
    });
    const { service, userRepo } = await makeService(
      {},
      { GOOGLE_ALLOWED_DOMAINS: 'rtb.gov.rw, other.rw' },
    );

    await expect(
      service.loginWithGoogle({ idToken: 't' }),
    ).resolves.toHaveProperty('accessToken');
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('refuses any self-registration when GOOGLE_ALLOW_SELF_REGISTER=false', async () => {
    const { service } = await makeService(
      {},
      { GOOGLE_ALLOW_SELF_REGISTER: 'false' },
    );
    await expect(service.loginWithGoogle({ idToken: 't' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('still lets pre-provisioned accounts in when self-registration is off', async () => {
    const user = buildUser({ email: 'new@gmail.com' });
    const { service } = await makeService(
      { findOne: jest.fn().mockResolvedValue(user) },
      { GOOGLE_ALLOW_SELF_REGISTER: 'false' },
    );
    await expect(
      service.loginWithGoogle({ idToken: 't' }),
    ).resolves.toHaveProperty('accessToken');
  });

  it('sends a 2FA user through the second factor', async () => {
    const user = buildUser({
      email: 'new@gmail.com',
      totpEnabled: true,
    } as never);
    const { service, sessionsService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await expect(
      service.loginWithGoogle({ idToken: 't' }),
    ).resolves.toMatchObject({
      mfaRequired: true,
    });
    expect(sessionsService.create).not.toHaveBeenCalled();
  });

  it('refuses an account that unlinked Google', async () => {
    const user = buildUser({
      email: 'new@gmail.com',
      googleUnlinkedAt: new Date(),
    } as never);
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    await expect(service.loginWithGoogle({ idToken: 't' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuses a different Google identity for an already-linked account', async () => {
    const user = buildUser({
      email: 'new@gmail.com',
      googleId: 'g-other',
    } as never);
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    await expect(service.loginWithGoogle({ idToken: 't' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

// ---------------------------------------------------------------------------
// §7: validateUser (used by JwtStrategy and the WebSocket gateway)
// ---------------------------------------------------------------------------

describe('AuthService.validateUser', () => {
  it('returns an active user and rejects a missing one', async () => {
    const user = buildUser();
    const found = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    await expect(found.service.validateUser(user.id)).resolves.toBe(user);
    const missing = await makeService();
    await expect(missing.service.validateUser('x')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

// ---------------------------------------------------------------------------
// §6b: loginWithGoogle
// ---------------------------------------------------------------------------

/** Shapes mockVerifyIdToken's resolved value like a real Google ticket. */
function googleTicket(payload: Record<string, unknown> | null) {
  return { getPayload: () => payload };
}

const GOOGLE_PAYLOAD = {
  sub: 'google-sub-123',
  email: 'alice@rtb.gov.rw',
  email_verified: true,
  given_name: 'Alice',
  family_name: 'Test',
  picture: 'https://lh3.googleusercontent.com/a/photo',
};

describe('AuthService.loginWithGoogle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('stored-refresh-hash' as never);
    mockVerifyIdToken.mockResolvedValue(googleTicket(GOOGLE_PAYLOAD));
  });

  it('signs in an existing user and issues our own tokens', async () => {
    const user = buildUser({ googleId: 'google-sub-123' } as never);
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    const result = (await service.loginWithGoogle({
      idToken: 'id-token',
    })) as SessionResult;

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect((result.user as { email: string }).email).toBe('alice@rtb.gov.rw');
    expect(result.user.password).toBeUndefined();
  });

  it('verifies the token against our client id', async () => {
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });

    await service.loginWithGoogle({ idToken: 'id-token' });

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: 'client-id.apps.googleusercontent.com',
    });
  });

  it('self-registers an unknown address with the default role', async () => {
    const { service, userRepo, roleRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto: Partial<User>) => ({ id: 'new-id', ...dto })),
      save: jest.fn((entity: User) => Promise.resolve(entity)),
    });

    const result = (await service.loginWithGoogle({
      idToken: 'id-token',
    })) as SessionResult;

    expect(roleRepo.findOne).toHaveBeenCalledWith({
      where: { name: 'viewer' },
    });

    const created = userRepo.create.mock.calls[0][0] as Partial<User>;
    expect(created.email).toBe('alice@rtb.gov.rw');
    expect(created.firstName).toBe('Alice');
    expect(created.googleId).toBe('google-sub-123');
    expect(created.isActive).toBe(true);
    // password is NOT NULL in the schema; a random secret keeps password
    // login unusable for these accounts until the user resets it.
    expect(created.password).toMatch(/^[0-9a-f]{96}$/);
    expect(result.accessToken).toBeDefined();
  });

  it('refuses an unverified Google email', async () => {
    mockVerifyIdToken.mockResolvedValue(
      googleTicket({ ...GOOGLE_PAYLOAD, email_verified: false }),
    );
    const { service, userRepo } = await makeService();

    // Otherwise anyone could claim an address they do not control.
    await expect(
      service.loginWithGoogle({ idToken: 'id-token' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('refuses a token Google rejects', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad signature'));
    const { service } = await makeService();

    await expect(
      service.loginWithGoogle({ idToken: 'forged' }),
    ).rejects.toThrow('Invalid or expired Google sign-in.');
  });

  it('refuses a deactivated account', async () => {
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser({ isActive: false })),
    });

    await expect(
      service.loginWithGoogle({ idToken: 'id-token' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('backfills the google link on an admin-created account', async () => {
    const user = buildUser({ googleId: null, avatarUrl: null } as never);
    const { service, userRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await service.loginWithGoogle({ idToken: 'id-token' });

    expect(userRepo.update).toHaveBeenCalledWith(user.id, {
      googleId: 'google-sub-123',
      avatarUrl: GOOGLE_PAYLOAD.picture,
    });
  });

  it('fails clearly when the default role has not been seeded', async () => {
    const { service, roleRepo, userRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(null),
    });
    roleRepo.findOne.mockResolvedValue(null);

    await expect(
      service.loginWithGoogle({ idToken: 'id-token' }),
    ).rejects.toThrow(/Default role "viewer" is missing/);
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §9: forgotPassword / verifyResetOtp (unchanged behaviour)
// ---------------------------------------------------------------------------

/** Mirrors the service's private OTP hashing so tests can assert on it. */
const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

/** A user with a live code pending, as consumeOtpAttempt expects to load it. */
function buildUserWithOtp(otp: string, overrides: Partial<User> = {}): User {
  return buildUser({
    passwordResetToken: sha256(otp),
    passwordResetExpiresAt: new Date(Date.now() + 60_000),
    passwordResetAttempts: 0,
    ...overrides,
  } as Partial<User & { validatePassword: jest.Mock }>);
}

describe('AuthService.forgotPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emails a 6-digit code and stores only its hash', async () => {
    const { service, userRepo, mailService } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });

    const result = await service.forgotPassword('alice@rtb.gov.rw');

    expect(result).toEqual({
      message: 'Verification code sent to alice@rtb.gov.rw.',
      email: 'alice@rtb.gov.rw',
      expiresInMinutes: 10,
      delivered: true,
    });
    expect(mailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);

    const [to, name, otp, ttl] = mailService.sendPasswordResetOtp.mock.calls[0];
    expect(to).toBe('alice@rtb.gov.rw');
    expect(name).toBe('Alice');
    expect(otp).toMatch(/^\d{6}$/);
    expect(ttl).toBe(10);

    // The code travels only in the email; the DB must hold only its hash.
    const [, stored] = userRepo.update.mock.calls[0];
    expect(stored.passwordResetToken).toBe(sha256(otp));
    expect(stored.passwordResetToken).not.toBe(otp);
    expect(stored.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('resets the attempt counter so a new code clears an earlier lock-out', async () => {
    const { service, userRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });

    await service.forgotPassword('alice@rtb.gov.rw');

    const [, stored] = userRepo.update.mock.calls[0];
    expect(stored.passwordResetAttempts).toBe(0);
  });

  it('reports "delivered: false" when SMTP is not configured', async () => {
    const { service, mailService } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });
    mailService.isConfigured = false;

    // Dev without SMTP: the UI must say "check the log", not "check your inbox".
    await expect(service.forgotPassword('alice@rtb.gov.rw')).resolves.toEqual(
      expect.objectContaining({ delivered: false }),
    );
  });

  it('tells the caller when no account matches, and sends no mail', async () => {
    const { service, userRepo, mailService } = await makeService({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(service.forgotPassword('ghost@rtb.gov.rw')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.forgotPassword('ghost@rtb.gov.rw')).rejects.toThrow(
      /No account found for ghost@rtb\.gov\.rw/,
    );
    expect(mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('rejects a deactivated account with a distinct message', async () => {
    const { service, mailService } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser({ isActive: false })),
    });

    await expect(service.forgotPassword('alice@rtb.gov.rw')).rejects.toThrow(
      ForbiddenException,
    );
    expect(mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  it('clears the stored code when the email fails to send', async () => {
    const user = buildUser();
    const { service, userRepo, mailService } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });
    mailService.sendPasswordResetOtp.mockRejectedValue(new Error('SMTP down'));

    // Reporting "code sent" after a failed send would strand the user.
    await expect(service.forgotPassword('alice@rtb.gov.rw')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(userRepo.update).toHaveBeenLastCalledWith(user.id, {
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      passwordResetAttempts: 0,
    });
  });

  it('looks the address up normalised (trimmed + lower-cased)', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const { service } = await makeService({ findOne });

    await expect(
      service.forgotPassword('  Alice@RTB.gov.rw  '),
    ).rejects.toThrow(NotFoundException);

    expect(findOne).toHaveBeenCalledWith({
      where: { email: 'alice@rtb.gov.rw' },
    });
  });

  it('issues a different code on each request', async () => {
    const { service, mailService } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });

    // 1-in-a-million collision is possible, so compare across several draws.
    for (let i = 0; i < 6; i++) await service.forgotPassword('a@rtb.gov.rw');

    const codes = mailService.sendPasswordResetOtp.mock.calls.map(
      (call: string[]) => call[2],
    );
    expect(new Set(codes).size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// §8: verifyResetOtp / resetPassword — OTP redemption
// ---------------------------------------------------------------------------

const INVALID_OTP_MESSAGE =
  'That code is invalid or has expired. Please request a new one.';

describe('AuthService.verifyResetOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a correct code without consuming it', async () => {
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQb(buildUserWithOtp('123456'))),
    });

    await expect(
      service.verifyResetOtp('alice@rtb.gov.rw', '123456'),
    ).resolves.toEqual({ valid: true });

    // Verification is non-destructive — the code survives for the reset step.
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a wrong code and burns an attempt', async () => {
    const user = buildUserWithOtp('123456', { passwordResetAttempts: 2 });
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.verifyResetOtp('alice@rtb.gov.rw', '999999'),
    ).rejects.toThrow(INVALID_OTP_MESSAGE);

    expect(userRepo.update).toHaveBeenCalledWith(user.id, {
      passwordResetAttempts: 3,
    });
  });

  it('discards the code once the attempt budget is exhausted', async () => {
    const user = buildUserWithOtp('123456', { passwordResetAttempts: 5 });
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    // Even the *correct* code is refused once the budget is gone.
    await expect(
      service.verifyResetOtp('alice@rtb.gov.rw', '123456'),
    ).rejects.toThrow(
      'Too many incorrect attempts. Please request a new code.',
    );

    expect(userRepo.update).toHaveBeenCalledWith(user.id, {
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      passwordResetAttempts: 0,
    });
  });

  it('rejects and clears an expired code', async () => {
    const user = buildUserWithOtp('123456', {
      passwordResetExpiresAt: new Date(Date.now() - 1000),
    });
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.verifyResetOtp('alice@rtb.gov.rw', '123456'),
    ).rejects.toThrow(INVALID_OTP_MESSAGE);

    expect(userRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ passwordResetToken: null }),
    );
  });

  it('rejects when no code is pending', async () => {
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(buildUser())),
    });

    await expect(
      service.verifyResetOtp('alice@rtb.gov.rw', '123456'),
    ).rejects.toThrow(INVALID_OTP_MESSAGE);
  });

  it('gives an unknown address the same error as a wrong code', async () => {
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
    });

    await expect(
      service.verifyResetOtp('ghost@rtb.gov.rw', '123456'),
    ).rejects.toThrow(INVALID_OTP_MESSAGE);
  });

  it.each(['', '12345', '1234567', 'abcdef', '12 456'])(
    'rejects malformed code %p without hitting the database',
    async (otp) => {
      const createQueryBuilder = jest.fn();
      const { service } = await makeService({ createQueryBuilder });

      await expect(
        service.verifyResetOtp('alice@rtb.gov.rw', otp),
      ).rejects.toThrow(BadRequestException);
      expect(createQueryBuilder).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// Google access tokens (custom-styled button, OAuth token client)
// ---------------------------------------------------------------------------

describe('AuthService.loginWithGoogle with an access token', () => {
  const CLIENT = 'client-id.apps.googleusercontent.com';
  const fetchMock = jest.fn();
  const realFetch = global.fetch;

  const userinfo = (body: Record<string, unknown>, ok = true) =>
    fetchMock.mockResolvedValue({
      ok,
      status: ok ? 200 : 401,
      json: () => Promise.resolve(body),
    });

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('stored-refresh-hash' as never);
    mockGetTokenInfo.mockResolvedValue({
      aud: CLIENT,
      azp: CLIENT,
      sub: 'google-sub-123',
      email: 'alice@rtb.gov.rw',
      email_verified: true,
      expiry_date: Date.now() + 3_600_000,
      scopes: ['openid', 'email', 'profile'],
    });
    userinfo(GOOGLE_PAYLOAD);
  });

  it('signs in when the token was issued to our client', async () => {
    const user = buildUser({ googleId: 'google-sub-123' } as never);
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    const result = (await service.loginWithGoogle({
      accessToken: 'at',
    })) as SessionResult;

    expect(mockGetTokenInfo).toHaveBeenCalledWith('at');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: 'Bearer at' } },
    );
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token-1');
  });

  it('refuses a token issued to another app (replay)', async () => {
    mockGetTokenInfo.mockResolvedValue({
      aud: 'other-app.apps.googleusercontent.com',
      azp: 'other-app.apps.googleusercontent.com',
      sub: 'google-sub-123',
      expiry_date: Date.now() + 3_600_000,
      scopes: [],
    });
    const { service, userRepo } = await makeService();

    await expect(
      service.loginWithGoogle({ accessToken: 'at' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('refuses an invalid or expired token', async () => {
    mockGetTokenInfo.mockRejectedValue(new Error('invalid_token'));
    const { service } = await makeService();

    await expect(
      service.loginWithGoogle({ accessToken: 'at' }),
    ).rejects.toThrow('Invalid or expired Google sign-in.');
  });

  it('refuses when the profile belongs to a different account', async () => {
    userinfo({ ...GOOGLE_PAYLOAD, sub: 'someone-else' });
    const { service } = await makeService();

    await expect(
      service.loginWithGoogle({ accessToken: 'at' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses when the profile cannot be read', async () => {
    userinfo({}, false);
    const { service } = await makeService();

    await expect(
      service.loginWithGoogle({ accessToken: 'at' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('still refuses an unverified email', async () => {
    userinfo({ ...GOOGLE_PAYLOAD, email_verified: false });
    const { service } = await makeService();

    await expect(
      service.loginWithGoogle({ accessToken: 'at' }),
    ).rejects.toThrow('Your Google email address is not verified.');
  });

  it('requires exactly one credential', async () => {
    const { service } = await makeService();

    await expect(service.loginWithGoogle({})).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.loginWithGoogle({ idToken: 'a', accessToken: 'b' }),
    ).rejects.toThrow(BadRequestException);
  });
});
