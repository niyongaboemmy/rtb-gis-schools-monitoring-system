import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  // DB_SYNC=true lets you force a one-time schema sync (e.g. initial Supabase setup).
  // Never leave enabled in production after the first deploy.
  const syncEnabled =
    configService.get<string>('DB_SYNC') === 'true' || !isProduction;

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      synchronize: syncEnabled,
      logging: false,
      ssl: { rejectUnauthorized: false },
      extra: {
        // Low connection count: Supabase pooler + Vercel serverless each
        // spin up many functions — keep total connections per function low.
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      },
    };
  }

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_NAME', 'rtb_gis_db'),
    autoLoadEntities: true,
    synchronize: syncEnabled,
    logging: !isProduction,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    extra: {
      max: 10,
      idleTimeoutMillis: 30000,
    },
  };
};
