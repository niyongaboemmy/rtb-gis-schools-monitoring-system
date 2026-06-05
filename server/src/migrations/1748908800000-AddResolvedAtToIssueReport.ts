import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResolvedAtToIssueReport1748908800000
  implements MigrationInterface
{
  name = 'AddResolvedAtToIssueReport1748908800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issue_reports" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "issue_reports" DROP COLUMN IF EXISTS "resolvedAt"`,
    );
  }
}
