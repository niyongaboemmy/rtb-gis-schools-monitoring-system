/**
 * WS1.2 — the scoring engine, the school metrics endpoint and the national
 * aggregates must reproduce the hand-calculated golden dataset exactly.
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from '../analytics.service';
import { DecisionAssessment } from '../entities/decision-assessment.entity';
import { ScoreHistory } from '../entities/score-history.entity';
import { RecommendationAction } from '../entities/recommendation-action.entity';
import { School } from '../../schools/entities/school.entity';
import { SchoolBuilding } from '../../schools/entities/school-building.entity';
import { PopulationData } from '../../population/entities/population-data.entity';
import { SchoolFacilitySurvey } from '../../schools/entities/school-facility-survey.entity';
import {
  IssueReport,
  ReportStatus,
} from '../../reports/entities/issue-report.entity';
import { AuditService } from '../../audit/audit.service';
import { GOLDEN, GOLDEN_NATIONAL, GoldenSchool } from './golden-dataset';
import { nationalCapacityUtilisation } from '../school-metrics.helpers';
import { scoreToPriorityLevel } from '../scoring.constants';

const qb = () => {
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
    'innerJoin',
    'innerJoinAndMapOne',
  ])
    q[m] = jest.fn(() => q);
  q.getRawOne = jest.fn().mockResolvedValue({});
  q.getRawMany = jest.fn().mockResolvedValue([]);
  q.getMany = jest.fn().mockResolvedValue([]);
  q.getCount = jest.fn().mockResolvedValue(0);
  return q;
};

const repo = (o: Record<string, jest.Mock> = {}) => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ ...v })),
  update: jest.fn().mockResolvedValue(undefined),
  count: jest.fn().mockResolvedValue(0),
  delete: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn(() => qb()),
  ...o,
});

async function serviceFor(g: GoldenSchool) {
  const school = {
    populationData: [],
    district: 'D',
    province: 'P',
    ...g.school,
  } as unknown as School;
  const reportRows = g.reports.map((status, i) => ({
    id: `${g.key}-r${i}`,
    status,
    createdAt: new Date(),
  }));
  const surveyRows = g.surveys.map((compliance, i) => ({
    id: `${g.key}-s${i}`,
    compliance,
    createdAt: new Date(),
  }));
  const repos = {
    assessment: repo(),
    history: repo(),
    action: repo(),
    school: repo({ findOne: jest.fn().mockResolvedValue(school) }),
    building: repo(),
    population: repo({
      findOne: jest.fn().mockResolvedValue(g.population),
    }),
    survey: repo({
      find: jest.fn().mockResolvedValue(surveyRows),
      findOne: jest.fn().mockResolvedValue(surveyRows[0] ?? null),
    }),
    issue: repo({
      find: jest.fn().mockResolvedValue(reportRows),
      count: jest.fn(({ where }: { where: { status?: ReportStatus } }) =>
        Promise.resolve(
          where.status
            ? reportRows.filter((r) => r.status === where.status).length
            : reportRows.length,
        ),
      ),
    }),
  };
  const mod = await Test.createTestingModule({
    providers: [
      AnalyticsService,
      {
        provide: getRepositoryToken(DecisionAssessment),
        useValue: repos.assessment,
      },
      { provide: getRepositoryToken(ScoreHistory), useValue: repos.history },
      {
        provide: getRepositoryToken(RecommendationAction),
        useValue: repos.action,
      },
      { provide: getRepositoryToken(School), useValue: repos.school },
      { provide: getRepositoryToken(SchoolBuilding), useValue: repos.building },
      {
        provide: getRepositoryToken(PopulationData),
        useValue: repos.population,
      },
      {
        provide: getRepositoryToken(SchoolFacilitySurvey),
        useValue: repos.survey,
      },
      { provide: getRepositoryToken(IssueReport), useValue: repos.issue },
      { provide: AuditService, useValue: { log: jest.fn() } },
    ],
  }).compile();
  return { service: mod.get(AnalyticsService), school };
}

describe('golden dataset — calculateSchoolScore', () => {
  it.each(GOLDEN.map((g) => [g.key, g] as const))(
    '%s reproduces the hand-calculated components and score',
    async (_k, g) => {
      const { service, school } = await serviceFor(g);
      const a = await service.calculateSchoolScore(school);
      expect({
        infrastructure: a.infrastructureScore,
        buildingAge: a.buildingAgeScore,
        accessibility: a.accessibilityScore,
        population: a.populationPressureScore,
        facilityCompliance: a.facilityComplianceScore,
        resolution: a.resolutionRateScore,
      }).toEqual(g.expected.components);
      expect(a.overallScore).toBe(g.expected.overallScore);
      expect(a.priorityLevel).toBe(g.expected.priority);
      expect(a.urgencyMonths).toBe(g.expected.urgencyMonths);
      expect(a.hasInfraDataGap).toBe(g.expected.dataGaps.infrastructure);
      expect(a.hasPopDataGap).toBe(g.expected.dataGaps.population);
    },
  );
});

describe('golden dataset — getSchoolMetrics', () => {
  it.each(GOLDEN.map((g) => [g.key, g] as const))(
    '%s reproduces the derived figures and data-gap flags',
    async (_k, g) => {
      const { service } = await serviceFor(g);
      const m = await service.getSchoolMetrics(String(g.school.id));
      expect(m.overallScore).toBe(g.expected.overallScore);
      expect(m.priorityLevel).toBe(g.expected.priority);
      expect(m.dataGaps).toEqual(g.expected.dataGaps);
      expect({
        totalStudents: m.totalStudents,
        totalCapacity: m.totalCapacity,
        capacityUtilisation: m.capacityUtilisation,
        totalTeachers: m.totalTeachers,
        totalStaff: m.totalStaff,
        studentToTeacherRatio: m.studentToTeacherRatio,
        avgBuildingAge: m.avgBuildingAge,
        totalLandArea: m.totalLandArea,
        usedLandPct: m.usedLandPct,
      }).toEqual(g.expected.metrics);
      // Report summary is internally consistent with the fixture.
      const solved = g.reports.filter((r) => r === ReportStatus.SOLVED).length;
      expect(m.reportSummary.resolved).toBe(solved);
      expect(m.reportSummary.resolutionRate).toBe(
        g.reports.length ? Math.round((solved / g.reports.length) * 100) : null,
      );
      expect(m.riskAssessment.indicative).toBe(true);
      expect(m.riskImpactScore).toBe(m.riskAssessment.impactScore);
    },
  );
});

describe('golden dataset — national aggregates', () => {
  it('average School Condition Score and Intervention Priority counts', async () => {
    const scores: number[] = [];
    for (const g of GOLDEN) {
      const { service, school } = await serviceFor(g);
      scores.push((await service.calculateSchoolScore(school)).overallScore);
    }
    const avg =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    expect(avg).toBe(GOLDEN_NATIONAL.avgScore);
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const s of scores) counts[scoreToPriorityLevel(s)]++;
    expect(counts).toEqual(GOLDEN_NATIONAL.byPriority);
  });

  it('nationalCapacityUtilisation helper = 102 %', () => {
    expect(
      nationalCapacityUtilisation(GOLDEN.map((g) => g.school as never)),
    ).toBe(GOLDEN_NATIONAL.capacityUtilisation);
  });

  it('getOverview returns the golden capacity utilisation and gap counts', async () => {
    const schoolQb = () => {
      const q = qb();
      q.getMany = jest.fn().mockResolvedValue(GOLDEN.map((g) => g.school));
      return q;
    };
    const assessQb = () => {
      const q = qb();
      q.getRawOne = jest.fn().mockResolvedValue({
        infraGaps: String(GOLDEN_NATIONAL.infraGaps),
        popGaps: String(GOLDEN_NATIONAL.popGaps),
      });
      return q;
    };
    const mod = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(DecisionAssessment),
          useValue: repo({ createQueryBuilder: jest.fn(assessQb) }),
        },
        { provide: getRepositoryToken(ScoreHistory), useValue: repo() },
        { provide: getRepositoryToken(RecommendationAction), useValue: repo() },
        {
          provide: getRepositoryToken(School),
          useValue: repo({ createQueryBuilder: jest.fn(schoolQb) }),
        },
        { provide: getRepositoryToken(SchoolBuilding), useValue: repo() },
        { provide: getRepositoryToken(PopulationData), useValue: repo() },
        { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: repo() },
        { provide: getRepositoryToken(IssueReport), useValue: repo() },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    const o = await mod.get(AnalyticsService).getOverview();
    expect(o.nationalCapacityUtilisation).toBe(
      GOLDEN_NATIONAL.capacityUtilisation,
    );
    expect(o.dataGaps.infrastructure).toBe(GOLDEN_NATIONAL.infraGaps);
    expect(o.dataGaps.population).toBe(GOLDEN_NATIONAL.popGaps);
  });
});
