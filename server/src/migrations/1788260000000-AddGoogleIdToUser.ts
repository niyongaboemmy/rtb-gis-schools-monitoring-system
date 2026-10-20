import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links a user row to a Google identity. Nullable: accounts created by an
 * administrator have no Google link until the user first signs in with it.
 */
export class AddGoogleIdToUser1788260000000 implements MigrationInterface {
  name = 'AddGoogleIdToUser1788260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId"`,
    );
  }
}
