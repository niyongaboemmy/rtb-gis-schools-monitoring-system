import { DataSource } from 'typeorm';
import { databaseConfig } from './config/database.config';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Clearing KMZ data from all schools...');

  await dataSource.query(`
    UPDATE schools 
    SET "kmzFilePath" = NULL,
        "kmzMasterKmlPath" = NULL,
        "kmz2dFilePath" = NULL,
        "kmz2dManifest" = NULL,
        "kmzStatus" = 'pending',
        "kmzProcessedAt" = NULL,
        "geojsonContent" = NULL,
        "thumbnailUrl" = NULL,
        "placesOverlayFilePath" = NULL,
        "placesOverlayData" = NULL;
  `);

  console.log('Clearing school buildings...');
  await dataSource.query(`DELETE FROM school_buildings`);

  console.log('Clearing school boundaries...');
  await dataSource.query(`DELETE FROM school_boundaries`);

  console.log('Successfully cleared all KMZ-based data!');
  await app.close();
}

bootstrap().catch(console.error);
