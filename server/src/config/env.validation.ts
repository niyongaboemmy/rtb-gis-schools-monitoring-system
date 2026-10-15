/**
 * Boot-time environment validation, wired into `ConfigModule.forRoot`.
 *
 * The server refuses to start without real JWT secrets. There is deliberately
 * no fallback: a default secret checked into the repo would let anyone forge
 * an admin token.
 */

/** Minimum secret length in production — 32 bytes of `openssl rand -hex`. */
export const MIN_SECRET_LENGTH = 32;

const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

/** Values copied from `.env.example` that must never reach production. */
const PLACEHOLDER_SECRETS = new Set([
  'your-secret-key-min-32-chars',
  'your-refresh-secret-min-32-chars',
  'rtb-super-secret-key-2026',
]);

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProd = config.NODE_ENV === 'production';
  const errors: string[] = [];

  for (const key of REQUIRED_SECRETS) {
    const value = typeof config[key] === 'string' ? config[key].trim() : '';
    if (!value) {
      errors.push(`${key} is not set`);
      continue;
    }
    if (isProd && value.length < MIN_SECRET_LENGTH)
      errors.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
    if (isProd && PLACEHOLDER_SECRETS.has(value))
      errors.push(`${key} is still the example placeholder`);
  }

  if (
    isProd &&
    config.JWT_SECRET &&
    config.JWT_SECRET === config.JWT_REFRESH_SECRET
  )
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');

  // 2FA secrets are encrypted with this key; MfaService also validates its
  // format. Checked here too so every missing value is reported at once.
  if (
    isProd &&
    !(
      typeof config.TOTP_ENCRYPTION_KEY === 'string' &&
      config.TOTP_ENCRYPTION_KEY.trim()
    )
  )
    errors.push('TOTP_ENCRYPTION_KEY is not set (openssl rand -hex 32)');

  if (errors.length)
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n` +
        'Generate secrets with: openssl rand -hex 32',
    );

  return config;
}

/** Reads a secret that `validateEnv` has already guaranteed is present. */
export function requireSecret(
  get: (key: string) => string | undefined,
  key: (typeof REQUIRED_SECRETS)[number],
): string {
  const value = get(key)?.trim();
  if (!value) throw new Error(`${key} is not set`);
  return value;
}
