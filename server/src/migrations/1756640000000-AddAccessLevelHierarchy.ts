import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the geographic-hierarchy metadata to `access_levels` and a supporting
 * index on `schools`. Purely additive — no column is dropped and no row is
 * deleted, so existing data is preserved. Safe to run on a populated database.
 */
export class AddAccessLevelHierarchy1756640000000 implements MigrationInterface {
  name = 'AddAccessLevelHierarchy1756640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_levels" ADD COLUMN IF NOT EXISTS "slug" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_levels" ADD COLUMN IF NOT EXISTS "rank" smallint NOT NULL DEFAULT 100`,
    );

    // Backfill slug from the existing name where not already set.
    await queryRunner.query(
      `UPDATE "access_levels" SET "slug" = lower("name") WHERE "slug" IS NULL`,
    );

    // Backfill rank for the five known tiers; leave custom levels at 100.
    await queryRunner.query(`
      UPDATE "access_levels" SET "rank" = CASE lower("name")
        WHEN 'national' THEN 10
        WHEN 'province' THEN 20
        WHEN 'district' THEN 30
        WHEN 'sector'   THEN 40
        WHEN 'school'   THEN 50
        ELSE "rank"
      END
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_access_levels_slug" ON "access_levels" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_schools_admin_area" ON "schools" ("province", "district", "sector")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_admin_area"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_access_levels_slug"`);
    await queryRunner.query(
      `ALTER TABLE "access_levels" DROP COLUMN IF EXISTS "rank"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_levels" DROP COLUMN IF EXISTS "slug"`,
    );
  }
}
