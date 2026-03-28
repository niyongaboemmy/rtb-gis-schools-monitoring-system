import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { School } from '../schools/entities/school.entity';
import { FacilityEntity } from '../schools/entities/facility.entity';
import { AccessLevel } from '../access-levels/entities/access-level.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, School, FacilityEntity, AccessLevel])],
  providers: [SeedService],
})
export class SeedModule {}

