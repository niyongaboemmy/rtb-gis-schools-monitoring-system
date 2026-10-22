/**
 * Measurement list shared by the 2D map and the 3D viewer (WS4.4): name,
 * value, kind, who + when, 2D/3D source badge; click to fly to it; rename /
 * delete per permission; clear all (with confirm); export CSV.
 */
import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, FileDown, Pencil, Ruler, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatRelative, formatDateTime } from "../../lib/format";
import { DISPLAY_UNITS, VIEWER_TOOLS, type DisplayUnit } from "../../lib/viewer-tools";
import { KIND_LABELS, type SiteFeatureKind } from "../../lib/measure/site-features";
import { EASE } from "../school-dashboard/tokens";

export interface MeasurementRow {
  id: string;
  name: string;
  kind: SiteFeatureKind;
  /** Primary value, already formatted. */
  value: string;
  /** e.g. "Surface 50.00 m²" for a sloped 3D area. */
  secondary?: string | null;
  /** e.g. a self-intersection warning. */
  warning?: string | null;
  source: "2d" | "3d";
  createdByName?: string | null;
  createdAt?: string | null;
  /** false = temporary measurement, not stored on the server. */
  saved: boolean;
  canEdit: boolean;
  canDelete: boolean;
  color?: string | null;
}

interface Props {
  rows: MeasurementRow[];
  unit: DisplayUnit;
  onUnitChange: (u: DisplayUnit) => void;
  onFlyTo: (id: string) => void;
  onRename?: (id: string, name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  /** Shown only when something can be cleared. */
  onClearAll?: () => void | Promise<void>;
  /** Omit when the user lacks EXPORT_VIEWER_DATA. */
  onExport?: () => void | Promise<void>;
  onClose: () => void;
  /** Footer note, e.g. accuracy. */
  footnote?: string;
  className?: string;
}

const KIND_ICON: Partial<Record<SiteFeatureKind, React.ElementType>> = {
  measure_distance: VIEWER_TOOLS.measure_distance.icon,
  measure_area: VIEWER_TOOLS.measure_area.icon,
  measure_perimeter: VIEWER_TOOLS.measure_perimeter.icon,
  measure_height: VIEWER_TOOLS.measure_height.icon,
  note: VIEWER_TOOLS.annotate.icon,
  pin: VIEWER_TOOLS.pin.icon,
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const iconBtn = cn(
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white",
  focusRing,
);

export const MeasurementListPanel: React.FC<Props> = ({
  rows,
  unit,
  onUnitChange,
  onFlyTo,
  onRename,
  onDelete,
  onClearAll,
  onExport,
  onClose,
  footnote,
  className,
}) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();

  const commitRename = async (id: string) => {
    const name = draft.trim();
    setEditing(null);
    if (name && onRename) await onRename(id, name);
  };

  return (
    <motion.section
      aria-label="Measurements"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "pointer-events-auto fixed z-40 flex flex-col overflow-hidden text-slate-800 dark:text-white",
        "bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10",
        "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
        // Phone: bottom sheet
        "inset-x-0 bottom-0 max-h-[60dvh] rounded-t-[1.75rem]",
        // Desktop: floating card on the left
        "md:inset-x-auto md:left-4 md:top-20 md:bottom-auto md:w-80 md:max-h-[70vh] md:rounded-[1.5rem]",
        className,
      )}
    >
      {/* Grab handle (phones) */}
      <div className="flex shrink-0 justify-center pb-1 pt-2.5 md:hidden" aria-hidden>
        <div className="h-1.5 w-10 rounded-full bg-slate-300/80 dark:bg-white/15" />
      </div>

      <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-2 md:pt-4">
        <h2 className="flex min-w-0 flex-1 items-baseline gap-1.5 pl-1 text-[15px] font-medium text-slate-900 dark:text-white">
          Measurements
          <span className="text-[13px] tabular-nums text-slate-500 dark:text-white/40">{rows.length}</span>
        </h2>
        <label className="flex items-center">
          <span className="sr-only">Units</span>
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as DisplayUnit)}
            className={cn(
              "h-9 cursor-pointer rounded-full bg-slate-900/[0.04] px-3 text-[13px] text-slate-700 transition-colors hover:bg-slate-900/[0.08] dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10 dark:[color-scheme:dark]",
              focusRing,
            )}
          >
            {DISPLAY_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onClose} aria-label="Close measurements" className={iconBtn}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <ul className="custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2" role="list">
        {rows.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Ruler className="h-6 w-6 text-slate-300 dark:text-white/25" aria-hidden />
            <p className="text-[13px] text-slate-600 dark:text-white/60">
              No measurements yet. Choose Distance, Area or Perimeter in the toolbar to start.
            </p>
          </li>
        )}
        <AnimatePresence initial={false}>
          {rows.map((r, i) => {
            const Icon = KIND_ICON[r.kind] ?? Ruler;
            return (
              <motion.li
                key={r.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                className="group rounded-2xl px-2 py-2 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/8"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${r.color ?? "#64748b"}22`, color: r.color ?? undefined }}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {editing === r.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void commitRename(r.id);
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          autoFocus
                          value={draft}
                          maxLength={200}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setEditing(null);
                            }
                          }}
                          aria-label="Measurement name"
                          className={cn(
                            "h-9 w-full rounded-full bg-white/80 px-3 text-[13px] text-slate-900 dark:bg-white/8 dark:text-white",
                            focusRing,
                          )}
                        />
                        <button
                          type="submit"
                          aria-label="Save name"
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90",
                            focusRing,
                          )}
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onFlyTo(r.id)}
                        className={cn("block w-full rounded-xl text-left", focusRing)}
                        title="Fly to this measurement"
                      >
                        <span className="block truncate text-[13px] font-medium text-slate-800 dark:text-white/90">{r.name}</span>
                        <span className="block text-[14px] tabular-nums text-primary dark:text-blue-300">{r.value}</span>
                        {r.secondary && (
                          <span className="block text-[11px] tabular-nums text-slate-600 dark:text-white/55">{r.secondary}</span>
                        )}
                      </button>
                    )}
                    {r.warning && (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-primary dark:text-blue-300">
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                        {r.warning}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-white/50">
                      <span className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 dark:bg-white/8">{KIND_LABELS[r.kind]}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5",
                          r.source === "3d"
                            ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300"
                            : "bg-slate-900/[0.05] text-slate-700 dark:bg-white/8 dark:text-white/70",
                        )}
                      >
                        {r.source.toUpperCase()}
                      </span>
                      {r.saved ? (
                        <span title={r.createdAt ? formatDateTime(r.createdAt) : undefined}>
                          {r.createdByName || "Unknown"}
                          {r.createdAt ? ` · ${formatRelative(r.createdAt)}` : ""}
                        </span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary dark:bg-primary/20 dark:text-blue-300">
                          Not saved
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5 transition-opacity md:opacity-60 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    {r.canEdit && onRename && editing !== r.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r.id);
                          setDraft(r.name);
                        }}
                        aria-label={`Rename ${r.name}`}
                        className={iconBtn}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                    {r.canDelete && (
                      <button
                        type="button"
                        onClick={() => void onDelete(r.id)}
                        aria-label={`Delete ${r.name}`}
                        className={cn(
                          iconBtn,
                          "hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15 dark:hover:text-destructive",
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-3 pt-2">
        {onExport && rows.some((r) => r.saved) && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onExport();
              } finally {
                setBusy(false);
              }
            }}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full bg-slate-900/[0.04] px-3.5 text-[13px] text-slate-700 transition-colors hover:bg-slate-900/[0.08] disabled:opacity-50 dark:bg-white/6 dark:text-white/80 dark:hover:bg-white/10",
              focusRing,
            )}
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </button>
        )}
        {onClearAll && rows.some((r) => r.canDelete) && (
          confirmClear ? (
              <motion.span
                key="confirm"
                initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="ml-auto flex items-center gap-1 text-[13px] text-slate-700 dark:text-white/80"
                role="alertdialog"
                aria-label="Confirm clear all"
              >
                Delete all you can?
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmClear(false);
                    await onClearAll();
                  }}
                  className={cn("h-9 rounded-full bg-destructive px-3.5 text-white transition-colors hover:bg-destructive/90", focusRing)}
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className={cn("h-9 rounded-full px-3.5 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/8", focusRing)}
                >
                  No
                </button>
              </motion.span>
            ) : (
              <motion.button
                key="clear"
                type="button"
                initial={false}
                animate={{ opacity: 1 }}
                onClick={() => setConfirmClear(true)}
                className={cn(
                  "ml-auto flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10",
                  focusRing,
                )}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear all
              </motion.button>
            )
        )}
        {footnote && <p className="w-full text-[11px] text-slate-600 dark:text-white/45">{footnote}</p>}
      </footer>
    </motion.section>
  );
};

export default MeasurementListPanel;
