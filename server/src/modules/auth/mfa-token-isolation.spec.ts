import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * WS10.6: the short-lived MFA token must never work as an access token —
 * not against the access-token secret, and not through JwtStrategy.
 */
describe('MFA token purpose isolation', () => {
  const config = {
    get: (k: string, d?: unknown) =>
      ({
        JWT_SECRET: 'access-secret-for-tests',
        JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
      })[k] ?? d,
  };
  const jwt = new JwtService({});
  const user = {
    id: 'u1',
    email: 'alice@rtb.gov.rw',
    isActive: true,
    totpEnabled: true,
    role: { permissions: [] },
    validatePassword: jest.fn().mockResolvedValue(true),
  };
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(user),
  };
  const userRepo = {
    createQueryBuilder: () => qb,
    update: jest.fn(),
    findOne: jest.fn().mockResolvedValue(user),
  };
  const service = new AuthService(
    userRepo as never,
    {} as never,
    jwt,
    config as never,
    {} as never,
    { record: jest.fn() } as never,
    {} as never,
    { isRequiredFor: () => false } as never,
    {} as never,
  );

  it('is not verifiable with the access-token secret', async () => {
    const result = (await service.login({
      email: 'alice@rtb.gov.rw',
      password: 'x',
    })) as { mfaToken: string };
    expect(result.mfaToken).toBeDefined();
    await expect(
      jwt.verifyAsync(result.mfaToken, { secret: 'access-secret-for-tests' }),
    ).rejects.toThrow();
  });

  it('is refused by JwtStrategy even if it were signed with the access secret', async () => {
    const strategy = new JwtStrategy(
      config as never,
      { validateUser: jest.fn() } as never,
    );
    await expect(
      strategy.validate({ originalUrl: '/api/v1/schools' } as never, {
        sub: 'u1',
        email: 'x',
        role: {},
        purpose: 'mfa',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('JwtStrategy blocks everything but auth + users/me while a password change is required', async () => {
    const validateUser = jest
      .fn()
      .mockResolvedValue({ id: 'u1', mustChangePassword: true });
    const strategy = new JwtStrategy(
      config as never,
      { validateUser } as never,
    );
    const payload = { sub: 'u1', email: 'x', role: {}, sid: 's1' };

    await expect(
      strategy.validate({ originalUrl: '/api/v1/schools' } as never, payload),
    ).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      strategy.validate(
        { originalUrl: '/api/v1/users/me/password' } as never,
        payload,
      ),
    ).resolves.toMatchObject({
      sessionId: 's1',
    });
    await expect(
      strategy.validate(
        { originalUrl: '/api/v1/auth/sessions' } as never,
        payload,
      ),
    ).resolves.toBeDefined();
  });
});
