/**
 * BUG-02 regression suite — healthIndex in DashboardService.mainPayload
 *
 * healthIndex now shares the canonical condition map with analytics.service
 * (scoring.constants.ts) so the school dashboard's healthIndex always matches
 * its infrastructureScore. These tests pin the arithmetic.
 *
 * Logic under test (dashboard.service.ts + scoring.constants.ts):
 *   CONDITION_SCORE_MAP = { good: 100, fair: 70, poor: 30, critical: 10 }
 *   healthSum    = buildings.reduce((acc, b) => acc + (CONDITION_SCORE_MAP[b.condition] ?? 50), 0)
 *   healthIndex  = buildings.length > 0 ? round(healthSum / buildings.length) : 50
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding, BuildingCondition } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBuilding(condition: BuildingCondition, extra: Partial<SchoolBuilding> = {}): SchoolBuilding {
  return {
    id: `b-${Math.random()}`,
    schoolId: 'school-1',
    condition,
    yearBuilt: 2015,      // deterministic ageScore (≈9 years old → 95)
    lastInspectionDate: new Date(),
    ...extra,
  } as unknown as SchoolBuilding;
}

function buildSchool(buildings: SchoolBuilding[], extra: Partial<School> = {}): School {
  return {
    id: 'school-1',
    name: 'Test School',
    code: 'TST-001',
    buildings,
    populationData: [],
    educationPrograms: [],
    establishedYear: 2010,
    usedLandArea: null,
    ...extra,
  } as unknown as School;
}

/** Assembles the DashboardService with all dependencies mocked. */
async function makeService(
  schoolRepoOverrides: Partial<Record<string, jest.Mock>> = {},
): Promise<{ service: DashboardService; schoolRepo: Record<string, jest.Mock> }> {
  const schoolRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    ...schoolRepoOverrides,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DashboardService,
      { provide: getRepositoryToken(School), useValue: schoolRepo },
      { provide: getRepositoryToken(SchoolBuilding), useValue: { find: jest.fn().mockResolvedValue([]) } },
      { provide: getRepositoryToken(PopulationData), useValue: { find: jest.fn().mockResolvedValue([]) } },
      {
        provide: ReportsService,
        useValue: { findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }) },
      },
      {
        provide: AnalyticsService,
        useValue: {
          getSchoolMetrics: jest.fn().mockResolvedValue({
            overallScore: 70, infrastructureScore: 70, buildingAgeScore: 80,
            populationPressureScore: 50, accessibilityScore: 60,
            facilityComplianceScore: 50, depreciation: 20,
            reportSummary: { total: 0 },
          }),
        },
      },
    ],
  }).compile();

  return { service: module.get(DashboardService), schoolRepo };
}

// ---------------------------------------------------------------------------
// BUG-02 regression: healthIndex calculation in mainPayload
// ---------------------------------------------------------------------------

describe('DashboardService.mainPayload – healthIndex (BUG-02 regression)', () => {
  it('[BUG-02] all GOOD buildings → healthIndex > 80', async () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.GOOD),
    ];
    const school = buildSchool(buildings);
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(school);

    const result = await service.mainPayload('school-1');

    // conditionMap[GOOD] = 100 → avg = 100 → must be > 80
    expect(result.data.infrastructure.healthIndex).toBeGreaterThan(80);
  });

  it('[BUG-02] all CRITICAL buildings → healthIndex < 20', async () => {
    const buildings = [
      buildBuilding(BuildingCondition.CRITICAL),
      buildBuilding(BuildingCondition.CRITICAL),
      buildBuilding(BuildingCondition.CRITICAL),
    ];
    const school = buildSchool(buildings);
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(school);

    const result = await service.mainPayload('school-1');

    // conditionMap[CRITICAL] = 10 → avg = 10 → must be < 20
    expect(result.data.infrastructure.healthIndex).toBeLessThan(20);
  });

  it('[BUG-02] no buildings → healthIndex = 50 (neutral default)', async () => {
    const school = buildSchool([]);
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(school);

    const result = await service.mainPayload('school-1');

    // buildings.length === 0 → service returns hardcoded 50
    expect(result.data.infrastructure.healthIndex).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// healthIndex exact values — pins the arithmetic so regressions show numbers
// ---------------------------------------------------------------------------

describe('DashboardService.mainPayload – healthIndex exact values', () => {
  it('single GOOD building → healthIndex = 100', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([buildBuilding(BuildingCondition.GOOD)]));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.healthIndex).toBe(100);
  });

  it('single FAIR building → healthIndex = 70', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([buildBuilding(BuildingCondition.FAIR)]));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.healthIndex).toBe(70);
  });

  it('single POOR building → healthIndex = 30 (canonical condition map)', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([buildBuilding(BuildingCondition.POOR)]));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.healthIndex).toBe(30);
  });

  it('single CRITICAL building → healthIndex = 10', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([buildBuilding(BuildingCondition.CRITICAL)]));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.healthIndex).toBe(10);
  });

  it('mixed GOOD + CRITICAL → healthIndex = Math.round((100 + 10) / 2) = 55', async () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.CRITICAL),
    ];
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool(buildings));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.healthIndex).toBe(55);
  });

  it('mixed GOOD + FAIR → healthIndex = Math.round((100 + 70) / 2) = 85', async () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.FAIR),
    ];
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool(buildings));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.healthIndex).toBe(85);
  });

  it('unknown condition falls back to neutral 50 in the average', async () => {
    // Canonical model: an unrecognised condition string is treated as "no data"
    // for that building (neutral 50), matching analytics.service.
    const buildings = [
      buildBuilding(BuildingCondition.CRITICAL),
      { ...buildBuilding(BuildingCondition.CRITICAL), condition: 'unknown_xyz' } as any,
    ];
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool(buildings));

    const { data } = await service.mainPayload('school-1');
    // (10 + 50) / 2 = 30
    expect(data.infrastructure.healthIndex).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// mainPayload – other fields in the infrastructure slice
// ---------------------------------------------------------------------------

describe('DashboardService.mainPayload – infrastructure slice correctness', () => {
  it('maintenanceDue = true when a CRITICAL building exists', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(
      buildSchool([buildBuilding(BuildingCondition.CRITICAL)]),
    );

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.maintenanceDue).toBe(true);
  });

  it('maintenanceDue = true when a POOR building exists', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(
      buildSchool([buildBuilding(BuildingCondition.POOR)]),
    );

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.maintenanceDue).toBe(true);
  });

  it('maintenanceDue = false when all buildings are GOOD and recently inspected', async () => {
    const recentDate = new Date(); // inspected today → not outdated
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(
      buildSchool([buildBuilding(BuildingCondition.GOOD, { lastInspectionDate: recentDate })]),
    );

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.maintenanceDue).toBe(false);
  });

  it('capacityUtilization = 0 when no education programs defined', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([]));

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.capacityUtilization).toBe(0);
  });

  it('capacityUtilization reflects students / capacity ratio from programs', async () => {
    const school = buildSchool([], {
      educationPrograms: [
        { totalStudents: 300, capacity: 500 },
      ] as any,
    });
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(school);

    const { data } = await service.mainPayload('school-1');
    expect(data.infrastructure.capacityUtilization).toBeCloseTo(0.6);
  });
});

// ---------------------------------------------------------------------------
// mainPayload – facilities summary (classroom/lab/dorm counts)
// ---------------------------------------------------------------------------

describe('DashboardService.mainPayload – facilities summary', () => {
  it('counts buildings by function keyword: classroom, lab, dormitory', async () => {
    const buildings: SchoolBuilding[] = [
      { ...buildBuilding(BuildingCondition.GOOD), function: 'Classroom Block A' } as any,
      { ...buildBuilding(BuildingCondition.GOOD), function: 'classroom_2' } as any,
      { ...buildBuilding(BuildingCondition.GOOD), function: 'Computer Lab' } as any,
      { ...buildBuilding(BuildingCondition.GOOD), function: 'Dormitory Main' } as any,
      { ...buildBuilding(BuildingCondition.GOOD), function: 'Admin Block' } as any,
    ];
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool(buildings));

    const { data } = await service.mainPayload('school-1');
    expect(data.facilities.classrooms).toBe(2);
    expect(data.facilities.labs).toBe(1);
    expect(data.facilities.dormitories).toBe(1);
  });

  it('returns zeros when no buildings match function keywords', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([]));

    const { data } = await service.mainPayload('school-1');
    expect(data.facilities.classrooms).toBe(0);
    expect(data.facilities.labs).toBe(0);
    expect(data.facilities.dormitories).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mainPayload – GIS summary
// ---------------------------------------------------------------------------

describe('DashboardService.mainPayload – GIS summary', () => {
  it('featureCount equals number of buildings', async () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.FAIR),
      buildBuilding(BuildingCondition.POOR),
    ];
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool(buildings));

    const { data } = await service.mainPayload('school-1');
    expect(data.gis.featureCount).toBe(3);
  });

  it('areaKm2 converts usedLandArea (hectares) to km² (* 0.01)', async () => {
    const school = buildSchool([], { usedLandArea: 200 } as any);
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(school);

    const { data } = await service.mainPayload('school-1');
    // 200 hectares * 0.01 = 2 km²
    expect(data.gis.areaKm2).toBeCloseTo(2);
  });

  it('areaKm2 = 0 when usedLandArea is null', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([]));

    const { data } = await service.mainPayload('school-1');
    expect(data.gis.areaKm2).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mainPayload – error handling
// ---------------------------------------------------------------------------

describe('DashboardService.mainPayload – error handling', () => {
  it('throws NotFoundException when school does not exist', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.mainPayload('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('throws with the correct school-not-found message', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.mainPayload('missing-id')).rejects.toThrow(
      'School with id "missing-id" not found',
    );
  });

  it('queries with the correct school ID and loads buildings + populationData relations', async () => {
    const school = buildSchool([]);
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(school);

    await service.mainPayload('school-abc');

    expect(schoolRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'school-abc' },
      relations: ['buildings', 'populationData'],
    });
  });

  it('returns a payload with a valid ISO timestamp', async () => {
    const { service, schoolRepo } = await makeService();
    schoolRepo.findOne.mockResolvedValue(buildSchool([]));

    const result = await service.mainPayload('school-1');

    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
