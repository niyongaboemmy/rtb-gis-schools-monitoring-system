/**
 * population-summary.ts
 *
 * Server-side roll-up for the Population Analytics page (WS1.4 pattern: the
 * client renders, it does not aggregate). Metric ids `population.*` in
 * docs/METRIC_DICTIONARY.md.
 */

export interface PopulationRow {
  population2km?: number | string | null;
  populationDensityPerKm2?: number | string | null;
  studentToSchoolRatio?: number | string | null;
  school?: { province?: string | null } | null;
}

export interface PopulationSummary {
  /** Active, in-scope schools. */
  totalSchools: number;
  /** Of those, schools with a population record that has 2 km population or density. */
  schoolsWithData: number;
  /** Σ population within 2 km (catchments may overlap, so this double-counts shared areas). */
  totalPopulation2km: number;
  /** Mean people per km² over schools with a density value; null when none. */
  avgDensityPerKm2: number | null;
  /** Mean (students ÷ residents within 2 km) over schools with a ratio; null when none. */
  avgStudentsPerResident: number | null;
  provinces: Array<{
    province: string;
    schools: number;
    totalPopulation2km: number;
    avgDensityPerKm2: number | null;
  }>;
}

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v as string));
  return Number.isFinite(n) ? n : null;
};
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const round = (v: number | null, dp: number): number | null =>
  v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp;

export function summarisePopulation(
  rows: PopulationRow[],
  totalSchools: number,
): PopulationSummary {
  const withData = rows.filter(
    (r) =>
      numOrNull(r.population2km) !== null ||
      numOrNull(r.populationDensityPerKm2) !== null,
  );
  const densities = (list: PopulationRow[]) =>
    list
      .map((r) => numOrNull(r.populationDensityPerKm2))
      .filter((v): v is number => v !== null);
  const pop = (list: PopulationRow[]) =>
    list.reduce((s, r) => s + (numOrNull(r.population2km) ?? 0), 0);

  const groups = new Map<string, PopulationRow[]>();
  for (const r of withData) {
    const p = r.school?.province || 'Unknown';
    groups.set(p, [...(groups.get(p) ?? []), r]);
  }

  return {
    totalSchools,
    schoolsWithData: withData.length,
    totalPopulation2km: Math.round(pop(withData)),
    avgDensityPerKm2: round(mean(densities(withData)), 0),
    avgStudentsPerResident: round(
      mean(
        withData
          .map((r) => numOrNull(r.studentToSchoolRatio))
          .filter((v): v is number => v !== null),
      ),
      3,
    ),
    provinces: [...groups.entries()]
      .map(([province, list]) => ({
        province,
        schools: list.length,
        totalPopulation2km: Math.round(pop(list)),
        avgDensityPerKm2: round(mean(densities(list)), 0),
      }))
      .sort((a, b) => b.schools - a.schools),
  };
}
