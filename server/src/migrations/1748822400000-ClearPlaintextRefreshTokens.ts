import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearPlaintextRefreshTokens1748822400000
  implements MigrationInterface
{
  name = 'ClearPlaintextRefreshTokens1748822400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invalidate all existing sessions by nullifying plaintext refresh tokens.
    // After this migration, every user must log in again to receive a properly hashed token.
    await queryRunner.query(
      `UPDATE "users" SET "refreshToken" = NULL WHERE "refreshToken" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot restore cleared tokens — this migration is intentionally irreversible.
  }
}
