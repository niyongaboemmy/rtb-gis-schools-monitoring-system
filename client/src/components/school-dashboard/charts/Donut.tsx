import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useChartTooltip } from "./useChartTooltip";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  /** Rendered in the hole (e.g. the total). */
  center?: ReactNode;
  size?: number;
  thickness?: number;
  ariaLabel: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Animated donut with a 2px surface gap between segments, hover/focus
 * tooltip ("Pending · 3 · 60%"), and an accessible text summary.
 */
export function Donut({ segments, center, size = 112, thickness = 12, ariaLabel }: DonutProps) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  const [active, setActive] = useState<string | null>(null);
  const r = 50 - thickness / 2 - 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const shown = segments.filter((s) => s.value > 0);
  const gap = shown.length > 1 ? 2.2 : 0; // ~2px at the default size
  let offset = 0;

  return (
    <div ref={boxRef} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={thickness} className="stroke-slate-900/6 dark:stroke-white/8" />
        {total > 0 &&
          shown.map((s, i) => {
            const len = (s.value / total) * C;
            const dash = Math.max(0.01, len - gap);
            const start = offset;
            offset += len;
            const pct = Math.round((s.value / total) * 100);
            return (
              <motion.circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeLinecap="butt"
                tabIndex={0}
                aria-label={`${s.label}: ${s.value} (${pct}%)`}
                className="cursor-pointer outline-none"
                strokeDasharray={`${dash} ${C - dash}`}
                initial={{ strokeDashoffset: -start + dash, opacity: 0 }}
                animate={{
                  strokeDashoffset: -start,
                  opacity: active && active !== s.key ? 0.35 : 1,
                  strokeWidth: active === s.key ? thickness + 3 : thickness,
                }}
                transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.2 + i * 0.1, ease: EASE }}
                onPointerEnter={() => setActive(s.key)}
                {...bind(
                  <span>
                    {s.label} · <b>{s.value}</b> · {pct}%
                  </span>,
                )}
                onPointerLeave={() => {
                  setActive(null);
                  bind(null).onPointerLeave();
                }}
              />
            );
          })}
      </svg>
      {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      {tooltip}
    </div>
  );
}
