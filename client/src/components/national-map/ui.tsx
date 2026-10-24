import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { PRIORITY_META } from "../maps/schoolMap";
import { EASE, scoreColor } from "./tokens";

/** Progress ring for a 0–100 School Condition Score, coloured by its band. */
export function ScoreRing({
  score,
  size = 44,
  stroke = 4,
  delay = 0,
  label,
}: {
  score: number | null;
  size?: number;
  stroke?: number;
  delay?: number;
  /** Accessible label; defaults to "Score N". */
  label?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);
  return (
    <span
      role="img"
      aria-label={label ?? (score === null ? "Not assessed" : `Score ${Math.round(score)} of 100`)}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-900/[0.07] dark:stroke-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: reduce ? 0 : 1, delay: reduce ? 0 : delay, ease: EASE }}
        />
      </svg>
      <span
        aria-hidden
        className="absolute tabular-nums text-slate-900 dark:text-white"
        style={{ fontSize: Math.max(10, Math.round(size * 0.28)) }}
      >
        {score === null ? "—" : Math.round(score)}
      </span>
    </span>
  );
}

/** Small donut of the priority mix (critical → low). */
export function MixRing({
  counts,
  size = 44,
  stroke = 5,
  children,
}: {
  counts: Record<string, number>;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const keys = ["critical", "high", "medium", "low"] as const;
  const total = keys.reduce((n, k) => n + (counts[k] ?? 0), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = keys.filter((k) => (counts[k] ?? 0) > 0);
  const gap = shown.length > 1 ? 2 : 0;
  const lens = shown.map((k) => ((counts[k] ?? 0) / Math.max(1, total)) * c);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <span
      role="img"
      aria-label={keys.map((k) => `${PRIORITY_META[k].label} ${counts[k] ?? 0}`).join(", ")}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-900/[0.07] dark:stroke-white/10" />
        {total > 0 &&
          shown.map((k, i) => (
              <circle
                key={k}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={PRIORITY_META[k].color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, lens[i] - gap)} ${c}`}
                strokeDashoffset={-offsets[i]}
              />
            ))}
      </svg>
      {children && <span className="absolute text-[13px] tabular-nums text-slate-900 dark:text-white">{children}</span>}
    </span>
  );
}

/** Round icon button used on glass surfaces; label doubles as the tooltip. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean; size?: "sm" | "md" }
>(function IconButton({ icon: Icon, label, active, size = "md", className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 hover:-translate-y-px motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        active
          ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.7)]"
          : "text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white",
        className,
      )}
      {...rest}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} aria-hidden />
    </button>
  );
});


/** Labelled on/off row (role="switch"), used for layer and list toggles. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-slate-900/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.05]"
    >
      {Icon && (
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
            checked ? "bg-primary/12 text-primary" : "bg-slate-900/[0.05] text-slate-500 dark:bg-white/[0.06] dark:text-white/50",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-slate-900 dark:text-white">{label}</span>
        {hint && <span className="block truncate text-xs text-slate-500 dark:text-white/45">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-slate-900/15 dark:bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
