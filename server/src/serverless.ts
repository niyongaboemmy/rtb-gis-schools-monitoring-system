// Serverless entry point for Vercel — wraps NestJS in an Express adapter.
// main.ts is still used for local/Docker development; this file is compiled
// to dist/serverless.js and imported by api/index.js at runtime.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

export async function createHandler(): Promise<express.Express> {
  const expressApp = express.default ? express.default() : (express as any)();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'] },
  );

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cookieParser());

  // body-parser required via CJS to avoid ESM interop issues
  const { json, urlencoded } = require('body-parser');
  // Vercel hard cap is 4.5 MB (Hobby) / ~50 MB (Pro); large KMZ uploads
  // require either a Pro plan or direct-to-storage uploads.
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  const corsOrigins = (process.env.APP_CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('TVET 3D GIS API')
      .setDescription(
        'API for the TVET 3D GIS platform (Rwanda TVET Board)',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('schools', 'School management')
      .addTag('kmz', 'KMZ geospatial processing')
      .addTag('population', 'Population analytics')
      .addTag('analytics', 'Decision support & analytics')
      .addTag('users', 'User management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.init();
  return expressApp;
}
