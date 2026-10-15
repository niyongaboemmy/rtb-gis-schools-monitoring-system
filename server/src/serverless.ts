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
import {
  DEFAULT_BODY_LIMIT,
  PERMISSIONS_POLICY,
  helmetOptions,
  isLargeBodyRoute,
  largeBodyLimit,
} from './common/security/http-hardening';

export async function createHandler(): Promise<express.Express> {
  const expressApp = express.default ? express.default() : (express as any)();

  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn'], bodyParser: false },
  );

  // Same hardening as main.ts (WS9.6/9.8/9.9/9.13).
  app.use(helmet(helmetOptions(isProd)));
  app.use(
    (
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
      next();
    },
  );
  app.use(compression());
  app.use(cookieParser());

  // body-parser required via CJS to avoid ESM interop issues
  const { json, urlencoded } = require('body-parser');
  // 1 MB everywhere except the JSON routes that carry geometries or bulk
  // rows. Vercel itself caps bodies at 4.5 MB (Hobby) / ~50 MB (Pro).
  const largeJson = json({ limit: largeBodyLimit() });
  const smallJson = json({ limit: DEFAULT_BODY_LIMIT });
  app.use(
    (req: express.Request, res: express.Response, next: express.NextFunction) =>
      (isLargeBodyRoute(req.path) ? largeJson : smallJson)(req, res, next),
  );
  app.use(urlencoded({ limit: DEFAULT_BODY_LIMIT, extended: true }));

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

  // Off in production unless explicitly enabled.
  const swaggerEnabled = isProd
    ? process.env.SWAGGER_ENABLED === 'true'
    : process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('TVET 3D GIS API')
      .setDescription('API for the TVET 3D GIS platform (Rwanda TVET Board)')
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
