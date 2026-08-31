// Standalone database seeder.
//   npm run seed        (from /server — builds then runs)
//   npm run seed:prod   (runs the already-built dist)
// Seeding is idempotent; safe to run repeatedly. Startup seeding is separate and
// gated by SEED_ON_STARTUP (see SeedService.onModuleInit).
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SeedService } from './modules/seed/seed.service';

async function bootstrap() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    await app.get(SeedService).run();
    logger.log('✅ Seeding complete');
  } catch (err) {
    logger.error('❌ Seeding failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
