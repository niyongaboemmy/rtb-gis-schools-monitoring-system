import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WS7.2 permission changes, applied to role rows already in the database:
 *  - renames the misspelt SCHOOL_SURVERY_EDIT to SCHOOL_SURVEY_EDIT;
 *  - grants the new viewer permissions to roles that already had the
 *    capability they split out of, so nobody loses a tool on upgrade:
 *      SCHOOL_VIEW_2D3D_MAP  → USE_MEASURE_TOOLS
 *      EDIT_SITE_ANNOTATIONS → SAVE_SITE_FEATURES
 *      EXPORT_REPORTS        → EXPORT_VIEWER_DATA
 */
export class ViewerPermissionsAndSurveyTypo1788400000100 implements MigrationInterface {
  name = 'ViewerPermissionsAndSurveyTypo1788400000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_replace("permissions", 'SCHOOL_SURVERY_EDIT', 'SCHOOL_SURVEY_EDIT')
       WHERE 'SCHOOL_SURVERY_EDIT' = ANY("permissions")`,
    );
    const grants: [string, string][] = [
      ['SCHOOL_VIEW_2D3D_MAP', 'USE_MEASURE_TOOLS'],
      ['EDIT_SITE_ANNOTATIONS', 'SAVE_SITE_FEATURES'],
      ['EXPORT_REPORTS', 'EXPORT_VIEWER_DATA'],
    ];
    for (const [had, grant] of grants) {
      await queryRunner.query(
        `UPDATE "roles" SET "permissions" = array_append("permissions", $2)
         WHERE $1 = ANY("permissions") AND NOT ($2 = ANY("permissions"))`,
        [had, grant],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const p of [
      'USE_MEASURE_TOOLS',
      'SAVE_SITE_FEATURES',
      'EXPORT_VIEWER_DATA',
    ])
      await queryRunner.query(
        `UPDATE "roles" SET "permissions" = array_remove("permissions", $1)`,
        [p],
      );
    await queryRunner.query(
      `UPDATE "roles" SET "permissions" = array_replace("permissions", 'SCHOOL_SURVEY_EDIT', 'SCHOOL_SURVERY_EDIT')`,
    );
  }
}
