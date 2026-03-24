import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PopulationData } from './entities/population-data.entity';
import { School } from '../schools/entities/school.entity';

@Injectable()
export class PopulationService {
  constructor(
    @InjectRepository(PopulationData)
    private readonly populationRepository: Repository<PopulationData>,
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
  ) {}

  async syncPopulation(
    schoolId?: string,
  ): Promise<{ synced: number; errors: string[] }> {
    const schools = schoolId
      ? await this.schoolRepository.find({ where: { id: schoolId } })
      : await this.schoolRepository.find();

    let synced = 0;
    const errors: string[] = [];

    for (const school of schools) {
      try {
        // Mock ArcGIS population data (replace with real API call)
        const mockData = this.generateMockPopulationData(school);

        // Upsert population data
        const existing = await this.populationRepository.findOne({
          where: { schoolId: school.id },
        });

        if (existing) {
          await this.populationRepository.update(existing.id, {
            ...mockData,
            syncedAt: new Date(),
          });
        } else {
          await this.populationRepository.save(
            this.populationRepository.create({
              schoolId: school.id,
              ...mockData,
              syncedAt: new Date(),
              dataSource: 'ArcGIS FeatureServer',
              dataYear: 2024,
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

  async getAllPopulation(): Promise<PopulationData[]> {
    return this.populationRepository.find({ relations: ['school'] });
  }

  private generateMockPopulationData(school: School) {
    // Generate realistic random data based on location
    const base = Math.floor(Math.random() * 5000) + 1000;
    return {
      population500m: Math.floor(base * 0.3),
      population1km: Math.floor(base * 0.7),
      population2km: base,
      schoolAgePopulation500m: Math.floor(base * 0.3 * 0.18),
      schoolAgePopulation1km: Math.floor(base * 0.7 * 0.18),
      schoolAgePopulation2km: Math.floor(base * 0.18),
      populationDensityPerKm2: Math.floor(Math.random() * 2000) + 200,
      studentToSchoolRatio:
        (parseFloat(String(school.totalStudents)) || 300) /
        (Math.random() * 3 + 1),
      rawData: { source: 'mock', generatedAt: new Date().toISOString() },
    };
  }
}
