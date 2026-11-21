import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TDMP sign-in gives identity only (TDMP SSO guide §8), so RTB GIS decides
 * access: a TDMP user nobody pre-registered waits for an administrator.
 */
export class TdmpLocalAccess1788560000000 implements MigrationInterface {
  name = 'TdmpLocalAccess1788560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accessPending" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "accessPending"`,
    );
  }
}
