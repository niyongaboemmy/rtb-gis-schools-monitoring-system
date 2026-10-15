// Load .env before any decorator is evaluated so process.env is populated
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // Body parsing is registered in configureApp with per-route limits; Nest's
  // own parser would otherwise apply its defaults first.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const { swaggerEnabled } = configureApp(app);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`\n🚀 TVET 3D GIS Server running at: http://localhost:${port}`);
  if (swaggerEnabled)
    console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
}

bootstrap();
