import {
  RiskInputs,
  computeRiskAssessment,
  riskImpactScore,
  riskProbabilityScore,
} from './risk-assessment';
import { accessibilityScore } from './scoring-engine';
import {
  buildingAges,
  capacityInputs,
  capacityUtilisationPct,
  landSummary,
  programmeTotals,
  studentTeacherRatio,
  teacherCount,
} from './school-metrics.helpers';

const base: RiskInputs = {
  overallScore: 58,
  infrastructureScore: 67,
  populationScore: 50,
  urgencyMonths: 12,
  buildingCount: 3,
  poorOrCriticalBuildingCount: 1,
  avgBuildingAge: 25,
  hasPopDataGap: false,
  daysSinceLastSurvey: 30,
  needsInterventionCount: 2,
  failedCount: 1,
  avgResolutionDays: 8,
};

describe('risk heuristics (indicative)', () => {
  it('impact: 0.5·(100−58) + 0.3·(1/3·100) + 0.2·(100−24) = 21 + 10 + 15.2 = 46.2 → 46', () => {
    expect(riskImpactScore(base)).toBe(46);
  });

  it('impact: urgency 0 contributes the full 20 points', () => {
    expect(
      riskImpactScore({
        ...base,
        overallScore: 14,
        urgencyMonths: 0,
        poorOrCriticalBuildingCount: 3,
      }),
    ).toBe(Math.round(43 + 30 + 20)); // 93
  });

  it('probability: 0.5·min(100, 37.5) + 0.25·20 + 0.25·20 = 18.75 + 5 + 5 = 28.75 → 29', () => {
    expect(riskProbabilityScore(base)).toBe(29);
  });

  it('probability: unknown age (50 y) + pop gap + never surveyed = 37.5 + 15 + 20 = 72.5 → 73', () => {
    expect(
      riskProbabilityScore({
        ...base,
        avgBuildingAge: null,
        hasPopDataGap: true,
        daysSinceLastSurvey: null,
      }),
    ).toBe(73);
  });

  it('factor levels and risk scores follow the documented rules', () => {
    const r = computeRiskAssessment(base);
    const f = Object.fromEntries(r.factors.map((x) => [x.id, x]));
    expect(f.needsIntervention.level).toBe('medium'); // 2 open
    expect(f.needsIntervention.impact).toBe(46 + 8);
    // Observed issues are certain: probability 100, not the age-driven 29.
    expect(f.needsIntervention.probability).toBe(100);
    expect(f.needsIntervention.riskScore).toBe(54);
    expect(f.failedRepairs.level).toBe('medium');
    expect(f.infrastructure.level).toBe('medium'); // 67 < 75
    expect(f.infrastructure.impact).toBe(33);
    expect(f.infrastructure.probability).toBe(29);
    expect(f.population.level).toBe('high'); // 50 < 55
    expect(f.resolutionTime.level).toBe('medium'); // 8 days
    expect(f.resolutionTime.impact).toBe(80);
    expect(r.factors.every((x) => x.applies)).toBe(true);
    // mean of (54·100 + 49·100 + 33·29 + 50·29 + 80·100) / 100 / 5
    expect(r.overall.score).toBe(
      Math.round((54 + 49 + 0.33 * 29 + 0.5 * 29 + 80) / 5),
    );
    expect(r.indicative).toBe(true);
    for (const x of r.factors) expect(x.rule.length).toBeGreaterThan(10);
  });

  it('factors with nothing observed do not apply and are left out of the overall risk', () => {
    const r = computeRiskAssessment({
      ...base,
      needsInterventionCount: 0,
      failedCount: 0,
      avgResolutionDays: 2,
    });
    const f = Object.fromEntries(r.factors.map((x) => [x.id, x]));
    for (const id of ['needsIntervention', 'failedRepairs', 'resolutionTime']) {
      expect(f[id].applies).toBe(false);
      expect(f[id].riskScore).toBe(0);
    }
    // only infrastructure (33·29) and population (50·29) remain
    expect(r.overall.score).toBe(Math.round((33 * 0.29 + 50 * 0.29) / 2));
  });

  it('missing data reads "unknown", never a band computed from the neutral 50', () => {
    const r = computeRiskAssessment({
      ...base,
      hasPopDataGap: true,
      hasInfraDataGap: true,
    });
    const f = Object.fromEntries(r.factors.map((x) => [x.id, x]));
    expect(f.population.level).toBe('unknown');
    expect(f.population.applies).toBe(false);
    expect(f.infrastructure.level).toBe('unknown');
  });

  it('an old open report counts as slow resolution even with no resolved reports', () => {
    const r = computeRiskAssessment({
      ...base,
      avgResolutionDays: null,
      oldestOpenDays: 45,
    });
    const f = Object.fromEntries(r.factors.map((x) => [x.id, x]));
    expect(f.resolutionTime.level).toBe('high');
    expect(f.resolutionTime.impact).toBe(100);
    const none = computeRiskAssessment({
      ...base,
      avgResolutionDays: null,
      oldestOpenDays: null,
    });
    expect(none.factors.find((x) => x.id === 'resolutionTime')!.level).toBe(
      'unknown',
    );
  });

  it('mitigation effectiveness decreases with open issues and is clamped', () => {
    const r = computeRiskAssessment({ ...base, needsInterventionCount: 20 });
    expect(
      r.strategies.find((s) => s.id === 'emergencyResponse')!.effectiveness,
    ).toBe(20);
    const r0 = computeRiskAssessment({ ...base, needsInterventionCount: 0 });
    expect(
      r0.strategies.find((s) => s.id === 'emergencyResponse')!.effectiveness,
    ).toBe(85);
  });

  it('overall level bands', () => {
    const calm = computeRiskAssessment({
      ...base,
      overallScore: 98,
      infrastructureScore: 100,
      populationScore: 100,
      urgencyMonths: 36,
      poorOrCriticalBuildingCount: 0,
      needsInterventionCount: 0,
      failedCount: 0,
      avgResolutionDays: 2,
    });
    expect(calm.overall.level).toBe('low');
  });
});

describe('school metrics helpers', () => {
  it('programme roll-up prefers programme enrolment', () => {
    expect(
      programmeTotals({
        totalStudents: 999,
        educationPrograms: [{ totalStudents: 100, capacity: 150 }],
      }),
    ).toEqual({ students: 100, capacity: 150 });
    expect(
      programmeTotals({ totalStudents: '40', educationPrograms: [] }),
    ).toEqual({
      students: 40,
      capacity: 0,
    });
  });

  it('teachers: gender breakdown first, else totalTeachers', () => {
    expect(
      teacherCount({
        maleTeachers: 3,
        femaleTeachers: null,
        totalTeachers: 50,
      }),
    ).toBe(3);
    expect(teacherCount({ totalTeachers: 12 })).toBe(12);
  });

  it('ratios and capacity are null without a denominator', () => {
    expect(studentTeacherRatio(100, 0)).toBeNull();
    expect(studentTeacherRatio(380, 16)).toBe(23.8);
    expect(capacityUtilisationPct(10, 0)).toBeNull();
    expect(capacityUtilisationPct(1, 3)).toBe(33.3);
  });

  it('land summary in hectares', () => {
    expect(landSummary({})).toEqual({
      usedHa: null,
      unusedHa: null,
      totalHa: null,
      usedPct: null,
    });
    expect(
      landSummary({ usedLandArea: '2.50', unusedLandArea: '1.50' }),
    ).toEqual({
      usedHa: 2.5,
      unusedHa: 1.5,
      totalHa: 4,
      usedPct: 62.5,
    });
  });

  it('data gaps: a measured 0 road status is not a gap', () => {
    expect(accessibilityScore(0)).toEqual({ score: 0, gap: false });
  });

  it('capacity inputs need programme capacity AND programme enrolment', () => {
    expect(
      capacityInputs({
        educationPrograms: [{ totalStudents: 50, capacity: 100 }],
      }),
    ).toEqual({ students: 50, capacity: 100 });
    // no programme students → not rated (was mixed with schools.totalStudents)
    expect(
      capacityInputs({
        totalStudents: 500,
        educationPrograms: [{ totalStudents: 0, capacity: 400 }],
      }),
    ).toBeNull();
  });

  it('building ages drop future and non-numeric years', () => {
    expect(
      buildingAges(
        [{ yearBuilt: 2000 }, { yearBuilt: 2999 }, { yearBuilt: 'x' }],
        2026,
      ),
    ).toEqual([26]);
  });
});
