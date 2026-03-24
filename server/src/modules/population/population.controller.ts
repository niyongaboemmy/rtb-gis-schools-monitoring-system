import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PopulationService } from './population.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('population')
@Controller('population')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PopulationController {
  constructor(private readonly populationService: PopulationService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync population data from ArcGIS FeatureServer' })
  sync(@Query('schoolId') schoolId?: string) {
    return this.populationService.syncPopulation(schoolId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all population data' })
  getAll() {
    return this.populationService.getAllPopulation();
  }

  @Get(':schoolId')
  @ApiOperation({ summary: 'Get population data for a specific school' })
  getBySchool(@Param('schoolId') schoolId: string) {
    return this.populationService.getPopulationBySchool(schoolId);
  }
}
