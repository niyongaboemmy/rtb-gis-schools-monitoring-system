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

// Resolve report storage dir from env — must match FILE_SERVER_STORAGE_DIR in file-server/.env
const _fileServerStoragePath = process.env.FILE_SERVER_STORAGE_PATH
  ? join(process.cwd(), process.env.FILE_SERVER_STORAGE_PATH)
  : join(process.cwd(), '..', 'file-server', 'storage');

const REPORTS_STORAGE_DIR = join(_fileServerStoragePath, 'reports');
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
import { ReportStatus } from './entities/issue-report.entity';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
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
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|pdf)$/)) {
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

    // Combine uploaded files with any pre-uploaded attachment URLs
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
  ) {
    return this.reportsService.findAll({
      schoolId,
      status,
      buildingId,
      facilityId,
      reportedBy,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single issue report by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update report details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportDto: Partial<CreateReportDto>,
  ) {
    return this.reportsService.update(id, updateReportDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update report status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportStatusDto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, updateReportStatusDto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a report' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.delete(id);
  }
}
