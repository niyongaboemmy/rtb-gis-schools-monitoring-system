/**
 * Shared display formatters (WS2.3). Every number, unit and date shown in the
 * UI goes through here so units and precision stay consistent.
 *
 * Precision is deliberately honest (WS6.5): 2D map measurements to 0.1 m, 3D
 * model measurements to 0.01 m. Neither imagery nor photogrammetry supports
 * millimetres.
 */

export const KIGALI_TZ = "Africa/Kigali";
const LOCALE = "en-RW";

/** Where a measurement came from; sets how many decimals it can honestly show. */
export type MeasureSource = "2d" | "3d";
const LENGTH_DECIMALS: Record<MeasureSource, number> = { "2d": 1, "3d": 2 };

export const SQM_PER_HECTARE = 10_000;
/** Areas at or above this are also shown in hectares. */
export const HECTARE_THRESHOLD_SQM = 10_000;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const EMPTY = "—";

export function formatNumber(value: number | null | undefined, maxDecimals = 0): string {
  if (!isNum(value)) return EMPTY;
  return new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  }).format(value);
}

function fixed(value: number, decimals: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Length in metres → "12.3 m", or "1.25 km" from 1 km up. */
export function formatLength(meters: number | null | undefined, source: MeasureSource = "2d"): string {
  if (!isNum(meters)) return EMPTY;
  if (Math.abs(meters) >= 1000) return `${fixed(meters / 1000, 2)} km`;
  return `${fixed(meters, LENGTH_DECIMALS[source])} m`;
}

/** Area in m² → "450.5 m²", or "1.25 ha (12,500 m²)" from 1 ha up. */
export function formatArea(sqMeters: number | null | undefined, source: MeasureSource = "2d"): string {
  if (!isNum(sqMeters)) return EMPTY;
  const sqm = `${fixed(sqMeters, LENGTH_DECIMALS[source])} m²`;
  if (Math.abs(sqMeters) < HECTARE_THRESHOLD_SQM) return sqm;
  return `${formatHectares(sqMeters / SQM_PER_HECTARE)} (${formatNumber(sqMeters)} m²)`;
}

/** Land area already in hectares → "2.50 ha". Never "h". */
export function formatHectares(hectares: number | null | undefined): string {
  if (!isNum(hectares)) return EMPTY;
  return `${fixed(hectares, 2)} ha`;
}

/**
 * Percentage. Pass a 0–100 value by default, or a 0–1 ratio with
 * `{ ratio: true }`.
 */
export function formatPercent(
  value: number | null | undefined,
  { decimals = 0, ratio = false }: { decimals?: number; ratio?: boolean } = {},
): string {
  if (!isNum(value)) return EMPTY;
  return `${fixed(ratio ? value * 100 : value, decimals)}%`;
}

/** A 0–100 score → "72". Returns "—" when missing (never a fake 0). */
export function formatScore(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  return String(Math.round(value));
}

/** Rwandan francs → "RWF 1,250,000", or compact "RWF 1.3M". */
export function formatCurrency(value: number | null | undefined, { compact = false } = {}): string {
  if (!isNum(value)) return EMPTY;
  const n = new Intl.NumberFormat(LOCALE, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
  return `RWF ${n}`;
}

/** "a:b" ratio such as students per teacher → "32:1". */
export function formatRatio(numerator: number | null | undefined, denominator: number | null | undefined): string {
  if (!isNum(numerator) || !isNum(denominator) || denominator === 0) return EMPTY;
  return `${formatNumber(numerator / denominator, 1)}:1`;
}

const toDate = (v: Date | string | number | null | undefined): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Calendar date in Kigali time → "13 Oct 2026". */
export function formatDate(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KIGALI_TZ, day: "numeric", month: "short", year: "numeric",
  }).format(d);
}

/** Date and time in Kigali time → "13 Oct 2026, 14:05". */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KIGALI_TZ, day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

/** "5 minutes ago" / "in 2 days". Falls back to the date past 30 days. */
export function formatRelative(value: Date | string | number | null | undefined, now = new Date()): string {
  const d = toDate(value);
  if (!d) return EMPTY;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs > 30 * 86400) return formatDate(d);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

/** File size → "18.9 MB", "1.82 GB", "640 KB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (!isNum(bytes)) return EMPTY;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${fixed(v, i === 0 ? 0 : v < 10 ? 2 : 1)} ${units[i]}`;
}

/** Elapsed time in ms → "45 s", "3 min 05 s", "1 h 02 min". */
export function formatDuration(ms: number | null | undefined): string {
  if (!isNum(ms) || ms < 0) return EMPTY;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
