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
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

// Module-level mock: replaces bcryptjs for every test in this file.
// This is critical for refreshToken tests (SEC-01) where we need
// to control bcrypt.compare's return value without real hashing.
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Google token verification hits Google's public keys over the network;
// stub the client so tests control the decoded payload.
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Builds a mock query-builder chain whose final `.getOne()` is controllable. */
function makeQb(resolvedUser: User | null) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(resolvedUser),
  };
  return qb;
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
  jwtOverrides: Record<string, jest.Mock> = {},
): Promise<{
  service: AuthService;
  userRepo: Record<string, jest.Mock>;
  jwtService: Record<string, jest.Mock>;
  configService: Record<string, jest.Mock>;
  mailService: {
    send: jest.Mock;
    sendPasswordResetOtp: jest.Mock;
    isConfigured: boolean;
  };
  auditService: Record<string, jest.Mock>;
  roleRepo: Record<string, jest.Mock>;
}> {
  const userRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    ...userRepoOverrides,
  };

  const mailService = {
    send: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
    isConfigured: true,
  };

  const auditService = { log: jest.fn() };

  const roleRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'role-viewer', name: 'viewer' }),
  };

  const jwtService = {
    signAsync: jest
      .fn()
      .mockResolvedValueOnce('access-token-1')
      .mockResolvedValueOnce('refresh-token-1'),
    ...jwtOverrides,
  };

  // Most keys are secrets whose value is irrelevant; these two are read as
  // real configuration by the Google flow.
  const configValues: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_DEFAULT_ROLE: 'viewer',
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key] ?? 'test-secret'),
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
  };
}

// ---------------------------------------------------------------------------
// §1: login — happy path
// ---------------------------------------------------------------------------

describe('AuthService.login – happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('stored-refresh-hash' as never);
  });

  it('returns accessToken + refreshToken + user on valid credentials', async () => {
    const user = buildUser();
    const qb = makeQb(user);
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    });

    const result = await service.login({
      email: 'alice@rtb.gov.rw',
      password: 'correct-pw',
    });

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('alice@rtb.gov.rw');
    // password must be stripped from the returned user object
    expect(result.user.password).toBeUndefined();
  });

  it('calls userRepository.update to stamp lastLoginAt', async () => {
    const user = buildUser();
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await service.login({ email: 'alice@rtb.gov.rw', password: 'correct-pw' });

    expect(userRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ lastLoginAt: expect.any(Date) }),
    );
  });

  it('stores a bcrypt hash of the refresh token, not the raw token', async () => {
    const user = buildUser();
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await service.login({ email: 'alice@rtb.gov.rw', password: 'correct-pw' });

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('refresh-token-1', 10);
    expect(userRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ refreshToken: 'stored-refresh-hash' }),
    );
  });
});

// ---------------------------------------------------------------------------
// §2: login — failure paths
// ---------------------------------------------------------------------------

describe('AuthService.login – failure paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('stored-hash' as never);
  });

  it('throws 401 when email does not exist (getOne returns null)', async () => {
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
    });

    await expect(
      service.login({ email: 'ghost@rtb.gov.rw', password: 'any' }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login({ email: 'ghost@rtb.gov.rw', password: 'any' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('throws 401 when password is wrong (validatePassword returns false)', async () => {
    const user = buildUser({
      validatePassword: jest.fn().mockResolvedValue(false),
    });
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'wrong-pw' }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'wrong-pw' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('throws 401 when user account is inactive (query filters isActive=true so getOne returns null)', async () => {
    // The query builder filters `isActive = true` at the DB level;
    // an inactive user's row is excluded → getOne resolves null.
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
    });

    await expect(
      service.login({ email: 'disabled@rtb.gov.rw', password: 'any' }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login({ email: 'disabled@rtb.gov.rw', password: 'any' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('does NOT generate tokens or update DB when login fails', async () => {
    const { service, userRepo, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
    });

    await expect(
      service.login({ email: 'x@rtb.gov.rw', password: 'x' }),
    ).rejects.toThrow();

    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(mockedBcrypt.hash).not.toHaveBeenCalled();
  });

  it('does NOT generate tokens when password validation fails', async () => {
    const user = buildUser({
      validatePassword: jest.fn().mockResolvedValue(false),
    });
    const { service, userRepo, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.login({ email: 'alice@rtb.gov.rw', password: 'wrong' }),
    ).rejects.toThrow();

    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §3: refreshToken — happy path
// ---------------------------------------------------------------------------

describe('AuthService.refreshToken – happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('new-stored-hash' as never);
    // Reset signAsync to produce a fresh pair for each test
  });

  it('returns a new accessToken + refreshToken when token is valid', async () => {
    const user = buildUser({ refreshToken: '$2a$10$storedHash' });
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const { service, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });
    // Reset the default queue set in makeService, then set the values for this test
    jwtService.signAsync
      .mockReset()
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');

    const result = await service.refreshToken(
      'user-uuid-1',
      'raw-refresh-token',
    );

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
  });

  it('compares the provided raw token against the stored hash', async () => {
    const user = buildUser({ refreshToken: '$2a$10$storedHash' });
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await service.refreshToken('user-uuid-1', 'raw-refresh-token');

    expect(mockedBcrypt.compare).toHaveBeenCalledWith(
      'raw-refresh-token',
      '$2a$10$storedHash',
    );
  });

  it('persists a new bcrypt hash of the new refresh token after rotation', async () => {
    const user = buildUser({ refreshToken: '$2a$10$storedHash' });
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const { service, userRepo, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });
    jwtService.signAsync
      .mockReset()
      .mockResolvedValueOnce('rotated-access')
      .mockResolvedValueOnce('rotated-refresh');

    await service.refreshToken('user-uuid-1', 'raw-refresh-token');

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('rotated-refresh', 10);
    expect(userRepo.update).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ refreshToken: 'new-stored-hash' }),
    );
  });
});

// ---------------------------------------------------------------------------
// §4: refreshToken — failure paths (SEC-01 regression)
// ---------------------------------------------------------------------------

describe('AuthService.refreshToken – failure paths (SEC-01)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('[SEC-01] throws 401 when a wrong/stolen refresh token is supplied', async () => {
    // SEC-01: an attacker supplies a token that does not match the stored hash.
    // bcrypt.compare must return false → service must reject.
    const user = buildUser({ refreshToken: '$2a$10$legitimateHash' });
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.refreshToken('user-uuid-1', 'stolen-or-wrong-token'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.refreshToken('user-uuid-1', 'stolen-or-wrong-token'),
    ).rejects.toThrow('Access denied');
  });

  it('[SEC-01] does NOT issue new tokens when bcrypt.compare returns false', async () => {
    const user = buildUser({ refreshToken: '$2a$10$legitimateHash' });
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const { service, jwtService, userRepo } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.refreshToken('user-uuid-1', 'bad-token'),
    ).rejects.toThrow();

    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('throws 401 when user refreshToken is null (post-logout / cleared token)', async () => {
    // After logout, refreshToken is set to null.
    // The service checks `!user.refreshToken` before bcrypt.compare.
    const user = buildUser({ refreshToken: null as any });

    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.refreshToken('user-uuid-1', 'any-token'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.refreshToken('user-uuid-1', 'any-token'),
    ).rejects.toThrow('Access denied');
  });

  it('skips bcrypt.compare entirely when refreshToken is null (early-exit guard)', async () => {
    const user = buildUser({ refreshToken: null as any });

    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(service.refreshToken('user-uuid-1', 'any')).rejects.toThrow();

    // bcrypt.compare should never be called — the null guard fires first
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
  });

  it('throws 401 when user is inactive (getOne returns null because query filters isActive=true)', async () => {
    // Query: `andWhere('user.isActive = :isActive', { isActive: true })` excludes inactive users.
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
    });

    await expect(
      service.refreshToken('inactive-user-id', 'any-token'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.refreshToken('inactive-user-id', 'any-token'),
    ).rejects.toThrow('Access denied');
  });

  it('throws 401 when user does not exist (getOne returns null)', async () => {
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(null)),
    });

    await expect(
      service.refreshToken('nonexistent-id', 'any-token'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// §5: logout
// ---------------------------------------------------------------------------

describe('AuthService.logout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears the stored refresh token (sets it to null)', async () => {
    const { service, userRepo } = await makeService();

    const result = await service.logout('user-uuid-1');

    expect(userRepo.update).toHaveBeenCalledWith('user-uuid-1', {
      refreshToken: null,
    });
    expect(result).toEqual({ message: 'Logged out successfully' });
  });

  it('subsequent refreshToken call fails because token is null (post-logout guard)', async () => {
    // Simulate logout followed by a refresh attempt: the stored token is now null
    const user = buildUser({ refreshToken: null as any });

    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(
      service.refreshToken('user-uuid-1', 'old-token'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// §6: validateUser
// ---------------------------------------------------------------------------

describe('AuthService.validateUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user when found and active', async () => {
    const user = buildUser();
    const { service, userRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    const result = await service.validateUser('user-uuid-1');

    expect(result).toBe(user);
    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1', isActive: true },
      relations: ['role', 'role.accessLevel'],
    });
  });

  it('throws 401 when user is not found', async () => {
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(service.validateUser('missing-id')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.validateUser('missing-id')).rejects.toThrow(
      'User not found or inactive',
    );
  });

  it('throws 401 when user is inactive (findOne returns null because isActive filter)', async () => {
    // TypeORM `where: { isActive: true }` excludes inactive users → null result
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(service.validateUser('inactive-id')).rejects.toThrow(
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

    const result = await service.loginWithGoogle('id-token');

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(result.user.email).toBe('alice@rtb.gov.rw');
    expect((result.user as Record<string, unknown>).password).toBeUndefined();
  });

  it('verifies the token against our client id', async () => {
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser()),
    });

    await service.loginWithGoogle('id-token');

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

    const result = await service.loginWithGoogle('id-token');

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
    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('refuses a token Google rejects', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad signature'));
    const { service } = await makeService();

    await expect(service.loginWithGoogle('forged')).rejects.toThrow(
      'Invalid or expired Google sign-in.',
    );
  });

  it('refuses a deactivated account', async () => {
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(buildUser({ isActive: false })),
    });

    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('backfills the google link on an admin-created account', async () => {
    const user = buildUser({ googleId: null, avatarUrl: null } as never);
    const { service, userRepo } = await makeService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    await service.loginWithGoogle('id-token');

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

    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
      /Default role "viewer" is missing/,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §7: forgotPassword — OTP issuance
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

describe('AuthService.resetPassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets the new password and clears the code and live sessions', async () => {
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQb(buildUserWithOtp('123456'))),
    });

    const result = await service.resetPassword(
      'alice@rtb.gov.rw',
      '123456',
      'NewPass@123',
    );

    expect(result).toEqual({
      message: 'Password updated. You can now sign in.',
    });

    const saved = userRepo.save.mock.calls[0][0];
    // Plain password handed to save() — the entity's @BeforeUpdate hook hashes it.
    expect(saved.password).toBe('NewPass@123');
    expect(saved.passwordResetToken).toBeNull();
    expect(saved.passwordResetExpiresAt).toBeNull();
    expect(saved.passwordResetAttempts).toBe(0);
    // A reset must log every existing session out.
    expect(saved.refreshToken).toBeNull();
  });

  it('does not change the password when the code is wrong', async () => {
    const { service, userRepo } = await makeService({
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQb(buildUserWithOtp('123456'))),
    });

    await expect(
      service.resetPassword('alice@rtb.gov.rw', '000000', 'NewPass@123'),
    ).rejects.toThrow(BadRequestException);

    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('cannot replay a code that has already been redeemed', async () => {
    // After a successful reset the stored hash is null, so the second
    // attempt loads a user with no pending code.
    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(buildUser())),
    });

    await expect(
      service.resetPassword('alice@rtb.gov.rw', '123456', 'NewPass@123'),
    ).rejects.toThrow(INVALID_OTP_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// §9: token generation — JWT payload and config wiring
// ---------------------------------------------------------------------------

describe('AuthService – JWT token generation wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('stored-hash' as never);
  });

  it('signs access token with JWT_SECRET and refresh token with JWT_REFRESH_SECRET', async () => {
    const user = buildUser();
    const configValues: Record<string, string> = {
      JWT_SECRET: 'my-access-secret',
      JWT_REFRESH_SECRET: 'my-refresh-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };

    const { service, jwtService, configService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    configService.get.mockImplementation(
      (key: string, fallback?: string) => configValues[key] ?? fallback,
    );
    jwtService.signAsync
      .mockReset()
      .mockResolvedValueOnce('signed-access')
      .mockResolvedValueOnce('signed-refresh');

    const result = await service.login({
      email: 'alice@rtb.gov.rw',
      password: 'pw',
    });

    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

    const [accessCall, refreshCall] = jwtService.signAsync.mock.calls;

    // First call: access token
    expect(accessCall[1]).toMatchObject({
      secret: 'my-access-secret',
      expiresIn: '15m',
    });
    // Second call: refresh token
    expect(refreshCall[1]).toMatchObject({
      secret: 'my-refresh-secret',
      expiresIn: '7d',
    });

    expect(result.accessToken).toBe('signed-access');
    expect(result.refreshToken).toBe('signed-refresh');
  });

  it('JWT payload contains sub (userId), email, and role', async () => {
    const user = buildUser({
      id: 'u-42',
      email: 'bob@rtb.gov.rw',
      role: { name: 'gis_analyst' } as any,
    });
    const { service, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');

    await service.login({ email: 'bob@rtb.gov.rw', password: 'pw' });

    const payload = jwtService.signAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      sub: 'u-42',
      email: 'bob@rtb.gov.rw',
      role: { name: 'gis_analyst' },
    });
  });
});
