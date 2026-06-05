import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

// Module-level mock: replaces bcryptjs for every test in this file.
// This is critical for refreshToken tests (SEC-01) where we need
// to control bcrypt.compare's return value without real hashing.
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

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
function buildUser(overrides: Partial<User & { validatePassword: jest.Mock }> = {}): User {
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
}> {
  const userRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...userRepoOverrides,
  };

  const jwtService = {
    signAsync: jest.fn()
      .mockResolvedValueOnce('access-token-1')
      .mockResolvedValueOnce('refresh-token-1'),
    ...jwtOverrides,
  };

  const configService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: userRepo },
      { provide: JwtService, useValue: jwtService },
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();

  return {
    service: module.get(AuthService),
    userRepo,
    jwtService,
    configService,
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

    const result = await service.login({ email: 'alice@rtb.gov.rw', password: 'correct-pw' });

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('alice@rtb.gov.rw');
    // password must be stripped from the returned user object
    expect((result.user as any).password).toBeUndefined();
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

    await expect(service.login({ email: 'x@rtb.gov.rw', password: 'x' })).rejects.toThrow();

    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(mockedBcrypt.hash).not.toHaveBeenCalled();
  });

  it('does NOT generate tokens when password validation fails', async () => {
    const user = buildUser({ validatePassword: jest.fn().mockResolvedValue(false) });
    const { service, userRepo, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(service.login({ email: 'alice@rtb.gov.rw', password: 'wrong' })).rejects.toThrow();

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
    (jwtService.signAsync as jest.Mock).mockReset()
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');

    const result = await service.refreshToken('user-uuid-1', 'raw-refresh-token');

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

    expect(mockedBcrypt.compare).toHaveBeenCalledWith('raw-refresh-token', '$2a$10$storedHash');
  });

  it('persists a new bcrypt hash of the new refresh token after rotation', async () => {
    const user = buildUser({ refreshToken: '$2a$10$storedHash' });
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const { service, userRepo, jwtService } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });
    (jwtService.signAsync as jest.Mock).mockReset()
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

    await expect(service.refreshToken('user-uuid-1', 'bad-token')).rejects.toThrow();

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

    expect(userRepo.update).toHaveBeenCalledWith('user-uuid-1', { refreshToken: null });
    expect(result).toEqual({ message: 'Logged out successfully' });
  });

  it('subsequent refreshToken call fails because token is null (post-logout guard)', async () => {
    // Simulate logout followed by a refresh attempt: the stored token is now null
    const user = buildUser({ refreshToken: null as any });

    const { service } = await makeService({
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(user)),
    });

    await expect(service.refreshToken('user-uuid-1', 'old-token')).rejects.toThrow(
      UnauthorizedException,
    );
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

    await expect(service.validateUser('missing-id')).rejects.toThrow(UnauthorizedException);
    await expect(service.validateUser('missing-id')).rejects.toThrow('User not found or inactive');
  });

  it('throws 401 when user is inactive (findOne returns null because isActive filter)', async () => {
    // TypeORM `where: { isActive: true }` excludes inactive users → null result
    const { service } = await makeService({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(service.validateUser('inactive-id')).rejects.toThrow(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// §7: token generation — JWT payload and config wiring
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

    configService.get.mockImplementation((key: string, fallback?: string) =>
      configValues[key] ?? fallback,
    );
    (jwtService.signAsync as jest.Mock).mockReset()
      .mockResolvedValueOnce('signed-access')
      .mockResolvedValueOnce('signed-refresh');

    const result = await service.login({ email: 'alice@rtb.gov.rw', password: 'pw' });

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
    const user = buildUser({ id: 'u-42', email: 'bob@rtb.gov.rw', role: { name: 'gis_analyst' } as any });
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
