import {
  validateEnv,
  requireSecret,
  MIN_SECRET_LENGTH,
} from './env.validation';

const strong = (c: string) => c.repeat(MIN_SECRET_LENGTH);

describe('validateEnv', () => {
  it('refuses to boot without JWT secrets', () => {
    expect(() => validateEnv({})).toThrow(/JWT_SECRET is not set/);
    expect(() => validateEnv({ JWT_SECRET: 'x' })).toThrow(
      /JWT_REFRESH_SECRET is not set/,
    );
    expect(() =>
      validateEnv({ JWT_SECRET: '   ', JWT_REFRESH_SECRET: 'y' }),
    ).toThrow(/JWT_SECRET is not set/);
  });

  it('accepts short secrets outside production', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'dev', JWT_REFRESH_SECRET: 'dev2' }),
    ).not.toThrow();
  });

  it('enforces length, placeholders and distinct secrets in production', () => {
    const prod = { NODE_ENV: 'production' };
    expect(() =>
      validateEnv({
        ...prod,
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: strong('b'),
      }),
    ).toThrow(/at least 32/);
    expect(() =>
      validateEnv({
        ...prod,
        JWT_SECRET: 'your-secret-key-min-32-chars',
        JWT_REFRESH_SECRET: strong('b'),
      }),
    ).toThrow(/placeholder/);
    expect(() =>
      validateEnv({
        ...prod,
        JWT_SECRET: strong('a'),
        JWT_REFRESH_SECRET: strong('a'),
      }),
    ).toThrow(/must differ/);
    expect(() =>
      validateEnv({
        ...prod,
        JWT_SECRET: strong('a'),
        JWT_REFRESH_SECRET: strong('b'),
      }),
    ).toThrow(/TOTP_ENCRYPTION_KEY/);
    expect(() =>
      validateEnv({
        ...prod,
        JWT_SECRET: strong('a'),
        JWT_REFRESH_SECRET: strong('b'),
        TOTP_ENCRYPTION_KEY: strong('c'),
      }),
    ).not.toThrow();
  });
});

describe('requireSecret', () => {
  it('returns the trimmed value or throws', () => {
    expect(requireSecret(() => ' s ', 'JWT_SECRET')).toBe('s');
    expect(() => requireSecret(() => undefined, 'JWT_SECRET')).toThrow();
  });
});
