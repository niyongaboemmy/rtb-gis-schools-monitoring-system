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
  @ApiOperation({ summary: 'Get all population data' })
  getAll(@CurrentScope() scope?: AccessScope) {
    return this.populationService.getAllPopulation(scope);
  }

  @Get(':schoolId')
  @ScopedResource('schoolId', 'params')
  @ApiOperation({ summary: 'Get population data for a specific school' })
  getBySchool(@Param('schoolId') schoolId: string) {
    return this.populationService.getPopulationBySchool(schoolId);
  }
}
