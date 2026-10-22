import React, { useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE } from "../school-dashboard/tokens";
import Feature from "ol/Feature";

interface MapNavigatorProps {
  features: Array<{ name: string; feature: Feature }>;
  selectedFeatureName: string | null;
  onFlyTo: (feature: Feature) => void;
  onClose: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

export const MapNavigator: React.FC<MapNavigatorProps> = ({
  features,
  selectedFeatureName,
  onFlyTo,
  onClose,
}) => {
  const reduce = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return features;
    const q = searchQuery.toLowerCase();
    return features.filter((f) => f.name.toLowerCase().includes(q));
  }, [features, searchQuery]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn(
        "fixed z-40 flex flex-col overflow-hidden",
        // Phones: bottom sheet
        "inset-x-0 bottom-0 h-[50vh] rounded-t-3xl",
        // Desktop: docked left of the tool rail
        "md:inset-auto md:right-[calc(var(--map-rail-w,3.5rem)+1.5rem)] md:top-16 md:h-auto md:w-72 md:rounded-3xl xl:top-4",
        "bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150",
        "ring-1 ring-white/40 dark:ring-white/10",
        "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
      )}
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-900/15 dark:bg-white/20 md:hidden" aria-hidden />
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-[14px] font-medium text-slate-900 dark:text-white">
          Navigator
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigator"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors",
            "hover:bg-slate-900/5 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white",
            focusRing,
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-white/50"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "h-9 w-full rounded-full bg-slate-900/5 pl-8 pr-3 text-[13px] text-slate-800 placeholder:text-slate-500",
              "dark:bg-white/6 dark:text-white dark:placeholder:text-white/40",
              focusRing,
            )}
          />
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 md:max-h-95">
        {filteredFeatures.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-slate-500 dark:text-white/50">
            No features found
          </p>
        ) : (
          filteredFeatures.map(({ name, feature }) => (
            <button
              key={name}
              type="button"
              onClick={() => onFlyTo(feature)}
              className={cn(
                "w-full truncate rounded-2xl px-3 py-2 text-left text-[13px] transition-colors",
                selectedFeatureName === name
                  ? "bg-primary/10 font-medium text-primary dark:text-blue-300"
                  : "text-slate-700 hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/8",
                focusRing,
              )}
            >
              {name}
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
};
