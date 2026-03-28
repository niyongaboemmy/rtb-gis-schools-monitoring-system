import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get system-wide analytics overview' })
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('decisions')
  @ApiOperation({
    summary: 'Get school decision assessments ranked by priority',
  })
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
  recalculate() {
    return this.analyticsService.recalculateAllScores();
  }
}
