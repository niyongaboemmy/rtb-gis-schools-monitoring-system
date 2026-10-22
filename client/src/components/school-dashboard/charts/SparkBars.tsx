import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../../lib/utils";
import { useChartTooltip } from "./useChartTooltip";

interface SparkBarsProps {
  data: Array<{ key: string; value: number; tip: ReactNode }>;
  height?: number;
  ariaLabel: string;
  className?: string;
}

/** Tiny bar series: rounded tops on the baseline, last bar emphasised, hover tooltip per bar. */
export function SparkBars({ data, height = 36, ariaLabel, className }: SparkBarsProps) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  const peak = Math.max(1, ...data.map((d) => d.value));
  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div role="img" aria-label={ariaLabel} className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => (
          // Hit area is the full column, larger than the bar.
          <div key={d.key} tabIndex={0} className="group flex h-full flex-1 cursor-pointer items-end outline-none" {...bind(d.tip)}>
            <motion.span
              className={cn(
                "w-full rounded-t-[4px] transition-colors",
                i === data.length - 1 ? "bg-primary" : "bg-primary/30 group-hover:bg-primary/60 group-focus-visible:bg-primary/60",
              )}
              initial={{ height: 0 }}
              animate={{ height: d.value > 0 ? `${Math.max(8, (d.value / peak) * 100)}%` : 2 }}
              transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.25 + i * 0.03, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ))}
      </div>
      {tooltip}
    </div>
  );
}
