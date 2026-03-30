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
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PriorityLevel } from './entities/school.entity';
import { ComplianceLevel } from './entities/school-facility-survey.entity';
import { BuildingDto } from './dto/building.dto';

@ApiTags('schools')
@Controller('schools')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('province') province?: string,
    @Query('district') district?: string,
    @Query('priority') priority?: PriorityLevel,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.schoolsService.findAll({
      search,
      province,
      district,
      priority,
      type,
      page,
      limit,
    });
  }

  @Get('geojson')
  @ApiOperation({ summary: 'Get all schools as GeoJSON FeatureCollection' })
  getGeoJson() {
    return this.schoolsService.getGeoJson();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get school statistics' })
  getStats() {
    return this.schoolsService.getStats();
  }

  @Get('facilities')
  @ApiOperation({ summary: 'Get all facility definitions' })
  getAllFacilities() {
    return this.schoolsService.getAllFacilities();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a school by ID with all relations' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.findOne(id);
  }

  @Get(':id/survey')
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
  @ApiOperation({ summary: 'Initialize a new facility survey for a school' })
  initializeSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('inspectedBy') inspectedBy: string,
  ) {
    return this.schoolsService.initializeSurvey(id, inspectedBy);
  }

  @Patch(':id/survey')
  @ApiOperation({ summary: 'Bulk update facility survey items' })
  bulkUpdateSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    updates: {
      itemId: string;
      facilityId: string;
      compliance: ComplianceLevel;
      notes?: string;
    }[],
  ) {
    return this.schoolsService.bulkUpdateSurvey(id, updates);
  }

  @Patch('survey/:surveyId')
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
  @ApiOperation({ summary: 'Update a school' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
  ) {
    return this.schoolsService.update(id, updateSchoolDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a school' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.remove(id);
  }

  // ============ Building Routes ============

  @Post(':id/buildings')
  @ApiOperation({ summary: 'Add a new building to a school' })
  addBuilding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() buildingDto: BuildingDto,
  ) {
    return this.schoolsService.addBuilding(id, buildingDto);
  }

  @Patch('buildings/:id')
  @ApiOperation({ summary: 'Update a specific building' })
  updateBuilding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() buildingDto: BuildingDto,
  ) {
    return this.schoolsService.updateBuilding(id, buildingDto);
  }

  @Delete('buildings/:id')
  @ApiOperation({ summary: 'Remove a specific building' })
  removeBuilding(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolsService.removeBuilding(id);
  }
}
