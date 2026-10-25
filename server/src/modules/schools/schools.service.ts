import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, ILike, DeepPartial, Brackets } from 'typeorm';
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
import { CreateChangeRequestDto } from './dto/change-request.dto';
import { filterSchoolUpdate } from './school-field-permissions';
import { schoolListSelect } from './school-list-select';
import { checkPoint, round7 } from './location/school-location.rules';
import { programmeTotals } from '../analytics/school-metrics.helpers';
import type { ChangeRequestPayload } from '../reports/entities/issue-report.entity';
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

    // One location rule for every writer (school-location.rules.ts).
    const point = checkPoint(schoolData.latitude, schoolData.longitude);
    if ('error' in point) throw new BadRequestException(point.error);

    const school = this.schoolRepository.create({
      ...schoolData,
      latitude: point.lat,
      longitude: point.lng,
      locationSource: 'manual',
      locationUpdatedAt: new Date(),
    });
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
          // Blank = not assessed (null). A defaulted condition used to make
          // unassessed buildings feed the infrastructure score.
          condition: condition ?? null,
          roofCondition: roofCondition ?? null,
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

    this.emitScoringInputChanged(savedSchool.id);
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

    const qb = this.schoolRepository
      .createQueryBuilder('school')
      .select(schoolListSelect('school'));

    if (search) {
      // Bracketed: without it `AND` binds tighter than `OR`, so a name or
      // code match escaped every other filter — the access scope included.
      qb.where(
        new Brackets((w) =>
          w
            .where('school.name ILIKE :search')
            .orWhere('school.code ILIKE :search')
            .orWhere('school.district ILIKE :search'),
        ),
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

  async update(
    id: string,
    updateSchoolDto: UpdateSchoolDto,
    editor?: { role?: { name?: string; permissions?: string[] } | null },
  ): Promise<School> {
    const school = await this.findOne(id);

    // Field-level permissions (WS7.7): a profile editor may only change the
    // groups they hold; locked fields need a change request instead.
    let dto: UpdateSchoolDto = updateSchoolDto;
    if (editor) {
      const isSuperAdmin =
        (editor.role?.name || '').toLowerCase().replace(/\s+/g, '_') ===
        'super_admin';
      const { allowed, rejected } = filterSchoolUpdate(
        updateSchoolDto as Record<string, unknown>,
        school as unknown as Record<string, unknown>,
        editor.role?.permissions ?? [],
        isSuperAdmin,
      );
      if (rejected.length) {
        throw new ForbiddenException({
          message: `You cannot change: ${rejected.join(', ')}. Use "Request a change" instead.`,
          lockedFields: rejected,
        });
      }
      dto = allowed as UpdateSchoolDto;
    }

    // Extract buildings from DTO
    const { buildings, ...schoolData } = dto;

    // Location: the same checks as everywhere (inside Rwanda, not swapped);
    // a real change is stamped as a manual edit so uploads and model jobs
    // follow the precedence rules in school-location.rules.ts.
    const location = this.prepareLocation(school, schoolData);

    // Update school data
    Object.assign(school, schoolData, location);
    await this.schoolRepository.save(school);

    // Update buildings if provided
    if (buildings !== undefined) {
      this.logger.debug(`UPDATE - Processing buildings for school: ${id}`);
      this.logger.debug(
        `UPDATE - Buildings data: ${JSON.stringify(buildings)}`,
      );
      await this.syncBuildings(id, buildings);
    } else {
      this.logger.debug(
        `UPDATE - Buildings property not provided for school ${id}`,
      );
    }

    // Students, programmes, road access, establishment year, status and
    // buildings all feed the School Condition Score.
    this.emitScoringInputChanged(id);
    return this.findOne(id);
  }

  /** Validated location fields for a PATCH, or {} when location was not changed. */
  private prepareLocation(
    school: School,
    data: { latitude?: unknown; longitude?: unknown },
  ): Partial<
    Pick<
      School,
      'latitude' | 'longitude' | 'locationSource' | 'locationUpdatedAt'
    >
  > {
    const { latitude, longitude } = data;
    // Applied below (or not at all) — never copied blindly from the DTO.
    delete data.latitude;
    delete data.longitude;
    if (latitude === undefined && longitude === undefined) return {};
    const point = checkPoint(
      latitude ?? school.latitude,
      longitude ?? school.longitude,
    );
    if ('error' in point) throw new BadRequestException(point.error);
    if (
      round7(Number(school.latitude)) === point.lat &&
      round7(Number(school.longitude)) === point.lng
    )
      return {};
    return {
      latitude: point.lat,
      longitude: point.lng,
      locationSource: 'manual',
      locationUpdatedAt: new Date(),
    };
  }

  /**
   * Validate a change request against the school and attach the current
   * values so the GIS analyst sees "from → to" (WS7.7).
   */
  async buildChangeRequest(
    id: string,
    dto: CreateChangeRequestDto,
  ): Promise<ChangeRequestPayload> {
    const school = await this.findOne(id);
    const seen = new Set<string>();
    const fields = dto.fields.map((f) => {
      if (seen.has(f.field))
        throw new BadRequestException(`Field "${f.field}" is listed twice.`);
      seen.add(f.field);
      if (JSON.stringify(f.proposedValue ?? null).length > 2000)
        throw new BadRequestException(
          `Proposed value for "${f.field}" is too long.`,
        );
      const raw = (school as unknown as Record<string, unknown>)[f.field];
      const currentValue =
        f.field === 'buildings'
          ? `${(school.buildings ?? []).length} building(s)`
          : (raw ?? null);
      return { field: f.field, currentValue, proposedValue: f.proposedValue };
    });
    return { fields, reason: dto.reason.trim() };
  }

  /**
   * Makes the school's buildings match `buildings`, updating rows in place by
   * id. Columns the form never edits (KMZ footprint, 3D model path/metadata,
   * inspection date) are kept, and so is each building's id, which issue
   * reports and viewer pins reference. Buildings missing from the list are
   * deleted; entries without a known id are created.
   */
  private async syncBuildings(schoolId: string, buildings: BuildingDto[]) {
    const existing = await this.schoolBuildingRepository.find({
      where: { schoolId },
    });
    const byId = new Map(existing.map((b) => [b.id, b]));
    const keep = new Set<string>();

    const rows = buildings.map((building) => {
      const {
        id: buildingId,
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
      const current = buildingId ? byId.get(buildingId) : undefined;
      if (current) keep.add(current.id);

      const patch: DeepPartial<SchoolBuilding> = {
        ...buildingData,
        schoolId,
        buildingCode: code,
        areaSquareMeters: area,
        // undefined = field not sent → keep; null/'' = cleared → not assessed.
        condition:
          condition !== undefined
            ? condition || null
            : (current?.condition ?? null),
        roofCondition:
          roofCondition !== undefined
            ? roofCondition || null
            : (current?.roofCondition ?? null),
        centroidLat: latitude ?? null,
        centroidLng: longitude ?? null,
      } as DeepPartial<SchoolBuilding>;
      if (annotations !== undefined) patch.annotations = annotations as never;
      else if (!current) patch.annotations = [];
      if (media !== undefined) patch.media = media as never;
      else if (!current) patch.media = [];

      return current
        ? this.schoolBuildingRepository.merge(current, patch)
        : this.schoolBuildingRepository.create(patch);
    });

    const removed = existing.filter((b) => !keep.has(b.id));
    if (removed.length) await this.schoolBuildingRepository.remove(removed);
    if (rows.length) await this.schoolBuildingRepository.save(rows);
    this.logger.debug(
      `UPDATE - Buildings for school ${schoolId}: ${keep.size} updated, ` +
        `${rows.length - keep.size} created, ${removed.length} removed`,
    );
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
          // Same enrolment/capacity definition as both dashboards.
          totalStudents: programmeTotals(school).students,
          totalCapacity: programmeTotals(school).capacity,
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
      condition: condition || null,
      roofCondition: roofCondition || null,
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

    const saved = await this.schoolBuildingRepository.save(created);
    this.emitScoringInputChanged(schoolId);
    return saved;
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
      condition:
        condition !== undefined ? condition || null : building.condition,
      roofCondition:
        roofCondition !== undefined
          ? roofCondition || null
          : building.roofCondition,
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

    // Only fields that were sent. Never the key: the DTO carries an optional
    // `id` (undefined when omitted) and copying it made save() insert a copy.
    delete updateData.id;
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) (building as any)[key] = value;
    }
    const saved = await this.schoolBuildingRepository.save(building);
    this.emitScoringInputChanged(saved.schoolId);
    return saved;
  }

  async removeBuilding(id: string): Promise<void> {
    const building = await this.schoolBuildingRepository.findOne({
      where: { id },
    });
    if (!building)
      throw new NotFoundException(`Building with ID "${id}" not found`);
    const { schoolId } = building;
    await this.schoolBuildingRepository.remove(building);
    this.emitScoringInputChanged(schoolId);
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
      this.emitScoringInputChanged(schoolId);
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
    // Re-surveying an item resets survey staleness (risk panel, last survey date).
    survey.inspectedAt = new Date();

    const saved = await this.surveyRepository.save(survey);
    this.emitScoringInputChanged(saved.schoolId);
    return saved;
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
          inspectedAt: new Date(),
        });
      } else {
        survey.compliance = update.compliance;
        if (update.notes !== undefined) {
          survey.notes = update.notes;
        }
        survey.inspectedAt = new Date();
      }

      await this.surveyRepository.save(survey);
    }

    const result = await this.surveyRepository.find({ where: { schoolId } });
    this.emitScoringInputChanged(schoolId);
    return result;
  }

  /** Something that feeds the School Condition Score changed → rescore. */
  private emitScoringInputChanged(schoolId: string | undefined | null): void {
    if (schoolId) this.eventEmitter.emit('school.updated', { schoolId });
  }
}
