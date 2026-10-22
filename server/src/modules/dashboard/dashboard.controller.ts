import {
  BadRequestException,
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ReportingDashboardDto } from './dto/reporting-dashboard.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import {
  CurrentScope,
  ScopedResource,
} from '../../common/scope/scope.decorator';
import type { AccessScope } from '../../common/scope/access-scope';
import { REPORTING_PERIODS, ReportingPeriod } from '../analytics/report-stats';

@Controller('schools/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // `GET main` was retired: it duplicated /analytics/schools/:id/metrics with
  // divergent formulas and hard-coded utility values, and no client used it.

  /**
   * Issue Reports across all schools in the caller's scope (School Reporting
   * overview). `period`: 30d (default) | 90d | 12m | all.
   */
  @Get('reporting/overview')
  @RequirePermissions(Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD)
  async getReportingOverview(
    @Query('period') period: string | undefined,
    @CurrentScope() scope?: AccessScope,
  ) {
    const p = (period ?? '30d') as ReportingPeriod;
    if (!REPORTING_PERIODS.includes(p)) {
      throw new BadRequestException(
        `period must be one of ${REPORTING_PERIODS.join(', ')}`,
      );
    }
    return this.dashboardService.reportingOverview(p, scope);
  }

  @Get('reporting')
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  @ScopedResource('schoolId', 'query')
  async getReporting(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
  ): Promise<ReportingDashboardDto> {
    return this.dashboardService.reportingPayload(schoolId);
  }
}
