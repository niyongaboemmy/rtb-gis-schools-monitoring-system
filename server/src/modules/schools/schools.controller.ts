import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  UseGuards,
  Query,
  ParseUUIDPipe,
  ParseArrayPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import * as XLSX from 'xlsx';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  RequirePermissions,
  RequireAnyPermission,
} from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';
import { ScopeGuard } from '../../common/scope/scope.guard';
import {
  CurrentScope,
  ScopedResource,
} from '../../common/scope/scope.decorator';
import type { AccessScope } from '../../common/scope/access-scope';
import { PriorityLevel, SchoolStatus } from './entities/school.entity';
import { ComplianceLevel } from './entities/school-facility-survey.entity';
import { BuildingDto } from './dto/building.dto';
import { SurveyUpdateItemDto } from './dto/survey-update.dto';

@ApiTags('schools')
@Controller('schools')
@UseGuards(JwtAuthGuard, PermissionsGuard, ScopeGuard)
@RequirePermissions(Permission.VIEW_SCHOOLS)
@ApiBearerAuth()
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_SCHOOL)
  @ApiOperation({ summary: 'Create a new school' })
  create(@Body() createSchoolDto: CreateSchoolDto) {
    return this.schoolsService.create(createSchoolDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schools with filters and pagination' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'priority', required: false, enum: PriorityLevel })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SchoolStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('province') province?: string,
    @Query('district') district?: string,
    @Query('priority') priority?: PriorityLevel,
    @Query('type') type?: string,
    @Query('status') status?: SchoolStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentScope() scope?: AccessScope,
  ) {
    return this.schoolsService.findAll(
      {
        search,
        province,
        district,
        priority,
        type,
        status,
        page,
        limit,
      },
      scope,
    );
  }

  @Get('geojson')
  @RequireAnyPermission(Permission.VIEW_MAP, Permission.VIEW_SCHOOLS)
  @ApiOperation({ summary: 'Get all schools as GeoJSON FeatureCollection' })
  getGeoJson(@CurrentScope() scope?: AccessScope) {
    return this.schoolsService.getGeoJson(scope);
  }

  @Get('stats')
  @RequireAnyPermission(Permission.VIEW_DASHBOARD, Permission.VIEW_SCHOOLS)
  @ApiOperation({ summary: 'Get school statistics' })
  getStats(@CurrentScope() scope?: AccessScope) {
    return this.schoolsService.getStats(scope);
  }

  @Get('facilities')
  @ApiOperation({ summary: 'Get all facility definitions' })
  getAllFacilities() {
    return this.schoolsService.getAllFacilities();
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all schools as an Excel spreadsheet' })
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.EXPORT_REPORTS)
  async exportExcel(
    @Res() res: Response,
    @CurrentScope() scope?: AccessScope,
  ): Promise<void> {
    const { data: schools } = await this.schoolsService.findAll(
      { page: 1, limit: 10000 },
      scope,
    );

    const rows = schools.map((s) => ({
      Code: s.code ?? '',
      Name: s.name ?? '',
      Province: s.province ?? '',
      District: s.district ?? '',
      Type: s.type ?? '',
      Status: s.status ?? '',
      Score: s.overallScore ?? '',
      Priority: s.priorityLevel ?? '',
      Students: s.totalStudents ?? '',
      'Male Teachers': s.maleTeachers ?? '',
      'Female Teachers': s.femaleTeachers ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schools');

    const buffer: Buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="schools-export.xlsx"',
    );
    res.send(buffer);
  }

  @Get(':id')
  @ScopedResource('id')
  @ApiOperation({ summary: 'Get a school by ID with all relations' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.findOne(id);
  }

  @Get(':id/survey')
  @ScopedResource('id')
  @ApiOperation({ summary: 'Get facility survey for a school' })
  getFacilitySurvey(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.getFacilitySurvey(id);
  }

  @Get(':id/buildings')
  @ApiOperation({
    summary: 'Get buildings for a school with optional BBOX filtering',
  })
  @ApiQuery({ name: 'minLat', required: false, type: Number })
  @ApiQuery({ name: 'maxLat', required: false, type: Number })
  @ApiQuery({ name: 'minLng', required: false, type: Number })
  @ApiQuery({ name: 'maxLng', required: false, type: Number })
  @ScopedResource('id')
  getBuildings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string,
  ) {
    const parseNum = (val?: string) => {
      if (val === undefined || val === null || val === '') return undefined;
      const n = parseFloat(val);
      return isFinite(n) ? n : undefined;
    };

    return this.schoolsService.findBuildings(id, {
      minLat: parseNum(minLat),
      maxLat: parseNum(maxLat),
      minLng: parseNum(minLng),
      maxLng: parseNum(maxLng),
    });
  }

  @Post(':id/survey/initialize')
  @ScopedResource('id')
  @RequirePermissions(Permission.RUN_FACILITY_SURVEY)
  @ApiOperation({ summary: 'Initialize a new facility survey for a school' })
  initializeSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('inspectedBy') inspectedBy: string,
  ) {
    return this.schoolsService.initializeSurvey(id, inspectedBy);
  }

  @Patch(':id/survey')
  @ScopedResource('id')
  @RequireAnyPermission(
    Permission.SCHOOL_SURVERY_EDIT,
    Permission.RUN_FACILITY_SURVEY,
  )
  @ApiOperation({ summary: 'Bulk update facility survey items' })
  bulkUpdateSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ParseArrayPipe({ items: SurveyUpdateItemDto }))
    updates: SurveyUpdateItemDto[],
  ) {
    return this.schoolsService.bulkUpdateSurvey(id, updates);
  }

  @Patch('survey/:surveyId')
  @ScopedResource('surveyId', 'params', 'survey')
  @RequireAnyPermission(
    Permission.SCHOOL_SURVERY_EDIT,
    Permission.RUN_FACILITY_SURVEY,
  )
  @ApiOperation({ summary: 'Update a single survey item' })
  updateSurveyItem(
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Body() body: { compliance: ComplianceLevel; notes?: string },
  ) {
    return this.schoolsService.updateSurveyItem(
      surveyId,
      body.compliance,
      body.notes,
    );
  }

  @Patch(':id')
  @ScopedResource('id')
  @RequireAnyPermission(
    Permission.MANAGE_SCHOOLS,
    Permission.EDIT_SCHOOL_PROFILE,
  )
  @ApiOperation({ summary: 'Update a school' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
  ) {
    return this.schoolsService.update(id, updateSchoolDto);
  }

  @Delete(':id')
  @ScopedResource('id')
  @HttpCode(204)
  @RequirePermissions(Permission.DELETE_SCHOOL)
  @ApiOperation({ summary: 'Delete a school' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.schoolsService.remove(id, req.user);
  }

  // ============ Building Routes ============

  @Post(':id/buildings')
  @ScopedResource('id')
  @RequirePermissions(Permission.EDIT_SCHOOL_BUILDINGS)
  @ApiOperation({ summary: 'Add a new building to a school' })
  addBuilding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() buildingDto: BuildingDto,
  ) {
    return this.schoolsService.addBuilding(id, buildingDto);
  }

  @Patch('buildings/:id')
  @ScopedResource('id', 'params', 'building')
  @RequirePermissions(Permission.EDIT_SCHOOL_BUILDINGS)
  @ApiOperation({ summary: 'Update a specific building' })
  updateBuilding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() buildingDto: BuildingDto,
  ) {
    return this.schoolsService.updateBuilding(id, buildingDto);
  }

  @Post(':id/kmz/2d/site-annotations')
  @ScopedResource('id')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @ApiOperation({ summary: 'Add a site annotation' })
  addSiteAnnotation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() annotation: any,
  ) {
    return this.schoolsService.addSiteAnnotation(id, annotation);
  }

  @Delete(':id/kmz/2d/site-annotations/:annId')
  @ScopedResource('id')
  @RequirePermissions(Permission.EDIT_SITE_ANNOTATIONS)
  @ApiOperation({ summary: 'Delete a site annotation' })
  removeSiteAnnotation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('annId') annId: string,
  ) {
    return this.schoolsService.removeSiteAnnotation(id, annId);
  }

  @Delete('buildings/:id')
  @ScopedResource('id', 'params', 'building')
  @RequirePermissions(Permission.EDIT_SCHOOL_BUILDINGS)
  @ApiOperation({ summary: 'Remove a specific building' })
  removeBuilding(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.removeBuilding(id);
  }
}
