import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DecisionAssessment } from './entities/decision-assessment.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { SchoolFacilitySurvey } from '../schools/entities/school-facility-survey.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DecisionAssessment,
      School,
      SchoolBuilding,
      PopulationData,
      SchoolFacilitySurvey,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
