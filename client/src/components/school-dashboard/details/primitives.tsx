import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { BRAND, EASE } from "../tokens";

/** Row of key figures for a dialog header: 2 columns on phones, `cols` from sm. */
export function SummaryStats({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 }) {
  return <dl className={cn("grid grid-cols-2 gap-2 sm:gap-2.5", cols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>{children}</dl>;
}

interface SummaryStatProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Identity / status colour: a dot before the label and the meter fill. */
  accent?: string;
  /** 0–100 → a thin meter under the value. */
  meter?: number | null;
  info?: ReactNode;
}

export function SummaryStat({ label, value, hint, accent, meter, info }: SummaryStatProps) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-900/[0.035] px-3.5 py-3 ring-1 ring-slate-900/5 dark:bg-white/[0.045] dark:ring-white/8">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/50">
        {accent && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />}
        <span className="truncate">{label}</span>
        {info}
      </dt>
      <dd className="mt-1 truncate text-xl font-semibold leading-tight tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</dd>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-white/45">{hint}</p>}
      {meter != null && <Meter value={meter} color={accent} className="mt-2" />}
    </div>
  );
}

/** A titled block inside a dialog body. */
export function DetailSection({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 space-y-3", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-white">{title}</h3>
        {aside && <div className="text-[11px] text-slate-500 dark:text-white/50">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** Thin animated 0–100 meter; `marker` draws a tick (e.g. 100% capacity). */
export function Meter({
  value,
  color = BRAND,
  marker,
  className,
  height = 6,
  label,
}: {
  value: number;
  color?: string;
  marker?: number;
  className?: string;
  height?: number;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative w-full rounded-full bg-slate-900/6 dark:bg-white/8", className)}
      style={{ height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.15, ease: EASE }}
      />
      {marker != null && (
        <span
          className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-slate-900/40 dark:bg-white/50"
          style={{ left: `${Math.max(0, Math.min(100, marker))}%` }}
        />
      )}
    </div>
  );
}

/** Status / category chip: coloured dot + ink text (never coloured text). */
export function StatusPill({ color, children, className }: { color?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/7 dark:text-white/80",
        className,
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </span>
  );
}

/** "How is this worked out?" trigger — every indicative number shows its rule. */
export function RuleTip({ rule, label }: { rule: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: how is this worked out?`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/40"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-normal text-[12px] font-medium normal-case leading-snug tracking-normal">{rule}</TooltipContent>
    </Tooltip>
  );
}

interface ChipOption<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
  color?: string;
}

/** Toggle chips (one active) for filtering a list. */
export function FilterChips<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ChipOption<K>[];
  value: K;
  onChange: (k: K) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              on
                ? "bg-primary text-white ring-primary"
                : "bg-white text-slate-600 ring-slate-900/8 hover:bg-slate-50 dark:bg-white/4 dark:text-white/65 dark:ring-white/10 dark:hover:bg-white/8",
            )}
          >
            {o.color && <span className={cn("h-1.5 w-1.5 rounded-full", on && "ring-2 ring-white/70")} style={{ background: o.color }} aria-hidden />}
            {o.label}
            {o.count != null && <span className={cn("tabular-nums", on ? "text-white/75" : "text-slate-400 dark:text-white/40")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented tabs with an animated thumb. Panels are rendered by the caller. */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  idPrefix,
}: {
  tabs: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  ariaLabel: string;
  idPrefix: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-full bg-slate-900/5 p-1 dark:bg-white/6">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.key}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              on ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-white/55 dark:hover:text-white/85",
            )}
          >
            {on && (
              <motion.span
                layoutId={`${idPrefix}-thumb`}
                className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-slate-900/5 dark:bg-white/12 dark:ring-white/10"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Dashed empty state with a short "what to do" line. */
export function EmptyNote({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-white/12">
      <p className="text-sm font-medium text-slate-800 dark:text-white/85">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500 dark:text-white/50">{children}</p>}
    </div>
  );
}
