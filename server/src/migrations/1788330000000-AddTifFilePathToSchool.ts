import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GeoTIFF overlay path for the 2D viewer. The create/edit form already
 * collected this and School2DViewer already read `school.tifFilePath`, but the
 * column never existed — so the value had nowhere to land.
 */
export class AddTifFilePathToSchool1788330000000 implements MigrationInterface {
  name = 'AddTifFilePathToSchool1788330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "tifFilePath" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "tifFilePath"`,
    );
  }
}
