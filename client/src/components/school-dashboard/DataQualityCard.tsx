import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  MapPin,
  Minus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber, formatPercent } from "../../lib/format";
import { COMPONENT_ORDER, weightLabel, type ComponentKey } from "../../lib/scoring";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { SchoolMetrics } from "../dashboard/types";
import { GlassCard } from "./GlassCard";
import { BRAND, EASE } from "./tokens";
import { useChartTooltip } from "./charts/useChartTooltip";

const MISSING: Record<ComponentKey, { label: string; fix: string; icon: LucideIcon }> = {
  infrastructure: { label: "Conditions", fix: "Record each building's condition", icon: Building2 },
  buildingAge: { label: "Build years", fix: "Add build years or the founding year", icon: CalendarClock },
  accessibility: { label: "Road access", fix: "Capture the road-status percentage", icon: MapPin },
  population: { label: "Population", fix: "Run a population sync", icon: Users },
  facilityCompliance: { label: "Survey", fix: "Complete the facility survey", icon: ClipboardCheck },
  resolution: { label: "Reports", fix: "Rated once 3 reports are old enough", icon: FileText },
};

const RINGS = [
  { key: "completeness", label: "Profile complete", color: BRAND, r: 42 },
  { key: "coverage", label: "Score measured", color: "#60a5fa", r: 31 },
] as const;

/** Peer benchmark as an arrow pill: ↑ above / ↓ below the area average. */
function Delta({ v, peers, label }: { v: number | null | undefined; peers?: number; label: string }) {
  const Icon = v == null ? Minus : v >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title={v == null ? `${label}: needs 3+ scored peers (${peers ?? 0})` : `${label}: ${v > 0 ? "+" : ""}${v} points`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        v == null
          ? "bg-slate-900/5 text-slate-500 dark:bg-white/6 dark:text-white/50"
          : v >= 0
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            : "bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label} {v == null ? "—" : formatNumber(Math.abs(v), 1)}
    </span>
  );
}

interface Props {
  metrics: SchoolMetrics | null;
  index?: number;
}

/** Two concentric rings (profile completeness, measured share of the score), what to collect, peers. */
export function DataQualityCard({ metrics, index }: Props) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  const values = {
    completeness: metrics?.dataCompletenessScore ?? null,
    coverage: typeof metrics?.dataCoverage === "number" ? Math.round(metrics.dataCoverage * 100) : null,
  };
  const missing = COMPONENT_ORDER.filter((k) => metrics?.dataGaps?.[k]);

  return (
    <GlassCard title="Data quality" icon={Database} tone="text-primary" info={<MetricInfo id="school.dataCompleteness" size="xs" />} index={index}>
      <div className="flex items-center gap-4">
        <div ref={boxRef} className="relative h-26 w-26 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Profile ${values.completeness ?? "—"}% complete; ${values.coverage ?? "—"}% of the score measured`}>
            {RINGS.map((ring, i) => {
              const C = 2 * Math.PI * ring.r;
              const v = values[ring.key] ?? 0;
              return (
                <g key={ring.key}>
                  <circle cx="50" cy="50" r={ring.r} fill="none" strokeWidth="8" className="stroke-slate-900/6 dark:stroke-white/8" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r={ring.r}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    tabIndex={0}
                    className="cursor-pointer outline-none"
                    initial={{ strokeDashoffset: C }}
                    animate={{ strokeDashoffset: C * (1 - v / 100) }}
                    transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.3 + i * 0.15, ease: EASE }}
                    {...bind(
                      <span>
                        {ring.label}: <b>{values[ring.key] == null ? "—" : `${values[ring.key]}%`}</b>
                      </span>,
                    )}
                  />
                </g>
              );
            })}
          </svg>
          {tooltip}
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {RINGS.map((ring) => (
            <li key={ring.key} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ring.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-white/60">{ring.label}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                {values[ring.key] == null ? "—" : formatPercent(values[ring.key])}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        {missing.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> All measured
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Missing data to collect">
            {missing.map((k) => {
              const M = MISSING[k];
              return (
                <li
                  key={k}
                  title={M.fix}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                >
                  <M.icon className="h-3 w-3" aria-hidden />
                  {M.label}
                  <span className="opacity-60">{weightLabel(k, metrics?.scoringModel)}</span>
                  <span className="sr-only">: {M.fix}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <Delta v={metrics?.scoreDeltaFromDistrict} peers={metrics?.districtPeerCount} label="District" />
        <Delta v={metrics?.scoreDeltaFromProvince} peers={metrics?.provincePeerCount} label="Province" />
        <MetricInfo id="school.peerDelta" size="xs" />
      </div>
    </GlassCard>
  );
}
