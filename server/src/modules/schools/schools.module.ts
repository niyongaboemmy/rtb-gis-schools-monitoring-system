import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { School } from './entities/school.entity';
import { SchoolBuilding } from './entities/school-building.entity';
import { SchoolBoundary } from './entities/school-boundary.entity';
import { FacilityEntity } from './entities/facility.entity';
import { SchoolFacilitySurvey } from './entities/school-facility-survey.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      School,
      SchoolBuilding,
      SchoolBoundary,
      FacilityEntity,
      SchoolFacilitySurvey,
    ]),
    StorageModule,
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService, TypeOrmModule],
})
export class SchoolsModule {}
