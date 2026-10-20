import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import { ScopedResource } from '../../common/scope/scope.decorator';
import { ViewerStateService } from './viewer-state.service';
import { UpdateViewerStateDto } from './dto/viewer-state.dto';
import { SiteFeaturesService, type ActingUser } from './site-features.service';
import {
  CreateSiteFeatureDto,
  UpdateSiteFeatureDto,
} from './dto/site-feature.dto';

@ApiTags('schools')
@Controller('schools/:schoolId')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@ScopedResource('schoolId', 'params')
@ApiBearerAuth()
export class SiteFeaturesController {
  constructor(
    private readonly viewerState: ViewerStateService,
    private readonly features: SiteFeaturesService,
  ) {}

  @Get('viewer-state')
  @RequirePermissions(Permission.SCHOOL_VIEW_2D3D_MAP)
  @ApiOperation({ summary: '3D viewer state (camera home, building pins)' })
  getViewerState(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.viewerState.get(schoolId);
  }

  @Put('viewer-state')
  @RequirePermissions(Permission.SAVE_SITE_FEATURES)
  @ApiOperation({ summary: 'Save the 3D viewer state for a school' })
  putViewerState(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() dto: UpdateViewerStateDto,
    @Request() req: { user?: { id?: string } },
  ) {
    return this.viewerState.update(schoolId, dto, req.user?.id ?? null);
  }

  // ── Site features (WS5.2) ────────────────────────────────────────────────

  @Get('site-features')
  @RequirePermissions(Permission.SCHOOL_VIEW_2D3D_MAP)
  @ApiOperation({ summary: 'Measurements, notes and pins from both viewers' })
  list(@Param('schoolId', ParseUUIDPipe) schoolId: string) {
    return this.features.list(schoolId);
  }

  @Get('site-features/export.csv')
  @RequirePermissions(Permission.EXPORT_VIEWER_DATA)
  @ApiOperation({ summary: 'Download site features as CSV' })
  async exportCsv(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.features.exportCsv(schoolId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="site-features-${schoolId}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return csv;
  }

  @Post('site-features')
  @RequirePermissions(Permission.SAVE_SITE_FEATURES)
  @ApiOperation({ summary: 'Save a measurement, note or pin' })
  create(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateSiteFeatureDto,
    @Request() req: { user?: ActingUser },
  ) {
    return this.features.create(schoolId, dto, req.user);
  }

  @Patch('site-features/:id')
  @RequirePermissions(Permission.SAVE_SITE_FEATURES)
  @ApiOperation({
    summary: 'Edit a site feature (own, or any with EDIT_SITE_ANNOTATIONS)',
  })
  update(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteFeatureDto,
    @Request() req: { user?: ActingUser },
  ) {
    return this.features.update(schoolId, id, dto, req.user);
  }

  @Delete('site-features/:id')
  @RequirePermissions(Permission.SAVE_SITE_FEATURES)
  @ApiOperation({
    summary: 'Delete a site feature (own, or any with EDIT_SITE_ANNOTATIONS)',
  })
  remove(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user?: ActingUser },
  ) {
    return this.features.remove(schoolId, id, req.user);
  }
}
