import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserSession } from './entities/user-session.entity';
import { SessionsService } from './sessions.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { CsrfHeaderGuard } from './guards/csrf-header.guard';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { requireSecret } from '../../config/env.validation';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserSession]),
    MailModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: requireSecret(
          (k) => configService.get<string>(k),
          'JWT_SECRET',
        ),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ) as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    MfaService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    CsrfHeaderGuard,
  ],
  exports: [
    AuthService,
    SessionsService,
    MfaService,
    PasswordService,
    JwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}
