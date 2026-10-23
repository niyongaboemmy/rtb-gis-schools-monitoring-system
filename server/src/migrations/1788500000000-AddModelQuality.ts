import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 3D model detail measurement (cm of surface per texture pixel, profile used,
 * warnings), shown in the viewer and on uploads (Phase 1 of
 * docs/3D_QUALITY_IMPLEMENTATION_PLAN.md; existing rows are measured lazily),
 * and the GPU-compressed KTX2 variant of the served model (Phase 3).
 */
export class AddModelQuality1788500000000 implements MigrationInterface {
  name = 'AddModelQuality1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "modelQuality" jsonb NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "modelVariants" jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "modelVariants"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "modelQuality"`,
    );
  }
}
