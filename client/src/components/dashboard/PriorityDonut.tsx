import { useState } from "react";
import type React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { wholePercentages } from "../../lib/percentages";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  /** Caption under the centre number, e.g. "schools". */
  unit?: string;
  /** Stack the ring above the legend (narrow side rails). */
  vertical?: boolean;
  /** Extra quick-info rendered under the legend, after a divider. */
  footer?: React.ReactNode;
  className?: string;
}

const R = 42;
const STROKE = 9;
const C = 2 * Math.PI * R;
/** Gap between segments, in circumference units. */
const GAP = 3.5;

/**
 * Glass card with an animated donut of schools by intervention priority and
 * a legend that cross-highlights with the ring on hover.
 */
export function PriorityDonut({ segments, unit = "schools", vertical = false, footer, className }: Props) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((n, s) => n + s.value, 0);
  const pcts = wholePercentages(segments.map((s) => s.value));
  const shown = segments.filter((s) => s.value > 0);
  const focus = active ? segments.find((s) => s.key === active) : null;

  const gap = shown.length > 1 ? GAP : 0;
  const lens = shown.map((s) => (s.value / Math.max(1, total)) * C);
  const arcs = shown.map((s, i) => ({
    ...s,
    dash: Math.max(0, lens[i] - gap),
    offset: lens.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  return (
    <div
      className={cn(
        vertical ? "relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl p-5" : "relative flex items-center gap-5 overflow-hidden rounded-3xl p-4 pr-5",
        "bg-linear-to-br from-white/45 via-white/20 to-white/5 shadow-float backdrop-blur-2xl backdrop-saturate-[1.8]",
        "dark:from-blue-400/[0.07] dark:via-blue-500/[0.03] dark:to-transparent",
        className,
      )}
    >

      <span aria-hidden className="pointer-events-none absolute -inset-x-6 -top-16 h-24 rotate-[-8deg] bg-linear-to-b from-white/50 to-transparent blur-xl dark:hidden" />

      {/* Donut */}
      <div className="relative h-28 w-28 shrink-0" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth={STROKE} className="stroke-slate-900/[0.06] dark:stroke-white/[0.07]" />
          {arcs.map((a, i) => (
            <motion.circle
              key={a.key}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={active === a.key ? STROKE + 3 : STROKE}
              strokeLinecap="round"
              strokeDasharray={`${a.dash} ${C}`}
              initial={reduce ? false : { strokeDashoffset: -a.offset + a.dash, opacity: 0 }}
              animate={{ strokeDashoffset: -a.offset, opacity: active && active !== a.key ? 0.3 : 1 }}
              transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.5 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ transition: "stroke-width 200ms" }}
              className="cursor-pointer"
              onPointerEnter={() => setActive(a.key)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={focus?.key ?? "total"}
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl font-semibold leading-none tabular-nums tracking-tight text-slate-900 dark:text-white"
            style={focus ? { color: focus.color } : undefined}
          >
            {focus ? focus.value : total}
          </motion.span>
          <span className="mt-1 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-white/45">
            {focus ? focus.label : unit}
          </span>
        </div>
      </div>

      {/* Legend */}
      <ul className={cn("grid min-w-0 grid-cols-2 gap-x-4 gap-y-2.5", vertical ? "w-full" : "flex-1")}>
        {segments.map((s, i) => {
          const pct = pcts[i];
          return (
            <li
              key={s.key}
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => setActive(null)}
              className={cn(
                "min-w-0 cursor-default rounded-xl px-2 py-1 transition-[background-color,opacity] duration-200",
                active === s.key && "bg-slate-900/[0.04] dark:bg-white/[0.06]",
                active && active !== s.key && "opacity-50",
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 dark:text-white/55">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}88` }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold leading-none tabular-nums text-slate-900 dark:text-white">{s.value}</span>
                <span className="text-[12px] tabular-nums text-slate-400 dark:text-white/35">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
      {footer && (
        <div className="w-full border-t border-slate-900/6 pt-3 dark:border-white/8">{footer}</div>
      )}
    </div>
  );
}
