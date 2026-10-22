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

/** 'unknown' = the factor's input is missing; it is excluded from the overall risk. */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

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
  /** Age in days of the oldest open Issue Report; null → none open. */
  oldestOpenDays?: number | null;
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
  /** False when the factor does not apply (nothing observed / no data); excluded from the overall risk. */
  applies: boolean;
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
    'Overall risk = mean of the risk scores (impact × probability ÷ 100) of the factors that apply — observed issues and measured components; factors with nothing observed or no data are left out. Critical > 70, High > 50, Medium > 30, otherwise Low.',
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
  // Slow resolution is judged on the worse of the closed-report average and
  // the age of the oldest still-open report: an issue ignored for 90 days is
  // the slowest resolution of all, even though it never enters the average.
  const effectiveDays = Math.max(avgDays, i.oldestOpenDays ?? 0);
  const hasResolutionData =
    i.avgResolutionDays !== null || (i.oldestOpenDays ?? null) !== null;

  const factor = (
    f: Omit<RiskFactor, 'riskScore' | 'probability' | 'applies'> & {
      probability?: number;
      applies?: boolean;
    },
  ): RiskFactor => {
    const applies = f.applies ?? true;
    const imp = applies ? clamp(Math.round(f.impact)) : 0;
    const prob = applies ? clamp(Math.round(f.probability ?? probability)) : 0;
    return {
      ...f,
      impact: imp,
      probability: prob,
      riskScore: Math.round((imp * prob) / 100),
      applies,
    };
  };

  const factors: RiskFactor[] = [
    factor({
      id: 'needsIntervention',
      title: 'Issues needing intervention',
      level: ni > 5 ? 'critical' : ni > 2 ? 'high' : ni > 0 ? 'medium' : 'low',
      applies: ni > 0,
      // Observed, not predicted: an open "Needs Intervention" report is certain.
      probability: 100,
      impact: impact + Math.min(20, ni * 4),
      mitigation:
        'Prioritise the open "Needs Intervention" reports through emergency response.',
      timeline: '1–7 days',
      owner: 'School leadership with district engineer',
      rule: 'Applies only when reports are open. Level: Critical > 5 open "Needs Intervention" reports, High > 2, Medium ≥ 1. Impact = base impact + min(20, 4 × count); probability 100 (observed).',
    }),
    factor({
      id: 'failedRepairs',
      title: 'Failed repairs',
      level: failed > 5 ? 'high' : failed > 0 ? 'medium' : 'low',
      applies: failed > 0,
      probability: 100,
      impact: impact + Math.min(15, failed * 3),
      mitigation:
        'Re-inspect failed repairs and assign a new contractor or approach.',
      timeline: '1–4 weeks',
      owner: 'Maintenance team',
      rule: 'Applies only when repairs failed. Level: High > 5 Issue Reports marked "Failed", Medium ≥ 1. Impact = base impact + min(15, 3 × count); probability 100 (observed).',
    }),
    factor({
      id: 'infrastructure',
      title: 'Infrastructure deterioration',
      level: i.hasInfraDataGap
        ? 'unknown'
        : bandFromComponent(i.infrastructureScore),
      applies: !i.hasInfraDataGap,
      impact: 100 - i.infrastructureScore,
      mitigation: i.hasInfraDataGap
        ? 'Survey the buildings: no assessed condition records are on file.'
        : 'Schedule preventive maintenance and fix poor/critical buildings first.',
      timeline: '3–6 months',
      owner: 'Facilities management',
      rule:
        'Level from the infrastructure component: Critical < 35, High < 55, Medium < 75, else Low. Impact = 100 − infrastructure component.' +
        (i.hasInfraDataGap
          ? ' No assessed buildings, so the level is unknown and the factor is left out of the overall risk.'
          : ''),
    }),
    factor({
      id: 'population',
      title: 'Demographic pressure on capacity',
      level: i.hasPopDataGap ? 'unknown' : bandFromComponent(i.populationScore),
      applies: !i.hasPopDataGap,
      impact: 100 - i.populationScore,
      mitigation: i.hasPopDataGap
        ? 'Run a population sync: catchment data is missing.'
        : 'Expand facilities or use space better through timetabling.',
      timeline: '6–12 months',
      owner: 'School administration',
      rule:
        'Level from the population component: Critical < 35, High < 55, Medium < 75, else Low. Impact = 100 − population component.' +
        (i.hasPopDataGap
          ? ' Population data is missing, so the level is unknown and the factor is left out of the overall risk.'
          : ''),
    }),
    factor({
      id: 'resolutionTime',
      title: 'Slow resolution times',
      level: !hasResolutionData
        ? 'unknown'
        : effectiveDays > 10
          ? 'high'
          : effectiveDays > 5
            ? 'medium'
            : 'low',
      applies: hasResolutionData && effectiveDays > 5,
      probability: 100,
      impact:
        effectiveDays > 5
          ? Math.min(100, Math.round((effectiveDays / 10) * 100))
          : 0,
      mitigation:
        'Streamline the issue workflow and add resources to clear the backlog.',
      timeline: '2–8 weeks',
      owner: 'Operations manager',
      rule: 'Days = the larger of the average resolution time and the age of the oldest open report. Level: High > 10 days, Medium > 5 days. Impact = min(100, days ÷ 10 × 100) above 5 days; probability 100 (observed).',
    }),
  ];

  const applying = factors.filter((f) => f.applies);
  const mean =
    applying.length > 0
      ? applying.reduce((s, f) => s + (f.impact * f.probability) / 100, 0) /
        applying.length
      : 0;
  const overallLevel: RiskLevel =
    mean > 70 ? 'critical' : mean > 50 ? 'high' : mean > 30 ? 'medium' : 'low';

  const strategies: MitigationStrategy[] = [
    {
      id: 'emergencyResponse',
      title: 'Emergency response to urgent issues',
      priority: ni > 0 ? 'immediate' : 'short-term',
      cost: 'high',
      effectiveness: clamp(90 - ni * 8, 20, 85),
      description:
        ni > 0
          ? `Address ${ni} issue${ni === 1 ? '' : 's'} needing intervention through emergency protocols.`
          : 'No issues need intervention now — keep an emergency protocol ready.',
      rule: 'Effectiveness = 90 − 8 × open "Needs Intervention" reports, kept between 20 and 85 (more open issues stretch resources).',
    },
    {
      id: 'repairFollowUp',
      title: 'Repair follow-up',
      priority: failed > 0 ? 'immediate' : 'short-term',
      cost: 'medium',
      effectiveness: clamp(85 - failed * 3, 20, 80),
      description:
        failed > 0
          ? `Re-inspect ${failed} failed repair${failed === 1 ? '' : 's'} before they escalate.`
          : 'No failed repairs on record — keep checking completed work.',
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
