import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Report assessment: each status change records the reviewer, the time and
 * an optional note (why it was triaged that way). Existing rows stay NULL.
 */
export class AddIssueReportReview1788480000000 implements MigrationInterface {
  name = 'AddIssueReportReview1788480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "reviewNote" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP WITH TIME ZONE NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid NULL`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_issue_reports_reviewed_by') THEN
          ALTER TABLE "issue_reports" ADD CONSTRAINT "FK_issue_reports_reviewed_by"
            FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP CONSTRAINT IF EXISTS "FK_issue_reports_reviewed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "reviewed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "reviewedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "reviewNote"`,
    );
  }
}
