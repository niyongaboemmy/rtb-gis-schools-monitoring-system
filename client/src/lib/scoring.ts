/**
 * The School Condition Score model as the client sees it: weights and
 * Intervention Priority bands come from the API (`scoringModel` on
 * /analytics/overview and /analytics/schools/:id/metrics). This file is the
 * ONLY client copy of the fallback, used when a payload predates the field.
 * Server source of truth: server/src/modules/analytics/scoring.constants.ts.
 */
import type { PriorityKey, ScoringModel } from "../components/dashboard/types";

export type ComponentKey = keyof ScoringModel["weights"];

/** Fallback only — mirrors scoring.constants.ts (SCORING_MODEL). */
export const FALLBACK_SCORING_MODEL: ScoringModel = {
  version: 0,
  weights: {
    infrastructure: 0.35,
    buildingAge: 0.25,
    accessibility: 0.1,
    population: 0.1,
    facilityCompliance: 0.15,
    resolution: 0.05,
  },
  bands: {
    critical: { min: 0, max: 34 },
    high: { min: 35, max: 54 },
    medium: { min: 55, max: 74 },
    low: { min: 75, max: 100 },
  },
  neutral: 50,
};

export const modelOf = (m?: ScoringModel | null): ScoringModel =>
  m ?? FALLBACK_SCORING_MODEL;

/** Intervention Priority band of a 0–100 score, using the served bands. */
export function bandOf(score: number, model?: ScoringModel | null): PriorityKey {
  const b = modelOf(model).bands;
  if (score < b.high.min) return "critical";
  if (score < b.medium.min) return "high";
  if (score < b.low.min) return "medium";
  return "low";
}

/** The bands in display order with their inclusive ranges. */
export function bandRanges(model?: ScoringModel | null) {
  const b = modelOf(model).bands;
  return (["critical", "high", "medium", "low"] as const).map((key) => ({
    key,
    range: `${b[key].min}–${b[key].max}`,
  }));
}

/** Six components in weight order (heaviest first). */
export const COMPONENT_ORDER: ComponentKey[] = [
  "infrastructure",
  "buildingAge",
  "facilityCompliance",
  "accessibility",
  "population",
  "resolution",
];

export const weightOf = (key: ComponentKey, model?: ScoringModel | null) =>
  modelOf(model).weights[key];

/** "35%" */
export const weightLabel = (key: ComponentKey, model?: ScoringModel | null) =>
  `${Math.round(weightOf(key, model) * 100)}%`;

/** One colour per Intervention Priority band — shared by every score visual. */
export const BAND_HEX: Record<PriorityKey, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};
