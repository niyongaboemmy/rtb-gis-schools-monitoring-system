import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { AlertTriangle, CalendarClock, MapPin, MapPinned } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate, formatNumber, formatPercent, formatScore } from "../../lib/format";
import { label } from "../../lib/labels";
import { BAND_HEX, bandOf, COMPONENT_ORDER, modelOf, type ComponentKey } from "../../lib/scoring";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { PriorityKey, SchoolMetrics } from "../dashboard/types";
import { HeroBackdrop } from "./HeroBackdrop";
import { EASE, BRAND } from "./tokens";

export type DetailView = "score" | "reports" | "risk" | "buildings" | "profile" | "actions";

const BANDS = ["critical", "high", "medium", "low"] as const;

/** Factor → its score field and chart colour (same slots as the Score factors card). */
const FACTORS: Record<ComponentKey, { name: string; field: keyof SchoolMetrics; color: string }> = {
  infrastructure: { name: "Buildings", field: "infrastructureScore", color: "var(--viz-1)" },
  buildingAge: { name: "Building age", field: "buildingAgeScore", color: "var(--viz-2)" },
  facilityCompliance: { name: "Facilities", field: "facilityComplianceScore", color: "var(--viz-3)" },
  accessibility: { name: "Road access", field: "accessibilityScore", color: "var(--viz-4)" },
  population: { name: "Population", field: "populationPressureScore", color: "var(--viz-5)" },
  resolution: { name: "Problems fixed", field: "resolutionRateScore", color: "var(--viz-6)" },
};

interface SchoolHeroProps {
  name: string;
  code?: string;
  district?: string;
  province?: string;
  mapped?: boolean;
  metrics: SchoolMetrics | null;
  onOpen: (view: DetailView) => void;
}

const pill =
  "inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-900/5 backdrop-blur-md dark:bg-white/8 dark:text-white/75 dark:ring-white/10";

/**
 * Full-bleed hero: the school's name and the decision (score, priority, due,
 * measured) over an animated campus/GIS scene. Minimal words; long names are
 * fluid-sized and clamped with the full name on hover.
 */
export function SchoolHero({ name, code, district, province, mapped, metrics, onOpen }: SchoolHeroProps) {
  const reduce = useReducedMotion();
  const model = modelOf(metrics?.scoringModel);
  const score = metrics ? Number(metrics.overallScore) : null;
  const hasScore = score != null && Number.isFinite(score);
  const band: PriorityKey | null = metrics?.priorityLevel ?? (hasScore ? bandOf(score, model) : null);
  const color = band ? BAND_HEX[band] : "#94a3b8";
  const coverage = typeof metrics?.dataCoverage === "number" ? metrics.dataCoverage : null;
  const urgency = metrics?.urgencyMonths;
  const place = [district, province].filter(Boolean).join(", ");

  // Pointer parallax (springy), centred at 0.5.
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const mx = useSpring(rawX, { stiffness: 60, damping: 20 });
  const my = useSpring(rawY, { stiffness: 60, damping: 20 });

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <section
      aria-label="School summary"
      className="relative isolate w-full overflow-hidden"
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        rawX.set((e.clientX - r.left) / r.width);
        rawY.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        rawX.set(0.5);
        rawY.set(0.5);
      }}
    >
      <HeroBackdrop color={BRAND} mx={mx} my={my} />

      {/* top padding clears the viewer's floating navigation */}
      <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-24 sm:px-8 sm:pb-16 sm:pt-28 lg:px-10 lg:pb-24 lg:pt-32">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          {/* ── Identity ─────────────────────────────────────────── */}
          <motion.div
            className="min-w-0 max-w-3xl"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <ul className="mb-5 flex flex-wrap items-center gap-2 sm:mb-6">
              {code && <li className={cn(pill, "font-mono text-[13px] tracking-wide")}>{code}</li>}
              {place && (
                <li className={pill}>
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="max-w-[16rem] truncate">{place}</span>
                </li>
              )}
              <li className={cn(pill, mapped && "text-emerald-700 dark:text-emerald-300")} title={mapped ? "Site map ready" : "No site map yet"}>
                <MapPinned className="h-3.5 w-3.5" aria-hidden />
                {mapped ? "Mapped" : "Not mapped"}
              </li>
            </ul>

            {/* Fluid size + clamp: long names stay on 2–3 lines, full name on hover */}
            <h1
              title={name}
              className="line-clamp-3 max-w-[36ch] break-words text-[clamp(1.5rem,1.05rem+1.5vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.015em] text-balance text-slate-900 sm:line-clamp-2 dark:text-white"
            >
              {name}
            </h1>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 sm:mt-5 dark:text-white/50">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {metrics?.calculatedAt ? formatDate(metrics.calculatedAt) : "—"}
              {metrics?.provisional && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary dark:text-blue-300">Preview</span>}
            </p>
          </motion.div>

          {/* ── Decision ─────────────────────────────────────────── */}
          <motion.div
            className="flex items-center gap-5 sm:gap-7"
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          >
            {/* Score orb with the six factors orbiting it */}
            <button
              type="button"
              onClick={() => onOpen("score")}
              aria-label={hasScore ? `School Condition Score ${formatScore(score)} of 100. Open the breakdown.` : "Not assessed yet"}
              className="group relative h-28 w-28 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:h-32 sm:w-32 lg:h-36 lg:w-36"
            >
              <span
                aria-hidden
                className="absolute inset-3 rounded-full bg-white/80 shadow-sm ring-1 ring-slate-900/6 transition-transform duration-500 group-hover:scale-[1.04] dark:bg-white/[0.06] dark:ring-white/10"
              />
              <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90 overflow-visible" aria-hidden>
                <circle cx="64" cy="64" r={R} fill="none" strokeWidth="7" className="stroke-slate-900/6 dark:stroke-white/8" />
                <motion.circle
                  cx="64"
                  cy="64"
                  r={R}
                  fill="none"
                  stroke={color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C * (1 - (hasScore ? score : 0) / 100) }}
                  transition={{ duration: reduce ? 0 : 1.6, ease: EASE, delay: 0.3 }}
                />
              </svg>
              {/* orbiting factor dots (size = factor score) */}
              <motion.span
                aria-hidden
                className="absolute inset-0"
                animate={reduce ? undefined : { rotate: 360 }}
                // One slow turn, then rest (360° = the start): an idle page
                // shouldn't repaint forever.
                transition={{ duration: 60, ease: "linear" }}
              >
                {COMPONENT_ORDER.map((k, i) => {
                  const raw = metrics?.[FACTORS[k].field];
                  const v = raw == null ? 0 : Number(raw);
                  const a = (i / COMPONENT_ORDER.length) * Math.PI * 2 - Math.PI / 2;
                  const size = 3.5 + (v / 100) * 3.5;
                  return (
                    <motion.span
                      key={k}
                      title={`${FACTORS[k].name}: ${formatScore(raw == null ? null : v)}`}
                      className="pointer-events-auto absolute rounded-full ring-[1.5px] ring-white/80 dark:ring-[#0a1122]/80"
                      style={{
                        width: size,
                        height: size,
                        left: `calc(50% + ${Math.cos(a) * 50}% - ${size / 2}px)`,
                        top: `calc(50% + ${Math.sin(a) * 50}% - ${size / 2}px)`,
                        background: FACTORS[k].color,
                        opacity: metrics?.dataGaps?.[k] ? 0.4 : 0.85,
                      }}
                      initial={reduce ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, delay: reduce ? 0 : 1 + i * 0.08, type: "spring", stiffness: 300 }}
                    />
                  );
                })}
              </motion.span>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold leading-none tabular-nums tracking-tight text-slate-900 lg:text-4xl dark:text-white">
                  {hasScore ? formatScore(score) : "—"}
                </span>
                <span className="mt-1 text-[12px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/50">score</span>
              </span>
            </button>

            {/* Three indicators, no prose */}
            <dl className="grid min-w-0 gap-3 rounded-2xl bg-white/55 px-4 py-3.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-white/70 backdrop-blur-xl sm:min-w-[11.5rem] sm:px-5 sm:py-4 dark:bg-white/[0.05] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] dark:ring-white/10">
              <div>
                <dt className="flex items-center gap-1 text-[12px] uppercase tracking-[0.14em] text-slate-500 dark:text-white/50">
                  Priority <MetricInfo id="school.priority" size="xs" />
                </dt>
                <dd className="mt-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{band ? label("priority", band) : "—"}</span>
                  <div className="mt-1.5 flex w-full max-w-36 gap-0.5" aria-hidden>
                    {BANDS.map((b, i) => (
                      <motion.span
                        key={b}
                        className="h-1.5 flex-1 first:rounded-l-full last:rounded-r-full"
                        style={{ background: BAND_HEX[b] }}
                        initial={{ opacity: 0.15 }}
                        animate={{ opacity: b === band ? 1 : 0.2, scaleY: b === band ? 1.7 : 1 }}
                        transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.6 + i * 0.08 }}
                      />
                    ))}
                  </div>
                </dd>
              </div>
              <div className="border-t border-slate-900/6 pt-3 dark:border-white/8">
                <dt className="flex items-center gap-1 text-[12px] uppercase tracking-[0.14em] text-slate-500 dark:text-white/50">
                  Due <MetricInfo id="school.urgencyMonths" size="xs" />
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {urgency == null ? "—" : urgency === 0 ? "Now" : `${formatNumber(urgency)} mo`}
                </dd>
              </div>
              <div className="border-t border-slate-900/6 pt-3 dark:border-white/8">
                <dt className="text-[12px] uppercase tracking-[0.14em] text-slate-500 dark:text-white/50">Real data</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-900/8 dark:bg-white/10" aria-hidden>
                    <motion.span
                      className={cn("block h-full rounded-full", coverage != null && coverage < 0.5 ? "bg-amber-500" : "bg-emerald-500")}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((coverage ?? 0) * 100)}%` }}
                      transition={{ duration: reduce ? 0 : 1.1, ease: EASE, delay: 0.6 }}
                    />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {coverage == null ? "—" : formatPercent(coverage * 100)}
                  </span>
                  {coverage != null && coverage < 0.5 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Mostly estimated — priority is provisional" />
                  )}
                </dd>
              </div>
            </dl>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
