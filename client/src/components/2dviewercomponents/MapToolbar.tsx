import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Box,
  Building2,
  ChevronRight,
  Download,
  Globe,
  HelpCircle,
  Home,
  Images,
  Info,
  Layers,
  ListOrdered,
  Map as MapIcon2,
  MapPin,
  MapPinned,
  Moon,
  MousePointer,
  MousePointer2,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  PenTool,
  PlusCircle,
  Ruler,
  Satellite,
  Square,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { VIEWER_TOOLS, type ViewerToolId } from "../../lib/viewer-tools";
import { cn } from "../../lib/utils";
import { EASE } from "../school-dashboard/tokens";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

export type MeasurementMode2D = "none" | "distance" | "area" | "perimeter";

type Icon = React.ComponentType<{ className?: string }>;

const MEASURE_TOOL_2D: { mode: Exclude<MeasurementMode2D, "none">; tool: ViewerToolId }[] = [
  { mode: "distance", tool: "measure_distance" },
  { mode: "area", tool: "measure_area" },
  { mode: "perimeter", tool: "measure_perimeter" },
];

const NOTE_TOOLS: { id: string; name: string; icon: Icon }[] = [
  { id: "annotate_point", name: "Pin", icon: MousePointer },
  { id: "annotate_line", name: "Line", icon: PenTool },
  { id: "annotate_poly", name: "Area", icon: Square },
  { id: "annotate_text", name: "Text", icon: Type },
];

const BASEMAPS: { id: string; name: string; icon: Icon }[] = [
  { id: "google", name: "Satellite", icon: Globe },
  { id: "satellite", name: "Sentinel", icon: Satellite },
  { id: "street", name: "Streets", icon: MapIcon2 },
  { id: "dark", name: "Dark", icon: Moon },
  { id: "offline", name: "Offline", icon: Download },
  { id: "ghost", name: "Light", icon: Layers },
];

const VISUALS = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Colour" },
] as const;

const EXPANDED_KEY = "rtb-map-rail-expanded";

interface MapToolbarProps {
  onClose?: () => void;
  showNavigator: boolean;
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  showOpacitySlider: boolean;
  setShowOpacitySlider: React.Dispatch<React.SetStateAction<boolean>>;
  basemapStyle: string;
  switchBasemap: (style: string) => void;
  measurementMode: MeasurementMode2D;
  setMeasurementMode: React.Dispatch<React.SetStateAction<MeasurementMode2D>>;
  /** USE_MEASURE_TOOLS — hides the measuring tools when false. */
  canMeasure?: boolean;
  /** SAVE_SITE_FEATURES — hides the note tools when false. */
  canAnnotate?: boolean;
  /** EDIT_SCHOOL_BUILDINGS — hides "Draw a building" when false. */
  canCreateBlock?: boolean;
  showMeasureList?: boolean;
  setShowMeasureList?: React.Dispatch<React.SetStateAction<boolean>>;
  measureCount?: number;
  onHelp?: () => void;
  clearMeasurements: () => void;
  activeTool: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the viewer's tool union lives in School2DViewer
  setActiveTool: React.Dispatch<React.SetStateAction<any>>;
  /** Show the "set school location" tool (permission-gated by the parent). */
  canSetLocation?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Back to the school's framing (site map, else buildings, else its point). */
  onHome: () => void;
  onExportPng: () => void;
  on3DView?: () => void;
  showBasicInfo: boolean;
  setShowBasicInfo: React.Dispatch<React.SetStateAction<boolean>>;
  kmzOpacity: number;
  setKmzOpacity: (val: number) => void;
  visuals: { brightness: number; contrast: number; saturation: number };
  setVisuals: React.Dispatch<React.SetStateAction<{ brightness: number; contrast: number; saturation: number }>>;
  showPlacesOverlay: boolean;
  setShowPlacesOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  showBuildingsList: boolean;
  setShowBuildingsList: React.Dispatch<React.SetStateAction<boolean>>;
  /** Buildings with open reports (badge on the Buildings button). */
  openReports?: number;
  /** Open the photo gallery of every building. */
  onGallery?: () => void;
}

type Group = "draw" | "measure" | "style";

const readExpanded = () => {
  try {
    // Names are shown unless the user hid them.
    return localStorage.getItem(EXPANDED_KEY) !== "0";
  } catch {
    return true;
  }
};

/**
 * The map's tool rail. Related tools are grouped: a group button opens a
 * flyout with its tools, and shows the chosen tool while it is active. The
 * rail can be widened to show each tool's name (remembered per browser).
 */
export const MapToolbar: React.FC<MapToolbarProps> = ({
  onClose,
  showNavigator,
  setShowNavigator,
  setShowOpacitySlider,
  basemapStyle,
  switchBasemap,
  measurementMode,
  setMeasurementMode,
  clearMeasurements,
  activeTool,
  setActiveTool,
  canSetLocation,
  canMeasure = true,
  canAnnotate = true,
  canCreateBlock = true,
  showMeasureList,
  setShowMeasureList,
  measureCount = 0,
  onHelp,
  onZoomIn,
  onZoomOut,
  onHome,
  onExportPng,
  showBasicInfo,
  setShowBasicInfo,
  kmzOpacity,
  setKmzOpacity,
  visuals,
  setVisuals,
  showPlacesOverlay,
  setShowPlacesOverlay,
  showBuildingsList,
  setShowBuildingsList,
  on3DView,
  openReports = 0,
  onGallery,
}) => {
  const reduce = useReducedMotion();
  const [expanded, setExpandedState] = React.useState(readExpanded);
  const [flyout, setFlyout] = React.useState<Group | null>(null);
  // Lined up with its button: from the top, or (lower half) from the bottom.
  const [flyoutPos, setFlyoutPos] = React.useState<{ top: number } | { bottom: number }>({ top: 0 });
  const shellRef = React.useRef<HTMLDivElement>(null);

  const setExpanded = (v: boolean) => {
    setExpandedState(v);
    try {
      localStorage.setItem(EXPANDED_KEY, v ? "1" : "0");
    } catch {
      /* private mode: not remembered */
    }
  };

  const openFlyout = (g: Group, el: HTMLElement) => {
    if (flyout === g) return setFlyout(null);
    // Line the flyout up with the button that opened it (desktop rail).
    const shell = shellRef.current?.getBoundingClientRect();
    const btn = el.getBoundingClientRect();
    if (shell) {
      const lowerHalf = btn.top + btn.height / 2 > shell.top + shell.height / 2;
      setFlyoutPos(lowerHalf ? { bottom: Math.max(0, shell.bottom - btn.bottom - 8) } : { top: Math.max(0, btn.top - shell.top - 8) });
    }
    setFlyout(g);
    // The opacity slider lives in "Map style" now.
    setShowOpacitySlider(false);
  };

  const pickTool = (tool: string) => {
    if (activeTool === tool) {
      setActiveTool("none");
    } else {
      setActiveTool(tool);
      if (measurementMode !== "none") {
        setMeasurementMode("none");
        clearMeasurements();
      }
    }
    setFlyout(null);
  };

  const pickMeasure = (mode: Exclude<MeasurementMode2D, "none">) => {
    if (measurementMode === mode) {
      setMeasurementMode("none");
      clearMeasurements();
    } else {
      setMeasurementMode(mode);
      setActiveTool("none");
      clearMeasurements();
    }
    setFlyout(null);
  };

  const stopMeasuring = () => {
    setMeasurementMode("none");
    clearMeasurements();
    setFlyout(null);
  };

  // Panels docked on the right sit just left of the rail (--map-rail-w).
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--map-rail-w", expanded ? "13rem" : "3.5rem");
    return () => {
      root.style.removeProperty("--map-rail-w");
    };
  }, [expanded]);

  React.useEffect(() => {
    if (!flyout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlyout(null);
    };
    const onDown = (e: PointerEvent) => {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) setFlyout(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [flyout]);

  // The group button shows the tool in use.
  const drawTools: { id: string; name: string; icon: Icon }[] = [
    { id: "select", name: "Select", icon: MousePointer2 },
    ...(canAnnotate ? NOTE_TOOLS.map((t) => ({ ...t, name: `Note · ${t.name}` })) : []),
    ...(canCreateBlock ? [{ id: "create_block", name: "Draw a building", icon: PlusCircle }] : []),
    ...(canSetLocation ? [{ id: "set_location", name: "Set school location", icon: MapPinned }] : []),
  ];
  const activeDraw = drawTools.find((t) => t.id === activeTool);
  const activeMeasure = MEASURE_TOOL_2D.find((m) => m.mode === measurementMode);
  const measureIcon = activeMeasure ? VIEWER_TOOLS[activeMeasure.tool].icon : Ruler;
  const styleChanged = basemapStyle !== "google" || kmzOpacity < 0.99 || visuals.brightness !== 1 || visuals.contrast !== 1 || visuals.saturation !== 1;

  const flyoutTitle = flyout === "draw" ? "Draw & notes" : flyout === "measure" ? "Measure" : "Map style";

  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={shellRef}
        className="pointer-events-none fixed inset-x-3 bottom-3 z-30 flex flex-col items-end gap-3 md:inset-auto md:bottom-4 md:right-4 md:top-4"
      >
        <motion.nav
          aria-label="Map tools"
          initial={reduce ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={cn(
            "pointer-events-auto flex max-w-full items-center rounded-[1.375rem] p-1.5 md:max-h-full md:rounded-[1.75rem] md:transition-[width] md:duration-300",
            expanded ? "md:w-52" : "md:w-14",
            "bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10",
            "shadow-[0_12px_40px_-16px_rgba(15,23,42,0.4)]",
          )}
        >
          <div className="flex w-full flex-row items-center gap-1 overflow-x-auto no-scrollbar md:max-h-full md:flex-col md:items-stretch md:overflow-y-auto md:overflow-x-hidden md:py-0.5">
            <RailButton
              label={expanded ? "Hide names" : "Show names"}
              icon={expanded ? PanelRightClose : PanelRightOpen}
              expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="hidden md:flex"
            />
            {onClose && <RailButton label="Close" icon={X} expanded={expanded} onClick={onClose} />}
            <RailButton label="School overview" icon={Info} expanded={expanded} active={showBasicInfo} onClick={() => setShowBasicInfo(!showBasicInfo)} />
            {onHelp && <RailButton label="Help" hint="?" icon={HelpCircle} expanded={expanded} onClick={onHelp} />}

            <Divider expanded={expanded} label="Explore" />
            <RailButton label="Layers" icon={Layers} expanded={expanded} active={showNavigator} onClick={() => setShowNavigator((v) => !v)} />
            <RailButton
              label="Buildings"
              icon={Building2}
              expanded={expanded}
              active={showBuildingsList}
              badge={openReports || undefined}
              badgeLabel={openReports ? `${openReports} with open reports` : undefined}
              onClick={() => setShowBuildingsList((v) => !v)}
            />
            {onGallery && <RailButton label="Gallery" icon={Images} expanded={expanded} onClick={onGallery} />}
            <RailButton label="Places" icon={MapPin} expanded={expanded} active={showPlacesOverlay} onClick={() => setShowPlacesOverlay(!showPlacesOverlay)} />

            <Divider expanded={expanded} label="Tools" />
            <RailButton
              label={activeDraw ? activeDraw.name : "Draw & notes"}
              icon={activeDraw?.icon ?? PenLine}
              expanded={expanded}
              group
              open={flyout === "draw"}
              active={!!activeDraw && activeTool !== "none"}
              onClick={(el) => openFlyout("draw", el)}
            />
            {(canMeasure || setShowMeasureList) && (
              <RailButton
                label={activeMeasure ? VIEWER_TOOLS[activeMeasure.tool].label : "Measure"}
                icon={measureIcon}
                expanded={expanded}
                group
                open={flyout === "measure"}
                active={!!activeMeasure || !!showMeasureList}
                badge={measureCount || undefined}
                badgeLabel={measureCount ? `${measureCount} measurements` : undefined}
                onClick={(el) => openFlyout("measure", el)}
              />
            )}
            <RailButton
              label="Map style"
              icon={Palette}
              expanded={expanded}
              group
              open={flyout === "style"}
              dot={styleChanged}
              onClick={(el) => openFlyout("style", el)}
            />

            <Divider expanded={expanded} label="View" />
            <RailButton label="Zoom in" icon={ZoomIn} expanded={expanded} onClick={onZoomIn} />
            <RailButton label="Zoom out" icon={ZoomOut} expanded={expanded} onClick={onZoomOut} />
            <RailButton label="Reset view" icon={Home} expanded={expanded} onClick={onHome} />
            <RailButton label="Save as image" icon={Download} expanded={expanded} onClick={onExportPng} />
            {on3DView && <RailButton label="Open in 3D" icon={Box} expanded={expanded} tone="brand" onClick={on3DView} />}
          </div>
        </motion.nav>

        {/* Flyout: beside the rail on desktop (lined up with its button), above the bar on phones */}
        <AnimatePresence>
          {flyout && (
            <motion.div
              key={flyout}
              role="dialog"
              aria-label={flyoutTitle}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 10, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: EASE }}
              style={"top" in flyoutPos ? { ["--fly-top" as string]: `${flyoutPos.top}px` } : { ["--fly-bottom" as string]: `${flyoutPos.bottom}px` }}
              className={cn(
                "pointer-events-auto absolute bottom-17 right-0 max-h-[70vh] w-[min(17rem,calc(100vw-1.5rem))] origin-bottom-right overflow-y-auto rounded-3xl p-2 no-scrollbar",
                "top" in flyoutPos ? "md:bottom-auto md:top-(--fly-top) md:origin-top-right" : "md:top-auto md:bottom-(--fly-bottom)",
                expanded ? "md:right-55" : "md:right-17",
                "bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_8%)]/60 dark:ring-white/10",
                "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
              )}
            >
              <div className="flex items-center justify-between px-2 pb-1 pt-1">
                <p className="text-xs text-slate-700 dark:text-white/50">{flyoutTitle}</p>
                <button
                  type="button"
                  onClick={() => setFlyout(null)}
                  aria-label="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-900/5 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/8 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              {flyout === "draw" && (
                <ul className="space-y-0.5">
                  {drawTools.map((t, i) => (
                    <FlyItem key={t.id} index={i} icon={t.icon} label={t.name} active={activeTool === t.id} onClick={() => pickTool(t.id)} />
                  ))}
                  {activeTool !== "none" && activeTool !== "select" && (
                    <FlyItem index={drawTools.length} icon={X} label="Stop" muted onClick={() => pickTool(activeTool)} />
                  )}
                </ul>
              )}

              {flyout === "measure" && (
                <ul className="space-y-0.5">
                  {canMeasure &&
                    MEASURE_TOOL_2D.map(({ mode, tool }, i) => {
                      const def = VIEWER_TOOLS[tool];
                      return <FlyItem key={mode} index={i} icon={def.icon} label={def.label} hint={def.shortcut?.toUpperCase()} active={measurementMode === mode} onClick={() => pickMeasure(mode)} />;
                    })}
                  {setShowMeasureList && (
                    <FlyItem
                      index={3}
                      icon={ListOrdered}
                      label="Saved measurements"
                      hint={measureCount ? String(measureCount) : undefined}
                      active={!!showMeasureList}
                      onClick={() => {
                        setShowMeasureList((v) => !v);
                        setFlyout(null);
                      }}
                    />
                  )}
                  {measurementMode !== "none" && <FlyItem index={4} icon={Trash2} label="Stop measuring" hint="Esc" muted onClick={stopMeasuring} />}
                </ul>
              )}

              {flyout === "style" && (
                <div className="space-y-4 px-1 pb-1">
                  <div className="grid grid-cols-3 gap-1">
                    {BASEMAPS.map((bm) => {
                      const on = basemapStyle === bm.id;
                      return (
                        <button
                          key={bm.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => switchBasemap(bm.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-2xl py-2.5 text-[11px] transition-colors",
                            on ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-900/5 dark:text-white/70 dark:hover:bg-white/8",
                          )}
                        >
                          <bm.icon className="h-4 w-4" aria-hidden />
                          {bm.name}
                        </button>
                      );
                    })}
                  </div>
                  <Slider label="Site map opacity" value={kmzOpacity} min={0} max={1} step={0.01} onChange={setKmzOpacity} />
                  {VISUALS.map((fx) => (
                    <Slider key={fx.key} label={fx.label} value={visuals[fx.key]} min={0.5} max={2} step={0.05} onChange={(v) => setVisuals((cur) => ({ ...cur, [fx.key]: v }))} />
                  ))}
                  {styleChanged && (
                    <button
                      type="button"
                      onClick={() => {
                        switchBasemap("google");
                        setKmzOpacity(1);
                        setVisuals({ brightness: 1, contrast: 1, saturation: 1 });
                      }}
                      className="w-full rounded-full py-2 text-xs text-slate-700 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white"
                    >
                      Reset style
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};

function Divider({ expanded, label }: { expanded: boolean; label: string }) {
  return expanded ? (
    <span className="hidden px-3 pb-0.5 pt-2 text-[11px] text-slate-600 md:block dark:text-white/35">{label}</span>
  ) : (
    <span className="mx-0.5 h-6 w-px shrink-0 self-center bg-slate-900/8 md:mx-0 md:my-0.5 md:h-px md:w-6 dark:bg-white/10" aria-hidden />
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-white/65">{label}</span>
        <span className="tabular-nums text-slate-900 dark:text-white">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-900/8 accent-primary dark:bg-white/10"
      />
    </label>
  );
}

function FlyItem({
  icon: IconCmp,
  label,
  hint,
  active,
  muted,
  index,
  onClick,
}: {
  icon: Icon;
  label: string;
  hint?: string;
  active?: boolean;
  muted?: boolean;
  index: number;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li initial={reduce ? false : { opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: index * 0.025, ease: EASE }}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          active
            ? "bg-primary text-white"
            : muted
              ? "text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white"
              : "text-slate-800 hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/8",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
            active ? "bg-white/20" : "bg-white/60 text-slate-700 group-hover:text-primary dark:bg-white/6 dark:text-white/60",
          )}
          aria-hidden
        >
          <IconCmp className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {hint && (
          <kbd className={cn("rounded px-1.5 font-sans text-[10px]", active ? "bg-white/20 text-white" : "bg-slate-900/5 text-slate-600 dark:bg-white/8 dark:text-white/45")}>{hint}</kbd>
        )}
      </button>
    </motion.li>
  );
}

function RailButton({
  label,
  hint,
  icon: IconCmp,
  onClick,
  expanded,
  active,
  open,
  group,
  badge,
  badgeLabel,
  dot,
  tone,
  className,
}: {
  label: string;
  hint?: string;
  icon: Icon;
  onClick: (el: HTMLButtonElement) => void;
  expanded: boolean;
  active?: boolean;
  /** Its flyout is open. */
  open?: boolean;
  /** Opens a flyout of tools. */
  group?: boolean;
  badge?: number;
  badgeLabel?: string;
  /** A small "changed" marker. */
  dot?: boolean;
  tone?: "brand";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const btn = (
    <motion.button
      type="button"
      aria-label={badgeLabel ? `${label}, ${badgeLabel}` : label}
      aria-pressed={group ? undefined : active !== undefined ? !!active : undefined}
      aria-expanded={group ? !!open : undefined}
      aria-haspopup={group ? "dialog" : undefined}
      onClick={(e) => onClick(e.currentTarget)}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      className={cn(
        "relative flex h-10 shrink-0 items-center gap-3 rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        expanded ? "w-10 md:w-full md:justify-start md:px-3" : "w-10 justify-center",
        active
          ? "bg-primary text-white"
          : open
            ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-200"
            : tone === "brand"
              ? "bg-primary/10 text-primary hover:bg-primary hover:text-white dark:text-blue-300"
              : "text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white",
        !expanded && "justify-center",
        className,
      )}
    >
      <span className="relative flex shrink-0 items-center justify-center">
        <IconCmp className="h-4 w-4" />
        {/* A group button carries a tiny corner mark: it opens more tools. */}
        {group && !expanded && <span className={cn("absolute -bottom-1.5 -right-1.5 h-0 w-0 border-l-[4px] border-t-[4px] border-l-transparent", active ? "border-t-white/70" : "border-t-current opacity-50")} style={{ transform: "rotate(-45deg)" }} aria-hidden />}
      </span>
      {expanded && <span className="hidden min-w-0 flex-1 truncate text-left text-[13px] md:block">{label}</span>}
      {expanded && hint && <kbd className="hidden rounded bg-slate-900/5 px-1.5 font-sans text-[10px] text-slate-600 md:inline dark:bg-white/8 dark:text-white/45">{hint}</kbd>}
      {expanded && group && <ChevronRight className={cn("hidden h-3.5 w-3.5 shrink-0 opacity-60 transition-transform md:block", open && "rotate-90")} aria-hidden />}
      {badge != null && (
        <motion.span
          key={badge}
          initial={reduce ? false : { scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] tabular-nums text-white ring-2 ring-white dark:ring-[hsl(224_40%_7%)]",
            expanded ? "absolute -right-0.5 -top-0.5 md:static md:ring-0" : "absolute -right-0.5 -top-0.5",
            active && "bg-white text-primary",
          )}
          aria-hidden
        >
          {badge > 99 ? "99+" : badge}
        </motion.span>
      )}
      {dot && !badge && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
    </motion.button>
  );
  if (expanded) return <span className="contents">{btn}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="left" className="hidden text-xs md:block">
        {label}
        {hint && <span className="ml-1.5 opacity-60">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
