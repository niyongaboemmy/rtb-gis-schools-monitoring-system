import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, ILike, DeepPartial } from 'typeorm';
import { School, PriorityLevel, SchoolStatus } from './entities/school.entity';
import {
  SchoolBuilding,
  BuildingCondition,
  RoofCondition,
} from './entities/school-building.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { FacilityEntity } from './entities/facility.entity';
import { BuildingDto } from './dto/building.dto';
import {
  SchoolFacilitySurvey,
  ComplianceLevel,
} from './entities/school-facility-survey.entity';
import { StorageService } from '../storage/storage.service';
import { AuditService, AuditActor } from '../audit/audit.service';
import {
  whereActiveSchool,
  isActiveSchool,
} from '../../common/school/active-school';
import {
  AccessScope,
  applySchoolScope,
  schoolMatchesScope,
} from '../../common/scope/access-scope';

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolBuilding)
    private readonly schoolBuildingRepository: Repository<SchoolBuilding>,
    @InjectRepository(FacilityEntity)
    private readonly facilityRepository: Repository<FacilityEntity>,
    @InjectRepository(SchoolFacilitySurvey)
    private readonly surveyRepository: Repository<SchoolFacilitySurvey>,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  async create(createSchoolDto: CreateSchoolDto): Promise<School> {
    const existing = await this.schoolRepository.findOne({
      where: { code: createSchoolDto.code },
    });
    if (existing)
      throw new ConflictException(
        `School with code "${createSchoolDto.code}" already exists`,
      );

    // Extract buildings from DTO
    const { buildings, ...schoolData } = createSchoolDto;

    const school = this.schoolRepository.create(schoolData);
    const savedSchool = await this.schoolRepository.save(school);

    // Create buildings if provided
    if (buildings && buildings.length > 0) {
      this.logger.debug(`Creating buildings for school: ${savedSchool.id}`);
      this.logger.debug(`Buildings data: ${JSON.stringify(buildings)}`);
      const schoolBuildings = buildings.map((building) => {
        const {
          area,
          condition,
          roofCondition,
          code,
          latitude,
          longitude,
          annotations,
          media,
          ...buildingData
        } = building;
        const created = this.schoolBuildingRepository.create({
          ...buildingData,
          schoolId: savedSchool.id,
          buildingCode: code,
          areaSquareMeters: area,
          condition: condition || BuildingCondition.FAIR,
          roofCondition: roofCondition || RoofCondition.GOOD,
          centroidLat: latitude ?? null,
          centroidLng: longitude ?? null,
          annotations: annotations || [],
          media: media || [],
        } as DeepPartial<SchoolBuilding>);
        this.logger.debug(
          `Created building: ${created.buildingCode ?? created.id}`,
        );
        return created;
      });
      const saved = await this.schoolBuildingRepository.save(schoolBuildings);
      this.logger.debug(
        `Saved ${saved.length} building(s) for school ${savedSchool.id}`,
      );
    } else {
      this.logger.debug(`No buildings to create for school ${savedSchool.id}`);
    }

    return this.findOne(savedSchool.id);
  }

  async findAll(
    query?: {
      search?: string;
      province?: string;
      district?: string;
      priority?: PriorityLevel;
      type?: string;
      status?: SchoolStatus;
      page?: number;
      limit?: number;
    },
    scope?: AccessScope,
  ): Promise<{ data: School[]; total: number; page: number; limit: number }> {
    const {
      search,
      province,
      district,
      priority,
      type,
      status,
      page = 1,
      limit = 20,
    } = query || {};

    const qb = this.schoolRepository.createQueryBuilder('school');

    if (search) {
      qb.where(
        'school.name ILIKE :search OR school.code ILIKE :search OR school.district ILIKE :search',
        { search: `%${search}%` },
      );
    }
    if (province) qb.andWhere('school.province = :province', { province });
    if (district) qb.andWhere('school.district = :district', { district });
    if (priority) qb.andWhere('school.priorityLevel = :priority', { priority });
    if (type) qb.andWhere('school.type = :type', { type });
    if (status) qb.andWhere('school.status = :status', { status });

    if (scope) applySchoolScope(qb, scope, 'school');

    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('school.overallScore', 'DESC').addOrderBy('school.name', 'ASC');

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findBuildings(
    id: string,
    extent?: {
      minLat?: number;
      maxLat?: number;
      minLng?: number;
      maxLng?: number;
    },
  ): Promise<SchoolBuilding[]> {
    const qb = this.schoolBuildingRepository
      .createQueryBuilder('building')
      .where('building.schoolId = :id', { id });

    if (
      extent &&
      typeof extent.minLat === 'number' &&
      typeof extent.maxLat === 'number' &&
      typeof extent.minLng === 'number' &&
      typeof extent.maxLng === 'number'
    ) {
      qb.andWhere(
        'building.centroidLat >= :minLat AND building.centroidLat <= :maxLat AND building.centroidLng >= :minLng AND building.centroidLng <= :maxLng',
        {
          minLat: extent.minLat,
          maxLat: extent.maxLat,
          minLng: extent.minLng,
          maxLng: extent.maxLng,
        },
      );
    }

    return qb.orderBy('building.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<School> {
    const school = await this.schoolRepository.findOne({
      where: { id },
      relations: ['buildings', 'boundaries', 'populationData', 'assessments'],
    });
    if (!school)
      throw new NotFoundException(`School with ID "${id}" not found`);
    return school;
  }

  async update(id: string, updateSchoolDto: UpdateSchoolDto): Promise<School> {
    const school = await this.findOne(id);

    // Extract buildings from DTO
    const { buildings, ...schoolData } = updateSchoolDto;

    // Update school data
    Object.assign(school, schoolData);
    await this.schoolRepository.save(school);

    // Update buildings if provided
    if (buildings !== undefined) {
      this.logger.debug(`UPDATE - Processing buildings for school: ${id}`);
      this.logger.debug(
        `UPDATE - Buildings data: ${JSON.stringify(buildings)}`,
      );
      // Delete existing buildings
      await this.schoolBuildingRepository.delete({ schoolId: id });

      // Create new buildings if provided
      if (buildings.length > 0) {
        this.logger.debug('UPDATE - Creating new buildings...');
        const schoolBuildings = buildings.map((building) => {
          const {
            area,
            condition,
            roofCondition,
            code,
            latitude,
            longitude,
            annotations,
            media,
            ...buildingData
          } = building;
          const created = this.schoolBuildingRepository.create({
            ...buildingData,
            schoolId: id,
            buildingCode: code,
            areaSquareMeters: area,
            condition: condition || BuildingCondition.FAIR,
            roofCondition: roofCondition || RoofCondition.GOOD,
            centroidLat: latitude ?? null,
            centroidLng: longitude ?? null,
            annotations: annotations || [],
            media: media || [],
          } as DeepPartial<SchoolBuilding>);
          this.logger.debug(
            `UPDATE - Created building: ${created.buildingCode ?? created.id}`,
          );
          return created;
        });
        const saved = await this.schoolBuildingRepository.save(schoolBuildings);
        this.logger.debug(
          `UPDATE - Saved ${saved.length} building(s) for school ${id}`,
        );
      } else {
        this.logger.debug(
          `UPDATE - No buildings to create after deletion for school ${id}`,
        );
      }
    } else {
      this.logger.debug(
        `UPDATE - Buildings property not provided for school ${id}`,
      );
    }

    return this.findOne(id);
  }

  async remove(id: string, actor?: AuditActor): Promise<void> {
    const school = await this.findOne(id);
    // Delete all spatial assets stored for this school (KMZ, tiles, places overlay, thumbnail)
    await this.storageService.deleteDirectory(`schools/${id}`);
    await this.schoolRepository.remove(school);
    this.auditService.log(actor ?? null, 'school.delete', 'school', id, {
      name: school.name,
      code: school.code,
    });
    // Purge analytics rows keyed off the `schoolId` varchar column — those tables
    // (decision_assessments, score_history, recommendation_action) have no working
    // FK cascade, so without this they linger and keep skewing national analytics.
    this.eventEmitter.emit('school.deleted', { schoolId: id });
  }

  async getGeoJson(scope?: AccessScope): Promise<object> {
    const all = await this.schoolRepository.find();
    // National map is an operating-network view — hide inactive/under-renovation.
    const active = all.filter(isActiveSchool);
    const schools = scope
      ? active.filter((s) => schoolMatchesScope(s, scope))
      : active;
    return {
      type: 'FeatureCollection',
      features: schools.map((school) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            parseFloat(String(school.longitude)),
            parseFloat(String(school.latitude)),
          ],
        },
        properties: {
          id: school.id,
          code: school.code,
          name: school.name,
          type: school.type,
          status: school.status,
          province: school.province,
          district: school.district,
          priorityLevel: school.priorityLevel,
          overallScore: school.overallScore,
          totalStudents:
            school.educationPrograms?.reduce(
              (sum, p) => sum + (parseFloat(String(p.totalStudents)) || 0),
              0,
            ) || 0,
          totalCapacity:
            school.educationPrograms?.reduce(
              (sum, p) => sum + (parseFloat(String(p.capacity)) || 0),
              0,
            ) || 0,
          roadStatusPercentage: school.roadStatusPercentage,
          kmzStatus: school.kmzStatus,
        },
      })),
    };
  }

  async getStats(scope?: AccessScope): Promise<object> {
    const scoped = () => {
      const qb = this.schoolRepository.createQueryBuilder('school');
      whereActiveSchool(qb, 'school');
      if (scope) applySchoolScope(qb, scope, 'school');
      return qb;
    };

    const total = await scoped().getCount();
    const byPriority = await scoped()
      .select('school.priorityLevel', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('school.priorityLevel')
      .getRawMany();

    const byProvince = await scoped()
      .select('school.province', 'province')
      .addSelect('COUNT(*)', 'count')
      .groupBy('school.province')
      .orderBy('count', 'DESC')
      .getRawMany();

    const byType = await scoped()
      .select('school.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('school.type')
      .getRawMany();

    return { total, byPriority, byProvince, byType };
  }

  // ============ Building Methods ============
  async addBuilding(
    schoolId: string,
    dto: BuildingDto,
  ): Promise<SchoolBuilding> {
    const {
      area,
      condition,
      roofCondition,
      code,
      latitude,
      longitude,
      annotations,
      media,
      ...buildingData
    } = dto;

    this.logger.debug(
      `[addBuilding] Received annotations: ${JSON.stringify(annotations)}`,
    );

    const created = this.schoolBuildingRepository.create({
      ...buildingData,
      schoolId,
      buildingCode: code,
      areaSquareMeters: area,
      condition: condition || BuildingCondition.FAIR,
      roofCondition: roofCondition || RoofCondition.GOOD,
      centroidLat: latitude ?? null,
      centroidLng: longitude ?? null,
      // Safety net: filter out any remaining nulls/nested arrays from the DTO transform
      annotations: (annotations || []).filter(
        (a: any) => a && typeof a === 'object' && !Array.isArray(a),
      ),
      media: (media || []).filter(
        (m: any) => m && typeof m === 'object' && !Array.isArray(m),
      ),
    } as DeepPartial<SchoolBuilding>);

    return this.schoolBuildingRepository.save(created);
  }

  async updateBuilding(id: string, dto: BuildingDto): Promise<SchoolBuilding> {
    this.logger.debug(`[updateBuilding] ID: ${id}`);
    this.logger.debug(`[updateBuilding] DTO: ${JSON.stringify(dto)}`);

    const building = await this.schoolBuildingRepository.findOne({
      where: { id },
    });
    if (!building)
      throw new NotFoundException(`Building with ID "${id}" not found`);

    const {
      area,
      condition,
      roofCondition,
      code,
      latitude,
      longitude,
      annotations,
      media,
      ...buildingData
    } = dto;

    const updateData: any = {
      ...buildingData,
      buildingCode: code,
      areaSquareMeters: area,
      condition: condition || building.condition,
      roofCondition: roofCondition || building.roofCondition,
      centroidLat: latitude !== undefined ? latitude : building.centroidLat,
      centroidLng: longitude !== undefined ? longitude : building.centroidLng,
      // Safety net: filter out any remaining nulls/nested arrays from the DTO transform
      annotations:
        annotations !== undefined
          ? (annotations || []).filter(
              (a: any) => a && typeof a === 'object' && !Array.isArray(a),
            )
          : building.annotations,
      media:
        media !== undefined
          ? (media || []).filter(
              (m: any) => m && typeof m === 'object' && !Array.isArray(m),
            )
          : building.media,
    };

    Object.assign(building, updateData);
    const saved = await this.schoolBuildingRepository.save(building);
    this.eventEmitter.emit('school.updated', { schoolId: saved.schoolId });
    return saved;
  }

  async removeBuilding(id: string): Promise<void> {
    const building = await this.schoolBuildingRepository.findOne({
      where: { id },
    });
    if (!building)
      throw new NotFoundException(`Building with ID "${id}" not found`);
    await this.schoolBuildingRepository.remove(building);
  }

  // ============ Facility Survey Methods ============

  async getAllFacilities(): Promise<FacilityEntity[]> {
    return this.facilityRepository.find();
  }

  async getFacilitySurvey(schoolId: string): Promise<SchoolFacilitySurvey[]> {
    return this.surveyRepository.find({
      where: { schoolId },
    });
  }

  async initializeSurvey(
    schoolId: string,
    inspectedBy: string,
  ): Promise<SchoolFacilitySurvey[]> {
    // Get all facilities
    const facilities = await this.facilityRepository.find();
    const surveyRecords: SchoolFacilitySurvey[] = [];

    for (const facility of facilities) {
      for (const item of facility.items) {
        // Check if survey already exists
        const existing = await this.surveyRepository.findOne({
          where: {
            schoolId,
            facilityId: facility.facilityId,
            itemId: item.id,
          },
        });

        if (!existing) {
          const survey = this.surveyRepository.create({
            schoolId,
            facilityId: facility.facilityId,
            itemId: item.id,
            compliance: ComplianceLevel.NON_COMPLIANT,
            inspectedBy,
            inspectedAt: new Date(),
          });
          surveyRecords.push(survey);
        }
      }
    }

    if (surveyRecords.length > 0) {
      await this.surveyRepository.save(surveyRecords);
    }

    return this.surveyRepository.find({ where: { schoolId } });
  }

  async updateSurveyItem(
    id: string,
    compliance: ComplianceLevel,
    notes?: string,
  ): Promise<SchoolFacilitySurvey> {
    const survey = await this.surveyRepository.findOne({ where: { id } });
    if (!survey) {
      throw new NotFoundException(`Survey item not found`);
    }

    survey.compliance = compliance;
    if (notes) {
      survey.notes = notes;
    }

    return this.surveyRepository.save(survey);
  }

  async bulkUpdateSurvey(
    schoolId: string,
    updates: {
      itemId: string;
      facilityId: string;
      compliance: ComplianceLevel;
      notes?: string;
    }[],
  ): Promise<SchoolFacilitySurvey[]> {
    for (const update of updates) {
      let survey = await this.surveyRepository.findOne({
        where: {
          schoolId,
          facilityId: update.facilityId,
          itemId: update.itemId,
        },
      });

      if (!survey) {
        survey = this.surveyRepository.create({
          schoolId,
          facilityId: update.facilityId,
          itemId: update.itemId,
          compliance: update.compliance,
          notes: update.notes,
        });
      } else {
        survey.compliance = update.compliance;
        if (update.notes !== undefined) {
          survey.notes = update.notes;
        }
      }

      await this.surveyRepository.save(survey);
    }

    const result = await this.surveyRepository.find({ where: { schoolId } });
    this.eventEmitter.emit('school.updated', { schoolId });
    return result;
  }

  async addSiteAnnotation(schoolId: string, annotation: any): Promise<any> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school)
      throw new NotFoundException(`School with ID "${schoolId}" not found`);

    if (!school.siteAnnotations) school.siteAnnotations = [];

    // Check if annotation already exists (for updates)
    const existingIdx = school.siteAnnotations.findIndex(
      (a) => a.id === annotation.id,
    );
    if (existingIdx !== -1) {
      school.siteAnnotations[existingIdx] = annotation;
    } else {
      school.siteAnnotations.push(annotation);
    }

    await this.schoolRepository.save(school);
    return annotation;
  }

  async removeSiteAnnotation(schoolId: string, annId: string): Promise<void> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school)
      throw new NotFoundException(`School with ID "${schoolId}" not found`);

    if (school.siteAnnotations) {
      school.siteAnnotations = school.siteAnnotations.filter(
        (a) => a.id !== annId,
      );
      await this.schoolRepository.save(school);
    }
  }
}
