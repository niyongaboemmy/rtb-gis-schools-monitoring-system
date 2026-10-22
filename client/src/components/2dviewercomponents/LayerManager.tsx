import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  MapPin,
  X,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Search,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { BuildingData } from "../school-form-steps/BuildingsStep";
import { ANNOTATION_ICONS } from "./AnnotationPickerModal";
import { EASE } from "../school-dashboard/tokens";

type LayerTab = "features" | "buildings";

const TABS: ReadonlyArray<{ id: LayerTab; label: string; icon: React.ElementType }> = [
  { id: "features", label: "Features", icon: MapPin },
  { id: "buildings", label: "Buildings", icon: Building2 },
];

const iconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white";

interface LayerManagerProps {
  onClose: () => void;
  schoolBuildings: BuildingData[];
  siteAnnotations: any[];
  onDeleteAnnotation: (id: string) => void;
  onSelectBuilding: (b: BuildingData) => void;
  onFlyToAnnotation: (ann: any) => void;
  selectedBuildingId?: string;
  hiddenAnnotationGroups: Set<string>;
  onToggleAnnotationGroup: (iconType: string) => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  onClose,
  schoolBuildings,
  siteAnnotations,
  onDeleteAnnotation,
  onSelectBuilding,
  onFlyToAnnotation,
  selectedBuildingId,
  hiddenAnnotationGroups,
  onToggleAnnotationGroup,
}) => {
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = React.useState<LayerTab>("features");
  const [searchQuery, setSearchQuery] = React.useState("");

  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeTab === "buildings" && selectedBuildingId && listRef.current) {
      const element = listRef.current.querySelector(
        `[data-id="${selectedBuildingId}"]`,
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedBuildingId, activeTab]);

  const filteredBuildings = React.useMemo(() => {
    if (!searchQuery.trim()) return schoolBuildings;
    const q = searchQuery.toLowerCase();
    return schoolBuildings.filter(
      (b) =>
        b.buildingName?.toLowerCase().includes(q) ||
        b.buildingCode?.toLowerCase().includes(q),
    );
  }, [schoolBuildings, searchQuery]);

  const filteredAnnotations = React.useMemo(() => {
    if (!searchQuery.trim()) return siteAnnotations;
    const q = searchQuery.toLowerCase();
    return siteAnnotations.filter((a) => a.label?.toLowerCase().includes(q));
  }, [siteAnnotations, searchQuery]);

  const annotationGroups = React.useMemo(() => {
    const counts: Record<string, number> = {};
    siteAnnotations.forEach((ann) => {
      const key = ann.icon || ann.iconType || ann.style?.iconType || "pin";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return ANNOTATION_ICONS.filter((ic) => counts[ic.id] > 0).map((ic) => ({
      ...ic,
      count: counts[ic.id],
    }));
  }, [siteAnnotations]);

  const rowMotion = (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 8 } as const),
    animate: { opacity: 1, y: 0 },
    exit: reduce ? undefined : { opacity: 0, x: -16 },
    transition: { duration: 0.28, delay: Math.min(i * 0.03, 0.3), ease: EASE },
  });

  const empty = (Icon: React.ElementType, title: string) => (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Icon className="h-6 w-6 text-slate-300 dark:text-white/25" aria-hidden />
      <p className="text-[13px] text-slate-700 dark:text-white/80">{title}</p>
    </div>
  );

  return (
    <motion.section
      aria-label="Layers"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "fixed z-40 flex flex-col overflow-hidden",
        "bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10",
        "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
        // Phone: bottom sheet
        "inset-x-0 bottom-0 h-[60dvh] rounded-t-[1.75rem]",
        // Desktop: just left of the tool rail, whatever its width
        "md:inset-auto md:right-[calc(var(--map-rail-w,3.5rem)+1.5rem)] md:top-4 md:h-auto md:max-h-[calc(100vh-2rem)] md:w-84 md:rounded-[1.5rem]",
      )}
    >
      {/* Grab handle (phones) */}
      <div className="flex shrink-0 justify-center pb-1 pt-2.5 md:hidden" aria-hidden>
        <div className="h-1.5 w-10 rounded-full bg-slate-300/80 dark:bg-white/15" />
      </div>

      <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-2 md:pt-4">
        <h3 className="flex-1 pl-1 text-[15px] font-medium text-slate-900 dark:text-white">
          Layers
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GIS panel"
          className={iconBtn}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {/* Tabs */}
      <div className="shrink-0 px-4 pb-2">
        <div
          role="tablist"
          aria-label="Layer type"
          className="flex gap-1 rounded-full bg-slate-900/[0.04] p-1 dark:bg-white/6"
        >
          {TABS.map((t) => {
            const on = activeTab === t.id;
            const count =
              t.id === "features" ? siteAnnotations.length : schoolBuildings.length;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  on
                    ? "text-white"
                    : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="layer-manager-tab"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={
                      reduce ? { duration: 0 } : { duration: 0.3, ease: EASE }
                    }
                    aria-hidden
                  />
                )}
                <t.icon className="relative h-3.5 w-3.5" aria-hidden />
                <span className="relative">{t.label}</span>
                <span className="relative tabular-nums text-[11px] opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-4 pb-2">
        <label className="relative block">
          <span className="sr-only">
            {activeTab === "features" ? "Search site features" : "Search building blocks"}
          </span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-white/35"
            aria-hidden
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === "features" ? "site features" : "building blocks"}`}
            className="h-9 w-full rounded-full bg-slate-900/[0.04] pl-8.5 pr-8 text-[13px] text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-white/6 dark:text-white dark:placeholder:text-white/35 dark:focus:bg-white/8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </label>
      </div>

      <div
        ref={listRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 md:min-h-[300px]"
      >
        {activeTab === "features" && (
          <>
            {/* Group visibility filter chips */}
            {annotationGroups.length > 1 && (
              <div className="px-1.5 pb-2 pt-1">
                <p className="mb-1.5 px-0.5 text-[11px] text-slate-600 dark:text-white/50">
                  Filter by type
                </p>
                <div className="flex flex-wrap gap-1">
                  {annotationGroups.map((ic) => {
                    const isHidden = hiddenAnnotationGroups.has(ic.id);
                    const IconComp = ic.icon;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => onToggleAnnotationGroup(ic.id)}
                        title={isHidden ? `Show ${ic.label}` : `Hide ${ic.label}`}
                        aria-pressed={!isHidden}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                          isHidden
                            ? "bg-transparent text-slate-500 line-through decoration-slate-400/60 hover:bg-slate-900/5 dark:text-white/40 dark:hover:bg-white/8"
                            : "bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.08] dark:bg-white/8 dark:text-white/80 dark:hover:bg-white/12",
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: ic.mapColor,
                            opacity: isHidden ? 0.35 : 1,
                          }}
                          aria-hidden
                        />
                        <IconComp className="h-3 w-3 shrink-0" aria-hidden />
                        <span>{ic.label}</span>
                        <span className="tabular-nums opacity-60">{ic.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredAnnotations.length === 0 ? (
              empty(
                MapPin,
                searchQuery.trim() ? "No match" : "No site features",
              )
            ) : (
              <div className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {filteredAnnotations.map((ann, i: number) => {
                    const iconType =
                      ann.icon || ann.iconType || ann.style?.iconType || "pin";
                    const iconDef =
                      ANNOTATION_ICONS.find((ic) => ic.id === iconType) ||
                      ANNOTATION_ICONS[0];
                    const IconComp = iconDef.icon;
                    const isGroupHidden = hiddenAnnotationGroups.has(iconType);
                    const title = ann.title || ann.label || "Untitled Annotation";
                    return (
                      <motion.div
                        key={ann.id}
                        layout={!reduce}
                        {...rowMotion(i)}
                        onClick={() => onFlyToAnnotation(ann)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/8",
                          isGroupHidden && "opacity-40",
                        )}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${iconDef.mapColor}22` }}
                          aria-hidden
                        >
                          <IconComp
                            className="h-4 w-4"
                            style={{ color: iconDef.mapColor }}
                          />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13px] font-medium text-slate-800 dark:text-white/90">
                            {title}
                          </span>
                          <span className="truncate text-[11px] text-slate-600 dark:text-white/50">
                            {iconDef.label} · {ann.type}
                          </span>
                          {ann.description && (
                            <span className="truncate text-[11px] text-slate-500 dark:text-white/40">
                              {ann.description}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAnnotation(ann.id);
                          }}
                          aria-label={`Delete "${title}"`}
                          className={cn(
                            iconBtn,
                            "hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15 dark:hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                          )}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {activeTab === "buildings" && (
          <>
            {filteredBuildings.length === 0 ? (
              empty(
                Building2,
                searchQuery.trim() ? "No match" : "No buildings found",
              )
            ) : (
              <div className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {filteredBuildings.map((b, i) => {
                    const on = selectedBuildingId === b.id;
                    return (
                      <motion.div
                        key={b.id}
                        data-id={b.id}
                        layout={!reduce}
                        {...rowMotion(i)}
                        onClick={() => onSelectBuilding(b)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 transition-colors",
                          on
                            ? "bg-primary/10 dark:bg-primary/20"
                            : "hover:bg-slate-900/5 dark:hover:bg-white/8",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            on
                              ? "bg-primary text-white"
                              : "bg-primary/10 text-primary dark:text-blue-300",
                          )}
                          aria-hidden
                        >
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "truncate text-[13px] font-medium",
                                on
                                  ? "text-primary dark:text-blue-300"
                                  : "text-slate-800 dark:text-white/90",
                              )}
                            >
                              {b.buildingName || "Unnamed Block"}
                            </span>
                            {b.buildingCondition === "good" && (
                              <CheckCircle2
                                className="h-3 w-3 shrink-0 text-primary dark:text-blue-300"
                                aria-label="Good condition"
                              />
                            )}
                          </span>
                          <span className="truncate text-[11px] tabular-nums text-slate-600 dark:text-white/50">
                            Code: {b.buildingCode || "N/A"}
                          </span>
                        </span>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 transition-opacity",
                            on
                              ? "text-primary opacity-100 dark:text-blue-300"
                              : "text-slate-400 opacity-0 group-hover:opacity-100 dark:text-white/40",
                          )}
                          aria-hidden
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="shrink-0 px-4 pb-3 pt-1">
        <p className="text-center text-[11px] text-slate-600 dark:text-white/45">
          {activeTab === "features"
            ? "Add notes from the toolbar"
            : "Draw buildings from the toolbar"}
        </p>
      </footer>
    </motion.section>
  );
};
