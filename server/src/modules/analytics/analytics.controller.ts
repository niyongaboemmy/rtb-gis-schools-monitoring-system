import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get system-wide analytics overview' })
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('schools/:schoolId/metrics')
  @ApiOperation({
    summary: 'Computed decision metrics, facility stats, and issue summary for one school',
  })
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  getSchoolMetrics(@Param('schoolId') schoolId: string) {
    return this.analyticsService.getSchoolMetrics(schoolId);
  }

  @Get('decisions')
  @ApiOperation({
    summary: 'Get school decision assessments ranked by priority',
  })
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'priority', required: false })
  getDecisions(
    @Query('province') province?: string,
    @Query('priority') priority?: string,
  ) {
    return this.analyticsService.getDecisions({ province, priority });
  }

  @Post('recalculate')
  @ApiOperation({ summary: 'Re-run decision scoring engine for all schools' })
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  recalculate() {
    return this.analyticsService.recalculateAllScores();
  }
}
