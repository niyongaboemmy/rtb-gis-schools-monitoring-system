import type { ComponentDataGaps, PriorityKey, SchoolMetrics, ScoringModel } from "../dashboard/types";
import { COMPONENT_ORDER, type ComponentKey } from "../../lib/scoring";
import { formatCurrency, formatNumber } from "../../lib/format";

/** One row of GET /analytics/decisions (numbers may arrive as decimal strings). */
export interface DecisionRow {
  id: string;
  schoolId?: string;
  priorityLevel?: PriorityKey | string;
  overallScore?: number | string;
  infrastructureScore?: number | string;
  buildingAgeScore?: number | string;
  facilityComplianceScore?: number | string;
  populationPressureScore?: number | string;
  accessibilityScore?: number | string;
  resolutionRateScore?: number | string;
  urgencyMonths?: number | null;
  estimatedBudgetRwf?: number | string | null;
  hasInfraDataGap?: boolean;
  hasPopDataGap?: boolean;
  dataGaps?: ComponentDataGaps;
  dataCoverage?: number | string | null;
  recommendations?: string[];
  createdAt?: string;
  updatedAt?: string;
  school?: { id?: string; name?: string; code?: string; district?: string; province?: string };
}

export const FIELD: Record<ComponentKey, keyof DecisionRow> = {
  infrastructure: "infrastructureScore",
  buildingAge: "buildingAgeScore",
  facilityCompliance: "facilityComplianceScore",
  accessibility: "accessibilityScore",
  population: "populationPressureScore",
  resolution: "resolutionRateScore",
};

export const FACTOR_NAME: Record<ComponentKey, string> = {
  infrastructure: "Building condition",
  buildingAge: "Building age",
  facilityCompliance: "Facilities checklist",
  accessibility: "Road access",
  population: "Nearby population",
  resolution: "Problems fixed",
};

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const gapsOf = (d: DecisionRow): ComponentDataGaps | undefined =>
  d.dataGaps ??
  (d.hasInfraDataGap != null || d.hasPopDataGap != null
    ? ({ infrastructure: !!d.hasInfraDataGap, population: !!d.hasPopDataGap } as ComponentDataGaps)
    : undefined);

/** The lowest measured factor (estimated ones are excluded — they're a neutral 50). */
export function weakestFactor(d: DecisionRow): { key: ComponentKey; score: number } | null {
  const gaps = gapsOf(d);
  let best: { key: ComponentKey; score: number } | null = null;
  for (const k of COMPONENT_ORDER) {
    const s = num(d[FIELD[k]]);
    if (s == null || gaps?.[k]) continue;
    if (!best || s < best.score) best = { key: k, score: s };
  }
  return best;
}

export const urgencyText = (months: unknown): string => {
  const m = num(months);
  if (m == null) return "Not scheduled";
  if (m <= 0) return "Act now";
  return `Within ${formatNumber(m)} mo`;
};

export const rwf = (v: unknown): string => {
  const n = num(v);
  return n == null || n <= 0 ? "—" : formatCurrency(n, { compact: true });
};

/** Shapes a decision row as SchoolMetrics so the shared score breakdown can render it. */
export const asMetrics = (d: DecisionRow, model: ScoringModel | null | undefined): SchoolMetrics =>
  ({
    ...d,
    overallScore: num(d.overallScore),
    infrastructureScore: num(d.infrastructureScore),
    buildingAgeScore: num(d.buildingAgeScore),
    facilityComplianceScore: num(d.facilityComplianceScore),
    populationPressureScore: num(d.populationPressureScore),
    accessibilityScore: num(d.accessibilityScore),
    resolutionRateScore: num(d.resolutionRateScore),
    dataCoverage: num(d.dataCoverage),
    dataGaps: gapsOf(d),
    scoringModel: model ?? undefined,
  }) as unknown as SchoolMetrics;
