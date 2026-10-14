import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WS7.3: track which permissions the seed granted to each built-in role so
 * re-seeding only adds permissions that are new in code, and never reverts
 * an administrator's edits. NULL for existing rows: the next seed treats the
 * current permission list as the baseline (see seed/role-permission-sync.ts).
 */
export class AddRoleSeededPermissions1788460000000 implements MigrationInterface {
  name = 'AddRoleSeededPermissions1788460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "seededPermissions" text[] NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" DROP COLUMN IF EXISTS "seededPermissions"`,
    );
  }
}
