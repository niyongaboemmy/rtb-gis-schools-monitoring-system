import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom, timeout } from 'rxjs';
import { PopulationData } from './entities/population-data.entity';
import { School } from '../schools/entities/school.entity';
import { AccessScope, applySchoolScope } from '../../common/scope/access-scope';
import {
  ACTIVE_SCHOOL_STATUS,
  whereActiveSchool,
} from '../../common/school/active-school';

interface ArcGISFeature {
  attributes: {
    POP2020?: number;
    POP_0_17?: number;
    [key: string]: unknown;
  };
}

interface ArcGISResponse {
  features?: ArcGISFeature[];
}

@Injectable()
export class PopulationService {
  private readonly logger = new Logger(PopulationService.name);

  constructor(
    @InjectRepository(PopulationData)
    private readonly populationRepository: Repository<PopulationData>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 2 * * 0')
  async scheduledSync(): Promise<void> {
    this.logger.log('Starting scheduled weekly population sync (Sunday 2 AM)');
    const result = await this.syncPopulation();
    this.logger.log(
      `Scheduled sync complete: ${result.synced} synced, ${result.errors.length} errors`,
    );
  }

  async syncPopulation(
    schoolId?: string,
  ): Promise<{ synced: number; errors: string[] }> {
    const schools = schoolId
      ? await this.schoolRepository.find({ where: { id: schoolId } })
      : await this.schoolRepository.find({
          where: { status: ACTIVE_SCHOOL_STATUS as any },
        });

    let synced = 0;
    const errors: string[] = [];

    for (const school of schools) {
      try {
        const arcgisData = await this.fetchArcGISPopulation(school);

        const existing = await this.populationRepository.findOne({
          where: { schoolId: school.id },
        });

        if (arcgisData === null) {
          // Fallback: preserve existing data, skip overwrite
          if (existing) {
            this.logger.warn(
              `ArcGIS fetch failed for school ${school.name} — preserving existing population data`,
            );
          } else {
            this.logger.warn(
              `ArcGIS fetch failed for school ${school.name} — no existing data to preserve`,
            );
          }
          synced++;
          continue;
        }

        if (existing) {
          await this.populationRepository.update(existing.id, {
            ...arcgisData,
            syncedAt: new Date(),
          });
        } else {
          await this.populationRepository.save(
            this.populationRepository.create({
              schoolId: school.id,
              ...arcgisData,
              syncedAt: new Date(),
              dataSource: 'ArcGIS FeatureServer',
              dataYear: new Date().getFullYear(),
            }),
          );
        }
        synced++;
      } catch (err) {
        errors.push(`School ${school.name}: ${err.message}`);
      }
    }

    return { synced, errors };
  }

  async getPopulationBySchool(
    schoolId: string,
  ): Promise<PopulationData | null> {
    return this.populationRepository.findOne({ where: { schoolId } });
  }

  async getAllPopulation(scope?: AccessScope): Promise<PopulationData[]> {
    const qb = this.populationRepository
      .createQueryBuilder('pop')
      .innerJoinAndSelect('pop.school', 'school');
    whereActiveSchool(qb, 'school');
    if (scope) applySchoolScope(qb, scope, 'school');
    return qb.getMany();
  }

  private async fetchArcGISPopulation(
    school: School,
  ): Promise<Partial<PopulationData> | null> {
    const baseUrl = this.configService.get<string>('ARCGIS_POPULATION_URL');

    if (!baseUrl) {
      this.logger.warn('ARCGIS_POPULATION_URL is not configured');
      return null;
    }

    const lat = parseFloat(String(school.latitude));
    const lon = parseFloat(String(school.longitude));

    if (isNaN(lat) || isNaN(lon)) {
      this.logger.warn(
        `School ${school.name} has invalid coordinates — skipping ArcGIS fetch`,
      );
      return null;
    }

    const params = new URLSearchParams({
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '2000',
      units: 'esriSRUnit_Meter',
      outFields: 'POP2020,POP_0_17',
      returnGeometry: 'false',
      f: 'json',
    });

    const url = `${baseUrl}/query?${params.toString()}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<ArcGISResponse>(url).pipe(timeout(15000)),
      );

      const features = response.data?.features ?? [];
      const totalPop = features.reduce(
        (sum, f) => sum + (f.attributes?.POP2020 ?? 0),
        0,
      );
      const youthPop = features.reduce(
        (sum, f) => sum + (f.attributes?.POP_0_17 ?? 0),
        0,
      );

      const areaKm2 = Math.PI * 4; // π × r² where r = 2 km
      const density = areaKm2 > 0 ? totalPop / areaKm2 : 0;
      const totalStudents = parseFloat(String(school.totalStudents)) || 0;
      const studentRatio = totalPop > 0 ? totalStudents / totalPop : 0;

      return {
        population2km: totalPop,
        population1km: Math.round(totalPop * 0.5),
        population500m: Math.round(totalPop * 0.15),
        schoolAgePopulation2km: youthPop,
        schoolAgePopulation1km: Math.round(youthPop * 0.5),
        schoolAgePopulation500m: Math.round(youthPop * 0.15),
        populationDensityPerKm2: parseFloat(density.toFixed(4)),
        studentToSchoolRatio: parseFloat(studentRatio.toFixed(2)),
        rawData: {
          source: 'ArcGIS',
          features,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      this.logger.warn(
        `ArcGIS request failed for school ${school.name}: ${err.message}`,
      );
      return null;
    }
  }
}
