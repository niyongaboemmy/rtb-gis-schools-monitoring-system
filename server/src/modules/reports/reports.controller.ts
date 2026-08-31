import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuid } from 'uuid';

import { tmpdir } from 'os';
import { isAbsolute } from 'path';

/**
 * The client normally pre-uploads attachments to the file-server and sends only
 * URLs, but this endpoint also accepts multipart. When it does, the file must
 * land in the file-server's storage root so the returned `/files/reports/...`
 * URL actually resolves. FILE_SERVER_STORAGE_PATH points at the shared volume
 * (same value the API's StorageService uses); tmpdir is only a dev fallback.
 */
const REPORTS_STORAGE_DIR = (() => {
  const cfg = process.env.FILE_SERVER_STORAGE_PATH;
  if (!cfg) return join(tmpdir(), 'rtb-reports-fallback');
  return isAbsolute(cfg)
    ? join(cfg, 'reports')
    : join(process.cwd(), cfg, 'reports');
})();

const MAX_ATTACHMENT_MB = parseInt(
  process.env.REPORT_ATTACHMENT_MAX_MB || '25',
  10,
);

try {
  mkdirSync(REPORTS_STORAGE_DIR, { recursive: true });
} catch {
  /* already exists */
}
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  UpdateReportStatusDto,
} from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ReportStatus } from './entities/issue-report.entity';
import { CurrentScope } from '../../common/scope/scope.decorator';
import type { AccessScope } from '../../common/scope/access-scope';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireAnyPermission(
  Permission.VIEW_REPORTING,
  Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
  Permission.CREATE_REPORT,
)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_REPORT)
  @ApiOperation({
    summary:
      'Create a new issue report (Supports both multipart and JSON with URLs)',
  })
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: diskStorage({
        destination: REPORTS_STORAGE_DIR,
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuid()}`;
          cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_ATTACHMENT_MB * 1024 * 1024, files: 5 },
      fileFilter: (req, file, cb) => {
        if (!/\.(jpe?g|png|webp|heic|pdf)$/i.test(file.originalname)) {
          return cb(new Error('Only images and PDF files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @Body() createReportDto: CreateReportDto,
    @Req() req: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const userId = req.user.id;

    // Relative URL — resolves behind the same-origin nginx proxy that fronts
    // both the API and the file-server (see deploy/nginx/*.conf).
    const uploadedPaths =
      files?.map((file) => `/files/reports/${file.filename}`) || [];
    const bodyAttachments = Array.isArray(createReportDto.attachments)
      ? createReportDto.attachments
      : typeof createReportDto.attachments === 'string'
        ? [createReportDto.attachments]
        : [];

    const finalAttachments = [...uploadedPaths, ...bodyAttachments];

    return this.reportsService.create(
      { ...createReportDto, attachments: finalAttachments },
      userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all issue reports' })
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'reportedBy', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: ReportStatus,
    @Query('buildingId') buildingId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('reportedBy') reportedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.reportsService.findAll(
      {
        schoolId,
        status,
        buildingId,
        facilityId,
        reportedBy,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      scope,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single issue report by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.reportsService.findOne(id, scope);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_REPORTS)
  @ApiOperation({ summary: 'Update report details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportDto: Partial<CreateReportDto>,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.reportsService.update(id, updateReportDto, scope);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.MANAGE_REPORTS)
  @ApiOperation({ summary: 'Update report status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportStatusDto: UpdateReportStatusDto,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.reportsService.updateStatus(
      id,
      updateReportStatusDto.status,
      scope,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_REPORTS)
  @ApiOperation({ summary: 'Delete a report' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.reportsService.delete(id, scope);
  }
}
