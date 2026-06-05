import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { DecisionAssessment, PriorityLevel } from './entities/decision-assessment.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolBuilding, BuildingCondition } from '../schools/entities/school-building.entity';
import { PopulationData } from '../population/entities/population-data.entity';
import { SchoolFacilitySurvey, ComplianceLevel } from '../schools/entities/school-facility-survey.entity';
import { IssueReport, ReportStatus } from '../reports/entities/issue-report.entity';
import { AuditService } from '../audit/audit.service';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeRepo = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ ...v, id: 'assessment-id' })),
  update: jest.fn().mockResolvedValue(undefined),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }),
  ...overrides,
});

function buildSchool(overrides: Partial<School> = {}): School {
  return {
    id: 'school-1',
    name: 'Test School',
    code: 'TST-001',
    buildings: [],
    populationData: [],
    educationPrograms: [],
    totalStudents: 0,
    roadStatusPercentage: 50,
    ...overrides,
  } as unknown as School;
}

function buildBuilding(condition: BuildingCondition, yearBuilt?: number): SchoolBuilding {
  return { condition, yearBuilt } as unknown as SchoolBuilding;
}

async function makeService(): Promise<{
  service: AnalyticsService;
  surveyRepo: ReturnType<typeof makeRepo>;
  auditService: { log: jest.Mock };
}> {
  const surveyRepo = makeRepo();
  const auditService = { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AnalyticsService,
      { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
      { provide: getRepositoryToken(School), useValue: makeRepo() },
      { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
      { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
      { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: surveyRepo },
      { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
      { provide: AuditService, useValue: auditService },
    ],
  }).compile();
  return { service: module.get(AnalyticsService), surveyRepo, auditService };
}

// ---------------------------------------------------------------------------
// TASK-020 §1: calculateInfrastructureScore (private — accessed via `any`)
// ---------------------------------------------------------------------------

describe('calculateInfrastructureScore', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it('empty buildings array → 50 (neutral default)', () => {
    expect((service as any).calculateInfrastructureScore([])).toBe(50);
  });

  it('null/undefined buildings → 50 (neutral default)', () => {
    expect((service as any).calculateInfrastructureScore(null)).toBe(50);
    expect((service as any).calculateInfrastructureScore(undefined)).toBe(50);
  });

  it('all GOOD buildings → 100', () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.GOOD),
    ];
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(100);
  });

  it('all CRITICAL buildings → 10', () => {
    const buildings = [
      buildBuilding(BuildingCondition.CRITICAL),
      buildBuilding(BuildingCondition.CRITICAL),
    ];
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(10);
  });

  it('all FAIR buildings → 70', () => {
    const buildings = [
      buildBuilding(BuildingCondition.FAIR),
      buildBuilding(BuildingCondition.FAIR),
    ];
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(70);
  });

  it('all POOR buildings → 40', () => {
    const buildings = [buildBuilding(BuildingCondition.POOR)];
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(40);
  });

  it('mixed GOOD + FAIR → Math.round((100+70)/2) = 85', () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.FAIR),
    ];
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(85);
  });

  it('2 GOOD + 1 POOR → Math.round((100+100+40)/3) = 80', () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.GOOD),
      buildBuilding(BuildingCondition.POOR),
    ];
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(80);
  });

  it('unknown condition falls back to 50 in average', () => {
    const buildings = [
      { condition: 'unknown_condition' } as unknown as SchoolBuilding,
      buildBuilding(BuildingCondition.GOOD),
    ];
    // (50 + 100) / 2 = 75
    expect((service as any).calculateInfrastructureScore(buildings)).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §2: calculateAgeScore (private — accessed via `any`)
// ---------------------------------------------------------------------------

describe('calculateAgeScore', () => {
  let service: AnalyticsService;
  const currentYear = new Date().getFullYear();

  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it('all buildings <= 10 years old → 95', () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD, currentYear - 5),
      buildBuilding(BuildingCondition.GOOD, currentYear - 8),
    ];
    expect((service as any).calculateAgeScore(buildings)).toBe(95);
  });

  it('all buildings <= 20 years old → 80', () => {
    const buildings = [
      buildBuilding(BuildingCondition.GOOD, currentYear - 15),
      buildBuilding(BuildingCondition.FAIR, currentYear - 18),
    ];
    expect((service as any).calculateAgeScore(buildings)).toBe(80);
  });

  it('all buildings <= 30 years old → 60', () => {
    const buildings = [buildBuilding(BuildingCondition.FAIR, currentYear - 25)];
    expect((service as any).calculateAgeScore(buildings)).toBe(60);
  });

  it('buildings older than 30 years → 40', () => {
    const buildings = [buildBuilding(BuildingCondition.POOR, currentYear - 40)];
    expect((service as any).calculateAgeScore(buildings)).toBe(40);
  });

  it('no buildings, establishedYear <= 10 years ago → 95 (uses establishedYear)', () => {
    expect((service as any).calculateAgeScore([], currentYear - 5)).toBe(95);
  });

  it('no buildings, establishedYear 21-30 years ago → 60 (uses establishedYear)', () => {
    expect((service as any).calculateAgeScore([], currentYear - 25)).toBe(60);
  });

  it('no buildings, no establishedYear → 50 (neutral default)', () => {
    expect((service as any).calculateAgeScore([])).toBe(50);
    expect((service as any).calculateAgeScore([], undefined)).toBe(50);
  });

  it('buildings without yearBuilt are excluded; falls back to establishedYear', () => {
    const buildings = [buildBuilding(BuildingCondition.GOOD, undefined)];
    // No yearBuilt → excluded → uses establishedYear = currentYear-5 → age=5 → 95
    expect((service as any).calculateAgeScore(buildings, currentYear - 5)).toBe(95);
  });

  it('buildings without yearBuilt and no establishedYear → 50', () => {
    const buildings = [buildBuilding(BuildingCondition.GOOD, undefined)];
    expect((service as any).calculateAgeScore(buildings)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §3: calculatePopulationScore (private — accessed via `any`)
// ---------------------------------------------------------------------------

describe('calculatePopulationScore', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it('no population data (undefined) → 50', () => {
    expect((service as any).calculatePopulationScore(undefined)).toBe(50);
  });

  it('no population data (null) → 50', () => {
    expect((service as any).calculatePopulationScore(null)).toBe(50);
  });

  it('demand/capacity ratio >= 5 → 10 (extreme demographic pressure)', () => {
    const pop = { schoolAgePopulation2km: 1000 } as PopulationData;
    // ratio = 1000/200 = 5
    expect((service as any).calculatePopulationScore(pop, 200)).toBe(10);
  });

  it('demand/capacity ratio exactly 5 → 10', () => {
    const pop = { schoolAgePopulation2km: 500 } as PopulationData;
    expect((service as any).calculatePopulationScore(pop, 100)).toBe(10);
  });

  it('demand/capacity ratio >= 3 and < 5 → 30', () => {
    const pop = { schoolAgePopulation2km: 400 } as PopulationData;
    // ratio = 400/100 = 4
    expect((service as any).calculatePopulationScore(pop, 100)).toBe(30);
  });

  it('demand/capacity ratio >= 2 and < 3 → 50', () => {
    const pop = { schoolAgePopulation2km: 250 } as PopulationData;
    // ratio = 250/100 = 2.5
    expect((service as any).calculatePopulationScore(pop, 100)).toBe(50);
  });

  it('demand/capacity ratio >= 1 and < 2 → 70', () => {
    const pop = { schoolAgePopulation2km: 250 } as PopulationData;
    // ratio = 250/200 = 1.25
    expect((service as any).calculatePopulationScore(pop, 200)).toBe(70);
  });

  it('demand/capacity ratio < 1 → 100 (comfortable headroom)', () => {
    const pop = { schoolAgePopulation2km: 50 } as PopulationData;
    // ratio = 50/200 = 0.25
    expect((service as any).calculatePopulationScore(pop, 200)).toBe(100);
  });

  it('no currentStudents provided → uses default capacity 300', () => {
    const pop = { schoolAgePopulation2km: 1800 } as PopulationData;
    // ratio = 1800/300 = 6 → >= 5 → 10
    expect((service as any).calculatePopulationScore(pop, undefined)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §4: calculateSchoolScore — integration (weighted formula + priority)
// ---------------------------------------------------------------------------

describe('calculateSchoolScore – integration (TASK-020)', () => {
  let service: AnalyticsService;
  const currentYear = new Date().getFullYear();

  beforeEach(async () => {
    ({ service } = await makeService());
  });

  it('infra=80, age=60, access=50, pop=70 → overallScore=68', async () => {
    // infra=80:  2 GOOD(100) + 1 POOR(40)  → (100+100+40)/3 = 80
    // age=60:    yearBuilt = currentYear-25 → avgAge=25 (21-30 → 60)
    // access=50: roadStatusPercentage = 50
    // pop=70:    demand=250, students=200   → ratio=1.25 (1≤r<2 → 70)
    // overallScore = round(80*0.40 + 60*0.30 + 50*0.15 + 70*0.15)
    //             = round(32 + 18 + 7.5 + 10.5) = 68
    const y = currentYear - 25;
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.GOOD, y),
        buildBuilding(BuildingCondition.GOOD, y),
        buildBuilding(BuildingCondition.POOR, y),
      ],
      roadStatusPercentage: 50,
      populationData: [{ schoolAgePopulation2km: 250 } as PopulationData],
      totalStudents: 200,
    });

    const result = await service.calculateSchoolScore(school);
    expect(Math.round(Number(result.overallScore))).toBe(68);
  });

  it('overallScore=68 maps to priorityLevel MEDIUM (55 ≤ score < 75)', async () => {
    const y = currentYear - 25;
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.GOOD, y),
        buildBuilding(BuildingCondition.GOOD, y),
        buildBuilding(BuildingCondition.POOR, y),
      ],
      roadStatusPercentage: 50,
      populationData: [{ schoolAgePopulation2km: 250 } as PopulationData],
      totalStudents: 200,
    });

    const result = await service.calculateSchoolScore(school);
    expect(result.priorityLevel).toBe(PriorityLevel.MEDIUM);
  });

  it('score ~30 → priorityLevel CRITICAL (score < 35)', async () => {
    // infra=10 (all CRITICAL), age=40 (>30yrs), access=80, pop=10 (ratio>=5)
    // round(10*0.40 + 40*0.30 + 80*0.15 + 10*0.15) = round(4+12+12+1.5) = 30
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.CRITICAL, currentYear - 40),
        buildBuilding(BuildingCondition.CRITICAL, currentYear - 40),
      ],
      roadStatusPercentage: 80,
      populationData: [{ schoolAgePopulation2km: 1000 } as PopulationData],
      totalStudents: 200,
    });

    const result = await service.calculateSchoolScore(school);
    expect(Number(result.overallScore)).toBeLessThan(35);
    expect(result.priorityLevel).toBe(PriorityLevel.CRITICAL);
  });

  it('score ~81 → priorityLevel LOW (score >= 75)', async () => {
    // infra=100 (all GOOD), age=80 (<=20yrs), access=60, pop=50 (no pop)
    // round(100*0.40 + 80*0.30 + 60*0.15 + 50*0.15) = round(40+24+9+7.5) = 81
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.GOOD, currentYear - 15),
        buildBuilding(BuildingCondition.GOOD, currentYear - 15),
      ],
      roadStatusPercentage: 60,
    });

    const result = await service.calculateSchoolScore(school);
    expect(Number(result.overallScore)).toBeGreaterThanOrEqual(75);
    expect(result.priorityLevel).toBe(PriorityLevel.LOW);
  });

  it('score in HIGH band → priorityLevel HIGH (35 ≤ score < 55)', async () => {
    // infra=40 (all POOR), age=60 (21-30yrs), access=50, pop=50 (no pop)
    // round(40*0.40 + 60*0.30 + 50*0.15 + 50*0.15) = round(16+18+7.5+7.5) = 49
    const school = buildSchool({
      buildings: [buildBuilding(BuildingCondition.POOR, currentYear - 25)],
      roadStatusPercentage: 50,
    });

    const result = await service.calculateSchoolScore(school);
    const score = Number(result.overallScore);
    expect(score).toBeGreaterThanOrEqual(35);
    expect(score).toBeLessThan(55);
    expect(result.priorityLevel).toBe(PriorityLevel.HIGH);
  });

  it('upserts existing assessment rather than creating a new record', async () => {
    const existingAssessment = { id: 'existing-id', schoolId: 'school-1' } as DecisionAssessment;
    const assessmentRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(existingAssessment) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(School), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const svc = module.get(AnalyticsService);
    await svc.calculateSchoolScore(buildSchool());

    expect(assessmentRepo.create).not.toHaveBeenCalled();
    expect(assessmentRepo.save).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §5: scoreToPriorityLevel boundary table (private)
// ---------------------------------------------------------------------------

describe('scoreToPriorityLevel boundaries', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    ({ service } = await makeService());
  });

  const cases: [number, PriorityLevel][] = [
    [0,   PriorityLevel.CRITICAL],
    [34,  PriorityLevel.CRITICAL],
    [35,  PriorityLevel.HIGH],
    [54,  PriorityLevel.HIGH],
    [55,  PriorityLevel.MEDIUM],
    [74,  PriorityLevel.MEDIUM],
    [75,  PriorityLevel.LOW],
    [100, PriorityLevel.LOW],
  ];

  test.each(cases)('score %i → %s', (score, expected) => {
    expect((service as any).scoreToPriorityLevel(score)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §6: overallScore weighted formula — regression tests
// ---------------------------------------------------------------------------

describe('AnalyticsService – overallScore weighted formula', () => {
  let service: AnalyticsService;
  let surveyRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    ({ service, surveyRepo } = await makeService());
  });

  const getScore = async (school: School): Promise<number> => {
    const result = await service.calculateSchoolScore(school);
    return Math.round(Number(result.overallScore));
  };

  it('all-GOOD buildings, full road access, no population pressure → score >= 90', async () => {
    const currentYear = new Date().getFullYear();
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.GOOD, currentYear - 5),
        buildBuilding(BuildingCondition.GOOD, currentYear - 6),
      ],
      roadStatusPercentage: 100,
    });
    // infraScore=100, ageScore=95, accessScore=100, popScore=50
    // round(100*0.40 + 95*0.30 + 100*0.15 + 50*0.15) = round(91) = 91
    expect(await getScore(school)).toBeGreaterThanOrEqual(90);
  });

  it('all-CRITICAL buildings, near-zero road access, high population pressure → score <= 20', async () => {
    const currentYear = new Date().getFullYear();
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.CRITICAL, currentYear - 55),
        buildBuilding(BuildingCondition.CRITICAL, currentYear - 58),
      ],
      roadStatusPercentage: 1,
      populationData: [{ schoolAgePopulation2km: 10000 } as PopulationData],
      totalStudents: 100,
    });
    expect(await getScore(school)).toBeLessThanOrEqual(20);
  });

  it('no buildings, no population, 50% road → score = 50 (all defaults)', async () => {
    // infraScore=50, ageScore=50, accessScore=50, popScore=50 → 50
    expect(await getScore(buildSchool({ roadStatusPercentage: 50 }))).toBe(50);
  });

  it('facilityComplianceScore does NOT affect overallScore (excluded from formula)', async () => {
    const currentYear = new Date().getFullYear();
    const baseSchool = buildSchool({
      buildings: [buildBuilding(BuildingCondition.GOOD, currentYear - 10)],
      roadStatusPercentage: 80,
    });

    surveyRepo.find
      .mockResolvedValueOnce([{ compliance: ComplianceLevel.COMPLIANT }])
      .mockResolvedValueOnce([{ compliance: ComplianceLevel.NON_COMPLIANT }]);

    const score1 = await getScore({ ...baseSchool });
    const score2 = await getScore({ ...baseSchool });
    expect(score1).toBe(score2);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §7: Seeded representative schools plausibility
// ---------------------------------------------------------------------------

describe('AnalyticsService – recalculate plausibility (seeded representative schools)', () => {
  const currentYear = new Date().getFullYear();

  const seeds = [
    {
      label: 'new school, good buildings, good road',
      school: buildSchool({
        buildings: [
          buildBuilding(BuildingCondition.GOOD, currentYear - 6),
          buildBuilding(BuildingCondition.GOOD, currentYear - 7),
        ],
        roadStatusPercentage: 90,
        educationPrograms: [{ code: 'P1', name: 'Prog1', totalStudents: 200, capacity: 400 }] as any,
      }),
    },
    {
      label: 'aging school, fair buildings, moderate road',
      school: buildSchool({
        buildings: [
          buildBuilding(BuildingCondition.FAIR, currentYear - 21),
          buildBuilding(BuildingCondition.FAIR, currentYear - 23),
        ],
        roadStatusPercentage: 55,
        educationPrograms: [{ code: 'P2', name: 'Prog2', totalStudents: 300, capacity: 350 }] as any,
      }),
    },
    {
      label: 'old school, critical buildings, poor road',
      school: buildSchool({
        buildings: [
          buildBuilding(BuildingCondition.CRITICAL, currentYear - 36),
          buildBuilding(BuildingCondition.POOR, currentYear - 41),
        ],
        roadStatusPercentage: 20,
        educationPrograms: [{ code: 'P3', name: 'Prog3', totalStudents: 500, capacity: 250 }] as any,
      }),
    },
    {
      label: 'school with no buildings or programs (all defaults)',
      school: buildSchool({}),
    },
  ];

  test.each(seeds)('$label → score in [1, 100] with valid priorityLevel', async ({ school }) => {
    const { service } = await makeService();
    const result = await service.calculateSchoolScore(school);
    const score = Math.round(Number(result.overallScore));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(result.priorityLevel).toMatch(/^(critical|high|medium|low)$/);
  });

  it('score ordering: good school scores higher than critical school', async () => {
    const { service } = await makeService();
    const goodResult = await service.calculateSchoolScore(seeds[0].school);
    const critResult = await service.calculateSchoolScore(seeds[2].school);
    expect(Number(goodResult.overallScore)).toBeGreaterThan(Number(critResult.overallScore));
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §8: Score convergence – frontend calculateDeepScore alignment
// ---------------------------------------------------------------------------

describe('Score convergence: Dashboard.tsx calculateDeepScore === SchoolDecisionDashboard overallScore', () => {
  function calculateDeepScore(school: any): number {
    if (!school) return 0;
    const serverScore = parseFloat(String(school.overallScore));
    if (!isNaN(serverScore) && serverScore > 0) {
      return Math.min(100, Math.max(0, Math.round(serverScore)));
    }
    const currentYear = new Date().getFullYear();
    const road = parseFloat(String(school.roadStatusPercentage));
    const accessibilityScore = isNaN(road) ? 50 : Math.min(100, Math.max(0, road));
    const established = parseFloat(String(school.establishedYear));
    const schoolAge = isNaN(established) ? 20 : Math.max(0, currentYear - established);
    const buildingAgeScore = Math.max(0, 100 - Math.min(schoolAge * 1.5, 50));
    const programs: any[] = Array.isArray(school.educationPrograms) ? school.educationPrograms : [];
    const totalStudents = programs.reduce(
      (s: number, p: any) => s + (parseFloat(String(p.totalStudents)) || 0), 0,
    );
    const totalCapacity = programs.reduce(
      (s: number, p: any) => s + (parseFloat(String(p.capacity)) || 0), 0,
    );
    const capacityScore = totalCapacity > 0
      ? Math.min(100, Math.max(0, Math.round((totalCapacity / Math.max(totalStudents, 1)) * 100)))
      : 50;
    return Math.round(accessibilityScore * 0.4 + buildingAgeScore * 0.35 + capacityScore * 0.25);
  }

  function calculateDecisionIntelligenceScore(calculatedAssessment: any): number {
    const raw = parseFloat(String(calculatedAssessment?.overallScore));
    return isNaN(raw) ? 50 : Math.min(100, Math.max(0, Math.round(raw)));
  }

  it('when overallScore > 0, both dashboards show identical clamped value', () => {
    expect(calculateDeepScore({ overallScore: 72 })).toBe(72);
    expect(calculateDecisionIntelligenceScore({ overallScore: 72 })).toBe(72);
  });

  it('overallScore = 0: Dashboard falls to fallback (> 0 guard); SDD returns 0 — documented divergence', () => {
    const dashScore = calculateDeepScore({ overallScore: 0, roadStatusPercentage: 70, establishedYear: 2010 });
    expect(dashScore).toBeGreaterThan(0);
    expect(calculateDecisionIntelligenceScore({ overallScore: 0 })).toBe(0);
  });

  it('overallScore above 100 is clamped to 100 on both paths', () => {
    expect(calculateDeepScore({ overallScore: 150 })).toBe(100);
    expect(calculateDecisionIntelligenceScore({ overallScore: 150 })).toBe(100);
  });

  it('negative overallScore: Dashboard uses fallback; SDD clamps to 0', () => {
    const dashNeg = calculateDeepScore({ overallScore: -10 });
    expect(dashNeg).toBeGreaterThan(0);
    expect(dashNeg).toBeLessThan(100);
    expect(calculateDecisionIntelligenceScore({ overallScore: -10 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §9: getOverview, getDecisions — public query methods
// ---------------------------------------------------------------------------

describe('AnalyticsService – getOverview', () => {
  it('returns aggregated overview shape with totals and provinceStats', async () => {
    const assessmentRepo = makeRepo({
      find: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    });
    const schoolRepo = makeRepo({
      count: jest.fn().mockResolvedValue(42),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn()
          .mockResolvedValueOnce([{ priority: 'critical', count: '3' }])
          .mockResolvedValueOnce([{ province: 'Kigali', total: '10', critical: '2', high: '1' }]),
      }),
    });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const result = await service.getOverview();

    expect(result.totalSchools).toBe(42);
    expect(result.byPriority).toHaveProperty('critical', 3);
    expect(result.recentAssessments).toHaveLength(1);
    expect(result.provinceStats).toHaveLength(1);
  });

  it('byPriority maps null priority to "unassessed"', async () => {
    const schoolRepo = makeRepo({
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn()
          .mockResolvedValueOnce([{ priority: null, count: '5' }])
          .mockResolvedValueOnce([]),
      }),
    });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const result = await service.getOverview();
    expect(result.byPriority).toHaveProperty('unassessed', 5);
  });
});

describe('AnalyticsService – getDecisions', () => {
  async function makeServiceWithAssessmentRepo(assessmentRepo: ReturnType<typeof makeRepo>) {
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(School), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();
    return module.get(AnalyticsService);
  }

  it('returns all assessments when no filter is provided', async () => {
    const mockAssessments = [{ id: 'a1' }, { id: 'a2' }];
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockAssessments),
    };
    const assessmentRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = await makeServiceWithAssessmentRepo(assessmentRepo);

    const result = await service.getDecisions();
    expect(result).toEqual(mockAssessments);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('applies province filter when provided', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const assessmentRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = await makeServiceWithAssessmentRepo(assessmentRepo);

    await service.getDecisions({ province: 'Kigali' });
    expect(qb.andWhere).toHaveBeenCalledWith('school.province = :province', { province: 'Kigali' });
  });

  it('applies priority filter when provided', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const assessmentRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = await makeServiceWithAssessmentRepo(assessmentRepo);

    await service.getDecisions({ priority: 'critical' });
    expect(qb.andWhere).toHaveBeenCalledWith('da.priorityLevel = :priority', { priority: 'critical' });
  });

  it('applies both filters when both are provided', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const assessmentRepo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = await makeServiceWithAssessmentRepo(assessmentRepo);

    await service.getDecisions({ province: 'Kigali', priority: 'high' });
    expect(qb.andWhere).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §10: recalculateAllScores, recalculateSchoolScore, handleSchoolUpdated
// ---------------------------------------------------------------------------

describe('AnalyticsService – recalculateAllScores', () => {
  it('processes all schools and returns processed count', async () => {
    const schools = [
      buildSchool({ id: 'school-1' }),
      buildSchool({ id: 'school-2' }),
      buildSchool({ id: 'school-3' }),
    ];
    const schoolRepo = makeRepo({ find: jest.fn().mockResolvedValue(schools) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const result = await service.recalculateAllScores();

    expect(result.processed).toBe(3);
  });

  it('returns processed=0 when no schools exist', async () => {
    const schoolRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const result = await service.recalculateAllScores();
    expect(result.processed).toBe(0);
  });
});

describe('AnalyticsService – recalculateSchoolScore', () => {
  it('returns a DecisionAssessment for a known school', async () => {
    const school = buildSchool({ id: 'school-42' });
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(school) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const result = await service.recalculateSchoolScore('school-42');
    expect(result).toBeDefined();
    expect(result.priorityLevel).toBeDefined();
  });

  it('throws NotFoundException when school does not exist', async () => {
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    await expect(service.recalculateSchoolScore('missing-id')).rejects.toThrow(
      'School with id "missing-id" not found',
    );
  });
});

describe('AnalyticsService – handleSchoolUpdated', () => {
  it('silently resolves when school exists', async () => {
    const school = buildSchool({ id: 'school-evt' });
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(school) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    await expect(service.handleSchoolUpdated({ schoolId: 'school-evt' })).resolves.toBeUndefined();
  });

  it('swallows NotFoundException and does not throw', async () => {
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    await expect(service.handleSchoolUpdated({ schoolId: 'missing' })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §11: getSchoolMetrics
// ---------------------------------------------------------------------------

describe('AnalyticsService – getSchoolMetrics', () => {
  it('throws NotFoundException when school does not exist', async () => {
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    await expect(service.getSchoolMetrics('missing-id')).rejects.toThrow(
      'School with id "missing-id" not found',
    );
  });

  it('returns a SchoolMetricsDto with correct shape for a basic school', async () => {
    const currentYear = new Date().getFullYear();
    const school = buildSchool({
      id: 'school-metrics-1',
      maleTeachers: 10 as any,
      femaleTeachers: 5 as any,
      maleAdminStaff: 2 as any,
      femaleAdminStaff: 1 as any,
      maleSupportStaff: 0 as any,
      femaleSupportStaff: 0 as any,
      usedLandArea: 5000 as any,
      unusedLandArea: 2000 as any,
      roadStatusPercentage: 70,
      buildings: [buildBuilding(BuildingCondition.GOOD, currentYear - 10)],
    });
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(school) });
    const issueReportRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: issueReportRepo },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const dto = await service.getSchoolMetrics('school-metrics-1');

    expect(dto.schoolId).toBe('school-metrics-1');
    expect(dto.overallScore).toBeGreaterThan(0);
    expect(dto.priorityLevel).toMatch(/^(critical|high|medium|low)$/);
    expect(dto.totalTeachers).toBe(15);
    expect(dto.totalStaff).toBe(18);
    expect(dto.maleTeacherRatio).toBe(67);
    expect(dto.usedLandArea).toBe(5000);
    expect(dto.unusedLandArea).toBe(2000);
    expect(dto.buildingCount).toBe(1);
    expect(dto.avgBuildingAge).toBe(10);
    expect(dto.reportSummary.total).toBe(0);
  });

  it('reportSummary correctly counts each status bucket from issue reports', async () => {
    const school = buildSchool({ id: 'school-reports' });
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(school) });

    const reports = [
      { id: 'r1', status: ReportStatus.NEED_INTERVENTION, facilityId: 'f1', description: 'desc1', buildingId: 'b1', schoolId: 'school-reports', createdAt: new Date() },
      { id: 'r2', status: ReportStatus.NEED_INTERVENTION, facilityId: 'f2', description: 'desc2', buildingId: 'b2', schoolId: 'school-reports', createdAt: new Date() },
      { id: 'r3', status: ReportStatus.PENDING, facilityId: 'f3', description: 'desc3', buildingId: null, schoolId: 'school-reports', createdAt: new Date() },
      { id: 'r4', status: ReportStatus.SOLVED, facilityId: 'f4', description: 'desc4', buildingId: null, schoolId: 'school-reports', createdAt: new Date() },
      { id: 'r5', status: ReportStatus.FAILED, facilityId: 'f5', description: 'desc5', buildingId: null, schoolId: 'school-reports', createdAt: new Date() },
    ] as IssueReport[];

    const issueReportRepo = makeRepo({ find: jest.fn().mockResolvedValue(reports) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: issueReportRepo },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const dto = await service.getSchoolMetrics('school-reports');

    expect(dto.reportSummary.total).toBe(5);
    expect(dto.reportSummary.critical).toBe(2);
    expect(dto.reportSummary.pending).toBe(1);
    expect(dto.reportSummary.resolved).toBe(1);
    expect(dto.reportSummary.failed).toBe(1);
    expect(dto.reportSummary.recentCritical).toHaveLength(2);
    expect(dto.reportSummary.recentCritical[0].id).toBe('r1');
  });

  it('calculates totalStudents from educationPrograms when present', async () => {
    const school = buildSchool({
      id: 'school-prog',
      educationPrograms: [
        { totalStudents: 100, capacity: 200 },
        { totalStudents: 150, capacity: 200 },
      ] as any,
      totalStudents: 999 as any,
    });
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(school) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    const service = module.get(AnalyticsService);
    const dto = await service.getSchoolMetrics('school-prog');

    // Should use programs sum (250) not raw totalStudents (999)
    expect(dto.totalStudents).toBe(250);
    expect(dto.totalCapacity).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §12: generateRecommendations — via calculateSchoolScore triggers
// ---------------------------------------------------------------------------

describe('generateRecommendations — exercised via calculateSchoolScore', () => {
  it('generates URGENT structural recommendation when critical/poor buildings exist', async () => {
    const { service } = await makeService();
    const school = buildSchool({
      buildings: [
        buildBuilding(BuildingCondition.CRITICAL),
        buildBuilding(BuildingCondition.POOR),
      ],
    });

    const result = await service.calculateSchoolScore(school);
    const recs = result.recommendations ?? [];
    expect(recs.some((r) => r.includes('[URGENT]'))).toBe(true);
  });

  it('generates CRITICAL overcapacity recommendation when students > 110% of capacity', async () => {
    const { service } = await makeService();
    const school = buildSchool({
      educationPrograms: [{ totalStudents: 500, capacity: 200 }] as any,
    });

    const result = await service.calculateSchoolScore(school);
    const recs = result.recommendations ?? [];
    expect(recs.some((r) => r.includes('[CRITICAL]'))).toBe(true);
  });

  it('falls back to routine maintenance when no issues detected', async () => {
    const { service } = await makeService();
    const school = buildSchool({
      buildings: [buildBuilding(BuildingCondition.GOOD)],
      educationPrograms: [{ totalStudents: 100, capacity: 300 }] as any,
    });

    const result = await service.calculateSchoolScore(school);
    const recs = result.recommendations ?? [];
    expect(recs.some((r) => r.includes('routine maintenance'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TASK-020 §13: calculateFacilityComplianceScore — exercised via calculateSchoolScore
// ---------------------------------------------------------------------------

describe('calculateFacilityComplianceScore — exercised via getSchoolMetrics', () => {
  async function makeServiceWithSurveys(surveys: { compliance: ComplianceLevel }[]) {
    const school = buildSchool({ id: 'school-survey' });
    const schoolRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(school) });
    const surveyRepo = makeRepo({ find: jest.fn().mockResolvedValue(surveys) });

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: surveyRepo },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) } },
      ],
    }).compile();

    return module.get(AnalyticsService);
  }

  it('no surveys → facilityComplianceScore = 50 (default)', async () => {
    const service = await makeServiceWithSurveys([]);
    const dto = await service.getSchoolMetrics('school-survey');
    expect(dto.facilityComplianceScore).toBe(50);
  });

  it('all COMPLIANT surveys → facilityComplianceScore = 100', async () => {
    const service = await makeServiceWithSurveys([
      { compliance: ComplianceLevel.COMPLIANT },
      { compliance: ComplianceLevel.COMPLIANT },
    ]);
    const dto = await service.getSchoolMetrics('school-survey');
    expect(dto.facilityComplianceScore).toBe(100);
  });

  it('all NON_COMPLIANT surveys → facilityComplianceScore = 50 (implementation note: 0 || 50 guard)', async () => {
    // The service uses `complianceMap[survey.compliance] || 50`. NON_COMPLIANT maps to 0
    // which is falsy, so the || 50 fallback fires — effectively treating NON_COMPLIANT as 50.
    const service = await makeServiceWithSurveys([
      { compliance: ComplianceLevel.NON_COMPLIANT },
    ]);
    const dto = await service.getSchoolMetrics('school-survey');
    expect(dto.facilityComplianceScore).toBe(50);
  });

  it('mixed COMPLIANT + NON_COMPLIANT → facilityComplianceScore = 75 (implementation note: 0 || 50 guard)', async () => {
    // COMPLIANT(100) + NON_COMPLIANT(50 via || guard) = 150 / 2 = 75
    const service = await makeServiceWithSurveys([
      { compliance: ComplianceLevel.COMPLIANT },
      { compliance: ComplianceLevel.NON_COMPLIANT },
    ]);
    const dto = await service.getSchoolMetrics('school-survey');
    expect(dto.facilityComplianceScore).toBe(75);
  });

  it('PARTIAL compliance → facilityComplianceScore = 50', async () => {
    const service = await makeServiceWithSurveys([
      { compliance: ComplianceLevel.PARTIAL },
    ]);
    const dto = await service.getSchoolMetrics('school-survey');
    expect(dto.facilityComplianceScore).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// TASK-031: recalculateAllScores — audit logging
// ---------------------------------------------------------------------------

describe('AnalyticsService.recalculateAllScores — audit logging', () => {
  it('calls auditService.log with analytics.recalculate after processing all schools', async () => {
    const schoolRepo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const auditServiceMock = { log: jest.fn(), findAll: jest.fn().mockResolvedValue([[], 0]) };

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DecisionAssessment), useValue: makeRepo() },
        { provide: getRepositoryToken(School), useValue: schoolRepo },
        { provide: getRepositoryToken(SchoolBuilding), useValue: makeRepo() },
        { provide: getRepositoryToken(PopulationData), useValue: makeRepo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: makeRepo() },
        { provide: getRepositoryToken(IssueReport), useValue: makeRepo() },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    }).compile();

    const svc = module.get(AnalyticsService);
    const actor = { id: 'user-1', email: 'admin@rtb.gov.rw' };

    await svc.recalculateAllScores(actor);

    expect(auditServiceMock.log).toHaveBeenCalledWith(
      actor,
      'analytics.recalculate',
      'system',
      undefined,
      { processed: 0 },
    );
  });

  it('logs null actor when called without an actor (event-driven path)', async () => {
    const { service, auditService } = await makeService();

    await service.recalculateAllScores();

    expect(auditService.log).toHaveBeenCalledWith(
      null,
      'analytics.recalculate',
      'system',
      undefined,
      expect.objectContaining({ processed: expect.any(Number) }),
    );
  });
});
