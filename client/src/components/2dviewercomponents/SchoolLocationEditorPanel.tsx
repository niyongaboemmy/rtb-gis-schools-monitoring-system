import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Loader2, Check, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber } from "../../lib/format";
import { EASE } from "../school-dashboard/tokens";

interface Props {
  draft: [number, number] | null;
  original: [number, number] | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const fmt = (n: number) => formatNumber(n, 7);

const moved = (
  a: [number, number] | null,
  b: [number, number] | null,
): boolean => {
  if (!a || !b) return !!a;
  return Math.abs(a[0] - b[0]) > 1e-7 || Math.abs(a[1] - b[1]) > 1e-7;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const Coord: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div className="min-w-0 rounded-2xl bg-slate-900/5 px-3 py-2 dark:bg-white/6">
    <span className="block text-[11px] text-slate-500 dark:text-white/50">{name}</span>
    <span className="block truncate text-[13px] tabular-nums text-slate-800 dark:text-white/90">
      {value}
    </span>
  </div>
);

export const SchoolLocationEditorPanel: React.FC<Props> = ({
  draft,
  original,
  saving,
  onSave,
  onCancel,
}) => {
  const reduce = useReducedMotion();
  const hasChange = moved(draft, original);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex justify-center md:inset-x-auto md:bottom-28 md:left-1/2 md:-translate-x-1/2">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className={cn(
          "pointer-events-auto w-full p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:w-[26rem] md:pb-4",
          "rounded-t-3xl md:rounded-3xl",
          "bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/40 dark:ring-white/10",
          "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-blue-300">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-slate-900 dark:text-white">
              Set school location
            </p>
            <p className="text-[12px] text-slate-600 dark:text-white/60">
              Click the map or drag the pin, then save.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Coord name="Latitude" value={draft ? fmt(draft[1]) : "—"} />
          <Coord name="Longitude" value={draft ? fmt(draft[0]) : "—"} />
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] text-slate-700 transition-colors",
              "hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/8",
              "disabled:pointer-events-none disabled:opacity-50",
              focusRing,
            )}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !hasChange || !draft}
            className={cn(
              "inline-flex h-9 min-w-30 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-medium text-white transition-colors",
              "hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
              focusRing,
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Save location
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
