import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';
import { existsSync } from 'fs';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { KmzModule } from './modules/kmz/kmz.module';
import { PopulationModule } from './modules/population/population.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { StorageModule } from './modules/storage/storage.module';
import { SeedModule } from './modules/seed/seed.module';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { RolesModule } from './modules/roles/roles.module';
import { AccessLevelsModule } from './modules/access-levels/access-levels.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { EventsModule } from './modules/events/events.module';
import { ScopeModule } from './common/scope/scope.module';
import { SiteFeaturesModule } from './modules/site-features/site-features.module';
import { SchoolLocationModule } from './modules/schools/location/school-location.module';
import { AuditContextGuard } from './common/audit/audit-context.guard';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { RequestContextMiddleware } from './common/audit/request-context.middleware';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),

    // Rate limiting — 200 requests per 60 s globally; auth endpoints override to 5.
    // Skipped only under Jest (NODE_ENV=test), where e2e suites log in many
    // times a minute; production and development are always throttled.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 200 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),

    // Cron job scheduler
    ScheduleModule.forRoot(),

    // Domain events — wildcard enabled for future event-pattern matching
    EventEmitterModule.forRoot({ wildcard: false }),

    // BullMQ — async job queues backed by Redis.
    // REDIS_URL (e.g. Upstash rediss://...) takes priority over host/port.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              lazyConnect: true,
              tls: redisUrl.startsWith('rediss://')
                ? { rejectUnauthorized: false }
                : undefined,
            },
          };
        }
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
          },
        };
      },
      inject: [ConfigService],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),

    // Static Assets — only mount paths that exist (uploads absent on Vercel)
    ...(existsSync(join(__dirname, '..', 'public'))
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
            serveRoot: '/public',
          }),
        ]
      : []),
    ...(existsSync(join(__dirname, '..', 'uploads'))
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
          }),
        ]
      : []),

    // Feature modules
    AuthModule,
    UsersModule,
    SchoolsModule,
    KmzModule,
    PopulationModule,
    AnalyticsModule,
    StorageModule,
    SeedModule,
    RolesModule,
    AccessLevelsModule,
    ReportsModule,
    DashboardModule,
    AuditModule,
    EventsModule,
    ScopeModule,
    SiteFeaturesModule,
    SchoolLocationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Audit (WS11): registered before the throttler so even rejected requests
    // know their handler. Never blocks.
    { provide: APP_GUARD, useClass: AuditContextGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Request id + AsyncLocalStorage audit context for every route (WS11).
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
