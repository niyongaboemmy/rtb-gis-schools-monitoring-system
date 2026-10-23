import { useEffect, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { type LucideIcon, Crosshair, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatNumber, formatPercent, formatScore } from '../../lib/format';
import { label } from '../../lib/labels';
import { MetricInfo } from '../metric-help/MetricInfo';
import type { MetricId } from '../metric-help/metrics';
import type { ScoringModel } from '../dashboard/types';
import { bandOf, modelOf } from '../../lib/scoring';

interface MetricBreakdown {
  label: string;
  /** null means the metric is not yet available — renders `emptyText` instead of a number */
  score: number | null;
  icon: LucideIcon;
  /** "score" renders 0–100 without a % sign; "percent" renders with %. */
  unit?: 'score' | 'percent';
  metricId?: MetricId;
  /** Shown instead of "—" when score is null. */
  emptyText?: string;
  /** Data-gap note, e.g. "Estimated for 5 schools". */
  estimatedNote?: string | null;
  /** Share of the School Condition Score (0–1). Context metrics omit it. */
  weight?: number;
}

interface IntelligenceScoreProps {
  /** School Condition Score (0–100); null when no school has been scored. */
  score: number | null;
  urgencyMonths?: number;
  metrics: MetricBreakdown[];
  className?: string;
  isAggregate?: boolean;
  /** Number of scored schools behind an aggregate score. */
  assessedCount?: number;
  children?: ReactNode;
  /** Extra section rendered below a divider inside the same panel. */
  appendix?: ReactNode;
  /** Served scoring model (weights + bands); falls back to the mirrored default. */
  model?: ScoringModel | null;
  /** Share of the score(s) that comes from measured data, 0–1. */
  coverage?: number | null;
  /** The overall score is shown elsewhere (e.g. a page hero): render factors only. */
  hideOverall?: boolean;
  /** Header title override. */
  title?: string;
}

type Band = 'critical' | 'high' | 'medium' | 'low';

const BAND_HEX: Record<Band, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};
/** Band segments of the 0–100 scale, from the served bands. */
const bandStops = (model: ScoringModel) => {
  const b = model.bands;
  return [
    { band: 'critical' as Band, from: 0, to: b.high.min },
    { band: 'high' as Band, from: b.high.min, to: b.medium.min },
    { band: 'medium' as Band, from: b.medium.min, to: b.low.min },
    { band: 'low' as Band, from: b.low.min, to: 100 },
  ];
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** Counts up to `value` once on mount, shown with `decimals` places. */
function CountUp({ value, delay = 0, decimals = 0 }: { value: number; delay?: number; decimals?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => formatNumber(v, decimals));
  useEffect(() => {
    if (reduce) return mv.set(value);
    const c = animate(mv, value, { duration: 1.4, delay, ease: EASE });
    return () => c.stop();
  }, [value, delay, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

/**
 * School Condition Score panel, built for decisions: the overall score and
 * its band on a 0–100 scale, the weakest weighted factor called out as the
 * focus area, then every factor ranked lowest-first with its weight.
 */
export function IntelligenceScore({
  score,
  urgencyMonths,
  metrics,
  className,
  isAggregate = false,
  assessedCount,
  children,
  appendix,
  model: modelProp,
  coverage,
  hideOverall = false,
  title,
}: IntelligenceScoreProps) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const model = modelOf(modelProp);
  const stops = bandStops(model);

  const hasHero = score != null && Number.isFinite(score);
  const band = hasHero ? bandOf(score, model) : null;
  const color = band ? BAND_HEX[band] : '#94a3b8';

  // Weighted factors drive the score; rank them so the weakest leads.
  const weighted = metrics
    .filter((m) => m.weight != null)
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  const context = metrics.filter((m) => m.weight == null);
  const focus = weighted.find((m) => m.score != null) ?? null;

  const R = 74;
  const C = 2 * Math.PI * R;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn(
        'col-span-1 overflow-hidden rounded-[1.75rem] shadow-float',
        'bg-white/55 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_6%)]/65 dark:backdrop-saturate-75',
        className,
      )}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-8">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {title ?? (isAggregate ? 'Condition score' : 'School Condition Score')}
          </h2>
          <MetricInfo id={isAggregate ? 'national.avgConditionScore' : 'school.conditionScore'} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-white/55">
          {context.map((m) => {
            const has = m.score != null && Number.isFinite(m.score);
            return (
              <span key={m.label} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/4 px-3 py-1 dark:bg-white/6">
                <m.icon className="h-3.5 w-3.5" aria-hidden />
                {m.label}
                <span className="font-medium text-slate-700 dark:text-white/80">
                  {has ? (m.unit === 'percent' ? formatPercent(m.score) : formatScore(m.score)) : 'n/a'}
                </span>
              </span>
            );
          })}
          <span className="rounded-full bg-slate-900/4 px-3 py-1 dark:bg-white/6">
            {isAggregate ? `${formatNumber(assessedCount ?? null)} schools assessed` : 'This school'}
          </span>
          {isAggregate && (
            <span
              tabIndex={0}
              role="img"
              aria-label="How it's calculated"
              data-tooltip="Average School Condition Score of every scored active school in your area — the six weighted factors below. Higher is better."
              className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-full transition-colors hover:bg-slate-900/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/5"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </div>
      </header>

      <div className={cn('grid gap-8 p-6 sm:p-8 lg:gap-10', !hideOverall && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
        {/* ── Overall ─────────────────────────────────────────────────── */}
        {!hideOverall && (
        <div className="flex flex-col items-center gap-6">
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90" role="img" aria-label={hasHero ? `Score ${formatScore(score)} out of 100` : 'Not assessed yet'}>
              <circle cx="88" cy="88" r={R} fill="none" strokeWidth="10" className="stroke-slate-900/6 dark:stroke-white/7" />
              <motion.circle
                cx="88"
                cy="88"
                r={R}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                whileInView={{ strokeDashoffset: C * (1 - (hasHero ? score : 0) / 100) }}
                viewport={{ once: true }}
                transition={{ duration: reduce ? 0 : 1.4, ease: EASE, delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {/* An average keeps its decimal so the number never reads as the
                    next band (74.6 is Medium; "75" would look Low). */}
                {hasHero ? <CountUp value={score} delay={0.2} decimals={isAggregate ? 1 : 0} /> : '—'}
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-white/50">out of 100</span>
            </div>
          </div>

          {/* Band scale: where the score sits between the priority bands */}
          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-white/50">{isAggregate ? 'Average band' : 'Intervention priority'}</span>
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {band ? label('priority', band) : 'Not assessed'}
              </span>
            </div>
            <div className="relative h-1.5">
              <div className="flex h-full gap-0.5 overflow-hidden rounded-full">
                {stops.map((b) => (
                  <span
                    key={b.band}
                    className="h-full transition-opacity duration-300"
                    style={{ flexGrow: b.to - b.from, background: BAND_HEX[b.band], opacity: band === b.band ? 0.9 : 0.25 }}
                  />
                ))}
              </div>
              {hasHero && (
                <motion.span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow dark:border-slate-900 dark:bg-white"
                  initial={{ left: '0%' }}
                  whileInView={{ left: `${Math.min(100, Math.max(0, score))}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: reduce ? 0 : 1.4, ease: EASE, delay: 0.2 }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] tabular-nums text-slate-400 dark:text-white/30">
              <span>0</span>
              <span>{model.bands.high.min}</span>
              <span>{model.bands.medium.min}</span>
              <span>{model.bands.low.min}</span>
              <span>100</span>
            </div>
          </div>

          {coverage != null && Number.isFinite(coverage) && (
            <p
              className={cn(
                'max-w-xs text-center text-xs',
                coverage < 0.5 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-white/50',
              )}
            >
              {formatPercent(coverage * 100)} of {isAggregate ? 'the scores' : 'this score'} comes from measured data
              {coverage < 0.5 ? ' — treat priorities as provisional until data is collected.' : '.'}
            </p>
          )}

          {!isAggregate && urgencyMonths != null && (
            <p className="text-xs text-slate-500 dark:text-white/50">
              Intervention due:{' '}
              <span className="font-medium text-slate-900 dark:text-white">
                {urgencyMonths === 0 ? 'now' : `in ${urgencyMonths} months`}
              </span>
            </p>
          )}

        </div>

        )}

        {/* ── Factors, weakest first ──────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between pb-3">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Factors</h3>
            <span className="text-xs text-slate-400 dark:text-white/35">weakest first · % = weight</span>
          </div>

          <ul className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3', hideOverall && 'xl:grid-cols-6')}>
            {weighted.map((m, i) => {
              const has = m.score != null && Number.isFinite(m.score);
              const c = has ? BAND_HEX[bandOf(m.score!)] : '#94a3b8';
              const isFocus = m === focus;
              const pct = has ? Math.min(100, Math.max(0, m.score!)) / 100 : 0;
              // Semicircle gauge: arc of radius 40 from 180° to 0°.
              const ARC = Math.PI * 40;
              return (
                <motion.li
                  key={m.label}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.07, ease: EASE }}
                  onPointerEnter={() => setHovered(m.label)}
                  onPointerLeave={() => setHovered(null)}
                  className={cn(
                    'group relative flex flex-col items-center rounded-2xl px-3 pb-3 pt-4 transition-[background-color,transform] duration-300 hover:-translate-y-0.5',
                    isFocus ? 'bg-primary/6 dark:bg-primary/10' : 'bg-slate-900/3 dark:bg-white/4',
                    hovered === m.label && 'bg-slate-900/5 dark:bg-white/7',
                  )}
                >
                  {isFocus && (
                    <span className="absolute right-2 top-2 rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-medium text-primary">Focus</span>
                  )}
                  <span className="absolute left-2.5 top-2.5 text-[10px] tabular-nums text-slate-400 dark:text-white/35">
                    {Math.round((m.weight ?? 0) * 100)}%
                  </span>
                  <div className="relative h-[54px] w-[100px]">
                    <svg viewBox="0 0 100 54" className="h-full w-full overflow-visible">
                      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-slate-900/6 dark:stroke-white/8" />
                      <motion.path
                        d="M10 50 A40 40 0 0 1 90 50"
                        fill="none"
                        stroke={c}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ARC}
                        initial={{ strokeDashoffset: ARC }}
                        whileInView={{ strokeDashoffset: ARC * (1 - pct) }}
                        viewport={{ once: true }}
                        transition={{ duration: reduce ? 0 : 1.1, delay: 0.3 + i * 0.07, ease: EASE }}
                      />
                    </svg>
                    <span className="absolute inset-x-0 bottom-0 text-center text-xl font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
                      {has ? <CountUp value={m.score!} delay={0.3 + i * 0.07} /> : '—'}
                    </span>
                  </div>
                  <span className="mt-2 flex max-w-full items-center gap-1 text-xs text-slate-600 dark:text-white/65">
                    <m.icon className="h-3.5 w-3.5 shrink-0" style={{ color: c }} aria-hidden />
                    <span className="truncate">{m.label}</span>
                  </span>
                  {m.estimatedNote && (
                    <span
                      tabIndex={0}
                      data-tooltip={m.estimatedNote}
                      className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                    >
                      Estimated
                    </span>
                  )}
                  {m.metricId && (
                    <span className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <MetricInfo id={m.metricId} size="xs" />
                    </span>
                  )}
                </motion.li>
              );
            })}
          </ul>

        </div>
      </div>

      {/* Decision row, on the same columns as above: focus area | next actions */}
      {(focus || children) && (
        <div className="grid gap-6 px-6 pb-6 sm:px-8 sm:pb-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          {focus ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.2, ease: EASE }}
              className="space-y-2.5"
            >
              <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                <Crosshair className="h-4 w-4 text-primary" aria-hidden />
                Focus area
              </h3>
              <div className="group flex items-center gap-3 rounded-2xl bg-slate-900/3 p-3 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-slate-900/5 dark:bg-white/4 dark:hover:bg-white/6">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums"
                  style={{ background: `${BAND_HEX[bandOf(focus.score!)]}1f`, color: BAND_HEX[bandOf(focus.score!)] }}
                >
                  {formatScore(focus.score)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{focus.label}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-white/50">
                    Weakest · {Math.round((focus.weight ?? 0) * 100)}% weight
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div />
          )}
          {children}
        </div>
      )}
      {appendix && (
        <>
          <div className="mx-6 h-px bg-linear-to-r from-transparent via-slate-900/10 to-transparent sm:mx-8 dark:via-white/10" />
          {appendix}
        </>
      )}
    </motion.section>
  );
}
