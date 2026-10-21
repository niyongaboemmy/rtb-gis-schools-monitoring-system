import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, X } from "lucide-react";
import { PRIORITY_META } from "../maps/schoolMap";
import { formatNumber } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { HierarchyItem } from "./types";

const KEYS = ["critical", "high", "medium", "low"] as const;

/** Priority band colour for a score (Critical <35, High <55, Medium <75, Low ≥75). */
const bandColor = (score: number | null) =>
  score === null
    ? "#64748b"
    : PRIORITY_META[score < 35 ? "critical" : score < 55 ? "high" : score < 75 ? "medium" : "low"].color;

const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

function Ring({ score, size = 44, stroke = 4, delay = 0 }: { score: number | null; size?: number; stroke?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = bandColor(score);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-900/[0.07] dark:stroke-white/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 3px ${color}66)` }}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white" style={{ fontSize: size > 60 ? 18 : 11 }}>
        {score === null ? "—" : Math.round(score)}
      </span>
    </span>
  );
}

function PriorityBar({ item }: { item: Pick<HierarchyItem, (typeof KEYS)[number]> }) {
  const total = KEYS.reduce((n, k) => n + (Number(item[k]) || 0), 0);
  return (
    <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-slate-900/[0.05] dark:bg-white/[0.06]">
      {total > 0 &&
        KEYS.map((k) =>
          Number(item[k]) > 0 ? (
            <span key={k} className="h-full rounded-full" style={{ flexGrow: Number(item[k]), background: PRIORITY_META[k].color }} />
          ) : null,
        )}
    </div>
  );
}

export interface ProvinceDistrictsDialogProps {
  open: boolean;
  onClose: () => void;
  province: {
    province: string;
    total: number;
    avgScore: number | null;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  /** Districts (null while loading). */
  districts: HierarchyItem[] | null;
  error?: boolean;
}

/**
 * Glass dialog with a province's summary and one row per district: average
 * School Condition Score ring, school count and priority mix. Districts that
 * need attention most (lowest score) come first.
 */
export function ProvinceDistrictsDialog({ open, onClose, province, districts, error }: ProvinceDistrictsDialogProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rows = [...(districts ?? [])].sort((a, b) => (num(a.avgScore) ?? 101) - (num(b.avgScore) ?? 101));
  const score = province?.avgScore ?? null;

  return createPortal(
    <AnimatePresence>
      {open && province && (
        <motion.div
          className="fixed inset-0 z-[9000] flex items-end justify-center p-3 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close district summary"
            data-tooltip="off"
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm dark:bg-black/50"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${province.province} — districts`}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "relative flex max-h-[min(640px,88dvh)] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem]",
              "bg-white/85 shadow-float backdrop-blur-2xl backdrop-saturate-150 dark:bg-slate-900/80",
            )}
          >
            {/* Header */}
            <div className="relative flex items-center gap-4 px-6 pb-5 pt-6">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl"
                style={{ background: `${bandColor(score)}26` }}
              />
              <Ring score={score} size={72} stroke={6} delay={0.15} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/50">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Province
                </p>
                <h2 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{province.province}</h2>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  {formatNumber(province.total)} {province.total === 1 ? "school" : "schools"} · average condition score
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Province priority mix */}
            <div className="space-y-2 px-6 pb-5">
              <PriorityBar item={province} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-white/55">
                {KEYS.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_META[k].color }} />
                    {PRIORITY_META[k].label}
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-white">{province[k]}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Districts */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-900/[0.025] px-3 py-3 dark:bg-white/[0.02]">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/45">
                Districts {rows.length ? `· ${rows.length}` : ""}{" "}
                <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-white/30">— lowest score first</span>
              </p>

              {error ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-white/50">Couldn&apos;t load the districts. Try again.</p>
              ) : districts === null ? (
                <ul className="space-y-1.5" aria-busy>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                      <span className="h-11 w-11 animate-pulse rounded-full bg-slate-900/[0.06] dark:bg-white/10" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-900/[0.06] dark:bg-white/10" />
                        <span className="block h-1.5 w-full animate-pulse rounded bg-slate-900/[0.05] dark:bg-white/[0.06]" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : rows.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-white/50">No active schools in this province yet.</p>
              ) : (
                <ul className="space-y-1">
                  {rows.map((d, i) => {
                    const s = num(d.avgScore);
                    return (
                      <motion.li
                        key={d.label}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: reduce ? 0 : 0.15 + i * 0.05 }}
                        className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.05]"
                      >
                        <Ring score={s} delay={0.25 + i * 0.05} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-white">{d.label}</span>
                            <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-white/50">
                              {formatNumber(Number(d.total))} {Number(d.total) === 1 ? "school" : "schools"}
                            </span>
                          </div>
                          <PriorityBar item={d} />
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
