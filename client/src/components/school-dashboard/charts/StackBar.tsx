import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useChartTooltip } from "./useChartTooltip";

export interface StackSegment {
  key: string;
  value: number;
  color: string;
  tip: ReactNode;
  /** Striped fill (e.g. estimated) — a second encoding beside colour. */
  textured?: boolean;
}

interface StackBarProps {
  segments: StackSegment[];
  /** Full-scale value (e.g. 100); the remainder shows as track. */
  max: number;
  height?: number;
  ariaLabel: string;
}

/** Horizontal stacked bar, 2px surface gaps, rounded ends, hover tooltip per segment. */
export function StackBar({ segments, max, height = 14, ariaLabel }: StackBarProps) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  return (
    <div ref={boxRef} className="relative">
      <div role="img" aria-label={ariaLabel} className="flex w-full gap-[2px] overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8" style={{ height }}>
        {segments.map((s, i) =>
          s.value > 0 ? (
            <motion.span
              key={s.key}
              tabIndex={0}
              className="h-full cursor-pointer outline-none first:rounded-l-full hover:brightness-110 focus-visible:brightness-110"
              style={{
                background: s.textured
                  ? `repeating-linear-gradient(135deg, ${s.color} 0 4px, color-mix(in srgb, ${s.color} 45%, transparent) 4px 8px)`
                  : s.color,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(s.value / max) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              {...bind(s.tip)}
            />
          ) : null,
        )}
      </div>
      {tooltip}
    </div>
  );
}
