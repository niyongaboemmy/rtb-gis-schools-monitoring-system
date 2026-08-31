import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import {
  DecisionAssessment,
  PriorityLevel,
} from './entities/decision-assessment.entity';
import { ScoreHistory } from './entities/score-history.entity';
import { RecommendationAction } from './entities/recommendation-action.entity';
import { School } from '../schools/entities/school.entity';
import {
  SchoolBuilding,
  BuildingCondition,
} from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import {
  SchoolFacilitySurvey,
  ComplianceLevel,
} from '../schools/entities/school-facility-survey.entity';
import {
  IssueReport,
  ReportStatus,
} from '../reports/entities/issue-report.entity';
import { AuditService } from '../audit/audit.service';
import { computeOverallScore } from './scoring.constants';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const qb = () => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  leftJoinAndMapOne: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({}),
  getRawMany: jest.fn().mockResolvedValue([]),
  getMany: jest.fn().mockResolvedValue([]),
  getCount: jest.fn().mockResolvedValue(0),
});

const makeRepo = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ ...v, id: 'assessment-id' })),
  update: jest.fn().mockResolvedValue(undefined),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn(() => qb()),
  ...overrides,
});

function buildSchool(overrides: Partial<School> = {}): School {
  return {
    id: 'school-1',
    name: 'Test School',
    code: 'TST-001',
    district: 'D',
    province: 'P',
    buildings: [],
    populationData: [],
    educationPrograms: [],
    totalStudents: 0,
    roadStatusPercentage: 50,
    ...overrides,
  } as unknown as School;
}

function buildBuilding(
  condition: BuildingCondition,
  yearBuilt?: number,
): SchoolBuilding {
  return { condition, yearBuilt } as unknown as SchoolBuilding;
}

type Repos = {
  assessment: ReturnType<typeof makeRepo>;
  scoreHistory: ReturnType<typeof makeRepo>;
  action: ReturnType<typeof makeRepo>;
  school: ReturnType<typeof makeRepo>;
  building: ReturnType<typeof makeRepo>;
  population: ReturnType<typeof makeRepo>;
  survey: ReturnType<typeof makeRepo>;
  issue: ReturnType<typeof makeRepo>;
};

async function makeService(repos: Partial<Repos> = {}): Promise<{
  service: AnalyticsService;
  repos: Repos;
  audit: { log: jest.Mock };
}> {
  const r: Repos = {
    assessment: repos.assessment ?? makeRepo(),
    scoreHistory: repos.scoreHistory ?? makeRepo(),
    action: repos.action ?? makeRepo(),
    school: repos.school ?? makeRepo(),
    building: repos.building ?? makeRepo(),
    population: repos.population ?? makeRepo(),
    survey: repos.survey ?? makeRepo(),
    issue: repos.issue ?? makeRepo(),
  };
  const audit = { log: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AnalyticsService,
      {
        provide: getRepositoryToken(DecisionAssessment),
        useValue: r.assessment,
      },
      { provide: getRepositoryToken(ScoreHistory), useValue: r.scoreHistory },
      { provide: getRepositoryToken(RecommendationAction), useValue: r.action },
      { provide: getRepositoryToken(School), useValue: r.school },
      { provide: getRepositoryToken(SchoolBuilding), useValue: r.building },
      { provide: getRepositoryToken(PopulationData), useValue: r.population },
      { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: r.survey },
      { provide: getRepositoryToken(IssueReport), useValue: r.issue },
      { provide: AuditService, useValue: audit },
    ],
  }).compile();

  return { service: module.get(AnalyticsService), repos: r, audit };
}

const CY = new Date().getFullYear();
const score = async (school: School): Promise<number> => {
  const { service } = await makeService();
  const res = await service.calculateSchoolScore(school);
  return Math.round(Number(res.overallScore));
};

// ---------------------------------------------------------------------------
// scoring.constants — the one formula
// ---------------------------------------------------------------------------

describe('computeOverallScore (canonical 6-factor 35/25/10/10/15/5)', () => {
  it('all components 50 → 50', () => {
    expect(
      computeOverallScore({
        infrastructure: 50,
        buildingAge: 50,
        accessibility: 50,
        population: 50,
        facilityCompliance: 50,
        resolution: 50,
      }),
    ).toBe(50);
  });

  it('all components 100 → 100', () => {
    expect(
      computeOverallScore({
        infrastructure: 100,
        buildingAge: 100,
        accessibility: 100,
        population: 100,
        facilityCompliance: 100,
        resolution: 100,
      }),
    ).toBe(100);
  });

  it('weights are applied in the documented proportion', () => {
    // only infrastructure = 100, rest 0  → 35
    expect(
      computeOverallScore({
        infrastructure: 100,
        buildingAge: 0,
        accessibility: 0,
        population: 0,
        facilityCompliance: 0,
        resolution: 0,
      }),
    ).toBe(35);
  });

  it('clamps out-of-range components', () => {
    expect(
      computeOverallScore({
        infrastructure: 500,
        buildingAge: -100,
        accessibility: 50,
        population: 50,
        facilityCompliance: 50,
        resolution: 50,
      }),
    ).toBe(
      clamp(
        100 * 0.35 + 0 * 0.25 + 50 * 0.1 + 50 * 0.1 + 50 * 0.15 + 50 * 0.05,
      ),
    );
  });
});

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

// ---------------------------------------------------------------------------
// calculateInfrastructureScore
// ---------------------------------------------------------------------------

describe('calculateInfrastructureScore', () => {
  let service: AnalyticsService;
  beforeEach(async () => ({ service } = await makeService()));

  it.each([
    [[], 50],
    [null, 50],
    [undefined, 50],
  ])('missing data (%p) → neutral 50', (input, expected) => {
    expect((service as any).calculateInfrastructureScore(input)).toBe(expected);
  });

  it('all GOOD → 100', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        buildBuilding(BuildingCondition.GOOD),
        buildBuilding(BuildingCondition.GOOD),
      ]),
    ).toBe(100);
  });

  it('all FAIR → 70', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        buildBuilding(BuildingCondition.FAIR),
      ]),
    ).toBe(70);
  });

  it('all POOR → 30 (canonical map)', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        buildBuilding(BuildingCondition.POOR),
      ]),
    ).toBe(30);
  });

  it('all CRITICAL → 10', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        buildBuilding(BuildingCondition.CRITICAL),
      ]),
    ).toBe(10);
  });

  it('mixed GOOD + FAIR → round((100+70)/2) = 85', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        buildBuilding(BuildingCondition.GOOD),
        buildBuilding(BuildingCondition.FAIR),
      ]),
    ).toBe(85);
  });

  it('2 GOOD + 1 POOR → round((100+100+30)/3) = 77', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        buildBuilding(BuildingCondition.GOOD),
        buildBuilding(BuildingCondition.GOOD),
        buildBuilding(BuildingCondition.POOR),
      ]),
    ).toBe(77);
  });

  it('unknown condition falls back to neutral 50 in the average', () => {
    expect(
      (service as any).calculateInfrastructureScore([
        { condition: 'nope' } as unknown as SchoolBuilding,
        buildBuilding(BuildingCondition.GOOD),
      ]),
    ).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// calculateAgeScore
// ---------------------------------------------------------------------------

describe('calculateAgeScore', () => {
  let service: AnalyticsService;
  beforeEach(async () => ({ service } = await makeService()));

  it.each([
    [5, 95],
    [10, 95],
    [18, 80],
    [30, 60],
    [40, 45],
    [50, 30],
    [60, 20],
    [80, 10],
  ])('avg building age %i years → %i', (age, expected) => {
    expect(
      (service as any).calculateAgeScore([
        buildBuilding(BuildingCondition.GOOD, CY - age),
      ]),
    ).toBe(expected);
  });

  it('no buildings → falls back to establishedYear', () => {
    expect((service as any).calculateAgeScore([], CY - 25)).toBe(60);
  });

  it('no buildings, no establishedYear → neutral 50', () => {
    expect((service as any).calculateAgeScore([])).toBe(50);
    expect((service as any).calculateAgeScore([], undefined)).toBe(50);
  });

  it('buildings without yearBuilt are excluded', () => {
    expect(
      (service as any).calculateAgeScore(
        [buildBuilding(BuildingCondition.GOOD, undefined)],
        CY - 5,
      ),
    ).toBe(95);
  });
});

// ---------------------------------------------------------------------------
// calculatePopulationScore
// ---------------------------------------------------------------------------

describe('calculatePopulationScore', () => {
  let service: AnalyticsService;
  beforeEach(async () => ({ service } = await makeService()));

  it('no population data → { score: 50, hasPopDataGap: true }', () => {
    expect((service as any).calculatePopulationScore(undefined)).toEqual({
      score: 50,
      hasPopDataGap: true,
    });
    expect((service as any).calculatePopulationScore(null)).toEqual({
      score: 50,
      hasPopDataGap: true,
    });
  });

  it.each([
    [1000, 200, 10], // ratio 5
    [400, 100, 30], // ratio 4
    [250, 100, 50], // ratio 2.5
    [250, 200, 70], // ratio 1.25
    [50, 200, 100], // ratio 0.25
  ])('demand %i / capacity %i → score %i', (demand, cap, expected) => {
    const pop = { schoolAgePopulation2km: demand } as PopulationData;
    expect((service as any).calculatePopulationScore(pop, cap).score).toBe(
      expected,
    );
  });

  it('no currentStudents → default catchment capacity 300', () => {
    const pop = { schoolAgePopulation2km: 1800 } as PopulationData;
    expect(
      (service as any).calculatePopulationScore(pop, undefined).score,
    ).toBe(10); // 1800/300 = 6
  });
});

// ---------------------------------------------------------------------------
// calculateSchoolScore — integration
// ---------------------------------------------------------------------------

describe('calculateSchoolScore – weighted composite', () => {
  it('2 GOOD + 1 POOR @25yr, road 50, demand 250/200 → 64 (MEDIUM)', async () => {
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.GOOD, CY - 25),
        buildBuilding(BuildingCondition.GOOD, CY - 25),
        buildBuilding(BuildingCondition.POOR, CY - 25),
      ],
      roadStatusPercentage: 50,
      populationData: [{ schoolAgePopulation2km: 250 } as PopulationData],
      totalStudents: 200,
    });
    // infra 77*.35 + age 60*.25 + access 50*.1 + pop 70*.1 + fac 50*.15 + res 50*.05
    expect(await score(school)).toBe(64);
    const { service } = await makeService();
    expect((await service.calculateSchoolScore(school)).priorityLevel).toBe(
      PriorityLevel.MEDIUM,
    );
  });

  it('all-CRITICAL @40yr, road 80, ratio 5 → < 35 (CRITICAL)', async () => {
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.CRITICAL, CY - 40),
        buildBuilding(BuildingCondition.CRITICAL, CY - 40),
      ],
      roadStatusPercentage: 80,
      populationData: [{ schoolAgePopulation2km: 1000 } as PopulationData],
      totalStudents: 200,
    });
    const { service } = await makeService();
    const res = await service.calculateSchoolScore(school);
    expect(Number(res.overallScore)).toBeLessThan(35);
    expect(res.priorityLevel).toBe(PriorityLevel.CRITICAL);
  });

  it('2 GOOD @15yr, road 60, no population → 76 (LOW)', async () => {
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.GOOD, CY - 15),
        buildBuilding(BuildingCondition.GOOD, CY - 15),
      ],
      roadStatusPercentage: 60,
    });
    expect(await score(school)).toBe(76);
    const { service } = await makeService();
    expect((await service.calculateSchoolScore(school)).priorityLevel).toBe(
      PriorityLevel.LOW,
    );
  });

  it('no buildings, no population, 50% road → 50 (HIGH band)', async () => {
    const school = buildSchool({ roadStatusPercentage: 50 });
    expect(await score(school)).toBe(50);
    const { service } = await makeService();
    expect((await service.calculateSchoolScore(school)).priorityLevel).toBe(
      PriorityLevel.HIGH,
    );
  });

  it('flags hasInfraDataGap / hasPopDataGap when the data is absent', async () => {
    const { service } = await makeService();
    const res = await service.calculateSchoolScore(buildSchool());
    expect(res.hasInfraDataGap).toBe(true);
    expect(res.hasPopDataGap).toBe(true);
  });

  it('persists a score-history snapshot on every run', async () => {
    const { service, repos } = await makeService();
    await service.calculateSchoolScore(buildSchool());
    expect(repos.scoreHistory.save).toHaveBeenCalledTimes(1);
  });

  it('upserts an existing assessment rather than creating a new row', async () => {
    const assessment = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'x', schoolId: 'school-1' }),
    });
    const { service } = await makeService({ assessment });
    await service.calculateSchoolScore(buildSchool());
    expect(assessment.create).not.toHaveBeenCalled();
    expect(assessment.save).toHaveBeenCalledTimes(1);
  });

  it('ordering: healthy school scores higher than a derelict one', async () => {
    const good = buildSchool({
      buildings: [buildBuilding(BuildingCondition.GOOD, CY - 6)],
      roadStatusPercentage: 90,
    });
    const bad = buildSchool({
      buildings: [buildBuilding(BuildingCondition.CRITICAL, CY - 45)],
      roadStatusPercentage: 15,
    });
    expect(await score(good)).toBeGreaterThan(await score(bad));
  });
});

// ---------------------------------------------------------------------------
// scoreToPriorityLevel boundaries
// ---------------------------------------------------------------------------

describe('priority banding', () => {
  const { scoreToPriorityLevel } = require('./scoring.constants');
  it.each([
    [0, PriorityLevel.CRITICAL],
    [34, PriorityLevel.CRITICAL],
    [35, PriorityLevel.HIGH],
    [54, PriorityLevel.HIGH],
    [55, PriorityLevel.MEDIUM],
    [74, PriorityLevel.MEDIUM],
    [75, PriorityLevel.LOW],
    [100, PriorityLevel.LOW],
  ])('score %i → %s', (s, expected) => {
    expect(scoreToPriorityLevel(s)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// calculateFacilityComplianceScore (via getSchoolMetrics)
// ---------------------------------------------------------------------------

describe('calculateFacilityComplianceScore', () => {
  const run = async (surveys: { compliance: ComplianceLevel }[]) => {
    const school = makeRepo({
      findOne: jest.fn().mockResolvedValue(buildSchool({ id: 's' })),
    });
    const survey = makeRepo({ find: jest.fn().mockResolvedValue(surveys) });
    const { service } = await makeService({ school, survey });
    return (await service.getSchoolMetrics('s')).facilityComplianceScore;
  };

  it('no surveys → 50', async () => expect(await run([])).toBe(50));
  it('all COMPLIANT → 100', async () =>
    expect(
      await run([
        { compliance: ComplianceLevel.COMPLIANT },
        { compliance: ComplianceLevel.COMPLIANT },
      ]),
    ).toBe(100));
  it('all NON_COMPLIANT → 0 (no more || 50 coercion)', async () =>
    expect(await run([{ compliance: ComplianceLevel.NON_COMPLIANT }])).toBe(0));
  it('COMPLIANT + NON_COMPLIANT → 50', async () =>
    expect(
      await run([
        { compliance: ComplianceLevel.COMPLIANT },
        { compliance: ComplianceLevel.NON_COMPLIANT },
      ]),
    ).toBe(50));
  it('PARTIAL → 50', async () =>
    expect(await run([{ compliance: ComplianceLevel.PARTIAL }])).toBe(50));
});

// ---------------------------------------------------------------------------
// getOverview
// ---------------------------------------------------------------------------

describe('getOverview', () => {
  it('returns the aggregate shape incl. nationalCapacityUtilisation', async () => {
    const school = makeRepo({
      count: jest.fn().mockResolvedValue(3),
      find: jest.fn().mockResolvedValue([
        {
          id: '1',
          totalStudents: 100,
          educationPrograms: [{ totalStudents: 100, capacity: 200 }],
        },
        {
          id: '2',
          totalStudents: 300,
          educationPrograms: [{ totalStudents: 300, capacity: 300 }],
        },
      ]),
      createQueryBuilder: jest.fn(() => {
        const q = qb();
        q.getRawMany = jest
          .fn()
          .mockResolvedValueOnce([{ priority: 'critical', count: '1' }])
          .mockResolvedValueOnce([
            {
              province: 'Kigali',
              total: '3',
              critical: '1',
              high: '1',
              medium: '1',
              low: '0',
              avgScore: '55',
            },
          ]);
        q.getRawOne = jest.fn().mockResolvedValue({ nationalAvgScore: '60' });
        return q;
      }),
    });
    const { service } = await makeService({ school });
    const res = await service.getOverview();
    expect(res.totalSchools).toBe(3);
    expect(res.byPriority).toHaveProperty('critical', 1);
    // (100 + 300) enrolled / (200 + 300) seats = 400/500 = 80
    expect(res.nationalCapacityUtilisation).toBe(80);
    expect(res.provinceStats).toHaveLength(1);
  });

  it('nationalCapacityUtilisation is null when no programme capacity exists', async () => {
    const school = makeRepo({
      count: jest.fn().mockResolvedValue(1),
      find: jest
        .fn()
        .mockResolvedValue([
          { id: '1', totalStudents: 100, educationPrograms: [] },
        ]),
    });
    const { service } = await makeService({ school });
    expect(
      (await service.getOverview()).nationalCapacityUtilisation,
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recalculate + events
// ---------------------------------------------------------------------------

describe('recalculateAllScores', () => {
  it('processes every school and writes an audit log', async () => {
    const school = makeRepo({
      find: jest
        .fn()
        .mockResolvedValue([
          buildSchool({ id: 'a' }),
          buildSchool({ id: 'b' }),
        ]),
    });
    const { service, audit } = await makeService({ school });
    const res = await service.recalculateAllScores();
    expect(res.processed).toBe(2);
    expect(audit.log).toHaveBeenCalledWith(
      null,
      'analytics.recalculate',
      'system',
      undefined,
      { processed: 2 },
    );
  });
});

describe('recalculateSchoolScore', () => {
  it('throws NotFound for an unknown school', async () => {
    await expect(
      (await makeService()).service.recalculateSchoolScore('nope'),
    ).rejects.toThrow('School with id "nope" not found');
  });
});

describe('generateRecommendations + estimateBudgetRwf', () => {
  it('a high-priority school with no building data gets a DATA recommendation, not "all good"', async () => {
    const { service } = await makeService();
    const res = await service.calculateSchoolScore(
      buildSchool({ roadStatusPercentage: 40 }), // no buildings, no pop
    );
    expect(res.recommendations.some((r) => r.startsWith('[DATA]'))).toBe(true);
    expect(res.recommendations.some((r) => r.includes('[OK]'))).toBe(false);
  });

  it('poor/critical buildings produce an [URGENT] line and a non-null budget', async () => {
    const { service } = await makeService();
    const res = await service.calculateSchoolScore(
      buildSchool({
        buildings: [
          buildBuilding(BuildingCondition.CRITICAL, CY - 30),
          buildBuilding(BuildingCondition.POOR, CY - 30),
        ],
        roadStatusPercentage: 80,
      }),
    );
    expect(res.recommendations[0]).toContain('[URGENT]');
    expect(Number(res.estimatedBudgetRwf)).toBeGreaterThan(0);
    expect(res.primaryRecommendation).toBe(res.recommendations[0]);
  });

  it('a healthy school falls back to the [OK] line and a null budget', async () => {
    const { service } = await makeService();
    const res = await service.calculateSchoolScore(
      buildSchool({
        buildings: [buildBuilding(BuildingCondition.GOOD, CY - 5)],
        roadStatusPercentage: 95,
        educationPrograms: [{ totalStudents: 100, capacity: 400 }] as any,
        populationData: [{ schoolAgePopulation2km: 200 } as PopulationData],
      }),
    );
    expect(res.recommendations).toEqual([expect.stringContaining('[OK]')]);
    expect(res.estimatedBudgetRwf ?? null).toBeNull();
  });

  it('caps at 6 recommendations', async () => {
    const { service } = await makeService();
    const res = await service.calculateSchoolScore(
      buildSchool({
        buildings: [buildBuilding(BuildingCondition.CRITICAL, CY - 70)],
        roadStatusPercentage: 5,
        educationPrograms: [{ totalStudents: 900, capacity: 200 }] as any,
      }),
    );
    expect(res.recommendations.length).toBeLessThanOrEqual(6);
  });
});

describe('getDecisions ordering', () => {
  it('orders the intervention queue by ascending overall score (most urgent first)', async () => {
    const q = qb();
    const assessment = makeRepo({ createQueryBuilder: jest.fn(() => q) });
    const { service } = await makeService({ assessment });
    await service.getDecisions();
    expect(q.orderBy).toHaveBeenCalledWith('da.overallScore', 'ASC');
  });
});

describe('getSchoolMetrics', () => {
  it('rolls totalStudents up from educationPrograms when present', async () => {
    const school = makeRepo({
      findOne: jest.fn().mockResolvedValue(
        buildSchool({
          id: 's',
          educationPrograms: [
            { totalStudents: 100, capacity: 200 },
            { totalStudents: 150, capacity: 200 },
          ] as any,
          totalStudents: 999 as any,
        }),
      ),
    });
    const { service } = await makeService({ school });
    const dto = await service.getSchoolMetrics('s');
    expect(dto.totalStudents).toBe(250);
    expect(dto.totalCapacity).toBe(400);
  });

  it('reportSummary buckets issue reports by status', async () => {
    const school = makeRepo({
      findOne: jest.fn().mockResolvedValue(buildSchool({ id: 's' })),
    });
    const issue = makeRepo({
      find: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          status: ReportStatus.NEED_INTERVENTION,
          createdAt: new Date(),
        },
        { id: 'r2', status: ReportStatus.PENDING, createdAt: new Date() },
        { id: 'r3', status: ReportStatus.SOLVED, createdAt: new Date() },
      ]),
    });
    const { service } = await makeService({ school, issue });
    const dto = await service.getSchoolMetrics('s');
    expect(dto.reportSummary.total).toBe(3);
    expect(dto.reportSummary.critical).toBe(1);
    expect(dto.reportSummary.pending).toBe(1);
    expect(dto.reportSummary.resolved).toBe(1);
  });
});
