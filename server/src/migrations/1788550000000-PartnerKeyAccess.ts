import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Access level per partner key: the area it reaches (national, a province,
 * a district or a list of schools) and the embedded views it may open.
 * Existing keys stay national with every view.
 */
export class PartnerKeyAccess1788550000000 implements MigrationInterface {
  name = 'PartnerKeyAccess1788550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partner_api_keys" ADD COLUMN IF NOT EXISTS "accessTier" varchar(16) NOT NULL DEFAULT 'national'`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_api_keys" ADD COLUMN IF NOT EXISTS "accessProvince" varchar(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_api_keys" ADD COLUMN IF NOT EXISTS "accessDistrict" varchar(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_api_keys" ADD COLUMN IF NOT EXISTS "accessSchoolCodes" text array`,
    );
    await queryRunner.query(
      `ALTER TABLE "partner_api_keys" ADD COLUMN IF NOT EXISTS "allowedViews" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of [
      'allowedViews',
      'accessSchoolCodes',
      'accessDistrict',
      'accessProvince',
      'accessTier',
    ])
      await queryRunner.query(
        `ALTER TABLE "partner_api_keys" DROP COLUMN IF EXISTS "${col}"`,
      );
  }
}
