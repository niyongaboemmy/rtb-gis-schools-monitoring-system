import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([School, SchoolBuilding, PopulationData]),
    AnalyticsModule,
    ReportsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
