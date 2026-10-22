import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "../school-dashboard/tokens";

interface LoadingOverlayProps {
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  /** Kept for callers; the overlay no longer shows elapsed time. */
  loadingStartTime: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  loadingProgress,
  loadingMessage,
}) => {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(loadingProgress || 0)));

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="map-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
          className="absolute inset-0 z-100 flex items-center justify-center bg-[hsl(224_40%_5%)]/70 backdrop-blur-xl backdrop-saturate-150 px-4"
        >
          <motion.div
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.4, ease: EASE, delay: reduce ? 0 : 0.05 }}
            className="w-full max-w-xs"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="flex items-center gap-1 text-[15px] font-medium text-white">
                Loading the school
                {!reduce && (
                  <span className="ml-0.5 inline-flex gap-0.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1 w-1 rounded-full bg-blue-300"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.18,
                        }}
                      />
                    ))}
                  </span>
                )}
              </p>
              <span className="text-[13px] tabular-nums text-white/70">{pct}%</span>
            </div>

            <div
              className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Map loading progress"
            >
              <motion.div
                className="relative h-full overflow-hidden rounded-full bg-primary"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
              >
                {!reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-y-0 w-1/2 bg-linear-to-r from-transparent via-white/40 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={{ x: "200%" }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </motion.div>
            </div>

            <p className="mt-2.5 truncate text-[12px] text-white/60">{loadingMessage}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
