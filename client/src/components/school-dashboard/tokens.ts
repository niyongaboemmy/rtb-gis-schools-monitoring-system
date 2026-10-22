/** Shared motion + surface tokens for the school dashboard (match the national view). */

/**
 * Brand primary (--primary) as hex — for SVG attributes and alpha-suffixed
 * styles, where CSS variables don't work. Status and chart colours stay separate.
 */
export const BRAND = "#2563eb";
/** Light brand tint — the second part of a two-part split. */
export const BRAND_LIGHT = "#93c5fd";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** The frosted surface used across the dashboards (matches the national view). */
export const glassSurface =
  "rounded-[1.75rem] bg-white/60 shadow-float backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/70 dark:backdrop-saturate-75 ring-1 ring-slate-900/5 dark:ring-white/6";
