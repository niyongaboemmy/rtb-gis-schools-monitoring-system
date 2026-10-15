import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves the 3D viewer state (camera home, building pins, 3D measures and
 * annotations) from the file-server's open `viewer-state.json` into the API,
 * behind JWT, permission and scope checks (finding C3).
 */
export class AddSchoolViewerStates1788400000000 implements MigrationInterface {
  name = 'AddSchoolViewerStates1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "school_viewer_states" (
        "school_id" uuid PRIMARY KEY
          REFERENCES "schools"("id") ON DELETE CASCADE,
        "home" jsonb,
        "building_pins" jsonb NOT NULL DEFAULT '{}',
        "annotations" jsonb NOT NULL DEFAULT '[]',
        "measures" jsonb NOT NULL DEFAULT '[]',
        "updated_by" uuid,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "school_viewer_states"`);
  }
}
