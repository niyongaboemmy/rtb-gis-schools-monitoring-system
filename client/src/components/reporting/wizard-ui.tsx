import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE_OUT, TONE_TILE, type Tone } from "../ui/surfaces";

/** Light step transition: a short fade with an 8px lift (opacity only when reduced). */
export function StepPanel({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      data-step={id}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Segmented stepper: one bar per step (done / current / upcoming) with its
 * label underneath. Nothing overlaps, so it stays clean at any width; phones
 * get a single "Step n of N · Label" line above the bar.
 */
export function WizardStepper({ steps, current }: { steps: string[]; current: number }) {
  const total = steps.length;
  return (
    <nav aria-label="Report progress" className="w-full">
      <p className="mb-2.5 flex items-baseline gap-2 text-xs sm:hidden">
        <span className="font-medium text-slate-900 dark:text-white">{steps[current - 1]}</span>
        <span className="text-slate-500 dark:text-white/50">
          Step {current} of {total}
        </span>
      </p>
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {steps.map((label, i) => {
          const n = i + 1;
          const done = current > n;
          const active = current === n;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="min-w-0">
              <span className="relative block h-1.5 overflow-hidden rounded-full bg-slate-900/8 dark:bg-white/8" aria-hidden>
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-out",
                    done || active ? "w-full" : "w-0",
                    active && "shadow-[0_0_12px_rgb(37_99_235/0.55)]",
                  )}
                />
              </span>
              <span
                className={cn(
                  "mt-2 hidden items-center gap-1.5 truncate text-xs sm:flex",
                  active && "font-medium text-slate-900 dark:text-white",
                  done && "text-slate-600 dark:text-white/65",
                  !active && !done && "text-slate-400 dark:text-white/35",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <span className={cn("shrink-0 tabular-nums", active ? "text-primary" : "")}>{n}</span>
                )}
                <span className="truncate">{label}</span>
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Title row for a wizard step: back button, title, context line, optional actions. */
export function StepHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel ?? "Back"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 ring-1 ring-slate-900/10 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/60 dark:ring-white/10 dark:hover:bg-white/8 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="truncate text-sm text-slate-500 dark:text-white/55">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Selectable option (building, facility, item): icon tile, title, meta line, chevron. */
export function ChoiceCard({
  icon: Icon,
  title,
  meta,
  onClick,
  selected,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  onClick: () => void;
  selected?: boolean;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-2xl p-4 text-left ring-1 transition-[background-color,box-shadow,transform] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.99]",
        selected
          ? "bg-primary/6 ring-primary/40"
          : "bg-white/70 ring-slate-900/8 hover:bg-white hover:ring-primary/30 hover:shadow-[0_8px_24px_-16px_rgb(15_23_42/0.35)] dark:bg-white/3 dark:ring-white/8 dark:hover:bg-white/6 dark:hover:ring-primary/40",
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", TONE_TILE[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-white/50">{meta}</span>}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary dark:text-white/35"
        aria-hidden
      />
    </button>
  );
}

/** Responsive grid for ChoiceCards. */
export function ChoiceGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** Quiet titled card used inside the details and review steps. */
export function WizardSection({
  icon: Icon,
  title,
  hint,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-white/70 p-5 ring-1 ring-slate-900/8 dark:bg-white/3 dark:ring-white/8",
        className,
      )}
    >
      <div className="mb-3 flex items-start gap-2.5">
        {Icon && (
          <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", TONE_TILE.primary)}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
          {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-white/50">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
