import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PopulationController } from './population.controller';
import { PopulationService } from './population.service';
import { PopulationData } from './entities/population-data.entity';
import { School } from '../schools/entities/school.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PopulationData, School])],
  controllers: [PopulationController],
  providers: [PopulationService],
  exports: [PopulationService],
})
export class PopulationModule {}
