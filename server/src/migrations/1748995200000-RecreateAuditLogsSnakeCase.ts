import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The original audit_logs table used TypeORM's default camelCase column names
 * (actorId, actorEmail, targetType, targetId, createdAt).  Columns are now
 * explicitly mapped to snake_case names in the entity so raw SQL, Postgres
 * tooling, and future migrations can reference them without quoting.
 *
 * This migration drops the table and lets synchronize (or the next migration
 * run) recreate it with the correct snake_case column names.  The table is new
 * and only contains dev/test data, so no data preservation is needed.
 */
export class RecreateAuditLogsSnakeCase1748995200000
  implements MigrationInterface
{
  name = 'RecreateAuditLogsSnakeCase1748995200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreating the old camelCase table is not worth the effort;
    // rolling back here simply removes the snake_case table.
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
  }
}
