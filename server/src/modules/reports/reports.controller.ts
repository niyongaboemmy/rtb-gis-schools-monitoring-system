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
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto, UpdateReportStatusDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportStatus } from './entities/issue-report.entity';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new issue report' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: diskStorage({
        destination: './uploads/reports',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${uuid()}`;
          cb(null, `report-${uniqueSuffix}${extname(file.originalname)}`);
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
  create(
    @Body() createReportDto: CreateReportDto,
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user.id;
    const attachmentPaths = files?.map((file) => `/uploads/reports/${file.filename}`) || [];
    return this.reportsService.create(
      { ...createReportDto, attachments: attachmentPaths },
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
  findAll(
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: ReportStatus,
    @Query('buildingId') buildingId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('reportedBy') reportedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.findAll({
      schoolId,
      status,
      buildingId,
      facilityId,
      reportedBy,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single issue report by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOne(id);
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
