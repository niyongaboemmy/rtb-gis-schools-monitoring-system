import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TDMP sync, list-first (docs/TDMP_INTEGRATION_PLAN.md §5):
 *  - schools: ownership and TDMP administrative unit ids; the out-of-scope
 *    `tdmpData.infrastructure` / `.staff` copies are dropped
 *  - tdmp_sync_runs: dry runs, a per-run report and live progress
 *  - tdmp_settings: when the sync runs on its own (admin-editable)
 */
export class TdmpSyncV21788530000000 implements MigrationInterface {
  name = 'TdmpSyncV21788530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "ownership" varchar(16)`,
    );
    for (const col of [
      'provinceId',
      'districtId',
      'sectorId',
      'cellId',
      'villageId',
    ])
      await queryRunner.query(
        `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "${col}" integer`,
      );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_schools_districtId" ON "schools" ("districtId")`,
    );
    await queryRunner.query(
      `UPDATE "schools" SET "tdmpData" = "tdmpData" - 'infrastructure' - 'staff'
        WHERE "tdmpData" ?| array['infrastructure','staff']`,
    );

    await queryRunner.query(
      `ALTER TABLE "tdmp_sync_runs" ADD COLUMN IF NOT EXISTS "dryRun" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tdmp_sync_runs" ADD COLUMN IF NOT EXISTS "report" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tdmp_sync_runs" ADD COLUMN IF NOT EXISTS "progress" jsonb`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tdmp_settings" (
        "id" varchar(32) PRIMARY KEY,
        "autoSync" boolean NOT NULL DEFAULT true,
        "probeIntervalMinutes" integer NOT NULL DEFAULT 60,
        "dailyRunAt" varchar(5) NOT NULL DEFAULT '07:15',
        "lastProbeAt" TIMESTAMP WITH TIME ZONE,
        "lastSeenMaterialisedAt" varchar(64),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedBy" varchar(255)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tdmp_settings"`);
    for (const col of ['progress', 'report', 'dryRun'])
      await queryRunner.query(
        `ALTER TABLE "tdmp_sync_runs" DROP COLUMN IF EXISTS "${col}"`,
      );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_schools_districtId"`);
    for (const col of [
      'villageId',
      'cellId',
      'sectorId',
      'districtId',
      'provinceId',
      'ownership',
    ])
      await queryRunner.query(
        `ALTER TABLE "schools" DROP COLUMN IF EXISTS "${col}"`,
      );
  }
}
