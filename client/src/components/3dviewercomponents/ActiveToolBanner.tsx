/**
 * Active-tool banner shared by both viewers (WS4.2): says what the tool does
 * and how to finish / undo / cancel, shows the live value with its ± accuracy,
 * and marks temporary measurements as "Not saved".
 */
import React from "react";
import { Check, Undo2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { VIEWER_TOOLS, type ViewerToolId } from "../../lib/viewer-tools";

interface Props {
  tool: ViewerToolId;
  /** Live value, e.g. "12.35 m". */
  liveValue?: string | null;
  /** e.g. "±0.10 m (provisional)". */
  accuracy?: string | null;
  /** Shown as an amber warning (e.g. self-intersecting outline). */
  warning?: string | null;
  /** True when what the user draws will NOT be stored. */
  notSaved?: boolean;
  pointCount?: number;
  onUndo?: () => void;
  onFinish?: () => void;
  onCancel: () => void;
  className?: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";

export const ActiveToolBanner: React.FC<Props> = ({
  tool,
  liveValue,
  accuracy,
  warning,
  notSaved,
  pointCount = 0,
  onUndo,
  onFinish,
  onCancel,
  className,
}) => {
  const def = VIEWER_TOOLS[tool];
  const Icon = def.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto absolute left-1/2 top-16 z-40 w-[calc(100vw-16px)] max-w-xl -translate-x-1/2",
        "rounded-2xl border border-amber-400/40 bg-white/95 px-3 py-2 text-slate-900 shadow-xl backdrop-blur-xl",
        "dark:bg-[#0f1117]/95 dark:text-white",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-snug">{def.help}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {liveValue && <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-300">{liveValue}</span>}
            {liveValue && accuracy && <span className="text-[11px] text-slate-500 dark:text-white/50">{accuracy}</span>}
            {notSaved && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                Not saved — you can measure but not save
              </span>
            )}
          </div>
          {warning && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">⚠ {warning}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onUndo && pointCount > 0 && (
            <button type="button" onClick={onUndo} aria-label="Undo last point (Backspace)" title="Undo last point (Backspace)"
              className={cn("flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}>
              <Undo2 className="h-4 w-4" />
            </button>
          )}
          {onFinish && pointCount >= 2 && (
            <button type="button" onClick={onFinish} aria-label="Finish (Enter)" title="Finish (Enter)"
              className={cn("flex h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700", focusRing)}>
              <Check className="h-4 w-4" /> <span className="hidden sm:inline">Finish</span>
            </button>
          )}
          <button type="button" onClick={onCancel} aria-label="Cancel (Esc)" title="Cancel (Esc)"
            className={cn("flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveToolBanner;
