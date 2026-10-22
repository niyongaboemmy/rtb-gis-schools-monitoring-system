import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatArea, formatDate, formatNumber } from "../../../lib/format";
import { label } from "../../../lib/labels";
import { MetricInfo } from "../../metric-help/MetricInfo";
import type { FacilityBuilding, SchoolMetrics } from "../../dashboard/types";
import { CONDITIONS, type ConditionKey } from "../status-colors";
import { StackBar } from "../charts/StackBar";
import { EASE } from "../tokens";
import { DetailSection, EmptyNote, FilterChips, StatusPill, SummaryStat, SummaryStats } from "./primitives";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const conditionOf = (b: FacilityBuilding): ConditionKey => {
  const c = String(b.condition ?? "").toLowerCase();
  return (CONDITIONS.some((x) => x.key === c) ? c : "none") as ConditionKey;
};

/** Worst first, unassessed last. */
const RANK: Record<ConditionKey, number> = { critical: 0, poor: 1, fair: 2, good: 3, none: 4 };
const META = Object.fromEntries(CONDITIONS.map((c) => [c.key, c])) as Record<ConditionKey, (typeof CONDITIONS)[number]>;

/** Header figures. Counts by condition are of the records shown below. */
export function BuildingsSummary({ buildings, metrics }: { buildings: FacilityBuilding[]; metrics: SchoolMetrics | null }) {
  const total = metrics?.buildingCount ?? buildings.length;
  const assessed = metrics?.assessedBuildingCount ?? buildings.filter((b) => conditionOf(b) !== "none").length;
  const needWork = buildings.filter((b) => ["poor", "critical"].includes(conditionOf(b))).length;
  return (
    <SummaryStats>
      <SummaryStat label="Buildings" value={formatNumber(total)} hint="on record" info={<MetricInfo id="school.buildingCount" size="xs" />} />
      <SummaryStat
        label="Assessed"
        value={`${formatNumber(assessed)} of ${formatNumber(total)}`}
        hint="feed the infrastructure score"
        meter={total ? (assessed / total) * 100 : null}
      />
      <SummaryStat label="Need work" value={formatNumber(needWork)} hint="poor or critical" accent={needWork ? META.critical.color : META.good.color} />
      <SummaryStat
        label="Average age"
        value={metrics?.avgBuildingAge == null ? "—" : `${formatNumber(metrics.avgBuildingAge)} yrs`}
        hint={metrics?.avgBuildingYear == null ? "build years not recorded" : `built around ${metrics.avgBuildingYear}`}
      />
    </SummaryStats>
  );
}

interface Props {
  buildings: FacilityBuilding[];
  /** Opens the building on the map (the dialog closes first). */
  onBuildingClick?: (b: FacilityBuilding) => void;
}

/** Condition mix (also the filter) and every building, worst first. */
export function BuildingsDetail({ buildings, onBuildingClick }: Props) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<ConditionKey | "all">("all");
  const counts = useMemo(() => {
    const c = Object.fromEntries(CONDITIONS.map((x) => [x.key, 0])) as Record<ConditionKey, number>;
    buildings.forEach((b) => c[conditionOf(b)]++);
    return c;
  }, [buildings]);
  const sorted = useMemo(
    () =>
      [...buildings]
        .filter((b) => filter === "all" || conditionOf(b) === filter)
        .sort((a, b) => RANK[conditionOf(a)] - RANK[conditionOf(b)] || String(a.name ?? "").localeCompare(String(b.name ?? ""))),
    [buildings, filter],
  );

  if (buildings.length === 0) {
    return (
      <EmptyNote title="No buildings recorded yet">
        Add buildings from the school's 2D map, or upload a site map (KMZ). Until then the Infrastructure part of the score is estimated.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-7">
      <DetailSection title="By condition" aside={<MetricInfo id="component.infrastructure" size="xs" />}>
        <StackBar
          max={buildings.length}
          height={12}
          ariaLabel="Buildings by condition"
          segments={CONDITIONS.map((c) => ({
            key: c.key,
            value: counts[c.key],
            color: c.color,
            textured: c.key === "none",
            tip: (
              <span>
                {c.label}: <b>{formatNumber(counts[c.key])}</b>
              </span>
            ),
          }))}
        />
        <FilterChips<ConditionKey | "all">
          ariaLabel="Filter by condition"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: buildings.length },
            ...CONDITIONS.filter((c) => counts[c.key] > 0).map((c) => ({ key: c.key, label: c.label, count: counts[c.key], color: c.color })),
          ]}
        />
      </DetailSection>

      <ul className="grid gap-2.5 md:grid-cols-2">
        {sorted.map((b, i) => {
          const c = META[conditionOf(b)];
          const year = num(b.yearBuilt);
          const floors = num(b.floors);
          const area = num(b.areaSquareMeters);
          const facts = [
            year ? `Built ${year}` : "Year unknown",
            floors ? `${formatNumber(floors)} floor${floors === 1 ? "" : "s"}` : null,
            area ? formatArea(area) : null,
            b.roofCondition ? `Roof ${label("roofCondition", b.roofCondition).toLowerCase()}` : null,
          ].filter(Boolean) as string[];
          const body = (
            <>
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${c.color} 14%, transparent)`, color: c.color }}
                aria-hidden
              >
                <Building2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-white">{b.name || "Unnamed building"}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-white/50">{b.function || "Use not recorded"}</span>
                  </span>
                  <StatusPill color={c.color}>{c.label}</StatusPill>
                </span>
                <span className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-white/50">
                  {facts.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                  <span>{b.lastInspectionDate ? `Inspected ${formatDate(b.lastInspectionDate)}` : "Not inspected yet"}</span>
                </span>
              </span>
              {onBuildingClick && <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />}
            </>
          );
          const cls =
            "group flex w-full items-start gap-3 rounded-2xl bg-slate-900/[0.025] p-3 text-left ring-1 ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8";
          return (
            <motion.li
              key={b.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
            >
              {onBuildingClick ? (
                <button
                  type="button"
                  onClick={() => onBuildingClick(b)}
                  aria-label={`${b.name || "Unnamed building"}, ${c.label}: show on map`}
                  className={cn(cls, "transition-colors hover:bg-slate-900/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:bg-white/[0.07]")}
                >
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
