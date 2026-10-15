import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PopulationService } from './population.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import {
  CurrentScope,
  RequireNationalScope,
  ScopedResource,
} from '../../common/scope/scope.decorator';
import type { AccessScope } from '../../common/scope/access-scope';

@ApiTags('population')
@Controller('population')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@RequireAnyPermission(
  Permission.VIEW_POPULATION,
  Permission.VIEW_ANALYTICS,
  Permission.SCHOOL_LEVEL_DASHBOARD,
)
@ApiBearerAuth()
export class PopulationController {
  constructor(private readonly populationService: PopulationService) {}

  @Post('sync')
  @RequirePermissions(Permission.SYNC_POPULATION)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Sync population data from ArcGIS FeatureServer' })
  sync(@Query('schoolId') schoolId?: string) {
    return this.populationService.syncPopulation(schoolId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Population records for active, in-scope schools (1 km and 500 m figures are estimated as 50% and 15% of the 2 km value)',
  })
  getAll(@CurrentScope() scope?: AccessScope) {
    return this.populationService.getAllPopulation(scope);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Population KPIs over active, in-scope schools: schools with data, Σ 2 km population, average density, average students per resident, per-province roll-up',
  })
  getSummary(@CurrentScope() scope?: AccessScope) {
    return this.populationService.getPopulationSummary(scope);
  }

  @Get(':schoolId')
  @ScopedResource('schoolId', 'params')
  @ApiOperation({ summary: 'Get population data for a specific school' })
  getBySchool(@Param('schoolId') schoolId: string) {
    return this.populationService.getPopulationBySchool(schoolId);
  }
}
