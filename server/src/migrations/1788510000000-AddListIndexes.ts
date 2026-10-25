import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the hot list and aggregate paths (performance plan P5.4):
 * reports by school / status / date, buildings by school, and schools by
 * status (every aggregate filters active schools) and overallScore (the
 * list sort). Postgres does not index foreign-key columns on its own.
 * Names match the @Index decorators on the entities.
 */
export class AddListIndexes1788510000000 implements MigrationInterface {
  name = 'AddListIndexes1788510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_issue_reports_school_id" ON "issue_reports" ("school_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_issue_reports_status" ON "issue_reports" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_issue_reports_createdAt" ON "issue_reports" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_school_buildings_school_id" ON "school_buildings" ("school_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_schools_status" ON "schools" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_schools_overallScore" ON "schools" ("overallScore")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_overallScore"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_school_buildings_school_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_issue_reports_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_issue_reports_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_issue_reports_school_id"`,
    );
  }
}
