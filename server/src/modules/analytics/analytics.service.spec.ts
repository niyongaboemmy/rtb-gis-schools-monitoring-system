import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
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
  ReportType,
} from '../reports/entities/issue-report.entity';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import {
  SCORING_VERSION,
  ageToScore,
  computeCoverage,
  computeOverallScore,
  demandRatioToScore,
  scoreToPriorityLevel,
} from './scoring.constants';
import {
  accessibilityScore,
  assessmentChanged,
  buildingAgeScore,
  computeAssessment,
  facilityComplianceScore,
  infrastructureScore,
  populationScore,
  resolutionScore,
  ScoringInputs,
} from './scoring-engine';
import { assessedBuildings } from './school-metrics.helpers';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const CY = new Date().getFullYear();
const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

/** Query-builder mock: every chain method returns itself; terminal results configurable. */
const qb = (o: Partial<Record<string, jest.Mock>> = {}) => {
  const q: Record<string, jest.Mock> = {};
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'take',
    'limit',
    'leftJoin',
    'innerJoin',
    'leftJoinAndMapOne',
    'innerJoinAndMapOne',
    'leftJoinAndSelect',
    'innerJoinAndSelect',
  ])
    q[m] = jest.fn(() => q);
  q.getRawOne = jest.fn().mockResolvedValue({});
  q.getRawMany = jest.fn().mockResolvedValue([]);
  q.getMany = jest.fn().mockResolvedValue([]);
  q.getCount = jest.fn().mockResolvedValue(0);
  return Object.assign(q, o);
};

const makeRepo = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  exists: jest.fn().mockResolvedValue(true),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ ...v, id: v.id ?? 'assessment-id' })),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
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
    status: 'active',
    buildings: [],
    educationPrograms: [],
    totalStudents: 0,
    roadStatusPercentage: 50,
    ...overrides,
  } as unknown as School;
}

const building = (
  condition: BuildingCondition | null,
  yearBuilt?: number,
): SchoolBuilding =>
  ({ condition, yearBuilt: yearBuilt ?? null }) as unknown as SchoolBuilding;

type Repos = Record<
  | 'assessment'
  | 'scoreHistory'
  | 'action'
  | 'school'
  | 'building'
  | 'population'
  | 'survey'
  | 'issue',
  ReturnType<typeof makeRepo>
>;

async function makeService(
  repos: Partial<Repos> = {},
  gateway?: { emitScoresRecalculated: jest.Mock },
) {
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
      ...(gateway ? [{ provide: EventsGateway, useValue: gateway }] : []),
    ],
  }).compile();
  return { service: module.get(AnalyticsService), repos: r, audit };
}

/** Pure scoring inputs with sensible empty defaults. */
const inputs = (
  o: Omit<Partial<ScoringInputs>, 'school'> & {
    school?: Record<string, unknown>;
  } = {},
): ScoringInputs => ({
  school: { id: 's', buildings: [], educationPrograms: [], ...o.school },
  population: o.population ?? null,
  surveys: o.surveys ?? [],
  reports: o.reports ?? [],
  now: o.now ?? NOW,
});

// ---------------------------------------------------------------------------
// The weighted composite
// ---------------------------------------------------------------------------

describe('computeOverallScore (canonical 6-factor 35/25/10/10/15/5)', () => {
  const all = (v: number) => ({
    infrastructure: v,
    buildingAge: v,
    accessibility: v,
    population: v,
    facilityCompliance: v,
    resolution: v,
  });
  it('all components 50 → 50', () =>
    expect(computeOverallScore(all(50))).toBe(50));
  it('all components 100 → 100', () =>
    expect(computeOverallScore(all(100))).toBe(100));
  it('weights are applied in the documented proportion', () =>
    expect(computeOverallScore({ ...all(0), infrastructure: 100 })).toBe(35));
  it('clamps out-of-range components', () =>
    expect(
      computeOverallScore({
        ...all(50),
        infrastructure: 500,
        buildingAge: -100,
      }),
    ).toBe(Math.round(35 + 0 + 5 + 5 + 7.5 + 2.5)));
  it('every non-finite component falls back to the neutral 50 (one rule)', () => {
    for (const k of Object.keys(all(0)) as Array<
      keyof ReturnType<typeof all>
    >) {
      expect(computeOverallScore({ ...all(50), [k]: NaN })).toBe(50);
    }
  });
});

describe('priority banding', () => {
  it.each([
    [0, PriorityLevel.CRITICAL],
    [34, PriorityLevel.CRITICAL],
    [35, PriorityLevel.HIGH],
    [54, PriorityLevel.HIGH],
    [55, PriorityLevel.MEDIUM],
    [74, PriorityLevel.MEDIUM],
    [75, PriorityLevel.LOW],
    [100, PriorityLevel.LOW],
  ])('score %i → %s', (s, expected) =>
    expect(scoreToPriorityLevel(s)).toBe(expected),
  );
});

describe('computeCoverage', () => {
  const none = {
    infrastructure: false,
    buildingAge: false,
    accessibility: false,
    population: false,
    facilityCompliance: false,
    resolution: false,
  };
  it('no gaps → 1', () => expect(computeCoverage(none)).toBe(1));
  it('all gaps → 0', () =>
    expect(
      computeCoverage(
        Object.fromEntries(
          Object.keys(none).map((k) => [k, true]),
        ) as typeof none,
      ),
    ).toBe(0));
  it('only building age measured → 0.25', () =>
    expect(
      computeCoverage({
        infrastructure: true,
        buildingAge: false,
        accessibility: true,
        population: true,
        facilityCompliance: true,
        resolution: true,
      }),
    ).toBe(0.25));
});

// ---------------------------------------------------------------------------
// Components (pure)
// ---------------------------------------------------------------------------

describe('assessedBuildings', () => {
  it('drops a stub with no condition and no inventory fields', () =>
    expect(assessedBuildings([{ condition: null }])).toHaveLength(0));
  it('keeps a building with an assessed condition, even "fair"', () =>
    expect(assessedBuildings([{ condition: 'fair' }])).toHaveLength(1));
  it('blank strings from a form are not a signal', () =>
    expect(
      assessedBuildings([{ condition: null, buildingCode: '', notes: ' ' }]),
    ).toHaveLength(0));
  it('keeps a stub once any inventory field is filled', () =>
    expect(assessedBuildings([{ condition: null, floors: 2 }])).toHaveLength(
      1,
    ));
});

describe('infrastructureScore', () => {
  const s = (...c: BuildingCondition[]) =>
    infrastructureScore(c.map((x) => building(x)));
  it('all GOOD → 100', () => expect(s(BuildingCondition.GOOD).score).toBe(100));
  it('all FAIR → 70', () => expect(s(BuildingCondition.FAIR).score).toBe(70));
  it('all POOR → 30', () => expect(s(BuildingCondition.POOR).score).toBe(30));
  it('all CRITICAL → 10', () =>
    expect(s(BuildingCondition.CRITICAL).score).toBe(10));
  it('GOOD + FAIR → 85', () =>
    expect(s(BuildingCondition.GOOD, BuildingCondition.FAIR).score).toBe(85));
  it('2 GOOD + 1 POOR → 77', () =>
    expect(
      s(BuildingCondition.GOOD, BuildingCondition.GOOD, BuildingCondition.POOR)
        .score,
    ).toBe(77));
  it('no rated buildings → neutral 50 + gap', () =>
    expect(infrastructureScore([])).toEqual({ score: 50, gap: true }));
  it('buildings without a condition are not rated (year only → gap)', () =>
    expect(infrastructureScore([building(null, CY - 5)])).toEqual({
      score: 50,
      gap: true,
    }));
});

describe('buildingAgeScore', () => {
  it.each([
    [5, 95],
    [10, 95],
    [18, 80],
    [30, 60],
    [40, 45],
    [50, 30],
    [60, 20],
    [80, 10],
  ])('avg age %i → %i', (age, expected) =>
    expect(
      buildingAgeScore([building(BuildingCondition.GOOD, CY - age)], null, CY)
        .score,
    ).toBe(expected),
  );
  it('falls back to the establishment year', () =>
    expect(buildingAgeScore([], CY - 45, CY)).toEqual({
      score: 30,
      gap: false,
      avgAge: null,
    }));
  it('no year anywhere → neutral 50 + gap', () =>
    expect(buildingAgeScore([], null, CY).gap).toBe(true));
  it('a future build year is dropped, never scored as new stock', () => {
    const r = buildingAgeScore(
      [building(BuildingCondition.GOOD, CY + 9)],
      null,
      CY,
    );
    expect(r).toEqual({ score: 50, gap: true, avgAge: null });
  });
  it('a future establishment year is a gap', () =>
    expect(buildingAgeScore([], CY + 3, CY).gap).toBe(true));
  it('ageToScore(NaN) is neutral, not the worst band', () =>
    expect(ageToScore(NaN)).toBe(50));
});

describe('accessibilityScore', () => {
  it('road % is the score', () =>
    expect(accessibilityScore(70)).toEqual({ score: 70, gap: false }));
  it('missing → neutral + gap', () =>
    expect(accessibilityScore(null)).toEqual({ score: 50, gap: true }));
});

describe('populationScore', () => {
  const school = (o: Record<string, unknown> = {}) => ({
    id: 's',
    educationPrograms: [],
    ...o,
  });
  it.each([
    [50, 200, 100],
    [250, 200, 70],
    [250, 100, 50],
    [400, 100, 30],
    [1000, 200, 10],
  ])('demand %i / enrolment %i → %i', (demand, students, expected) =>
    expect(
      populationScore(
        { schoolAgePopulation2km: demand },
        school({ totalStudents: students }),
      ).score,
    ).toBe(expected),
  );
  it('no record → neutral + gap', () =>
    expect(populationScore(null, school())).toEqual({ score: 50, gap: true }));
  it('a 0 / null / NaN school-age population is missing data, not "no demand" (was 100)', () => {
    for (const v of [0, '0.00', null, 'abc', -5]) {
      expect(
        populationScore({ schoolAgePopulation2km: v as never }, school()),
      ).toEqual({ score: 50, gap: true });
    }
  });
  it('uses programme seat capacity (not enrolment) as the denominator', () =>
    expect(
      populationScore(
        { schoolAgePopulation2km: 300 },
        school({
          totalStudents: 600,
          educationPrograms: [{ totalStudents: 600, capacity: 100 }],
        }),
      ).score,
    ).toBe(30));
  it('no capacity and no enrolment → default catchment 300', () =>
    expect(
      populationScore({ schoolAgePopulation2km: 299 }, school()).score,
    ).toBe(100));
  it('demandRatioToScore(NaN) is neutral', () =>
    expect(demandRatioToScore(NaN)).toBe(50));
});

describe('facilityComplianceScore', () => {
  const run = (...c: ComplianceLevel[]) =>
    facilityComplianceScore(c.map((compliance) => ({ compliance })));
  it('no surveys → 50 + gap', () =>
    expect(run()).toEqual({ score: 50, gap: true }));
  it('all COMPLIANT → 100', () =>
    expect(
      run(ComplianceLevel.COMPLIANT, ComplianceLevel.COMPLIANT).score,
    ).toBe(100));
  it('NON_COMPLIANT → 0', () =>
    expect(run(ComplianceLevel.NON_COMPLIANT).score).toBe(0));
  it('COMPLIANT + NON_COMPLIANT → 50', () =>
    expect(
      run(ComplianceLevel.COMPLIANT, ComplianceLevel.NON_COMPLIANT).score,
    ).toBe(50));
  it('PARTIAL → 50', () => expect(run(ComplianceLevel.PARTIAL).score).toBe(50));
});

describe('resolutionScore', () => {
  const rep = (status: ReportStatus, ageDays: number, type?: ReportType) => ({
    status,
    createdAt: daysAgo(ageDays),
    type: type ?? ReportType.ISSUE,
  });
  it('no reports → neutral + gap', () =>
    expect(resolutionScore([], NOW)).toMatchObject({ score: 50, gap: true }));
  it('a freshly filed report does not lower the score (was 0)', () =>
    expect(resolutionScore([rep(ReportStatus.PENDING, 1)], NOW)).toMatchObject({
      score: 50,
      gap: true,
      eligible: 0,
    }));
  it('fewer than 3 eligible reports → neutral + gap', () =>
    expect(
      resolutionScore(
        [rep(ReportStatus.PENDING, 60), rep(ReportStatus.SOLVED, 60)],
        NOW,
      ),
    ).toMatchObject({ score: 50, gap: true, eligible: 2 }));
  it('solved ÷ (solved + open beyond the 30-day SLA)', () =>
    expect(
      resolutionScore(
        [
          rep(ReportStatus.SOLVED, 2),
          rep(ReportStatus.PENDING, 45),
          rep(ReportStatus.NEED_INTERVENTION, 90),
          rep(ReportStatus.PENDING, 3), // inside the SLA → not eligible
        ],
        NOW,
      ),
    ).toMatchObject({ score: 33, gap: false, eligible: 3, solved: 1 }));
  it('data change requests never count', () =>
    expect(
      resolutionScore(
        [1, 2, 3, 4].map(() =>
          rep(ReportStatus.PENDING, 90, ReportType.DATA_CHANGE_REQUEST),
        ),
        NOW,
      ),
    ).toMatchObject({ gap: true, eligible: 0 }));
});

// ---------------------------------------------------------------------------
// computeAssessment — composite + recommendations + budget
// ---------------------------------------------------------------------------

describe('computeAssessment', () => {
  it('2 GOOD + 1 POOR @25yr, road 50, demand 250/200 → 64 (MEDIUM)', () => {
    const a = computeAssessment(
      inputs({
        school: {
          buildings: [
            building(BuildingCondition.GOOD, CY - 25),
            building(BuildingCondition.GOOD, CY - 25),
            building(BuildingCondition.POOR, CY - 25),
          ],
          roadStatusPercentage: 50,
          totalStudents: 200,
        },
        population: { schoolAgePopulation2km: 250 },
      }),
    );
    // 77·.35 + 60·.25 + 50·.1 + 70·.1 + 50·.15 + 50·.05 = 63.95
    expect(a.overallScore).toBe(64);
    expect(a.priorityLevel).toBe(PriorityLevel.MEDIUM);
  });

  it('all-CRITICAL @40yr, road 80, ratio 5 → CRITICAL', () => {
    const a = computeAssessment(
      inputs({
        school: {
          buildings: [
            building(BuildingCondition.CRITICAL, CY - 40),
            building(BuildingCondition.CRITICAL, CY - 40),
          ],
          roadStatusPercentage: 80,
          totalStudents: 200,
        },
        population: { schoolAgePopulation2km: 1000 },
      }),
    );
    expect(a.overallScore).toBeLessThan(35);
    expect(a.priorityLevel).toBe(PriorityLevel.CRITICAL);
  });

  it('2 GOOD @15yr, road 60, no population → 76 (LOW)', () => {
    const a = computeAssessment(
      inputs({
        school: {
          buildings: [
            building(BuildingCondition.GOOD, CY - 15),
            building(BuildingCondition.GOOD, CY - 15),
          ],
          roadStatusPercentage: 60,
        },
      }),
    );
    expect(a.overallScore).toBe(76);
    expect(a.priorityLevel).toBe(PriorityLevel.LOW);
  });

  it('no data at all → 50, every gap set, coverage 0', () => {
    const a = computeAssessment(
      inputs({ school: { roadStatusPercentage: null } }),
    );
    expect(a.overallScore).toBe(50);
    expect(Object.values(a.dataGaps).every(Boolean)).toBe(true);
    expect(a.dataCoverage).toBe(0);
  });

  it('a placeholder-only school is an infra gap and is budgeted for a survey', () => {
    const a = computeAssessment(
      inputs({
        school: { buildings: [building(null)], roadStatusPercentage: 80 },
      }),
    );
    expect(a.hasInfraDataGap).toBe(true);
    expect(a.infrastructureScore).toBe(50);
    expect(a.estimatedBudgetRwf).toBe(3_500_000);
    expect(a.basis).toMatchObject({
      buildingCount: 1,
      assessedBuildingCount: 0,
    });
  });

  it('NYAMIRAMA TSS real payload → every fallback path at once', () => {
    const a = computeAssessment(
      inputs({
        school: {
          establishedYear: 1984,
          roadStatusPercentage: 70,
          totalStudents: null,
          educationPrograms: [
            { capacity: null, totalStudents: 101 },
            { capacity: null, totalStudents: 84 },
          ],
        },
      }),
    );
    const expectedAge = ageToScore(CY - 1984);
    expect(a.infrastructureScore).toBe(50);
    expect(a.buildingAgeScore).toBe(expectedAge);
    expect(a.accessibilityScore).toBe(70);
    expect(a.populationPressureScore).toBe(50);
    expect(a.overallScore).toBe(
      Math.round(50 * 0.35 + expectedAge * 0.25 + 7 + 5 + 7.5 + 2.5),
    );
    expect(a.priorityLevel).toBe(PriorityLevel.HIGH);
    expect(a.dataCoverage).toBe(0.35); // age 25 % + access 10 %
  });

  it('a school with missing data gets [DATA] lines, never "[OK]"', () => {
    const a = computeAssessment(
      inputs({ school: { roadStatusPercentage: 40 } }),
    );
    expect(a.recommendations.some((r) => r.startsWith('[DATA]'))).toBe(true);
    expect(a.recommendations.some((r) => r.includes('[OK]'))).toBe(false);
  });

  it('estimated (neutral) components never trigger a "fix" line or a cost', () => {
    const a = computeAssessment(
      inputs({
        school: { roadStatusPercentage: null, establishedYear: CY - 70 },
      }),
    );
    expect(a.recommendations.some((r) => r.startsWith('[ACCESS]'))).toBe(false);
    expect(a.recommendations.some((r) => r.startsWith('[COMPLIANCE]'))).toBe(
      false,
    );
    expect(
      a.recommendations.some((r) => r.startsWith('[DATA] Road access')),
    ).toBe(true);
  });

  it('poor/critical buildings → [URGENT] first and a non-null budget', () => {
    const a = computeAssessment(
      inputs({
        school: {
          buildings: [
            building(BuildingCondition.CRITICAL, CY - 30),
            building(BuildingCondition.POOR, CY - 30),
          ],
          roadStatusPercentage: 80,
        },
      }),
    );
    expect(a.recommendations[0]).toContain('[URGENT]');
    expect(a.primaryRecommendation).toBe(a.recommendations[0]);
    expect(a.estimatedBudgetRwf).toBeGreaterThan(0);
  });

  it('a healthy, fully measured school → [OK] and no budget', () => {
    const a = computeAssessment(
      inputs({
        school: {
          buildings: [building(BuildingCondition.GOOD, CY - 5)],
          roadStatusPercentage: 95,
          educationPrograms: [{ totalStudents: 100, capacity: 400 }],
        },
        population: { schoolAgePopulation2km: 200 },
        surveys: [{ compliance: ComplianceLevel.COMPLIANT }],
        reports: [1, 2, 3].map(() => ({
          status: ReportStatus.SOLVED,
          createdAt: daysAgo(40),
        })),
      }),
    );
    expect(a.recommendations).toEqual([expect.stringContaining('[OK]')]);
    expect(a.estimatedBudgetRwf).toBeNull();
    expect(a.dataCoverage).toBe(1);
  });

  it('caps at 6 recommendations', () => {
    const a = computeAssessment(
      inputs({
        school: {
          buildings: [building(BuildingCondition.CRITICAL, CY - 70)],
          roadStatusPercentage: 5,
          educationPrograms: [{ totalStudents: 900, capacity: 200 }],
        },
      }),
    );
    expect(a.recommendations.length).toBeLessThanOrEqual(6);
  });

  it('assessmentChanged: equal stored row (pg strings) → false; a component change → true', () => {
    const a = computeAssessment(
      inputs({ school: { roadStatusPercentage: 60 } }),
    );
    const stored = {
      ...a,
      overallScore: String(a.overallScore) + '.00',
      dataCoverage: String(a.dataCoverage),
    };
    expect(assessmentChanged(stored, a)).toBe(false);
    expect(
      assessmentChanged({ ...stored, accessibilityScore: '61.00' }, a),
    ).toBe(true);
    expect(assessmentChanged(null, a)).toBe(true);
    // jsonb returns keys in its own order — not a change
    const reordered = Object.fromEntries(Object.entries(a.dataGaps).reverse());
    expect(assessmentChanged({ ...stored, dataGaps: reordered }, a)).toBe(
      false,
    );
    expect(
      assessmentChanged(
        {
          ...stored,
          dataGaps: { ...a.dataGaps, population: !a.dataGaps.population },
        },
        a,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AnalyticsService — persistence behaviour
// ---------------------------------------------------------------------------

describe('calculateSchoolScore (persist)', () => {
  it('first run creates the assessment, one history row and one socket event', async () => {
    const gateway = { emitScoresRecalculated: jest.fn() };
    const { service, repos } = await makeService({}, gateway);
    const res = await service.calculateSchoolScore(buildSchool());
    expect(repos.assessment.save).toHaveBeenCalledTimes(1);
    expect(repos.scoreHistory.save).toHaveBeenCalledTimes(1);
    expect(gateway.emitScoresRecalculated).toHaveBeenCalledTimes(1);
    expect(res.scoringVersion).toBe(SCORING_VERSION);
    expect(res.dataGaps).toBeTruthy();
  });

  it('an unchanged score writes nothing (no history row, no event)', async () => {
    const first = await makeService();
    const saved = await first.service.calculateSchoolScore(buildSchool());
    const gateway = { emitScoresRecalculated: jest.fn() };
    const assessment = makeRepo({
      findOne: jest.fn().mockResolvedValue(saved),
    });
    const { service, repos } = await makeService({ assessment }, gateway);
    await service.calculateSchoolScore(
      buildSchool({
        overallScore: saved.overallScore,
        priorityLevel: saved.priorityLevel,
      } as never),
    );
    expect(assessment.save).not.toHaveBeenCalled();
    expect(repos.scoreHistory.save).not.toHaveBeenCalled();
    expect(repos.school.update).not.toHaveBeenCalled();
    expect(gateway.emitScoresRecalculated).not.toHaveBeenCalled();
  });

  it('updates the existing row rather than creating a second one', async () => {
    const assessment = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'x', schoolId: 'school-1' }),
    });
    const { service } = await makeService({ assessment });
    await service.calculateSchoolScore(buildSchool());
    expect(assessment.create).not.toHaveBeenCalled();
    expect(assessment.save).toHaveBeenCalledTimes(1);
  });

  it('a concurrent first insert (unique violation) retries as an update', async () => {
    const dup = new QueryFailedError('INSERT', [], new Error('dup'));
    (dup as unknown as { driverError: { code: string } }).driverError = {
      code: '23505',
    };
    const existing = { id: 'x', schoolId: 'school-1' };
    const assessment = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing),
      save: jest
        .fn()
        .mockRejectedValueOnce(dup)
        .mockImplementation((v) => Promise.resolve(v)),
    });
    const { service } = await makeService({ assessment });
    const res = await service.calculateSchoolScore(buildSchool());
    expect(assessment.save).toHaveBeenCalledTimes(2);
    expect(res.id).toBe('x');
  });

  it('counts only Issue Reports for the resolution component', async () => {
    const issue = makeRepo({
      find: jest.fn().mockResolvedValue(
        [1, 2, 3, 4].map((i) => ({
          id: `r${i}`,
          status: ReportStatus.PENDING,
          type: ReportType.DATA_CHANGE_REQUEST,
          createdAt: daysAgo(90),
        })),
      ),
    });
    const { service } = await makeService({ issue });
    const res = await service.calculateSchoolScore(buildSchool());
    expect(res.resolutionRateScore).toBe(50);
    expect(res.dataGaps?.resolution).toBe(true);
  });

  it('loads population by the schoolId column', async () => {
    const population = makeRepo({
      findOne: jest.fn().mockResolvedValue({ schoolAgePopulation2km: 1000 }),
    });
    const { service } = await makeService({ population });
    const res = await service.calculateSchoolScore(
      buildSchool({ totalStudents: 200 }),
    );
    expect(population.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 'school-1' } }),
    );
    expect(Number(res.populationPressureScore)).toBe(10);
    expect(res.hasPopDataGap).toBe(false);
  });
});

describe('getSchoolMetrics (read-only)', () => {
  const schoolRepo = (s: School) =>
    makeRepo({ findOne: jest.fn().mockResolvedValue(s) });

  it('never writes: no assessment save, no history, no school update, no event', async () => {
    const gateway = { emitScoresRecalculated: jest.fn() };
    const { service, repos } = await makeService(
      { school: schoolRepo(buildSchool({ id: 's' })) },
      gateway,
    );
    const dto = await service.getSchoolMetrics('s');
    expect(repos.assessment.save).not.toHaveBeenCalled();
    expect(repos.scoreHistory.save).not.toHaveBeenCalled();
    expect(repos.school.update).not.toHaveBeenCalled();
    expect(gateway.emitScoresRecalculated).not.toHaveBeenCalled();
    expect(dto.provisional).toBe(true); // nothing stored yet
  });

  it('serves the stored assessment when it is current', async () => {
    const assessment = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        schoolId: 's',
        overallScore: '42.00',
        infrastructureScore: '30.00',
        buildingAgeScore: '45.00',
        accessibilityScore: '50.00',
        populationPressureScore: '50.00',
        facilityComplianceScore: 50,
        resolutionRateScore: 50,
        priorityLevel: PriorityLevel.HIGH,
        urgencyMonths: 3,
        recommendations: ['[PLAN] x'],
        dataGaps: {
          infrastructure: false,
          buildingAge: false,
          accessibility: false,
          population: true,
          facilityCompliance: true,
          resolution: true,
        },
        dataCoverage: '0.70',
        scoringVersion: SCORING_VERSION,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    });
    const { service } = await makeService({
      school: schoolRepo(buildSchool({ id: 's' })),
      assessment,
    });
    const dto = await service.getSchoolMetrics('s');
    expect(dto.provisional).toBe(false);
    expect(dto.overallScore).toBe(42);
    expect(dto.priorityLevel).toBe(PriorityLevel.HIGH);
    expect(dto.dataCoverage).toBe(0.7);
    expect(dto.calculatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rolls enrolment up from programmes; capacity utilisation uses programme students only', async () => {
    const { service } = await makeService({
      school: schoolRepo(
        buildSchool({
          id: 's',
          educationPrograms: [
            { totalStudents: 100, capacity: 200 },
            { totalStudents: 150, capacity: 200 },
          ] as never,
          totalStudents: 999,
        }),
      ),
    });
    const dto = await service.getSchoolMetrics('s');
    expect(dto.totalStudents).toBe(250);
    expect(dto.totalCapacity).toBe(400);
    expect(dto.capacityUtilisation).toBe(62.5);
  });

  it('capacity utilisation is null when programmes record capacity but no students', async () => {
    const { service } = await makeService({
      school: schoolRepo(
        buildSchool({
          id: 's',
          educationPrograms: [{ totalStudents: 0, capacity: 400 }] as never,
          totalStudents: 500,
        }),
      ),
    });
    expect(
      (await service.getSchoolMetrics('s')).capacityUtilisation,
    ).toBeNull();
  });

  it('reportSummary counts Issue Reports by status (change requests excluded)', async () => {
    const issue = makeRepo({
      find: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          status: ReportStatus.NEED_INTERVENTION,
          createdAt: daysAgo(1),
        },
        { id: 'r2', status: ReportStatus.PENDING, createdAt: daysAgo(1) },
        {
          id: 'r3',
          status: ReportStatus.SOLVED,
          createdAt: daysAgo(4),
          resolvedAt: daysAgo(1),
        },
        {
          id: 'r4',
          status: ReportStatus.PENDING,
          type: ReportType.DATA_CHANGE_REQUEST,
          createdAt: daysAgo(1),
        },
      ]),
    });
    const { service } = await makeService({
      school: schoolRepo(buildSchool({ id: 's' })),
      issue,
    });
    const dto = await service.getSchoolMetrics('s');
    expect(dto.reportSummary).toMatchObject({
      total: 3,
      critical: 1,
      pending: 1,
      resolved: 1,
      active: 2,
      resolutionRate: 33,
      avgResolutionDays: 3,
    });
  });

  it('peer averages need at least 3 peers', async () => {
    const assessment = makeRepo({
      createQueryBuilder: jest.fn(() =>
        qb({ getRawOne: jest.fn().mockResolvedValue({ avg: '60.0', n: '2' }) }),
      ),
    });
    const { service } = await makeService({
      school: schoolRepo(buildSchool({ id: 's' })),
      assessment,
    });
    const dto = await service.getSchoolMetrics('s');
    expect(dto.districtAvgScore).toBeNull();
    expect(dto.scoreDeltaFromDistrict).toBeNull();
    expect(dto.districtPeerCount).toBe(2);
  });

  it('rejects a missing id before querying (TypeORM would match any row)', async () => {
    const { service, repos } = await makeService();
    await expect(service.getSchoolMetrics(undefined as never)).rejects.toThrow(
      'schoolId is required',
    );
    expect(repos.school.findOne).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// National overview
// ---------------------------------------------------------------------------

describe('getOverview', () => {
  /** School query builder that answers by the first selected alias. */
  const schoolQb = (rows: Record<string, unknown[]>, many: unknown[]) => () => {
    let alias = '';
    const q = qb();
    q.select = jest.fn((_: unknown, a?: string) => {
      alias = a ?? alias;
      return q;
    });
    q.getRawMany = jest.fn(() => Promise.resolve(rows[alias] ?? []));
    q.getMany = jest.fn(() => Promise.resolve(many));
    q.getCount = jest.fn().mockResolvedValue(3);
    return q;
  };

  it('returns the aggregate shape; byPriority always has every band', async () => {
    const capacitySchools = [
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
      { id: '3', totalStudents: 50, educationPrograms: [] },
    ];
    const school = makeRepo({
      createQueryBuilder: jest.fn(
        schoolQb(
          {
            priority: [
              { priority: 'critical', count: '1' },
              { priority: null, count: '2' },
            ],
            province: [
              {
                province: 'Kigali',
                total: '3',
                scored: '1',
                critical: '1',
                high: '0',
                medium: '0',
                low: '0',
                avgScore: '30.0',
                minScore: '30',
                maxScore: '30',
              },
              {
                province: 'South',
                total: '1',
                scored: '0',
                critical: '0',
                high: '0',
                medium: '0',
                low: '0',
                avgScore: null,
                minScore: null,
                maxScore: null,
              },
            ],
          },
          capacitySchools,
        ),
      ),
    });
    const { service } = await makeService({ school });
    const res = await service.getOverview();
    expect(res.totalSchools).toBe(3);
    expect(res.byPriority).toEqual({
      critical: 1,
      high: 0,
      medium: 0,
      low: 0,
      unassessed: 2,
    });
    // (100 + 300) / (200 + 300) = 80 %; school 3 has no programme data
    expect(res.nationalCapacityUtilisation).toBe(80);
    // national enrolment = Σ programme roll-up (school 3 falls back to its column)
    expect(res.totalStudents).toBe(450);
    // A province with no scored schools has a null average, not 0
    expect(res.provinceStats[1].avgScore).toBeNull();
    // No scored schools in the aggregate row → averages are null
    expect(res.nationalAvgScore).toBeNull();
    expect(res.scoringModel.weights.resolution).toBe(0.05);
    expect(res.nationalRecommendations.join(' ')).not.toContain('WASH');
  });

  it('critical spotlight orders the lowest scores first', async () => {
    const queries: ReturnType<typeof qb>[] = [];
    const school = makeRepo({
      createQueryBuilder: jest.fn(() => {
        const q = qb();
        queries.push(q);
        return q;
      }),
    });
    const { service } = await makeService({ school });
    await service.getOverview();
    const spot = queries.find((q) =>
      q.where.mock.calls.some((c) =>
        String(c[0]).includes('da.priorityLevel = :crit'),
      ),
    );
    expect(spot?.orderBy).toHaveBeenCalledWith('da.overallScore', 'ASC');
  });

  it('nationalCapacityUtilisation is null when no programme capacity exists', async () => {
    const school = makeRepo({
      createQueryBuilder: jest.fn(
        schoolQb({}, [{ id: '1', totalStudents: 100, educationPrograms: [] }]),
      ),
    });
    const { service } = await makeService({ school });
    expect(
      (await service.getOverview()).nationalCapacityUtilisation,
    ).toBeNull();
  });
});

describe('generateNationalRecommendations', () => {
  const base = {
    criticalCount: 0,
    unassessed: 0,
    scoredSchoolCount: 4,
    provinceStats: [],
    dataGaps: { infrastructure: 0, population: 0 },
    componentAverages: {
      infrastructure: 80,
      buildingAge: 80,
      accessibility: 80,
      population: 80,
      facilityCompliance: 80,
      resolution: 80,
    },
    avgDataCoverage: 1,
  };
  it('one line per finding, no duplicated critical line', async () => {
    const { service } = await makeService();
    const recs = service.generateNationalRecommendations({
      ...base,
      criticalCount: 2,
    });
    expect(recs.filter((r) => r.includes('2 schools'))).toHaveLength(1);
  });
  it('names the weakest measured component', async () => {
    const { service } = await makeService();
    const recs = service.generateNationalRecommendations({
      ...base,
      componentAverages: { ...base.componentAverages, accessibility: 30 },
    });
    expect(
      recs.some((r) => r.startsWith('[FOCUS]') && r.includes('road access')),
    ).toBe(true);
  });
  it('skips the lowest-province line for unscored provinces', async () => {
    const { service } = await makeService();
    const recs = service.generateNationalRecommendations({
      ...base,
      provinceStats: [
        { province: 'A', avgScore: null, scored: 0 },
        { province: 'B', avgScore: 60, scored: 2 },
      ],
    });
    expect(recs.some((r) => r.startsWith('[STRATEGIC]'))).toBe(false);
  });
  it('flags low data coverage', async () => {
    const { service } = await makeService();
    const recs = service.generateNationalRecommendations({
      ...base,
      avgDataCoverage: 0.3,
    });
    expect(recs.some((r) => r.includes('30%'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Recalculation triggers
// ---------------------------------------------------------------------------

describe('recalculateAllScores', () => {
  it('processes every active school and writes an audit log', async () => {
    const school = makeRepo({
      find: jest
        .fn()
        .mockResolvedValue([
          buildSchool({ id: 'a' }),
          buildSchool({ id: 'b' }),
        ]),
    });
    const { service, audit } = await makeService({ school });
    expect((await service.recalculateAllScores()).processed).toBe(2);
    expect(audit.log).toHaveBeenCalledWith(
      null,
      'analytics.recalculate',
      'system',
      undefined,
      {
        processed: 2,
      },
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

describe('handleSchoolUpdated', () => {
  it('coalesces a burst of events into one run plus one trailing run', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const school = makeRepo({
      findOne: jest.fn(async () => {
        await gate;
        return buildSchool({ id: 'a' });
      }),
    });
    const { service } = await makeService({ school });
    const runs = [1, 2, 3, 4].map(() =>
      service.handleSchoolUpdated({ schoolId: 'a' }),
    );
    release();
    await Promise.all(runs);
    expect(school.findOne).toHaveBeenCalledTimes(2);
  });

  it('never throws (a failed background rescore is logged)', async () => {
    const { service } = await makeService();
    await expect(
      service.handleSchoolUpdated({ schoolId: 'missing' }),
    ).resolves.toBeUndefined();
  });
});

describe('getDecisions', () => {
  it('orders the intervention queue by ascending overall score', async () => {
    const q = qb();
    const assessment = makeRepo({ createQueryBuilder: jest.fn(() => q) });
    const { service } = await makeService({ assessment });
    await service.getDecisions();
    expect(q.orderBy).toHaveBeenCalledWith('da.overallScore', 'ASC');
  });

  it('serves the stored dataGaps on each row', async () => {
    const gaps = {
      infrastructure: true,
      buildingAge: false,
      accessibility: true,
      population: false,
      facilityCompliance: true,
      resolution: true,
    };
    const q = qb({
      getMany: jest.fn().mockResolvedValue([{ schoolId: 'a', dataGaps: gaps }]),
    });
    const assessment = makeRepo({ createQueryBuilder: jest.fn(() => q) });
    const { service } = await makeService({ assessment });
    expect((await service.getDecisions())[0].dataGaps).toEqual(gaps);
  });
});
