import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TDMP integration: TDMP becomes the source of truth for users and school
 * information.
 *  - users: where the account is managed (authSource) and its TDMP user id
 *  - user_sessions: the encrypted TDMP refresh token of a `tdmp` session
 *  - roles: which TDMP role names map to the role
 *  - schools: the TDMP link (id, code), last sync time and TDMP extras
 *  - tdmp_sync_runs: one row per school sync
 */
export class TdmpIntegration1788520000000 implements MigrationInterface {
  name = 'TdmpIntegration1788520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authSource" varchar(16) NOT NULL DEFAULT 'local'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tdmpUserId" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_tdmpUserId" ON "users" ("tdmpUserId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "external_refresh_token_enc" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "external_checked_at" timestamp`,
    );

    await queryRunner.query(
      `ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "tdmpRoleNames" text array NOT NULL DEFAULT '{}'`,
    );

    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "tdmpSchoolId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "tdmpSchoolCode" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "tdmpSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "tdmpData" jsonb`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_schools_tdmpSchoolId" ON "schools" ("tdmpSchoolId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_schools_tdmpSchoolCode" ON "schools" ("tdmpSchoolCode")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tdmp_sync_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "trigger" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL,
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "totals" jsonb NOT NULL,
        "errors" jsonb NOT NULL DEFAULT '[]',
        "triggeredBy" varchar(255),
        CONSTRAINT "PK_tdmp_sync_runs" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tdmp_sync_runs_startedAt" ON "tdmp_sync_runs" ("startedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tdmp_sync_runs"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_schools_tdmpSchoolCode"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_tdmpSchoolId"`);
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "tdmpData"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "tdmpSyncedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "tdmpSchoolCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "tdmpSchoolId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP COLUMN IF EXISTS "tdmpRoleNames"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN IF EXISTS "external_checked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN IF EXISTS "external_refresh_token_enc"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tdmpUserId"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "tdmpUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "authSource"`,
    );
  }
}
