import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { formatNumber, formatPercent } from "../../lib/format";
import { EASE } from "../school-dashboard/tokens";

/** "Not recorded" in muted ink, so a gap never looks like a value. */
export function Missing({ children = "Not recorded" }: { children?: ReactNode }) {
  return <span className="font-normal text-slate-400 dark:text-white/35">{children}</span>;
}

/** Stacked label / value pair for record fields. */
export function Field({ label, value, className, mono }: { label: ReactNode; value: ReactNode; className?: string; mono?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[13px] font-medium text-slate-500 dark:text-white/45">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm font-medium text-slate-900 dark:text-white/90", mono && "font-mono text-[15px] tabular-nums")}>
        {empty ? <Missing /> : value}
      </dd>
    </div>
  );
}

/** Two-part share bar with a legend (e.g. male / female). Values are counts. */
export function SplitBar({
  parts,
  ariaLabel,
}: {
  parts: [{ label: string; value: number | null | undefined; color: string }, { label: string; value: number | null | undefined; color: string }];
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const a = Number(parts[0].value ?? 0);
  const b = Number(parts[1].value ?? 0);
  const total = a + b;
  if (!total) return <p className="text-xs text-slate-400 dark:text-white/35">No breakdown recorded</p>;
  return (
    <div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${ariaLabel}: ${parts.map((p) => `${p.label} ${formatNumber(Number(p.value ?? 0))}`).join(", ")}`}>
        {parts.map((p, i) => (
          <motion.span
            key={p.label}
            className={cn("h-full", i === 0 ? "rounded-l-full" : "rounded-r-full")}
            style={{ background: p.color }}
            initial={{ width: 0 }}
            animate={{ width: `${(Number(p.value ?? 0) / total) * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.2, ease: EASE }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[13px] text-slate-500 dark:text-white/50">
        {parts.map((p, i) => (
          <span key={p.label} className={cn("inline-flex items-center gap-1.5", i === 1 && "flex-row-reverse")}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label}
            <b className="font-semibold tabular-nums text-slate-800 dark:text-white/85">{formatNumber(Number(p.value ?? 0))}</b>
            <span className="tabular-nums text-slate-400 dark:text-white/35">{formatPercent((Number(p.value ?? 0) / total) * 100)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
