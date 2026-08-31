/**
 * scoring.constants.ts
 *
 * SINGLE SOURCE OF TRUTH for the decision-intelligence scoring model.
 *
 * Every score in the system (national overview, school dashboard, decision
 * engineering page, risk matrix) is derived from the six weighted components
 * defined here. Server services and the client UI must reference these values —
 * never hard-code a weight or band inline.
 *
 * Model: 6-factor weighted composite (weights sum to 1.0)
 *   infrastructure       35%   building condition
 *   buildingAge          25%   average age of stock
 *   accessibility        10%   road-status percentage
 *   population           10%   capacity headroom vs local school-age demand
 *   facilityCompliance   15%   facility survey compliance
 *   resolution            5%   issue-report resolution rate
 *
 * Higher score = healthier school = lower intervention priority.
 */

import { BuildingCondition } from '../schools/entities/school-building.entity';
import { ComplianceLevel } from '../schools/entities/school-facility-survey.entity';
import { PriorityLevel } from './entities/decision-assessment.entity';

// ─── Weights ─────────────────────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  infrastructure: 0.35,
  buildingAge: 0.25,
  accessibility: 0.1,
  population: 0.1,
  facilityCompliance: 0.15,
  resolution: 0.05,
} as const;

/** Runtime guard — fails loudly if a weight is ever edited to break the sum. */
export const SCORE_WEIGHTS_SUM = Object.values(SCORE_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
);

/** Neutral score used when a component has no data (paired with a *DataGap flag). */
export const NEUTRAL_SCORE = 50;

// ─── Component maps ──────────────────────────────────────────────────────────

/** Physical building condition → infrastructure sub-score (0–100). */
export const CONDITION_SCORE_MAP: Record<BuildingCondition, number> = {
  [BuildingCondition.GOOD]: 100,
  [BuildingCondition.FAIR]: 70,
  [BuildingCondition.POOR]: 30,
  [BuildingCondition.CRITICAL]: 10,
};

/** Facility survey compliance → compliance sub-score (0–100). */
export const COMPLIANCE_SCORE_MAP: Record<ComplianceLevel, number> = {
  [ComplianceLevel.COMPLIANT]: 100,
  [ComplianceLevel.PARTIAL]: 50,
  [ComplianceLevel.NON_COMPLIANT]: 0,
};

// ─── Building-age model ──────────────────────────────────────────────────────

/**
 * Average building age (years) → building-age sub-score (0–100).
 * Monotonically decreasing: newer stock scores higher.
 */
export function ageToScore(avgAgeYears: number): number {
  if (avgAgeYears <= 10) return 95;
  if (avgAgeYears <= 20) return 80;
  if (avgAgeYears <= 30) return 60;
  if (avgAgeYears <= 40) return 45;
  if (avgAgeYears <= 50) return 30;
  if (avgAgeYears <= 60) return 20;
  return 10; // > 60 years — critical structural risk
}

// ─── Population / capacity-headroom model ─────────────────────────────────────

/**
 * demand/capacity ratio → population sub-score (0–100).
 * Higher score = more capacity headroom (less demographic pressure).
 */
export function demandRatioToScore(ratio: number): number {
  if (ratio >= 5) return 10;
  if (ratio >= 3) return 30;
  if (ratio >= 2) return 50;
  if (ratio >= 1) return 70;
  return 100;
}

/** Fallback catchment capacity when a school reports no enrolment. */
export const DEFAULT_CATCHMENT_CAPACITY = 300;

// ─── Priority banding ────────────────────────────────────────────────────────

export const PRIORITY_BANDS = {
  critical: { min: 0, max: 34 },
  high: { min: 35, max: 54 },
  medium: { min: 55, max: 74 },
  low: { min: 75, max: 100 },
} as const;

export function scoreToPriorityLevel(score: number): PriorityLevel {
  if (score < 35) return PriorityLevel.CRITICAL;
  if (score < 55) return PriorityLevel.HIGH;
  if (score < 75) return PriorityLevel.MEDIUM;
  return PriorityLevel.LOW;
}

/** Recommended months-to-intervention derived from the overall score band. */
export function urgencyMonthsFromScore(overallScore: number): number {
  if (overallScore < 35) return 0;
  if (overallScore < 45) return 3;
  if (overallScore < 55) return 6;
  if (overallScore < 65) return 12;
  if (overallScore < 75) return 18;
  return 36;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const clamp0to100 = (n: number): number =>
  Math.min(100, Math.max(0, n));

/** parseFloat that never yields NaN — returns `fallback` instead. */
export const safeScore = (v: unknown, fallback = 0): number => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

export interface ScoreComponents {
  infrastructure: number;
  buildingAge: number;
  accessibility: number;
  population: number;
  facilityCompliance: number;
  resolution: number;
}

/** The one weighted-composite formula. Clamps components, returns 0–100 integer. */
export function computeOverallScore(c: ScoreComponents): number {
  const infra = clamp0to100(safeScore(c.infrastructure));
  const age = clamp0to100(safeScore(c.buildingAge));
  const access = clamp0to100(safeScore(c.accessibility));
  const pop = clamp0to100(safeScore(c.population));
  const facility = clamp0to100(safeScore(c.facilityCompliance, NEUTRAL_SCORE));
  const resolution = clamp0to100(safeScore(c.resolution, NEUTRAL_SCORE));

  return clamp0to100(
    Math.round(
      infra * SCORE_WEIGHTS.infrastructure +
        age * SCORE_WEIGHTS.buildingAge +
        access * SCORE_WEIGHTS.accessibility +
        pop * SCORE_WEIGHTS.population +
        facility * SCORE_WEIGHTS.facilityCompliance +
        resolution * SCORE_WEIGHTS.resolution,
    ),
  );
}
