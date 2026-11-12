import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
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
import {
  schoolMatchesScope,
  type AccessScope,
} from '../../common/scope/access-scope';
import { School } from '../schools/entities/school.entity';
import { TdmpSyncService } from './tdmp-sync.service';
import { TdmpConnectionService } from './tdmp-connection.service';
import { PROBE_INTERVALS } from './entities/tdmp-settings.entity';

class LinkSchoolDto {
  @IsString()
  @Length(1, 64)
  schoolCode: string;
}

class StartSyncDto {
  /** Read TDMP and report what would change, without writing. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

class UpdateTdmpSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsIn(PROBE_INTERVALS as unknown as number[])
  probeIntervalMinutes?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'dailyRunAt must be HH:mm' })
  dailyRunAt?: string;
}

type AuthedRequest = { user?: { email?: string } };

/**
 * TDMP integration routes: the school sync and its schedule (TDMP admin
 * page), the connection check, linking local schools to TDMP codes, and
 * resolving a TDMP code for deep links.
 */
@ApiTags('tdmp')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@ApiBearerAuth()
export class TdmpController {
  constructor(
    private readonly sync: TdmpSyncService,
    private readonly connection: TdmpConnectionService,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
  ) {}

  @Get('tdmp/status')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'TDMP integration status and the last sync run' })
  status() {
    return this.sync.status();
  }

  @Post('tdmp/sync')
  @HttpCode(202)
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({
    summary: 'Start a school sync from TDMP now (dryRun: report only)',
  })
  async startSync(@Request() req: AuthedRequest, @Body() dto: StartSyncDto) {
    const run = await this.sync.start('manual', req.user?.email ?? null, {
      dryRun: !!dto?.dryRun,
    });
    return { started: true, runId: run.id, dryRun: run.dryRun };
  }

  @Get('tdmp/sync/runs/:id')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'One TDMP sync run, with its report' })
  run(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.getRun(id);
  }

  @Get('tdmp/settings')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'When the TDMP sync runs on its own' })
  settings() {
    return this.sync.getSettings();
  }

  @Patch('tdmp/settings')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Pause, resume or reschedule the automatic sync' })
  updateSettings(
    @Request() req: AuthedRequest,
    @Body() dto: UpdateTdmpSettingsDto,
  ) {
    return this.sync.updateSettings(dto, req.user?.email ?? null);
  }

  @Get('tdmp/connection')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({
    summary: 'Check TDMP: reachability, our key, and which requests are met',
  })
  checkConnection(@Query('refresh') refresh?: string) {
    return this.connection.check(refresh === 'true' || refresh === '1');
  }

  @Get('tdmp/sync/runs')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Recent TDMP sync runs' })
  runs(@Query('limit') limit?: string) {
    return this.sync.listRuns(Number(limit) || 10);
  }

  @Get('tdmp/schools/unlinked')
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Local schools not linked to a TDMP school yet' })
  unlinked() {
    return this.sync.unlinked();
  }

  @Post('tdmp/schools/:id/link')
  @HttpCode(200)
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @RequireNationalScope()
  @ApiOperation({ summary: 'Link a local school to a TDMP school code' })
  link(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkSchoolDto) {
    return this.sync.link(id, dto.schoolCode);
  }

  @Post('tdmp/schools/:id/refresh')
  @HttpCode(200)
  @RequirePermissions(Permission.MANAGE_SCHOOLS)
  @ScopedResource('id')
  @ApiOperation({ summary: 'Re-read one school from TDMP now' })
  refresh(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.refresh(id);
  }

  @Get('tdmp/schools/resolve/:schoolCode')
  @RequirePermissions(Permission.VIEW_SCHOOLS)
  @ApiOperation({
    summary: 'Our school id for a TDMP school code (links from TDMP)',
  })
  async resolve(
    @Param('schoolCode') schoolCode: string,
    @CurrentScope() scope: AccessScope,
  ) {
    const school = await this.schools.findOne({
      where: [{ tdmpSchoolCode: schoolCode }, { code: schoolCode }],
      select: ['id', 'province', 'district', 'sector'],
    });
    if (!school || !schoolMatchesScope(school, scope))
      throw new NotFoundException('That school is not in RTB GIS yet.');
    return { id: school.id };
  }
}
