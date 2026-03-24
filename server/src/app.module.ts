import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),

    // Static Assets
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
      serveStaticOptions: {
        setHeaders: (res) => {
          res.set('Access-Control-Allow-Origin', '*');
        },
      },
    }),

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
  ],
})
export class AppModule {}
