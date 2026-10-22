/**
 * Active-tool banner shared by both viewers (WS4.2): says what the tool does
 * and how to finish / undo / cancel, shows the live value with its ± accuracy,
 * and marks temporary measurements as "Not saved".
 */
import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Undo2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { VIEWER_TOOLS, type ViewerToolId } from "../../lib/viewer-tools";
import { EASE } from "../school-dashboard/tokens";

interface Props {
  tool: ViewerToolId;
  /** Live value, e.g. "12.35 m". */
  liveValue?: string | null;
  /** e.g. "±0.10 m (provisional)". */
  accuracy?: string | null;
  /** Shown as a primary-tinted warning (e.g. self-intersecting outline). */
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
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const ghostIcon = cn(
  "flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors",
  "hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/8 dark:hover:text-white",
  focusRing,
);

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
  const reduce = useReducedMotion();
  const def = VIEWER_TOOLS[tool];
  const Icon = def.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto absolute left-1/2 top-16 z-40 w-[calc(100vw-16px)] max-w-xl -translate-x-1/2",
        className,
      )}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className={cn(
          "rounded-3xl px-3 py-2.5 text-slate-800 dark:text-white",
          "bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/40 dark:ring-white/10",
          "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-blue-300">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-snug text-slate-700 dark:text-white/80">{def.help}</p>
            {(liveValue || notSaved) && (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  {liveValue && (
                    <motion.span
                      key={liveValue}
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="text-[15px] font-medium tabular-nums text-primary dark:text-blue-300"
                    >
                      {liveValue}
                    </motion.span>
                  )}
                </AnimatePresence>
                {liveValue && accuracy && (
                  <span className="text-[11px] tabular-nums text-slate-500 dark:text-white/50">{accuracy}</span>
                )}
                {notSaved && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary dark:bg-primary/20 dark:text-blue-200">
                    Not saved — you can measure but not save
                  </span>
                )}
              </div>
            )}
            {warning && (
              <p className="mt-1.5 flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary dark:bg-primary/20 dark:text-blue-200">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                <span className="min-w-0">{warning}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onUndo && pointCount > 0 && (
              <button type="button" onClick={onUndo} aria-label="Undo last point (Backspace)" title="Undo last point (Backspace)"
                className={ghostIcon}>
                <Undo2 className="h-4 w-4" aria-hidden />
              </button>
            )}
            {onFinish && pointCount >= 2 && (
              <button type="button" onClick={onFinish} aria-label="Finish (Enter)" title="Finish (Enter)"
                className={cn(
                  "flex h-10 items-center gap-1 rounded-full bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary/90",
                  focusRing,
                )}>
                <Check className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Finish</span>
              </button>
            )}
            <button type="button" onClick={onCancel} aria-label="Cancel (Esc)" title="Cancel (Esc)"
              className={ghostIcon}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ActiveToolBanner;
