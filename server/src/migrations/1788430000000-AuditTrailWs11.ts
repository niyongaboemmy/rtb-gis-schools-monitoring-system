import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WS11 activity log:
 *  - WS11.1  new columns (actor_role, outcome, target_label, subject_user_id,
 *            changes, ip, user_agent, session_id, request_id, prev_hash, hash)
 *            plus indexes on created_at and subject_user_id;
 *  - created_at narrowed to millisecond precision so it round-trips through JS
 *    Dates exactly (the hash chain and pagination cursor depend on it);
 *  - WS11.6  append-only trigger: UPDATE / DELETE / TRUNCATE raise, except a
 *            DELETE inside a transaction that ran
 *            `SET LOCAL rtb.audit_archive = 'on'` (the retention job).
 *
 * The table owner can still drop the trigger — that is what the hash chain
 * and nightly integrity check are for. Idempotent.
 */
export class AuditTrailWs111788430000000 implements MigrationInterface {
  name = 'AuditTrailWs111788430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1748995200000 dropped the table and left recreation to synchronize; make
    // sure it exists on databases that never ran synchronize.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_id" character varying,
        "actor_email" character varying,
        "action" character varying NOT NULL,
        "target_type" character varying NOT NULL,
        "target_id" character varying,
        "meta" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "actor_role" character varying,
        ADD COLUMN IF NOT EXISTS "outcome" character varying(16) NOT NULL DEFAULT 'success',
        ADD COLUMN IF NOT EXISTS "target_label" character varying,
        ADD COLUMN IF NOT EXISTS "subject_user_id" character varying,
        ADD COLUMN IF NOT EXISTS "changes" jsonb,
        ADD COLUMN IF NOT EXISTS "ip" character varying(64),
        ADD COLUMN IF NOT EXISTS "user_agent" character varying(512),
        ADD COLUMN IF NOT EXISTS "session_id" character varying(128),
        ADD COLUMN IF NOT EXISTS "request_id" character varying(64),
        ADD COLUMN IF NOT EXISTS "prev_hash" character varying(64),
        ADD COLUMN IF NOT EXISTS "hash" character varying(64)`);

    // Before the trigger exists: ALTER TYPE rewrites rows without firing it.
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "created_at" TYPE TIMESTAMP(3)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_actor" ON "audit_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_target" ON "audit_logs" ("target_type", "target_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_action" ON "audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_created_at" ON "audit_logs" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_subject_user" ON "audit_logs" ("subject_user_id")`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE'
           AND coalesce(current_setting('rtb.audit_archive', true), '') = 'on' THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
          USING ERRCODE = 'insufficient_privilege';
      END
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_audit_logs_append_only" ON "audit_logs"`,
    );
    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_logs_append_only"
        BEFORE UPDATE OR DELETE ON "audit_logs"
        FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_audit_logs_no_truncate" ON "audit_logs"`,
    );
    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_logs_no_truncate"
        BEFORE TRUNCATE ON "audit_logs"
        FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_audit_logs_no_truncate" ON "audit_logs"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_audit_logs_append_only" ON "audit_logs"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_append_only()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_subject_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_created_at"`);
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN IF EXISTS "hash",
        DROP COLUMN IF EXISTS "prev_hash",
        DROP COLUMN IF EXISTS "request_id",
        DROP COLUMN IF EXISTS "session_id",
        DROP COLUMN IF EXISTS "user_agent",
        DROP COLUMN IF EXISTS "ip",
        DROP COLUMN IF EXISTS "changes",
        DROP COLUMN IF EXISTS "subject_user_id",
        DROP COLUMN IF EXISTS "target_label",
        DROP COLUMN IF EXISTS "outcome",
        DROP COLUMN IF EXISTS "actor_role"`);
  }
}
