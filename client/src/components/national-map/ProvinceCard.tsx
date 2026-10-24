import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, ListFilter, Loader2, MapPin, X } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { formatNumber } from "../../lib/format";
import { PRIORITY_META } from "../maps/schoolMap";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { HierarchyItem } from "../dashboard/types";
import type { ProvinceSummary } from "./types";
import { EASE, MUTED, STRONG, scoreColor } from "./tokens";
import { MixRing, ScoreRing } from "./ui";

const KEYS = ["critical", "high", "medium", "low"] as const;
const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

/** Districts per province, fetched once per session. */
const districtCache = new Map<string, HierarchyItem[]>();

export interface ProvinceCardProps {
  summary: ProvinceSummary;
  district: string;
  onDistrict: (d: string) => void;
  onShowList: () => void;
  onClear: () => void;
  onClose: () => void;
  hideClose?: boolean;
  /** Without analytics access: district rows computed from the loaded schools. */
  localDistricts?: HierarchyItem[] | null;
}

/**
 * Province summary: average School Condition Score ring, priority mix, and
 * an on-demand district breakdown (server aggregates from /analytics/hierarchy).
 * Clicking a district filters the map to it.
 */
export function ProvinceCardBody({
  summary,
  district,
  onDistrict,
  onShowList,
  onClear,
  onClose,
  hideClose,
  localDistricts,
}: ProvinceCardProps) {
  const reduce = useReducedMotion();
  const [districts, setDistricts] = useState<HierarchyItem[] | null>(() => districtCache.get(summary.province) ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [shownFor, setShownFor] = useState(summary.province);

  // A different province: reset the breakdown (derived-state pattern).
  if (shownFor !== summary.province) {
    setShownFor(summary.province);
    setDistricts(districtCache.get(summary.province) ?? null);
    setError(false);
  }

  const loadDistricts = async () => {
    if (localDistricts) {
      setDistricts([...localDistricts].sort((a, b) => (num(a.avgScore) ?? 101) - (num(b.avgScore) ?? 101)));
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ items?: HierarchyItem[] }>("/analytics/hierarchy", {
        params: { province: summary.province },
      });
      const items = [...(res.data.items ?? [])].sort((a, b) => (num(a.avgScore) ?? 101) - (num(b.avgScore) ?? 101));
      districtCache.set(summary.province, items);
      setDistricts(items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const counts = { critical: summary.critical, high: summary.high, medium: summary.medium, low: summary.low };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex items-center gap-4 px-5 pb-4 pt-4">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl"
          style={{ background: `${scoreColor(summary.avgScore)}26` }}
        />
        <ScoreRing score={summary.avgScore} size={68} stroke={6} delay={0.1} />
        <div className="relative min-w-0 flex-1">
          <p className={cn("flex items-center gap-1.5 text-xs", MUTED)}>
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Province
            <MetricInfo id="national.avgConditionScore" size="xs" />
          </p>
          <h2 className={cn("truncate text-base font-semibold tracking-tight", STRONG)}>{summary.province}</h2>
          <p className={cn("text-xs", MUTED)}>
            Average condition score · {formatNumber(summary.total)} {summary.total === 1 ? "school" : "schools"}
          </p>
        </div>
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close province summary"
            className={cn("relative -mr-1 self-start rounded-full p-2 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/10", MUTED)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5">
        {/* Priority mix */}
        <div className="flex items-center gap-4 rounded-2xl bg-slate-900/[0.035] p-3 dark:bg-white/[0.04]">
          <MixRing counts={counts} size={56} stroke={6}>
            <span className="flex flex-col items-center leading-none">
              {summary.total}
              <span className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">{summary.total === 1 ? "school" : "schools"}</span>
            </span>
          </MixRing>
          <ul className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
            {KEYS.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[k].color }} />
                <span className={MUTED}>{PRIORITY_META[k].label}</span>
                <span className={cn("ml-auto tabular-nums", STRONG)}>{counts[k]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShowList}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[15px] text-primary-foreground transition-transform hover:-translate-y-px motion-reduce:hover:translate-y-0"
          >
            <ListFilter className="h-4 w-4" aria-hidden /> List its schools
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900/[0.06] px-4 text-[15px] text-slate-800 hover:bg-slate-900/10 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.14]"
          >
            Clear
          </button>
        </div>

        {/* Districts */}
        {districts === null ? (
          <button
            type="button"
            onClick={() => void loadDistricts()}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-2xl bg-slate-900/[0.035] px-4 py-3 text-left text-[15px] text-slate-800 transition-colors hover:bg-slate-900/[0.06] dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
          >
            {error ? "Couldn't load the districts — try again" : "View districts"}
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
          </button>
        ) : districts.length === 0 ? (
          <p className={cn("py-4 text-center text-[15px]", MUTED)}>No active schools in this province yet.</p>
        ) : (
          <div>
            <p className={cn("pb-1.5 text-xs", MUTED)}>
              Districts · {districts.length} <span className="font-normal opacity-75">— lowest score first, click to filter</span>
            </p>
            <ul className="space-y-0.5">
              {districts.map((d, i) => {
                const active = district === d.label;
                return (
                  <motion.li
                    key={d.label}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.04, ease: EASE }}
                  >
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onDistrict(active ? "" : d.label)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors",
                        active ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]",
                      )}
                    >
                      <ScoreRing score={num(d.avgScore)} size={34} stroke={3.5} delay={0.1 + i * 0.04} />
                      <span className={cn("min-w-0 flex-1 truncate text-[15px]", STRONG)}>{d.label}</span>
                      <MixRing counts={{ critical: d.critical, high: d.high, medium: d.medium, low: d.low }} size={22} stroke={4} />
                      <span className={cn("w-16 shrink-0 text-right text-xs tabular-nums", MUTED)}>
                        {formatNumber(Number(d.total))} {Number(d.total) === 1 ? "school" : "schools"}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
