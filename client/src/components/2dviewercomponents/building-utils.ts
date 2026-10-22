import { CONDITIONS, NO_DATA } from "../school-dashboard/status-colors";
import type { BuildingData } from "../school-form-steps/BuildingsStep";

/** Buildings arrive with both the form's and the API's field names. */
export type AnyBuilding = BuildingData & {
  name?: string;
  code?: string;
  function?: string;
  area?: number | string;
  areaSquareMeters?: number | string;
  floors?: number | string;
  yearBuilt?: number | string;
  condition?: string;
  roofCondition?: string;
  notes?: string;
};

export const buildingName = (b: AnyBuilding | null | undefined): string =>
  b?.buildingName || b?.name || b?.buildingCode || b?.code || "Unnamed building";

export const buildingCode = (b: AnyBuilding): string | null => b.buildingCode || b.code || null;

export const buildingFunction = (b: AnyBuilding): string | null => b.buildingFunction || b.function || null;

export const buildingArea = (b: AnyBuilding): number | null => {
  const v = Number(b.buildingArea || b.area || b.areaSquareMeters);
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const buildingFloors = (b: AnyBuilding): number | null => {
  const v = Number(b.buildingFloors || b.floors);
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const buildingYear = (b: AnyBuilding): number | null => {
  const v = Number(b.buildingYearBuilt || b.yearBuilt);
  return Number.isFinite(v) && v > 1800 ? v : null;
};

/** 4 = good … 1 = critical. Roof "needs repair" counts as poor. */
const RANK: Record<string, number> = { good: 4, fair: 3, needs_repair: 2, poor: 2, critical: 1 };

export interface ConditionView {
  key: string;
  label: string;
  color: string;
  /** 0–100 for the ring, null when nothing was checked. */
  pct: number | null;
}

const fromRank = (r: number | null): ConditionView => {
  if (r == null) {
    const none = CONDITIONS.find((c) => c.key === "none")!;
    return { key: "none", label: none.label, color: NO_DATA, pct: null };
  }
  const key = r >= 3.5 ? "good" : r >= 2.5 ? "fair" : r >= 1.5 ? "poor" : "critical";
  const c = CONDITIONS.find((x) => x.key === key)!;
  return { key, label: c.label, color: c.color, pct: Math.round((r / 4) * 100) };
};

const rankOf = (v: unknown): number | null => {
  const k = typeof v === "string" ? v.trim().toLowerCase() : "";
  return RANK[k] ?? null;
};

/** Structure, roof and the overall condition (the average of what was checked). */
export function buildingCondition(b: AnyBuilding) {
  const structure = rankOf(b.buildingCondition || b.condition);
  const roof = rankOf(b.buildingRoofCondition || b.roofCondition);
  const known = [structure, roof].filter((v): v is number => v != null);
  return {
    overall: fromRank(known.length ? known.reduce((a, v) => a + v, 0) / known.length : null),
    structure: fromRank(structure),
    roof: fromRank(roof),
  };
}

/** Short initials for a building badge ("Block A" → "BA"). */
export const buildingInitials = (b: AnyBuilding): string => {
  const n = buildingName(b);
  const words = n.split(/[\s_-]+/).filter(Boolean);
  const s = words.length > 1 ? words[0][0] + words[1][0] : n.slice(0, 2);
  return s.toUpperCase();
};
