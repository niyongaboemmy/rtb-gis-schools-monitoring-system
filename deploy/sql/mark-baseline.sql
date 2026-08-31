-- ─── One-time baseline for a brand-new production database ──────────────────
-- Context: the files in server/src/migrations/ are INCREMENTAL changes that
-- assume the base schema already exists (it used to be created by TypeORM
-- `synchronize`). On a fresh EC2 database we bootstrap the schema once by booting
-- the API with DB_SYNC=true, which materialises the CURRENT full schema — meaning
-- the 4 existing migrations are already satisfied. This script records them as
-- applied so `migration:run` won't try to re-run them on the first deploy.
--
-- Run ONCE, immediately after the DB_SYNC=true bootstrap boot:
--   psql "$DATABASE_URL_OR_CONN" -f deploy/sql/mark-baseline.sql
--
-- Every schema change AFTER this point must ship as a new generated migration
-- (server: `npm run migration:generate -- src/migrations/<name>`), committed to
-- the repo. The deploy pipeline runs it automatically.

CREATE TABLE IF NOT EXISTS "migrations" (
    "id" SERIAL NOT NULL,
    "timestamp" bigint NOT NULL,
    "name" character varying NOT NULL,
    CONSTRAINT "PK_migrations" PRIMARY KEY ("id")
);

INSERT INTO "migrations" ("timestamp", "name")
SELECT v.timestamp, v.name
FROM (VALUES
    (1711800000000, 'UpdateBuildingMediaSchema1711800000000'),
    (1748822400000, 'ClearPlaintextRefreshTokens1748822400000'),
    (1748908800000, 'AddResolvedAtToIssueReport1748908800000'),
    (1748995200000, 'RecreateAuditLogsSnakeCase1748995200000')
) AS v(timestamp, name)
WHERE NOT EXISTS (
    SELECT 1 FROM "migrations" m WHERE m.name = v.name
);

SELECT "timestamp", "name" FROM "migrations" ORDER BY "timestamp";
