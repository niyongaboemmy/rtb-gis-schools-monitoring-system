import {
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
import { ScopedResource } from '../../common/scope/scope.decorator';

@Controller('schools/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // `GET main` was retired: it duplicated /analytics/schools/:id/metrics with
  // divergent formulas and hard-coded utility values, and no client used it.

  @Get('reporting')
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  @ScopedResource('schoolId', 'query')
  async getReporting(
    @Query('schoolId', ParseUUIDPipe) schoolId: string,
  ): Promise<ReportingDashboardDto> {
    return this.dashboardService.reportingPayload(schoolId);
  }
}
