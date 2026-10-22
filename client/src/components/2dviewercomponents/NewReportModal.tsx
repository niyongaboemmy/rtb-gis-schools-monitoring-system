import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ClipboardPlus, X } from "lucide-react";
import SchoolReporting from "../../pages/SchoolReporting";
import { EASE } from "../school-dashboard/tokens";

interface Props {
  open: boolean;
  schoolId: string;
  buildingId: string;
  buildingName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

/** The report form, opened over the map with the building already chosen. */
export function NewReportModal({ open, schoolId, buildingId, buildingName, onClose, onSubmitted }: Props) {
  const reduce = useReducedMotion();
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Report a problem: ${buildingName}`}>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            key="panel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="relative flex h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white ring-1 ring-slate-900/5 sm:h-[90vh] sm:rounded-[1.75rem] dark:bg-[hsl(224_40%_7%)] dark:ring-white/8"
          >
            <header className="flex items-center gap-3 px-5 py-4 sm:px-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                <ClipboardPlus className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-slate-900 dark:text-white">Report a problem</p>
                <p className="truncate text-xs text-slate-500 dark:text-white/50">{buildingName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <X className="h-4.5 w-4.5" aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <SchoolReporting schoolId={schoolId} initialBuildingId={buildingId} hideHeader mode="modal" onReportSubmitted={onSubmitted} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
