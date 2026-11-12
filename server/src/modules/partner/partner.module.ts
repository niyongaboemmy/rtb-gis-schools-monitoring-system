import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { AccessLevel } from '../access-levels/entities/access-level.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolBoundary } from '../schools/entities/school-boundary.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PartnerApiKey } from './entities/partner-api-key.entity';
import { PartnerKeysService } from './partner-keys.service';
import { PartnerSchoolsService } from './partner-schools.service';
import { PartnerApiKeyGuard } from './partner-api-key.guard';
import {
  EmbedController,
  PartnerApiController,
  PartnerKeysController,
} from './partner.controllers';

/**
 * What RTB GIS offers partner platforms (TDMP): a key-authenticated,
 * read-only partner API (schools, coordinates) and signed embed links to the
 * school dashboard and 2D / 3D maps. Guide: /developers.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartnerApiKey,
      User,
      Role,
      AccessLevel,
      School,
      SchoolBoundary,
    ]),
    AuthModule,
    AuditModule,
  ],
  controllers: [PartnerApiController, PartnerKeysController, EmbedController],
  providers: [PartnerKeysService, PartnerSchoolsService, PartnerApiKeyGuard],
})
export class PartnerModule {}
