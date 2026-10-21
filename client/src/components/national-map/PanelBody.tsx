import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpDown, ChevronDown, Eye, SearchX, SlidersHorizontal, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber } from "../../lib/format";
import { PRIORITY_META, priorityMeta } from "../maps/schoolMap";
import { FULL_RANGE, isFullRange, normProvince, type ScoreRange } from "./geo";
import { ScoreRangeSlider } from "./ScoreRangeSlider";
import { SORT_OPTIONS, type PlottedSchool, type SortKey } from "./types";
import { EASE, MUTED, STRONG } from "./tokens";
import { ScoreRing } from "./ui";

const KEYS = ["critical", "high", "medium", "low"] as const;
/** "Eastern Province" → "Eastern", "Kigali City" → "Kigali". */
const shortProvince = (name: string) => name.replace(/\s+(Province|City)$/i, "");
const PAGE = 60;

export interface PanelBodyProps {
  loading: boolean;
  total: number;
  filteredCount: number;
  inViewCount: number;
  avgScore: number | null;
  scoredCount: number;
  priorityCounts: Record<string, number>;
  priorities: Set<string>;
  onTogglePriority: (key: string) => void;
  /** Every province on the map, with how many schools it has. */
  provinceChips: { name: string; count: number }[];
  province: string;
  onProvince: (p: string) => void;
  /** Pointer / focus over a province chip: the map lights it up. */
  onPreviewProvince: (p: string | null) => void;
  /** Pointer / focus over a priority chip: the map spotlights that band. */
  onFocusBand: (band: string | null) => void;
  districts: string[];
  district: string;
  onDistrict: (d: string) => void;
  range: ScoreRange;
  onRange: (r: ScoreRange) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  inViewOnly: boolean;
  onInViewOnly: (v: boolean) => void;
  list: PlottedSchool[];
  selectedId: string | null;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (p: PlottedSchool) => void;
  activeFilters: number;
  onReset: () => void;
  /** Bottom sheet: collapse the filter block behind a disclosure. */
  compact?: boolean;
}

const SELECT =
  "h-10 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-900/[0.05] pl-4 pr-9 text-[13px] text-slate-900 outline-none transition-colors hover:bg-slate-900/[0.07] focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.07] dark:text-white dark:hover:bg-white/[0.1] [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-white";

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        {children}
      </select>
      <ChevronDown className={cn("pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2", MUTED)} aria-hidden />
    </label>
  );
}

/** Summary, filters and the synced school list (shared by side panel and bottom sheet).
 *  The list owns the height: summary is one line, filters fold behind one
 *  button, and what's active shows as removable pills. */
export function PanelBody(p: PanelBodyProps) {
  const reduce = useReducedMotion();
  const [limit, setLimit] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  // Keep the selected row in view when the selection comes from the map.
  useEffect(() => {
    if (!p.selectedId) return;
    rowRefs.current.get(p.selectedId)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [p.selectedId, reduce]);

  const shown = p.list.slice(0, limit);

  // Active filters as pills (each one removable on its own).
  const pills: { key: string; label: ReactNode; onRemove: () => void }[] = [
    ...KEYS.filter((k) => p.priorities.has(k)).map((k) => ({
      key: `prio-${k}`,
      label: (
        <>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_META[k].color }} />
          {PRIORITY_META[k].label}
        </>
      ),
      onRemove: () => p.onTogglePriority(k),
    })),
    ...(p.province ? [{ key: "prov", label: shortProvince(p.province), onRemove: () => p.onProvince("") }] : []),
    ...(p.district ? [{ key: "dist", label: p.district, onRemove: () => p.onDistrict("") }] : []),
    ...(isFullRange(p.range)
      ? []
      : [{ key: "range", label: `Score ${p.range[0]}–${p.range[1]}`, onRemove: () => p.onRange(FULL_RANGE) }]),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Summary: one line */}
      <div className="flex items-center gap-3 px-5 pb-3">
        <ScoreRing
          score={p.loading ? null : p.avgScore}
          size={38}
          stroke={3.5}
          delay={0.2}
          label={p.avgScore === null ? "Average score not available" : `Average condition score ${Math.round(p.avgScore)}`}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className={cn("text-[13px] tabular-nums", STRONG)}>
            {p.loading ? "Loading…" : formatNumber(p.filteredCount)}{" "}
            {!p.loading && (p.filteredCount === 1 ? "school" : "schools")}
            {!p.loading && p.filteredCount !== p.total && <span className={MUTED}> of {formatNumber(p.total)}</span>}
          </p>
          <p className={cn("truncate text-[11px] tabular-nums", MUTED)}>
            {p.avgScore !== null && `Avg ${Math.round(p.avgScore)} · `}
            {formatNumber(p.inViewCount)} in view · {formatNumber(p.scoredCount)} assessed
          </p>
        </div>
      </div>

      {/* Toolbar: filters · sort · in view */}
      <div className="flex items-center gap-1.5 px-4 pb-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="map-panel-filters"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            filtersOpen
              ? "bg-slate-900/[0.08] text-slate-900 dark:bg-white/[0.12] dark:text-white"
              : "bg-slate-900/[0.04] text-slate-700 hover:bg-slate-900/[0.07] dark:bg-white/[0.06] dark:text-white/80 dark:hover:bg-white/[0.1]",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
          {p.activeFilters > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] tabular-nums text-primary-foreground">
              {p.activeFilters}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", filtersOpen && "rotate-180")} aria-hidden />
        </button>

        <label className="relative ml-auto min-w-0">
          <span className="sr-only">Sort schools</span>
          <select
            aria-label="Sort schools"
            value={p.sort}
            onChange={(e) => p.onSort(e.target.value as SortKey)}
            className={cn(
              "h-8 max-w-[8.5rem] cursor-pointer appearance-none truncate rounded-full bg-transparent pl-3 pr-7 text-xs outline-none transition-colors hover:bg-slate-900/[0.05] focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.07] [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-white",
              "text-slate-700 dark:text-white/80",
            )}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ArrowUpDown className={cn("pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2", MUTED)} aria-hidden />
        </label>

        <button
          type="button"
          aria-pressed={p.inViewOnly}
          onClick={() => p.onInViewOnly(!p.inViewOnly)}
          title="Only list schools visible on the map"
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            p.inViewOnly
              ? "bg-primary text-primary-foreground"
              : "text-slate-700 hover:bg-slate-900/[0.05] dark:text-white/80 dark:hover:bg-white/[0.07]",
          )}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          In view
        </button>
      </div>

      {/* Active filters */}
      {pills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-4 pb-2">
          {pills.map((f) => (
            <span
              key={f.key}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/10 pl-2.5 pr-1 text-[11px] text-slate-800 dark:bg-primary/20 dark:text-white/90"
            >
              {f.label}
              <button
                type="button"
                onClick={f.onRemove}
                aria-label="Remove filter"
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-900/10 dark:hover:bg-white/15"
              >
                <X className="h-2.5 w-2.5" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={p.onReset} className="ml-1 rounded-full px-1.5 text-[11px] text-primary hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Filters drawer */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            id="map-panel-filters"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="shrink-0 overflow-hidden"
          >
            <div className="mx-4 mb-2 space-y-3 rounded-2xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.03]">
              <FilterGroup label="Priority" onPointerLeave={() => p.onFocusBand(null)}>
                {KEYS.map((key) => {
                  const meta = PRIORITY_META[key];
                  const on = p.priorities.has(key);
                  return (
                    <Chip
                      key={key}
                      on={on}
                      dim={p.priorities.size > 0 && !on}
                      aria-pressed={on}
                      onClick={() => p.onTogglePriority(key)}
                      onPointerEnter={() => p.onFocusBand(key)}
                      onFocus={() => p.onFocusBand(key)}
                      onBlur={() => p.onFocusBand(null)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                      <span className="tabular-nums opacity-55">{p.priorityCounts[key] ?? 0}</span>
                    </Chip>
                  );
                })}
              </FilterGroup>

              <FilterGroup label="Province" onPointerLeave={() => p.onPreviewProvince(null)}>
                {[{ name: "", count: p.total }, ...p.provinceChips].map((c) => {
                  const on = c.name ? normProvince(p.province) === normProvince(c.name) : !p.province;
                  return (
                    <Chip
                      key={c.name || "all"}
                      on={on}
                      aria-pressed={on}
                      onClick={() => p.onProvince(on && c.name ? "" : c.name)}
                      onPointerEnter={() => p.onPreviewProvince(c.name || null)}
                      onFocus={() => p.onPreviewProvince(c.name || null)}
                      onBlur={() => p.onPreviewProvince(null)}
                    >
                      {c.name ? shortProvince(c.name) : "All"}
                      <span className="tabular-nums opacity-55">{formatNumber(c.count)}</span>
                    </Chip>
                  );
                })}
              </FilterGroup>

              {p.districts.length > 0 && (
                <Select label="District" value={p.district} onChange={p.onDistrict}>
                  <option value="">All districts</option>
                  {p.districts.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </Select>
              )}
              <ScoreRangeSlider value={p.range} onCommit={p.onRange} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="custom-scrollbar mx-2 mb-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[1.25rem] bg-slate-900/[0.035] p-1.5 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)] dark:bg-black/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" aria-label="Schools" role="list">
        {p.loading ? (
          <ul className="space-y-1 px-2 pt-1" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="h-8 w-8 animate-pulse rounded-full bg-slate-900/[0.06] motion-reduce:animate-none dark:bg-white/10" />
                <span className="flex-1 space-y-1.5">
                  <span className="block h-3 w-2/3 animate-pulse rounded-full bg-slate-900/[0.06] motion-reduce:animate-none dark:bg-white/10" />
                  <span className="block h-2.5 w-1/3 animate-pulse rounded-full bg-slate-900/[0.05] motion-reduce:animate-none dark:bg-white/[0.06]" />
                </span>
              </li>
            ))}
          </ul>
        ) : p.list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/[0.05] dark:bg-white/[0.06]">
              <SearchX className={cn("h-5 w-5", MUTED)} aria-hidden />
            </span>
            <p className={cn("text-[13px]", STRONG)}>
              {p.inViewOnly && p.filteredCount > 0 ? "No schools in this part of the map" : "No schools match these filters"}
            </p>
            <p className={cn("text-xs", MUTED)}>
              {p.inViewOnly && p.filteredCount > 0 ? "Zoom out or turn off “In view only”." : "Try widening the score range or clearing a filter."}
            </p>
            <div className="flex gap-2">
              {p.inViewOnly && (
                <button type="button" onClick={() => p.onInViewOnly(false)} className="rounded-full bg-slate-900/[0.05] px-3 py-1.5 text-xs hover:bg-slate-900/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                  Show all
                </button>
              )}
              {p.activeFilters > 0 && (
                <button type="button" onClick={p.onReset} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                  Reset filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {shown.map((pt) => {
              const s = pt.school;
              const m = priorityMeta(pt.priority);
              const active = s.id === p.selectedId;
              const hover = s.id === p.hoverId;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(s.id, el);
                    else rowRefs.current.delete(s.id);
                  }}
                  type="button"
                  role="listitem"
                  aria-current={active || undefined}
                  data-tooltip="off"
                  onClick={() => p.onSelect(pt)}
                  onMouseEnter={() => p.onHover(s.id)}
                  onMouseLeave={() => p.onHover(null)}
                  onFocus={() => p.onHover(s.id)}
                  onBlur={() => p.onHover(null)}
                  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 46px" }}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary/10 dark:bg-primary/20"
                      : hover
                        ? "bg-slate-900/[0.04] dark:bg-white/[0.06]"
                        : "hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]",
                  )}
                >
                  <ScoreRing score={pt.score} size={30} stroke={3} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px]", STRONG)}>{s.name}</span>
                    <span className={cn("flex items-center gap-1.5 truncate text-[11px]", MUTED)}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color }} />
                      {m.label} · {s.district}
                    </span>
                  </span>
                </button>
              );
            })}
            {p.list.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mx-auto mt-2 block rounded-full bg-slate-900/[0.05] px-4 py-2 text-xs text-slate-700 hover:bg-slate-900/10 dark:bg-white/[0.07] dark:text-white/80 dark:hover:bg-white/[0.12]"
              >
                Show {formatNumber(Math.min(PAGE, p.list.length - limit))} more of {formatNumber(p.list.length - limit)}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Labelled row of chips inside the filters drawer. */
function FilterGroup({ label, children, onPointerLeave }: { label: string; children: ReactNode; onPointerLeave?: () => void }) {
  return (
    <div>
      <p className={cn("pb-1.5 text-[11px]", MUTED)}>{label}</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label} onPointerLeave={onPointerLeave}>
        {children}
      </div>
    </div>
  );
}

function Chip({
  on,
  dim,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean; dim?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-[background-color,color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on
          ? "bg-primary text-primary-foreground"
          : "bg-white/60 text-slate-700 hover:bg-white dark:bg-white/[0.05] dark:text-white/80 dark:hover:bg-white/[0.1]",
        dim && "opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
