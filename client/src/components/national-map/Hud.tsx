import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Map as MapIcon, Radar, RotateCcw, Ruler, Shapes, Undo2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatArea, formatLength, formatNumber } from "../../lib/format";
import { PRIORITY_META } from "../maps/schoolMap";
import { pathLength, polygonArea, type LatLng } from "./geo";
import type { PlottedSchool, ToolMode } from "./types";
import { EASE, GLASS, GLASS_STRONG, MUTED, STRONG } from "./tokens";
import { IconButton, ScoreRing } from "./ui";

/** Large areas read better in km² than in hectares. */
const areaText = (sqm: number) => (sqm >= 1_000_000 ? `${formatNumber(sqm / 1_000_000, 2)} km²` : formatArea(sqm));

const TOOL_META = {
  distance: { icon: Ruler, title: "Measure distance", hint: "Click the map or a school to add points" },
  area: { icon: Shapes, title: "Measure area", hint: "Click at least three points to close a shape" },
  nearest: { icon: Radar, title: "Nearest schools", hint: "Click anywhere to find the five closest schools" },
} as const;

/** Readout for the active map tool (distance / area / nearest). */
export function ToolHud({
  tool,
  points,
  nearest,
  onUndo,
  onClear,
  onExit,
  onPick,
  className,
}: {
  tool: Exclude<ToolMode, "none">;
  points: LatLng[];
  nearest: { point: PlottedSchool; meters: number }[];
  onUndo: () => void;
  onClear: () => void;
  onExit: () => void;
  onPick: (p: PlottedSchool) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const meta = TOOL_META[tool];
  const Icon = meta.icon;
  const value =
    tool === "distance"
      ? points.length > 1
        ? formatLength(pathLength(points))
        : null
      : tool === "area"
        ? points.length > 2
          ? areaText(polygonArea(points))
          : null
        : null;
  const perimeter = tool === "area" && points.length > 2 ? formatLength(pathLength([...points, points[0]])) : null;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn("pointer-events-auto w-full max-w-sm overflow-hidden rounded-[1.5rem]", GLASS_STRONG, className)}
    >
      <div className="flex items-center gap-3 p-2 pl-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[13px] tabular-nums", STRONG)}>
            {value ?? meta.title}
          </p>
          <p className={cn("truncate text-xs", MUTED)}>
            {perimeter
              ? `Perimeter ${perimeter} · ${points.length} points`
              : tool !== "nearest" && points.length > 0
                ? `${points.length} ${points.length === 1 ? "point" : "points"} · Esc to finish`
                : meta.hint}
          </p>
        </div>
        {tool !== "nearest" && points.length > 0 && <IconButton icon={Undo2} label="Undo last point" size="sm" onClick={onUndo} />}
        {points.length > 0 && <IconButton icon={RotateCcw} label="Clear" size="sm" onClick={onClear} />}
        <IconButton icon={X} label="Exit tool (Esc)" size="sm" onClick={onExit} />
      </div>
      {tool === "nearest" && nearest.length > 0 && (
        <ul className="custom-scrollbar max-h-64 overflow-y-auto px-2 pb-2">
          {nearest.map(({ point, meters }, i) => (
            <li key={point.school.id}>
              <button
                type="button"
                onClick={() => onPick(point)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]"
              >
                <span className={cn("w-4 text-center text-xs tabular-nums", MUTED)}>{i + 1}</span>
                <ScoreRing score={point.score} size={30} stroke={3} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px]", STRONG)}>{point.school.name}</span>
                  <span className={cn("block truncate text-xs", MUTED)}>{point.school.district}</span>
                </span>
                <span className={cn("shrink-0 text-xs tabular-nums", STRONG)}>{formatLength(meters)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

/** Priority legend with live counts. Each band is a toggle (filters the map,
 *  keys 1–4) and hovering one spotlights its schools. */
export function Legend({
  counts,
  unassessed,
  density,
  clusters,
  active,
  onToggle,
  onFocusBand,
  className,
}: {
  counts: Record<string, number>;
  unassessed: number;
  density: boolean;
  clusters: boolean;
  /** Bands the filter keeps; empty = all. */
  active: Set<string>;
  onToggle: (band: string) => void;
  onFocusBand: (band: string | null) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const filtering = active.size > 0;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn("pointer-events-auto rounded-2xl px-2.5 py-2", GLASS, className)}
      aria-label="Legend"
      role="group"
      onPointerLeave={() => onFocusBand(null)}
    >
      <p className={cn("px-1 pb-1 text-[11px]", MUTED)}>
        Intervention priority <span className="opacity-60">· click to filter</span>
      </p>
      <ul className="flex flex-wrap items-center gap-0.5">
        {(["critical", "high", "medium", "low"] as const).map((k, i) => {
          const on = !filtering || active.has(k);
          return (
            <li key={k}>
              <button
                type="button"
                aria-pressed={filtering && active.has(k)}
                title={`${filtering && active.has(k) ? "Show all bands" : `Show only ${PRIORITY_META[k].label.toLowerCase()}`} · key ${i + 1}`}
                onClick={() => onToggle(k)}
                onPointerEnter={() => onFocusBand(k)}
                onFocus={() => onFocusBand(k)}
                onBlur={() => onFocusBand(null)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-[background-color,opacity] duration-200 hover:bg-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.07]",
                  filtering && active.has(k) && "bg-slate-900/[0.06] dark:bg-white/[0.08]",
                  !on && "opacity-40",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_META[k].color, boxShadow: `0 0 8px ${PRIORITY_META[k].ring}` }} />
                <span className="text-slate-700 dark:text-white/75">{PRIORITY_META[k].label}</span>
                <span className={cn("tabular-nums", MUTED)}>{formatNumber(counts[k] ?? 0)}</span>
              </button>
            </li>
          );
        })}
        {unassessed > 0 && (
          <li className="flex items-center gap-1.5 px-2 py-1 text-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
            <span className="text-slate-700 dark:text-white/75">Not assessed</span>
            <span className={cn("tabular-nums", MUTED)}>{formatNumber(unassessed)}</span>
          </li>
        )}
      </ul>
      {(density || clusters) && (
        <p className={cn("px-1 pt-1 text-[11px]", MUTED)}>
          {clusters && "Rings show the priority mix of grouped schools. "}
          {density && "Glow = schools within ~9 km."}
        </p>
      )}
    </motion.div>
  );
}

/** Centered glass state card (loading / error / empty) over the map. */
export function MapStateCard({
  kind,
  title,
  description,
  onRetry,
}: {
  kind: "loading" | "error" | "empty";
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role={kind === "error" ? "alert" : "status"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn("pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-[1.75rem] px-7 py-6 text-center", GLASS_STRONG)}
    >
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          kind === "error" ? "bg-red-500/12 text-red-500" : "bg-primary/10 text-primary",
        )}
      >
        {kind === "loading" ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden />
        ) : kind === "error" ? (
          <AlertTriangle className="h-5 w-5" aria-hidden />
        ) : (
          <MapIcon className="h-5 w-5" aria-hidden />
        )}
      </span>
      <p className={cn("text-[13px] font-semibold", STRONG)}>{title}</p>
      {description && <p className={cn("text-xs leading-relaxed", MUTED)}>{description}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-1 rounded-full bg-primary px-4 py-2 text-[13px] text-primary-foreground">
          Try again
        </button>
      )}
    </motion.div>
  );
}
