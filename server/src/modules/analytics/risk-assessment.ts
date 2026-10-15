/**
 * risk-assessment.ts
 *
 * INDICATIVE risk heuristics for the school dashboard's "Risk Assessment &
 * Mitigation" panel (WS1.5). These were previously magic numbers computed in
 * the browser (client/src/components/dashboard/RiskAssessment.tsx). They now
 * live here as one pure, unit-tested function; the client only renders.
 *
 * These are rules of thumb, NOT measured values and NOT part of the School
 * Condition Score. The UI labels the panel "Indicative" and shows each
 * `rule` string in a tooltip. Every rule is listed in docs/METRIC_DICTIONARY.md
 * (ids `risk.*`).
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskInputs {
  /** School Condition Score, 0–100. */
  overallScore: number;
  infrastructureScore: number;
  /** Population (capacity-headroom) component, 0–100. */
  populationScore: number;
  /** Months to intervention from the score band; null → 36. */
  urgencyMonths: number | null;
  buildingCount: number;
  /** Buildings whose condition is poor or critical. */
  poorOrCriticalBuildingCount: number;
  /** null → treated as 50 years (pessimistic). */
  avgBuildingAge: number | null;
  hasPopDataGap: boolean;
  /** true → infrastructure component is the neutral 50 (no assessed buildings). */
  hasInfraDataGap?: boolean;
  /** null → never surveyed. */
  daysSinceLastSurvey: number | null;
  /** Issue Reports currently "Needs Intervention". */
  needsInterventionCount: number;
  /** Issue Reports whose repair failed. */
  failedCount: number;
  /** Mean days from report to resolution; null → no resolved reports. */
  avgResolutionDays: number | null;
}

export interface RiskFactor {
  id: string;
  title: string;
  level: RiskLevel;
  /** 0–100 consequence severity. */
  impact: number;
  /** 0–100 likelihood. */
  probability: number;
  /** round(impact × probability ÷ 100). */
  riskScore: number;
  mitigation: string;
  timeline: string;
  owner: string;
  /** Plain-language rule shown in the UI tooltip. */
  rule: string;
}

export interface MitigationStrategy {
  id: string;
  title: string;
  priority: 'immediate' | 'short-term' | 'long-term';
  cost: 'low' | 'medium' | 'high';
  /** Indicative effectiveness 0–100. */
  effectiveness: number;
  description: string;
  rule: string;
}

export interface RiskAssessmentResult {
  indicative: true;
  /** Base consequence severity (0–100). */
  impactScore: number;
  /** Base likelihood (0–100). */
  probabilityScore: number;
  overall: { score: number; level: RiskLevel; rule: string };
  factors: RiskFactor[];
  strategies: MitigationStrategy[];
  rules: { impact: string; probability: string };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export const RISK_RULES = {
  impact:
    'Impact = 50% × (100 − School Condition Score) + 30% × share of poor/critical buildings × 100 + 20% × urgency (100 if intervention due now, else max(0, 100 − 2 × months)). Capped at 100.',
  probability:
    'Probability = 50% × min(100, 1.5 × average building age in years; 50 years assumed if unknown) + 25% × (60 if population data is missing, else 20) + 25% × survey staleness (80 if last survey > 365 days ago or never, 50 if > 180 days, else 20). Capped at 100.',
  overall:
    'Overall risk = mean of the factor risk scores (impact × probability ÷ 100). Critical > 70, High > 50, Medium > 30, otherwise Low.',
} as const;

/** Base impact (consequence severity) — 0–100. */
export function riskImpactScore(i: RiskInputs): number {
  const urgency = i.urgencyMonths ?? 36;
  return Math.min(
    100,
    Math.round(
      (100 - i.overallScore) * 0.5 +
        (i.poorOrCriticalBuildingCount / Math.max(1, i.buildingCount)) *
          100 *
          0.3 +
        (urgency === 0 ? 100 : Math.max(0, 100 - urgency * 2)) * 0.2,
    ),
  );
}

/** Base probability (likelihood) — 0–100. */
export function riskProbabilityScore(i: RiskInputs): number {
  const age = i.avgBuildingAge ?? 50;
  const days = i.daysSinceLastSurvey ?? Infinity;
  const staleness = days > 365 ? 80 : days > 180 ? 50 : 20;
  return Math.min(
    100,
    Math.round(
      Math.min(100, age * 1.5) * 0.5 +
        (i.hasPopDataGap ? 60 : 20) * 0.25 +
        staleness * 0.25,
    ),
  );
}

/** Score-deficit band shared by the component-driven factors. */
function bandFromComponent(score: number): RiskLevel {
  if (score < 35) return 'critical';
  if (score < 55) return 'high';
  if (score < 75) return 'medium';
  return 'low';
}

export function computeRiskAssessment(i: RiskInputs): RiskAssessmentResult {
  const impact = riskImpactScore(i);
  const probability = riskProbabilityScore(i);
  const ni = Math.max(0, i.needsInterventionCount);
  const failed = Math.max(0, i.failedCount);
  const avgDays = i.avgResolutionDays ?? 0;

  const factor = (
    f: Omit<RiskFactor, 'riskScore' | 'probability'>,
  ): RiskFactor => ({
    ...f,
    impact: clamp(Math.round(f.impact)),
    probability,
    riskScore: Math.round((clamp(Math.round(f.impact)) * probability) / 100),
  });

  const factors: RiskFactor[] = [
    factor({
      id: 'needsIntervention',
      title: 'Issues needing intervention',
      level: ni > 5 ? 'critical' : ni > 2 ? 'high' : ni > 0 ? 'medium' : 'low',
      impact: impact + Math.min(20, ni * 4),
      mitigation:
        'Prioritise the open "Needs Intervention" reports through emergency response.',
      timeline: '1–7 days',
      owner: 'School leadership with district engineer',
      rule: 'Level: Critical > 5 open "Needs Intervention" reports, High > 2, Medium ≥ 1. Impact = base impact + min(20, 4 × count).',
    }),
    factor({
      id: 'failedRepairs',
      title: 'Failed repairs',
      level: failed > 5 ? 'high' : failed > 0 ? 'medium' : 'low',
      impact: impact + Math.min(15, failed * 3),
      mitigation:
        'Re-inspect failed repairs and assign a new contractor or approach.',
      timeline: '1–4 weeks',
      owner: 'Maintenance team',
      rule: 'Level: High > 5 Issue Reports marked "Failed", Medium ≥ 1. Impact = base impact + min(15, 3 × count).',
    }),
    factor({
      id: 'infrastructure',
      title: 'Infrastructure deterioration',
      level: bandFromComponent(i.infrastructureScore),
      impact: 100 - i.infrastructureScore,
      mitigation:
        'Schedule preventive maintenance and fix poor/critical buildings first.',
      timeline: '3–6 months',
      owner: 'Facilities management',
      rule:
        'Level from the infrastructure component: Critical < 35, High < 55, Medium < 75, else Low. Impact = 100 − infrastructure component.' +
        (i.hasInfraDataGap
          ? ' No assessed buildings, so this uses the neutral 50.'
          : ''),
    }),
    factor({
      id: 'population',
      title: 'Demographic pressure on capacity',
      level: bandFromComponent(i.populationScore),
      impact: 100 - i.populationScore,
      mitigation: 'Expand facilities or use space better through timetabling.',
      timeline: '6–12 months',
      owner: 'School administration',
      rule:
        'Level from the population component: Critical < 35, High < 55, Medium < 75, else Low. Impact = 100 − population component.' +
        (i.hasPopDataGap
          ? ' Population data is missing, so this uses the neutral 50.'
          : ''),
    }),
    factor({
      id: 'resolutionTime',
      title: 'Slow resolution times',
      level: avgDays > 10 ? 'high' : avgDays > 5 ? 'medium' : 'low',
      impact: avgDays > 5 ? Math.min(100, Math.round((avgDays / 10) * 100)) : 0,
      mitigation:
        'Streamline the issue workflow and add resources to clear the backlog.',
      timeline: '2–8 weeks',
      owner: 'Operations manager',
      rule: 'Level: High if average resolution > 10 days, Medium > 5 days. Impact = 0 up to 5 days, else min(100, days ÷ 10 × 100).',
    }),
  ];

  const mean =
    factors.reduce((s, f) => s + (f.impact * f.probability) / 100, 0) /
    factors.length;
  const overallLevel: RiskLevel =
    mean > 70 ? 'critical' : mean > 50 ? 'high' : mean > 30 ? 'medium' : 'low';

  const strategies: MitigationStrategy[] = [
    {
      id: 'emergencyResponse',
      title: 'Emergency response to urgent issues',
      priority: ni > 0 ? 'immediate' : 'short-term',
      cost: 'high',
      effectiveness: clamp(90 - ni * 8, 20, 85),
      description: `Address ${ni} issue${ni === 1 ? '' : 's'} needing intervention through emergency protocols.`,
      rule: 'Effectiveness = 90 − 8 × open "Needs Intervention" reports, kept between 20 and 85 (more open issues stretch resources).',
    },
    {
      id: 'repairFollowUp',
      title: 'Repair follow-up',
      priority: failed > 0 ? 'immediate' : 'short-term',
      cost: 'medium',
      effectiveness: clamp(85 - failed * 3, 20, 80),
      description: `Re-inspect ${failed} failed repair${failed === 1 ? '' : 's'} before they escalate.`,
      rule: 'Effectiveness = 85 − 3 × failed reports, kept between 20 and 80.',
    },
    {
      id: 'workflow',
      title: 'Resolution workflow improvement',
      priority: avgDays > 7 ? 'immediate' : 'short-term',
      cost: avgDays > 10 ? 'high' : 'medium',
      effectiveness: avgDays > 5 ? 75 : 85,
      description:
        i.avgResolutionDays === null
          ? 'No resolved reports yet to measure resolution time.'
          : `Reduce the current ${i.avgResolutionDays.toFixed(1)}-day average resolution time.`,
      rule: 'Effectiveness = 85, or 75 when average resolution already exceeds 5 days.',
    },
    {
      id: 'preventiveMaintenance',
      title: 'Preventive maintenance programme',
      priority: i.infrastructureScore < 50 ? 'immediate' : 'long-term',
      cost: 'low',
      effectiveness: i.infrastructureScore < 50 ? 85 : 70,
      description:
        'Run a regular maintenance schedule to prevent infrastructure deterioration.',
      rule: 'Effectiveness = 85 when the infrastructure component is below 50, else 70.',
    },
  ];

  return {
    indicative: true,
    impactScore: impact,
    probabilityScore: probability,
    overall: {
      score: Math.round(mean),
      level: overallLevel,
      rule: RISK_RULES.overall,
    },
    factors,
    strategies,
    rules: { impact: RISK_RULES.impact, probability: RISK_RULES.probability },
  };
}
