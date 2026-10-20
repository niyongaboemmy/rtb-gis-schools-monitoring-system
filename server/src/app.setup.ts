import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_BODY_LIMIT,
  PERMISSIONS_POLICY,
  helmetOptions,
  isLargeBodyRoute,
  largeBodyLimit,
} from './common/security/http-hardening';

/**
 * HTTP setup shared by main.ts and the e2e suites, so tests exercise the same
 * middleware, limits, pipes and prefix as production. The app must be created
 * with `bodyParser: false` — body parsing is registered here per route.
 *
 * Returns whether Swagger was mounted.
 */
export function configureApp(app: INestApplication): {
  swaggerEnabled: boolean;
} {
  const isProd = process.env.NODE_ENV === 'production';

  // nginx on the same host terminates TLS; trust it so req.ip / req.secure
  // reflect the real client (lockout audit, session list, Secure cookies).
  (
    app.getHttpAdapter().getInstance() as {
      set: (k: string, v: unknown) => void;
    }
  ).set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');

  // Security headers: CSP (prod), HSTS (prod), Referrer- and Permissions-Policy
  app.use(helmet(helmetOptions(isProd)));
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
  app.use(compression());
  app.use(cookieParser());

  // Body limits (WS9.6): 1 MB everywhere except the few JSON routes that
  // carry geometries or bulk rows. File uploads are multipart → multer.
  const { json, urlencoded } = require('body-parser');
  const largeJson = json({ limit: largeBodyLimit() });
  const smallJson = json({ limit: DEFAULT_BODY_LIMIT });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (isLargeBodyRoute(req.path) ? largeJson : smallJson)(req, res, next),
  );
  app.use(urlencoded({ limit: DEFAULT_BODY_LIMIT, extended: true }));

  // CORS — origins from APP_CORS_ORIGINS env var (comma-separated)
  const corsOrigins = (process.env.APP_CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (
    process.env.NODE_ENV === 'production' &&
    corsOrigins.some((o) => o.includes('localhost'))
  ) {
    console.warn(
      '[WARN] APP_CORS_ORIGINS contains a localhost origin in production. ' +
        'Set APP_CORS_ORIGINS to your production frontend URL(s).',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation — off in production unless explicitly enabled
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

  return { swaggerEnabled };
}
