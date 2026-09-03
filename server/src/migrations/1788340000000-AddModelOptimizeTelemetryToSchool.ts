import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Telemetry for the server-side GLB optimizer so the API (and the 3D viewer)
 * can tell whether the served model is the optimized build or a raw multi-GB
 * photogrammetry export, and why optimization failed if it did.
 */
export class AddModelOptimizeTelemetryToSchool1788340000000 implements MigrationInterface {
  name = 'AddModelOptimizeTelemetryToSchool1788340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "modelOptimized" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "modelBytes" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "modelOptimizeError" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "modelOptimizedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "modelOptimizedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "modelOptimizeError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "modelBytes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "modelOptimized"`,
    );
  }
}
