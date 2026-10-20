import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Authentication hardening (WS9.5, WS9.11, WS10.1–10.9, WS8.7):
 *  - password history / forced change, account lockout counters,
 *  - TOTP + email-code second factor columns, Google unlink marker,
 *  - privacy-notice acceptance,
 *  - the `user_sessions` table for multi-device refresh tokens.
 *
 * Purely additive. Existing users keep signing in: every new flag defaults to
 * "off", and the legacy `users.refreshToken` column stays readable so a live
 * session is migrated into `user_sessions` on its next refresh.
 */
export class AuthHardening1788420000000 implements MigrationInterface {
  name = 'AuthHardening1788420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const add = (sql: string) =>
      queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS ${sql}`);

    await add(`"passwordHistory" jsonb`);
    await add(`"passwordChangedAt" TIMESTAMP`);
    await add(`"mustChangePassword" boolean NOT NULL DEFAULT false`);
    await add(`"failedLoginCount" integer NOT NULL DEFAULT 0`);
    await add(`"lockedUntil" TIMESTAMP`);
    await add(`"totpEnabled" boolean NOT NULL DEFAULT false`);
    await add(`"totpEnabledAt" TIMESTAMP`);
    await add(`"totpSecretEnc" character varying`);
    await add(`"totpPendingSecretEnc" character varying`);
    await add(`"totpLastUsedStep" bigint`);
    await add(`"totpRecoveryCodes" jsonb`);
    await add(`"mfaEmailOtpHash" character varying`);
    await add(`"mfaEmailOtpExpiresAt" TIMESTAMP`);
    await add(`"mfaEmailOtpAttempts" integer NOT NULL DEFAULT 0`);
    await add(`"googleUnlinkedAt" TIMESTAMP`);
    await add(`"privacyAcceptedAt" TIMESTAMP`);
    await add(`"privacyVersion" character varying`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "refresh_token_hash" character varying(64) NOT NULL,
        "previous_token_hash" character varying(64),
        "rotated_at" TIMESTAMP,
        "user_agent" character varying(512),
        "ip" character varying(64),
        "method" character varying(32),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "revoked_at" TIMESTAMP,
        "revoked_reason" character varying(64)
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_sessions_user" ON "user_sessions" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);
    for (const col of [
      'privacyVersion',
      'privacyAcceptedAt',
      'googleUnlinkedAt',
      'mfaEmailOtpAttempts',
      'mfaEmailOtpExpiresAt',
      'mfaEmailOtpHash',
      'totpRecoveryCodes',
      'totpLastUsedStep',
      'totpPendingSecretEnc',
      'totpSecretEnc',
      'totpEnabledAt',
      'totpEnabled',
      'lockedUntil',
      'failedLoginCount',
      'mustChangePassword',
      'passwordChangedAt',
      'passwordHistory',
    ])
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN IF EXISTS "${col}"`,
      );
  }
}
