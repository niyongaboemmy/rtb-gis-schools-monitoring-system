import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { DecisionAssessment } from './entities/decision-assessment.entity';
import { ScoreHistory } from './entities/score-history.entity';
import { RecommendationAction } from './entities/recommendation-action.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { SchoolFacilitySurvey } from '../schools/entities/school-facility-survey.entity';
import { IssueReport } from '../reports/entities/issue-report.entity';

@Module({
  imports: [
    AuditModule,
    EventsModule,
    TypeOrmModule.forFeature([
      DecisionAssessment,
      ScoreHistory,
      RecommendationAction,
      School,
      SchoolBuilding,
      PopulationData,
      SchoolFacilitySurvey,
      IssueReport,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
