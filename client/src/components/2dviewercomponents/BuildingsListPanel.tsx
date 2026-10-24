import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, ChevronRight, Images, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import type { BuildingData } from "../school-form-steps/BuildingsStep";
import { cn } from "../../lib/utils";
import { formatArea } from "../../lib/format";
import { EASE } from "../school-dashboard/tokens";
import type { BuildingReportCount } from "./hooks/useSchoolReports";
import { buildingArea, buildingCode, buildingCondition, buildingFunction, buildingInitials, buildingName } from "./building-utils";

interface BuildingsListPanelProps {
  buildings: BuildingData[];
  onClose: () => void;
  onSelect: (building: BuildingData) => void;
  onDelete: (id: string) => Promise<void>;
  onAdd?: () => void;
  selectedId?: string;
  /** Open reports per building (map badges use the same numbers). */
  counts?: Map<string, BuildingReportCount>;
  /** Show add / delete (defaults to true for callers that gate elsewhere). */
  canEdit?: boolean;
  /** Open the school-wide photo gallery. */
  onGallery?: () => void;
}

type Filter = "all" | "reports";

/** The school's buildings: search, open reports per building, add and remove. */
export const BuildingsListPanel: React.FC<BuildingsListPanelProps> = ({
  buildings,
  onClose,
  onSelect,
  onDelete,
  onAdd,
  selectedId,
  counts,
  canEdit = true,
  onGallery,
}) => {
  const reduce = useReducedMotion();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(String(selectedId))}"]`)?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const withReports = counts ? buildings.filter((b) => (counts.get(String(b.id))?.open ?? 0) > 0).length : 0;
  const activeFilter: Filter = withReports === 0 ? "all" : filter;
  const q = query.trim().toLowerCase();
  const rows = buildings.filter((b) => {
    if (activeFilter === "reports" && !(counts?.get(String(b.id))?.open ?? 0)) return false;
    if (!q) return true;
    return [buildingName(b), buildingCode(b), buildingFunction(b)].some((v) => v?.toLowerCase().includes(q));
  });

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      await onDelete(id);
      setConfirm(null);
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(null);
    }
  };

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white";

  return (
    <motion.section
      aria-label="Buildings"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "fixed z-40 flex flex-col overflow-hidden",
        "bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10",
        "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
        "inset-x-0 bottom-0 h-[64dvh] rounded-t-[1.75rem]",
        // Desktop: just left of the tool rail, whatever its width.
        "md:inset-auto md:right-[calc(var(--map-rail-w,3.5rem)+1.5rem)] md:top-4 md:h-auto md:max-h-[calc(100vh-2rem)] md:w-84 md:rounded-[1.5rem]",
      )}
    >
      <div className="flex shrink-0 justify-center pb-1 pt-2.5 md:hidden" aria-hidden>
        <div className="h-1.5 w-10 rounded-full bg-slate-300/80 dark:bg-white/15" />
      </div>

      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-2 md:pt-4">
        <h2 className="flex-1 pl-1 text-[15px] font-medium text-slate-900 dark:text-white">
          Buildings <span className="text-sm tabular-nums text-slate-400 dark:text-white/40">{buildings.length}</span>
        </h2>
        {onGallery && (
          <button type="button" onClick={onGallery} aria-label="Gallery" title="Gallery" className={iconBtn}>
            <Images className="h-4 w-4" aria-hidden />
          </button>
        )}
        {onAdd && canEdit && (
          <motion.button
            type="button"
            onClick={onAdd}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            aria-label="Add building"
            title="Add building"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </motion.button>
        )}
        <button type="button" onClick={onClose} aria-label="Close buildings list" className={iconBtn}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {/* Search + filter */}
      <div className="shrink-0 space-y-2 px-4 pb-3">
        <label className="relative block">
          <span className="sr-only">Search buildings</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-white/35" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-full bg-slate-900/[0.04] pl-8.5 pr-8 text-[15px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-white/6 dark:text-white dark:placeholder:text-white/35 dark:focus:bg-white/8"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </label>
        {withReports > 0 && (
          <div role="group" aria-label="Show" className="flex gap-1.5">
            {(
              [
                ["all", "All", buildings.length],
                ["reports", "With reports", withReports],
              ] as const
            ).map(([k, l, n]) => (
              <button
                key={k}
                type="button"
                aria-pressed={activeFilter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
                  activeFilter === k ? "bg-primary text-white" : "bg-slate-900/[0.04] text-slate-600 hover:bg-slate-900/[0.08] dark:bg-white/6 dark:text-white/65 dark:hover:bg-white/10",
                )}
              >
                {k === "reports" && <span className={cn("h-1.5 w-1.5 rounded-full", activeFilter === k ? "bg-white" : "bg-primary")} aria-hidden />}
                {l}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <ul ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3 custom-scrollbar">
        {rows.length === 0 ? (
          <li className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
            <Building2 className="h-6 w-6 text-slate-300 dark:text-white/25" aria-hidden />
            <p className="text-[15px] text-slate-700 dark:text-white/80">{q ? "No match" : "No buildings yet"}</p>
            <p className="text-xs text-slate-500 dark:text-white/45">{q ? "Try another name." : canEdit && onAdd ? "Tap + to draw one on the map." : "Buildings appear once mapped."}</p>
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {rows.map((b, i) => {
              const id = String(b.id);
              const c = counts?.get(id);
              const cond = buildingCondition(b).overall;
              const on = selectedId != null && String(selectedId) === id;
              const area = buildingArea(b);
              const fn = buildingFunction(b);
              const asking = confirm === id;
              return (
                <motion.li
                  key={id}
                  data-id={id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -16 }}
                  transition={{ duration: 0.28, delay: Math.min(i * 0.025, 0.25), ease: EASE }}
                  className="group relative"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {asking ? (
                      <motion.div
                        key="confirm"
                        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-2 rounded-2xl bg-destructive/[0.07] px-3 py-2.5 dark:bg-destructive/15"
                      >
                        <p className="min-w-0 flex-1 truncate text-[15px] text-slate-800 dark:text-white/85">Delete {buildingName(b)}?</p>
                        <button type="button" onClick={() => setConfirm(null)} className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-900/5 dark:text-white/65 dark:hover:bg-white/8">
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deleting === id}
                          onClick={() => void remove(id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
                        >
                          {deleting === id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                          Delete
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="row"
                        type="button"
                        onClick={() => onSelect(b)}
                        aria-current={on ? "true" : undefined}
                        whileTap={reduce ? undefined : { scale: 0.99 }}
                        initial={false}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                          on ? "bg-primary/[0.08] dark:bg-primary/15" : "hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]",
                        )}
                      >
                        <span
                          className={cn(
                            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-medium",
                            on ? "bg-primary text-white" : "bg-primary/10 text-primary dark:text-blue-300",
                          )}
                          aria-hidden
                        >
                          {buildingInitials(b)}
                          {/* Condition, as a small status dot */}
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[hsl(224_40%_7%)]" style={{ background: cond.color }} title={cond.label} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[15px]", on ? "text-primary dark:text-blue-300" : "text-slate-900 dark:text-white/90")}>{buildingName(b)}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-slate-500 dark:text-white/45">
                            {[fn ? fn.charAt(0).toUpperCase() + fn.slice(1) : null, area ? formatArea(area) : null].filter(Boolean).join(" · ") || cond.label}
                          </span>
                        </span>
                        {c && c.open > 0 && (
                          <motion.span
                            key={c.open}
                            initial={reduce ? false : { scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className="min-w-5.5 rounded-full bg-primary px-1.5 text-center text-[13px] leading-5.5 tabular-nums text-white"
                            title={[c.action && `${c.action} need action`, c.waiting && `${c.waiting} waiting`].filter(Boolean).join(" · ")}
                            aria-label={`${c.open} open report${c.open === 1 ? "" : "s"}`}
                          >
                            {c.open}
                          </motion.span>
                        )}
                        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5", on ? "text-primary" : "text-slate-300 dark:text-white/25", canEdit && "md:group-hover:opacity-0")} aria-hidden />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  {canEdit && !asking && (
                    <button
                      type="button"
                      onClick={() => setConfirm(id)}
                      aria-label={`Delete ${buildingName(b)}`}
                      className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 opacity-0 transition-[opacity,background-color,color] hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 md:flex dark:text-white/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        )}
      </ul>
    </motion.section>
  );
};
