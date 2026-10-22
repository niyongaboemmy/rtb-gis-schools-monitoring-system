import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One way to manage a school's location: record where the current
 * latitude / longitude came from (manual edit, KMZ, 3D model, seed) and when,
 * so uploads and background jobs follow the same precedence rules.
 * Existing rows stay NULL (unknown source).
 */
export class AddSchoolLocationSource1788490000000 implements MigrationInterface {
  name = 'AddSchoolLocationSource1788490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "locationSource" varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "locationUpdatedAt" TIMESTAMP WITH TIME ZONE NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "locationUpdatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "locationSource"`,
    );
  }
}
