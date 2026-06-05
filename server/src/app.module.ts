import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { KmzModule } from './modules/kmz/kmz.module';
import { PopulationModule } from './modules/population/population.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { StorageModule } from './modules/storage/storage.module';
import { SeedModule } from './modules/seed/seed.module';
import { databaseConfig } from './config/database.config';
import { RolesModule } from './modules/roles/roles.module';
import { AccessLevelsModule } from './modules/access-levels/access-levels.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Rate limiting — 200 requests per 60 s globally; auth endpoints override to 5
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),

    // Cron job scheduler
    ScheduleModule.forRoot(),

    // Domain events — wildcard enabled for future event-pattern matching
    EventEmitterModule.forRoot({ wildcard: false }),

    // BullMQ — async job queues backed by Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
        },
      }),
      inject: [ConfigService],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),

    // Static Assets
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'public'),
        serveRoot: '/public',
      },
      {
        rootPath: join(__dirname, '..', 'uploads'),
        serveRoot: '/uploads',
      },
    ),

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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
