import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  GraduationCap,
  KeyRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber, formatRelative } from "../../lib/format";
import {
  areaCoverage,
  totalsSummary,
  triggerLabel,
  TDMP_COVERAGE,
  type CoverageArea,
  type RequestStatus,
  type SyncRun,
} from "../../lib/tdmp";
import type { Tone } from "../ui/surfaces";
import type { SetupStep } from "./TdmpGuide";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-success",
  warn: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
  primary: "text-primary",
};
const TONE_STROKE: Record<Tone, string> = {
  good: "stroke-success",
  warn: "stroke-warning",
  danger: "stroke-destructive",
  neutral: "stroke-muted-foreground",
  primary: "stroke-primary",
};
const TONE_FILL: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
};

/** Card surface shared by the clickable tiles. */
const TILE =
  "group relative flex min-w-0 rounded-2xl bg-white/55 text-left ring-1 ring-inset ring-slate-900/[0.06] transition-all hover:-translate-y-0.5 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.035] dark:ring-white/[0.08]";

/** Animated ring with a number in the middle; the whole thing is a button. */
export function ProgressRing({
  value,
  label,
  caption,
  center,
  tone = "primary",
  tip,
  onClick,
}: {
  /** Guidance shown on hover / focus. */
  tip?: string;
  /** 0–100 */
  value: number;
  label: string;
  caption: string;
  center: string;
  tone?: Tone;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <button type="button" onClick={onClick} data-tooltip={tip} className={cn(TILE, "items-center gap-3 p-3")} aria-label={`${label}: ${center}. ${caption}. Show details`}>
      <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} className="fill-none stroke-slate-900/[0.07] dark:stroke-white/10" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          className={cn("fill-none", TONE_STROKE[tone])}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(100, Math.max(0, value)) / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <text x="32" y="32" dominantBaseline="central" textAnchor="middle" transform="rotate(90 32 32)" className="fill-foreground text-[13px] font-semibold">
          {center}
        </text>
      </svg>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{caption}</span>
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

/** A short number with a label; opens its details. */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  tip,
  onClick,
}: {
  tip?: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} data-tooltip={tip} className={cn(TILE, "flex-col gap-1 p-3")}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", TONE_TEXT[tone])} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate text-lg font-semibold leading-tight tabular-nums text-foreground">{value}</span>
      {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

/** The six setup steps as a connected track; each step opens its explanation. */
export function SetupStepper({ steps, onOpen }: { steps: SetupStep[]; onOpen: (step: SetupStep) => void }) {
  const next = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid grid-cols-3 gap-y-4 @2xl:grid-cols-6" aria-label="Setup progress">
      {steps.map((s, i) => {
        const isNext = i === next;
        return (
          <li key={s.id} className="relative flex flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2",
                  i % 3 === 0 && "hidden @2xl:block",
                  steps[i - 1].done ? "bg-success/60" : "bg-slate-900/10 dark:bg-white/10",
                )}
              />
            )}
            <button
              type="button"
              onClick={() => onOpen(s)}
              data-tooltip={`${s.title}${s.done ? " · done" : ""}: ${s.explain}`}
              aria-current={isNext ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.title}${s.done ? " (done)" : isNext ? " (next)" : ""}`}
              className="group relative z-10 flex flex-col items-center gap-1.5 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-background transition-transform group-hover:scale-110",
                  s.done
                    ? "bg-success text-white"
                    : isNext
                      ? "bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary/20"
                      : "bg-slate-900/[0.06] text-muted-foreground dark:bg-white/10",
                )}
              >
                {s.done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-center text-xs leading-tight", isNext ? "font-semibold text-primary" : s.done ? "text-foreground" : "text-muted-foreground")}>
                {s.short}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const AREA_ICON: Record<CoverageArea["id"], LucideIcon> = {
  profile: Building2,
  enrolment: GraduationCap,
  staffing: Users,
  identity: KeyRound,
};

/** One tile per data area with a mini progress bar of live fields. */
export function CoverageGrid({
  requests,
  onOpen,
}: {
  requests: Pick<RequestStatus, "id" | "state">[] | undefined;
  onOpen: (area: CoverageArea) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 @3xl:grid-cols-5">
      {TDMP_COVERAGE.map((a) => {
        const c = areaCoverage(a, requests);
        const pct = Math.round((c.live / c.total) * 100);
        const tone: Tone = pct === 100 ? "good" : pct > 0 ? "warn" : "neutral";
        const Icon = AREA_ICON[a.id];
        return (
          <button key={a.id} type="button" onClick={() => onOpen(a)} data-tooltip={`${a.summary} Click to see each field.`} className={cn(TILE, "flex-col gap-2 p-3")} aria-label={`${a.title}: ${c.live} of ${c.total} live. Show fields`}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} aria-hidden />
                <span className="truncate">{a.title}</span>
              </span>
              {pct === 100 && <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />}
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10" aria-hidden>
              <motion.span
                className={cn("block h-full rounded-full", TONE_FILL[tone])}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            <span className="text-xs text-muted-foreground">
              {pct === 100 ? "All live" : pct === 0 ? "Waiting for TDMP" : `${c.live} of ${c.total} live`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const RUN_DOT: Record<SyncRun["status"], string> = {
  running: "bg-primary animate-pulse",
  completed: "bg-success",
  failed: "bg-destructive",
};

/** Latest runs as a compact timeline; each opens its report. */
export function ActivityList({ runs, onOpen }: { runs: SyncRun[]; onOpen: (run: SyncRun) => void }) {
  if (!runs.length) return <p className="py-2 text-sm text-muted-foreground">No runs yet.</p>;
  return (
    <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-border/60" aria-label="Recent runs">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            onClick={() => onOpen(run)}
            data-tooltip="Open this run's full report"
            className="group relative flex w-full items-start gap-3 rounded-xl py-1.5 pl-0 pr-2 text-left hover:bg-slate-900/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.04]"
          >
            <span className="relative z-10 mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-background" aria-hidden>
              <span className={cn("h-2.5 w-2.5 rounded-full", RUN_DOT[run.status])} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-foreground">{triggerLabel(run)}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatRelative(run.startedAt)}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {run.status === "failed" ? "Failed: open for details" : totalsSummary(run.totals, run.dryRun)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export interface AttentionItem {
  id: string;
  icon: LucideIcon;
  label: string;
  count: number;
  tone: Tone;
  /** What clicking does, shown on hover / focus. */
  tip: string;
  onOpen: () => void;
}

/** What needs a person, with a count each; nothing → an all-clear line. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  const open = items.filter((i) => i.count > 0);
  if (!open.length)
    return (
      <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> Nothing needs attention.
      </p>
    );
  return (
    <ul className="space-y-1.5">
      {open.map((i) => (
        <li key={i.id}>
          <button
            type="button"
            onClick={i.onOpen}
            data-tooltip={i.tip}
            className="group flex w-full items-center gap-3 rounded-xl bg-slate-900/[0.025] px-3 py-2.5 text-left ring-1 ring-inset ring-slate-900/5 transition-colors hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.03] dark:ring-white/8"
          >
            <i.icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[i.tone])} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{i.label}</span>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", TONE_TEXT[i.tone], "bg-slate-900/[0.05] dark:bg-white/10")}>
              {formatNumber(i.count)}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
