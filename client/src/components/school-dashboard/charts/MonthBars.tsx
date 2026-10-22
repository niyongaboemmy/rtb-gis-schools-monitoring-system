import { motion, useReducedMotion } from "framer-motion";
import { formatNumber } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { EASE } from "../tokens";
import { useChartTooltip } from "./useChartTooltip";

interface Series {
  key: string;
  label: string;
  color: string;
}

interface MonthBarsProps {
  data: Array<{ key: string; label: string; values: Record<string, number> }>;
  series: Series[];
  height?: number;
  ariaLabel: string;
}

/**
 * Grouped monthly bars (one bar per series, 2px gaps, rounded tops on a
 * shared baseline), recessive gridlines, a legend, and one hover/focus
 * tooltip per month.
 */
export function MonthBars({ data, series, height = 150, ariaLabel }: MonthBarsProps) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  // A round-ish top so gridlines land on whole numbers.
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-white/60">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={boxRef} className="relative">
        <div className="relative flex" style={{ height }}>
          {/* y labels + gridlines */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {[1, 0.5, 0].map((f) => (
              <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%`, transform: "translateY(50%)" }}>
                <span className="w-6 text-right text-[10px] tabular-nums text-slate-400 dark:text-white/35">{Number.isInteger(top * f) ? formatNumber(top * f) : ""}</span>
                <span className={f === 0 ? "h-px flex-1 bg-slate-900/15 dark:bg-white/15" : "h-px flex-1 border-t border-dashed border-slate-900/8 dark:border-white/8"} />
              </div>
            ))}
          </div>
          <div role="img" aria-label={ariaLabel} className="relative ml-8 flex flex-1 items-end gap-1 sm:gap-1.5">
            {data.map((d, i) => (
              <div
                key={d.key}
                tabIndex={0}
                className="group flex h-full flex-1 cursor-default items-end justify-center gap-[2px] rounded-md outline-none hover:bg-slate-900/[0.03] focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:bg-white/[0.04]"
                {...bind(
                  <span className="flex flex-col gap-0.5">
                    <b>{d.label}</b>
                    {series.map((s) => (
                      <span key={s.key}>
                        {s.label}: <b>{formatNumber(d.values[s.key] ?? 0)}</b>
                      </span>
                    ))}
                  </span>,
                )}
              >
                {series.map((s, j) => {
                  const v = d.values[s.key] ?? 0;
                  return (
                    <motion.span
                      key={s.key}
                      className="w-full max-w-3 rounded-t-[4px]"
                      style={{ background: s.color, minHeight: v > 0 ? 3 : 0 }}
                      initial={{ height: 0 }}
                      animate={{ height: `${(v / top) * 100}%` }}
                      transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : 0.1 + i * 0.03 + j * 0.05, ease: EASE }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="ml-8 mt-1.5 flex gap-1 sm:gap-1.5" aria-hidden>
          {data.map((d, i) => (
            // Every other label on phones, but keep the slot so labels stay under their bars.
            <span key={d.key} className={cn("min-w-0 flex-1 truncate text-center text-[10px] text-slate-400 dark:text-white/40", i % 2 === 1 && "invisible sm:visible")}>
              {d.label}
            </span>
          ))}
        </div>
        {tooltip}
      </div>
    </div>
  );
}
