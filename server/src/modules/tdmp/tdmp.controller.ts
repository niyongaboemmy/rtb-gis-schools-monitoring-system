import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString, Length } from 'class-validator';
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
import { TdmpSchoolSource } from './tdmp-school.source';
import { TdmpUnavailableError } from './tdmp-api.client';
import { TdmpConfig } from './tdmp.config';

class LinkSchoolDto {
  @IsString()
  @Length(1, 64)
  schoolCode: string;
}

/**
 * TDMP integration routes: the school sync (Settings ▸ TDMP), linking local
 * schools to TDMP codes, resolving a TDMP code for deep links, and a school's
 * staff list read live from TDMP.
 */
@ApiTags('tdmp')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@ApiBearerAuth()
export class TdmpController {
  constructor(
    private readonly sync: TdmpSyncService,
    private readonly source: TdmpSchoolSource,
    private readonly config: TdmpConfig,
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
  @ApiOperation({ summary: 'Start a full school sync from TDMP' })
  async startSync(@Request() req: { user?: { email?: string } }) {
    const run = await this.sync.start('manual', req.user?.email ?? null);
    return { started: true, runId: run.id };
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

  @Get('schools/:id/staff')
  @RequirePermissions(Permission.VIEW_SCHOOLS)
  @ScopedResource('id')
  @ApiOperation({ summary: "A school's staff, read live from TDMP" })
  async staff(@Param('id', ParseUUIDPipe) id: string) {
    const school = await this.schools.findOne({
      where: { id },
      select: ['id', 'tdmpSchoolCode'],
    });
    if (!school) throw new NotFoundException('School not found');
    if (!school.tdmpSchoolCode)
      throw new ConflictException('This school is not linked to TDMP.');
    if (!this.config.syncEnabled)
      throw new ServiceUnavailableException(
        'TDMP is not configured (TDMP_API_KEY).',
      );
    try {
      const rows = await this.source.staff(school.tdmpSchoolCode);
      return {
        source: 'tdmp',
        fetchedAt: new Date().toISOString(),
        // Contact details and identifiers stay in TDMP.
        staff: rows.map((t) => ({
          id: t.id,
          names: t.names ?? [t.firstName, t.lastName].filter(Boolean).join(' '),
          gender: t.gender ?? null,
          positionName: t.positionName ?? null,
          qualificationLevel: t.qualificationLevel ?? null,
          staffType: t.staffType ?? null,
          employmentStatus: t.employmentStatus ?? null,
          isHeadTeacher: !!t.isHeadTeacher,
          isDeputyHeadTeacher: !!t.isDeputyHeadTeacher,
        })),
      };
    } catch (err) {
      if (err instanceof TdmpUnavailableError)
        throw new ServiceUnavailableException(
          'TDMP is not reachable right now. Try again later.',
        );
      throw err;
    }
  }
}
