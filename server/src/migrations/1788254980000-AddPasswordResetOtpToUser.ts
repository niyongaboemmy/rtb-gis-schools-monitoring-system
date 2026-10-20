import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Columns backing the forgot-password verification code.
 *
 * `passwordResetToken` holds the SHA-256 hash of the emailed 6-digit code —
 * never the code itself. `passwordResetAttempts` caps brute-force guessing,
 * which matters because a 6-digit code is only 1M wide.
 */
export class AddPasswordResetOtpToUser1788254980000 implements MigrationInterface {
  name = 'AddPasswordResetOtpToUser1788254980000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP`,
    );
    // NOT NULL DEFAULT 0 matches the entity; existing rows backfill to 0.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetAttempts" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetAttempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetToken"`,
    );
  }
}
