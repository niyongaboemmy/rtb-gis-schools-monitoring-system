import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partner API (docs/TDMP_INTEGRATION_PLAN.md §14): keys other platforms (TDMP)
 * use to read school coordinates and to request signed embed links. Only a
 * SHA-256 of each key is stored. users.authSource gains 'partner' (varchar,
 * no schema change).
 */
export class PartnerApi1788540000000 implements MigrationInterface {
  name = 'PartnerApi1788540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "partner" varchar(60) NOT NULL,
        "keyPrefix" varchar(24) NOT NULL,
        "keyHash" varchar(64) NOT NULL,
        "scopes" text array NOT NULL,
        "allowedOrigins" text array NOT NULL DEFAULT '{}',
        "serviceUserId" uuid NOT NULL,
        "createdBy" varchar(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "revokedBy" varchar(255)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_partner_api_keys_keyHash" ON "partner_api_keys" ("keyHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partner_api_keys"`);
  }
}
