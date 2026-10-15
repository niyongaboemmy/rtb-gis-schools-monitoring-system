/**
 * Measurement list shared by the 2D map and the 3D viewer (WS4.4): name,
 * value, kind, who + when, 2D/3D source badge; click to fly to it; rename /
 * delete per permission; clear all (with confirm); export CSV.
 */
import React, { useState } from "react";
import { Check, FileDown, Pencil, Ruler, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatRelative, formatDateTime } from "../../lib/format";
import { DISPLAY_UNITS, VIEWER_TOOLS, type DisplayUnit } from "../../lib/viewer-tools";
import { KIND_LABELS, type SiteFeatureKind } from "../../lib/measure/site-features";

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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background";

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

  const commitRename = async (id: string) => {
    const name = draft.trim();
    setEditing(null);
    if (name && onRename) await onRename(id, name);
  };

  return (
    <section
      aria-label="Measurements"
      className={cn(
        "pointer-events-auto fixed z-40 flex flex-col",
        "inset-x-2 bottom-2 max-h-[55vh] md:inset-x-auto md:left-4 md:top-20 md:bottom-auto md:w-80 md:max-h-[70vh]",
        "rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-xl",
        "dark:border-white/10 dark:bg-[#0f1117]/95 dark:text-white",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
        <Ruler className="h-4 w-4 text-amber-500" aria-hidden />
        <h2 className="text-sm font-bold">Measurements</h2>
        <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold dark:bg-white/10">{rows.length}</span>
        <label className="ml-auto flex items-center gap-1 text-xs">
          <span className="sr-only">Units</span>
          <select
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as DisplayUnit)}
            className={cn(
              "h-10 rounded-lg border border-slate-200 bg-transparent px-2 text-xs dark:border-white/10 dark:bg-[#0f1117]",
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close measurements"
          className={cn("flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <ul className="flex-1 overflow-y-auto p-2" role="list">
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-slate-500 dark:text-white/50">
            No measurements yet. Choose Distance, Area or Perimeter in the toolbar to start.
          </li>
        )}
        {rows.map((r) => {
          const Icon = KIND_ICON[r.kind] ?? Ruler;
          return (
            <li
              key={r.id}
              className="group mb-1 rounded-xl border border-transparent p-2 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/5"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${r.color ?? "#64748b"}22`, color: r.color ?? undefined }}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" />
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
                          "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-white/20 dark:bg-black/30",
                          focusRing,
                        )}
                      />
                      <button type="submit" aria-label="Save name" className={cn("flex h-9 w-9 items-center justify-center rounded-md", focusRing)}>
                        <Check className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onFlyTo(r.id)}
                      className={cn("block w-full rounded-md text-left", focusRing)}
                      title="Fly to this measurement"
                    >
                      <span className="block truncate text-sm font-semibold">{r.name}</span>
                      <span className="block font-mono text-sm text-amber-600 dark:text-amber-300">{r.value}</span>
                      {r.secondary && <span className="block text-xs text-slate-500 dark:text-white/60">{r.secondary}</span>}
                    </button>
                  )}
                  {r.warning && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">⚠ {r.warning}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-white/50">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold dark:bg-white/10">{KIND_LABELS[r.kind]}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-bold",
                        r.source === "3d"
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
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
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                        Not saved
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 md:opacity-60 md:group-hover:opacity-100 md:focus-within:opacity-100">
                  {r.canEdit && onRename && editing !== r.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(r.id);
                        setDraft(r.name);
                      }}
                      aria-label={`Rename ${r.name}`}
                      className={cn("flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {r.canDelete && (
                    <button
                      type="button"
                      onClick={() => void onDelete(r.id)}
                      aria-label={`Delete ${r.name}`}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
                        focusRing,
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2 dark:border-white/10">
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
              "flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5",
              focusRing,
            )}
          >
            <FileDown className="h-3.5 w-3.5" /> Export CSV
          </button>
        )}
        {onClearAll && rows.some((r) => r.canDelete) && (
          confirmClear ? (
            <span className="ml-auto flex items-center gap-1 text-xs" role="alertdialog" aria-label="Confirm clear all">
              Delete all you can?
              <button
                type="button"
                onClick={async () => {
                  setConfirmClear(false);
                  await onClearAll();
                }}
                className={cn("h-10 rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-700", focusRing)}
              >
                Yes, clear
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className={cn("h-10 rounded-lg px-3", focusRing)}>
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className={cn(
                "ml-auto flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
                focusRing,
              )}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          )
        )}
        {footnote && <p className="w-full text-[11px] text-slate-500 dark:text-white/50">{footnote}</p>}
      </footer>
    </section>
  );
};

export default MeasurementListPanel;
