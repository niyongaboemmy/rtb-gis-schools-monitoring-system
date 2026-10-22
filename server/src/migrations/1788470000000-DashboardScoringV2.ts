import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dashboard calculation fixes (docs/DASHBOARD_FIX_PLAN.md, phases 2–3).
 *
 * Schema
 *  - decision_assessments: one row per school (dedupe, then UNIQUE index) and
 *    three new columns: dataGaps (jsonb), dataCoverage, scoringVersion.
 *    Every existing row gets scoringVersion 0, so the app rescores all active
 *    schools with the v2 rules on its next boot.
 *  - school_buildings.condition / roofCondition: nullable, no default.
 *    Null = not assessed; a defaulted 'fair' made bare KMZ/GLB stubs look like
 *    inspected buildings.
 *
 * Data
 *  - Placeholder buildings (condition 'fair', roof 'good'/null, every
 *    inventory field empty) → condition/roof NULL. Rows whose only data is
 *    condition 'good' (the old form default) are NOT changed here; they are
 *    listed for GIS review (plan decision D-3).
 *  - population_data school-age counts ≤ 0 → NULL (no data, not "no demand").
 *  - issue_reports: a non-SOLVED report keeps no resolution date.
 *  - score_history: drop consecutive identical snapshots (written on every
 *    dashboard view before v2). The first snapshot of each run is kept.
 *
 * Idempotent: safe to re-run.
 */
export class DashboardScoringV21788470000000 implements MigrationInterface {
  name = 'DashboardScoringV21788470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── decision_assessments ──────────────────────────────────────────────
    await queryRunner.query(`
      DELETE FROM "decision_assessments" a
      USING "decision_assessments" b
      WHERE a."schoolId" = b."schoolId"
        AND (a."updatedAt" < b."updatedAt"
             OR (a."updatedAt" = b."updatedAt" AND a."id" < b."id"))
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_decision_assessments_schoolId" ON "decision_assessments" ("schoolId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_assessments" ADD COLUMN IF NOT EXISTS "dataGaps" jsonb NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_assessments" ADD COLUMN IF NOT EXISTS "dataCoverage" numeric(4,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_assessments" ADD COLUMN IF NOT EXISTS "scoringVersion" integer NOT NULL DEFAULT 0`,
    );

    // ── school_buildings: condition is an assessment, not a default ───────
    await queryRunner.query(`
      ALTER TABLE "school_buildings"
        ALTER COLUMN "condition" DROP DEFAULT,
        ALTER COLUMN "condition" DROP NOT NULL,
        ALTER COLUMN "roofCondition" DROP DEFAULT,
        ALTER COLUMN "roofCondition" DROP NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "school_buildings"
         SET "condition" = NULL, "roofCondition" = NULL
       WHERE "condition" = 'fair'
         AND ("roofCondition" IS NULL OR "roofCondition" = 'good')
         AND "yearBuilt" IS NULL
         AND "structuralScore" IS NULL
         AND "areaSquareMeters" IS NULL
         AND "floors" IS NULL
         AND ("buildingCode" IS NULL OR "buildingCode" = '')
         AND ("notes" IS NULL OR "notes" = '')
         AND "footprintGeojson" IS NULL
         AND "lastInspectionDate" IS NULL
    `);

    // ── population_data: 0 = no data ──────────────────────────────────────
    await queryRunner.query(`
      UPDATE "population_data"
         SET "schoolAgePopulation2km" = NULL,
             "schoolAgePopulation1km" = NULL,
             "schoolAgePopulation500m" = NULL
       WHERE "schoolAgePopulation2km" IS NOT NULL
         AND "schoolAgePopulation2km" <= 0
    `);

    // ── issue_reports: only SOLVED reports carry a resolution date ─────────
    await queryRunner.query(`
      UPDATE "issue_reports" SET "resolvedAt" = NULL
       WHERE "status" <> 'SOLVED' AND "resolvedAt" IS NOT NULL
    `);

    // ── score_history: collapse view-driven duplicate snapshots ───────────
    await queryRunner.query(`
      WITH sig AS (
        SELECT "id",
               concat_ws('|', "overallScore", "infrastructureScore",
                 "buildingAgeScore", "accessibilityScore",
                 "populationPressureScore", "facilityComplianceScore",
                 "resolutionRateScore") AS s,
               LAG(concat_ws('|', "overallScore", "infrastructureScore",
                 "buildingAgeScore", "accessibilityScore",
                 "populationPressureScore", "facilityComplianceScore",
                 "resolutionRateScore"))
                 OVER (PARTITION BY "schoolId" ORDER BY "recordedAt", "id") AS prev
          FROM "score_history"
      )
      DELETE FROM "score_history"
       WHERE "id" IN (SELECT "id" FROM sig WHERE s = prev)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Data clean-ups (placeholders, zero population, reopened dates, pruned
    // history) are not reversible; only the schema is restored.
    await queryRunner.query(
      `UPDATE "school_buildings" SET "condition" = 'fair' WHERE "condition" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "school_buildings" SET "roofCondition" = 'good' WHERE "roofCondition" IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "school_buildings"
        ALTER COLUMN "condition" SET DEFAULT 'fair',
        ALTER COLUMN "condition" SET NOT NULL,
        ALTER COLUMN "roofCondition" SET DEFAULT 'good',
        ALTER COLUMN "roofCondition" SET NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "decision_assessments" DROP COLUMN IF EXISTS "scoringVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_assessments" DROP COLUMN IF EXISTS "dataCoverage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_assessments" DROP COLUMN IF EXISTS "dataGaps"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_decision_assessments_schoolId"`,
    );
  }
}
