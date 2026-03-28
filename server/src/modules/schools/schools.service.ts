import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DeepPartial } from 'typeorm';
import { School, PriorityLevel } from './entities/school.entity';
import {
  SchoolBuilding,
  BuildingCondition,
  RoofCondition,
} from './entities/school-building.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { FacilityEntity } from './entities/facility.entity';
import {
  SchoolFacilitySurvey,
  ComplianceLevel,
} from './entities/school-facility-survey.entity';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolBuilding)
    private readonly schoolBuildingRepository: Repository<SchoolBuilding>,
    @InjectRepository(FacilityEntity)
    private readonly facilityRepository: Repository<FacilityEntity>,
    @InjectRepository(SchoolFacilitySurvey)
    private readonly surveyRepository: Repository<SchoolFacilitySurvey>,
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
      console.log('Creating buildings for school:', savedSchool.id);
      console.log('Buildings data:', buildings);
      const schoolBuildings = buildings.map((building) => {
        const { area, condition, roofCondition, code, latitude, longitude, ...buildingData } =
          building;
        const created = this.schoolBuildingRepository.create({
          ...buildingData,
          schoolId: savedSchool.id,
          buildingCode: code,
          areaSquareMeters: area,
          condition: (condition as BuildingCondition) || BuildingCondition.FAIR,
          roofCondition: (roofCondition as RoofCondition) || RoofCondition.GOOD,
          centroidLat: latitude ?? null,
          centroidLng: longitude ?? null,
        } as DeepPartial<SchoolBuilding>);
        console.log('Created building:', created);
        return created;
      });
      const saved = await this.schoolBuildingRepository.save(schoolBuildings);
      console.log('Saved buildings:', saved);
    } else {
      console.log('No buildings to create. Buildings array:', buildings);
    }

    return this.findOne(savedSchool.id);
  }

  async findAll(query?: {
    search?: string;
    province?: string;
    district?: string;
    priority?: PriorityLevel;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: School[]; total: number; page: number; limit: number }> {
    const {
      search,
      province,
      district,
      priority,
      type,
      page = 1,
      limit = 20,
    } = query || {};

    const where: any = {};
    if (province) where.province = province;
    if (district) where.district = district;
    if (priority) where.priorityLevel = priority;
    if (type) where.type = type;

    const qb = this.schoolRepository.createQueryBuilder('school');

    if (search) {
      qb.where(
        'school.name ILIKE :search OR school.code ILIKE :search OR school.district ILIKE :search',
        {
          search: `%${search}%`,
        },
      );
    }
    if (province) qb.andWhere('school.province = :province', { province });
    if (district) qb.andWhere('school.district = :district', { district });
    if (priority) qb.andWhere('school.priorityLevel = :priority', { priority });
    if (type) qb.andWhere('school.type = :type', { type });

    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('school.overallScore', 'DESC').addOrderBy('school.name', 'ASC');

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
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
      console.log('UPDATE - Processing buildings for school:', id);
      console.log('UPDATE - Buildings data:', buildings);
      // Delete existing buildings
      await this.schoolBuildingRepository.delete({ schoolId: id });

      // Create new buildings if provided
      if (buildings.length > 0) {
        console.log('UPDATE - Creating new buildings...');
        const schoolBuildings = buildings.map((building) => {
          const { area, condition, roofCondition, code, latitude, longitude, ...buildingData } =
            building;
          const created = this.schoolBuildingRepository.create({
            ...buildingData,
            schoolId: id,
            buildingCode: code,
            areaSquareMeters: area,
            condition:
              (condition as BuildingCondition) || BuildingCondition.FAIR,
            roofCondition:
              (roofCondition as RoofCondition) || RoofCondition.GOOD,
            centroidLat: latitude ?? null,
            centroidLng: longitude ?? null,
          } as DeepPartial<SchoolBuilding>);
          console.log('UPDATE - Created building:', created);
          return created;
        });
        const saved = await this.schoolBuildingRepository.save(schoolBuildings);
        console.log('UPDATE - Saved buildings:', saved);
      } else {
        console.log('UPDATE - No buildings to create after deletion');
      }
    } else {
      console.log('UPDATE - Buildings property not provided');
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const school = await this.findOne(id);
    await this.schoolRepository.remove(school);
  }

  async getGeoJson(): Promise<object> {
    const schools = await this.schoolRepository.find();
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

  async getStats(): Promise<object> {
    const total = await this.schoolRepository.count();
    const byPriority = await this.schoolRepository
      .createQueryBuilder('school')
      .select('school.priorityLevel', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('school.priorityLevel')
      .getRawMany();

    const byProvince = await this.schoolRepository
      .createQueryBuilder('school')
      .select('school.province', 'province')
      .addSelect('COUNT(*)', 'count')
      .groupBy('school.province')
      .orderBy('count', 'DESC')
      .getRawMany();

    const byType = await this.schoolRepository
      .createQueryBuilder('school')
      .select('school.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('school.type')
      .getRawMany();

    return { total, byPriority, byProvince, byType };
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
      const survey = await this.surveyRepository.findOne({
        where: {
          schoolId,
          facilityId: update.facilityId,
          itemId: update.itemId,
        },
      });

      if (survey) {
        survey.compliance = update.compliance;
        if (update.notes) {
          survey.notes = update.notes;
        }
        await this.surveyRepository.save(survey);
      }
    }

    return this.surveyRepository.find({ where: { schoolId } });
  }
}
