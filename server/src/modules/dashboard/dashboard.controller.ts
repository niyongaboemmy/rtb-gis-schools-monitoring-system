import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { MainDashboardDto } from './dto/main-dashboard.dto';
import { ReportingDashboardDto } from './dto/reporting-dashboard.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/constants/permissions.constant';

@Controller('schools/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('main')
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  async getMain(@Query('schoolId') schoolId: string): Promise<MainDashboardDto> {
    return this.dashboardService.mainPayload(schoolId);
  }

  @Get('reporting')
  @RequirePermissions(Permission.SCHOOL_LEVEL_DASHBOARD)
  async getReporting(
    @Query('schoolId') schoolId: string,
  ): Promise<ReportingDashboardDto> {
    return this.dashboardService.reportingPayload(schoolId);
  }
}
