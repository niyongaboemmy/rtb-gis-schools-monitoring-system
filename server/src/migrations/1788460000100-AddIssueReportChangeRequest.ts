import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WS7.7 "Request a change": issue reports gain a type (issue vs
 * data_change_request), the requested field changes and the role the
 * request is routed to. Existing rows become type 'issue'.
 */
export class AddIssueReportChangeRequest1788460000100 implements MigrationInterface {
  name = 'AddIssueReportChangeRequest1788460000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "type" character varying(40) NOT NULL DEFAULT 'issue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "changeRequest" jsonb NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "assignedRole" character varying(64) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_issue_reports_type" ON "issue_reports" ("type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_issue_reports_type"`);
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "assignedRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "changeRequest"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "type"`,
    );
  }
}
