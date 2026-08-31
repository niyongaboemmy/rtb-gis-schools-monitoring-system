import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Header,
  HttpCode,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { ActionStatus } from './entities/recommendation-action.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import {
  CurrentScope,
  RequireNationalScope,
  ScopedResource,
} from '../../common/scope/scope.decorator';
import type { AccessScope } from '../../common/scope/access-scope';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@ScopedResource('schoolId', 'params')
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── National overview ─────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'Get system-wide analytics overview' })
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  getOverview(@CurrentScope() scope?: AccessScope) {
    return this.analyticsService.getOverview(scope);
  }

  // ── Hierarchy drill-down (Province → District → Schools) ─────────────────

  @Get('hierarchy')
  @ApiOperation({
    summary:
      'Province → District → School drill-down. Omit both params for national view.',
  })
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'district', required: false })
  getHierarchy(
    @Query('province') province?: string,
    @Query('district') district?: string,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.analyticsService.getHierarchy(province, district, scope);
  }

  // ── School-level metrics & history ───────────────────────────────────────

  @Get('schools/:schoolId/metrics')
  @ApiOperation({
    summary:
      'Computed decision metrics, facility stats, and issue summary for one school',
  })
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  getSchoolMetrics(@Param('schoolId') schoolId: string) {
    return this.analyticsService.getSchoolMetrics(schoolId);
  }

  @Get('schools/:schoolId/history')
  @ApiOperation({
    summary: 'Score history for a school (default: last 12 months)',
  })
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  @ApiQuery({ name: 'months', required: false, type: Number })
  getHistory(
    @Param('schoolId') schoolId: string,
    @Query('months') months?: string,
  ) {
    return this.analyticsService.getScoreHistory(
      schoolId,
      months ? parseInt(months, 10) : 12,
    );
  }

  // ── Recommendation actions ────────────────────────────────────────────────

  @Get('schools/:schoolId/actions')
  @ApiOperation({ summary: 'List recommendation actions for a school' })
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  getActions(@Param('schoolId') schoolId: string) {
    return this.analyticsService.getActions(schoolId);
  }

  @Post('schools/:schoolId/actions')
  @ApiOperation({ summary: 'Create a recommendation action for a school' })
  @RequirePermissions(Permission.MANAGE_DECISIONS)
  createAction(
    @Param('schoolId') schoolId: string,
    @Body() body: { recommendation: string },
  ) {
    return this.analyticsService.createAction(schoolId, body.recommendation);
  }

  @Patch('actions/:id')
  @ApiOperation({ summary: 'Update status / assignee / due-date of an action' })
  @RequirePermissions(Permission.MANAGE_DECISIONS)
  updateAction(
    @Param('id') id: string,
    @Body()
    body: {
      status?: ActionStatus;
      assignedTo?: string | null;
      dueDate?: string | null;
    },
  ) {
    return this.analyticsService.updateAction(id, body);
  }

  // ── Decisions list ────────────────────────────────────────────────────────

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
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.analyticsService.getDecisions({ province, priority }, scope);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  @Get('export')
  @ApiOperation({ summary: 'Export all school assessments as CSV' })
  @RequirePermissions(Permission.EXPORT_REPORTS)
  @RequireNationalScope()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="rtb-schools-export.csv"',
  )
  exportCsv(): Promise<string> {
    return this.analyticsService.exportNationalCsv();
  }

  // ── Recalculation ─────────────────────────────────────────────────────────

  @Post('recalculate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-run decision scoring engine for all schools' })
  @RequirePermissions(Permission.MANAGE_DECISIONS)
  @RequireNationalScope()
  recalculate(@Request() req: any) {
    return this.analyticsService.recalculateAllScores(req.user);
  }

  @Post('schools/:schoolId/recalculate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Re-run decision scoring engine for a single school',
  })
  @RequirePermissions(Permission.MANAGE_DECISIONS)
  recalculateOne(@Param('schoolId') schoolId: string) {
    return this.analyticsService.recalculateSchoolScore(schoolId);
  }
}
