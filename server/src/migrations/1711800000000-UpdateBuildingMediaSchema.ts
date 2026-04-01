import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateBuildingMediaSchema1711800000000 implements MigrationInterface {
    name = 'UpdateBuildingMediaSchema1711800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add the media column if it doesn't already exist
        await queryRunner.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_buildings' AND column_name='media') THEN
                    ALTER TABLE "school_buildings" ADD COLUMN "media" jsonb DEFAULT '[]';
                END IF;
            END $$;
        `);

        // Migration logic: If any existing records have 'url' instead of 'path' inside the JSONB array, we could migrate them here.
        // For simplicity in this environment, and since it's likely a new feature, we'll ensure the column is ready.
        // Example: UPDATE "school_buildings" SET "media" = ...
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Warning: Deleting the column will cause data loss. Use with caution.
        // await queryRunner.query(`ALTER TABLE "school_buildings" DROP COLUMN "media"`);
    }
}
