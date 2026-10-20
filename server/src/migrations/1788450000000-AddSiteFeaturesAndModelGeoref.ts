import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WS5.2 / WS5.3 / WS6.4:
 *  - `site_features`: one store for measurements, notes and pins drawn in the
 *    2D or 3D viewer (WGS84 geometry + optional model-frame points).
 *  - School: model scale check result and the model's georeference origin.
 *
 * Existing data (School."siteAnnotations" and the 3D viewer-state measures /
 * annotations) is moved into site_features by SiteFeaturesService.importLegacy
 * the first time each school's features are read — one code path for prod
 * (migrations) and dev (synchronize), idempotent, and able to use the model
 * origin written by the next GLB processing run.
 */
export class AddSiteFeaturesAndModelGeoref1788450000000 implements MigrationInterface {
  name = 'AddSiteFeaturesAndModelGeoref1788450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_features" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
        "kind" varchar(32) NOT NULL,
        "geometry" jsonb NOT NULL,
        "model_coords" jsonb,
        "value" double precision,
        "unit" varchar(16),
        "label" varchar(200),
        "description" text,
        "color" varchar(16),
        "properties" jsonb,
        "source" varchar(2) NOT NULL,
        "legacy_id" varchar(100),
        "created_by" uuid,
        "created_by_name" varchar(200),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_by" uuid,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_site_features_kind" CHECK ("kind" IN
          ('measure_distance','measure_area','measure_perimeter','measure_height','note','pin')),
        CONSTRAINT "CHK_site_features_source" CHECK ("source" IN ('2d','3d'))
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_site_features_school_created" ON "site_features" ("school_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_site_features_legacy_id" ON "site_features" ("legacy_id")`,
    );

    for (const [col, type] of [
      ['modelScaleFactor', 'double precision'],
      ['modelScaleWarning', 'text'],
      ['modelOriginLat', 'double precision'],
      ['modelOriginLng', 'double precision'],
      ['modelOriginAlt', 'double precision'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "${col}" ${type}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of [
      'modelOriginAlt',
      'modelOriginLng',
      'modelOriginLat',
      'modelScaleWarning',
      'modelScaleFactor',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "schools" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "site_features"`);
  }
}
