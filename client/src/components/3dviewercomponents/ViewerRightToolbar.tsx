/**
 * 3D viewer toolbar (WS4.2 / WS7.4). Tool buttons come from the shared
 * vocabulary (lib/viewer-tools) so names, icons and shortcuts match the 2D
 * map. Tools the user lacks permission for are hidden, not disabled.
 */
import React, { useState } from "react";
import {
  X, Building2, Layers, SlidersHorizontal, ListOrdered, Download, Home, RefreshCcw,
  Check, HelpCircle, Eye, Map as MapIcon, Wrench, ChevronRight,
} from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useAuthorization } from "../../hooks/useAuthorization";
import { toolTitle, toolsFor, type ViewerToolId } from "../../lib/viewer-tools";

type RenderMode = "unlit" | "lit" | "wireframe";
type VisibilityMode = "all" | "annotations" | "measures" | "clear";

const TOOL_IDS: ViewerToolId[] = [
  "navigate",
  "measure_distance",
  "measure_area",
  "measure_perimeter",
  "measure_height",
  "annotate",
];

const VISIBILITY_LABEL: Record<VisibilityMode, string> = {
  all: "Showing measurements and notes",
  annotations: "Showing notes only",
  measures: "Showing measurements only",
  clear: "Hiding measurements and notes",
};

interface ViewerRightToolbarProps {
  onClose?: () => void;
  showHelp: boolean;
  setShowHelp: (val: boolean | ((p: boolean) => boolean)) => void;
  showBuildingsList: boolean;
  setShowBuildingsList: (val: boolean | ((p: boolean) => boolean)) => void;
  buildingsCount?: number;
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  modeLabels: Record<RenderMode, string>;
  speedIdx: number;
  speedSteps: number[];
  speedUp: () => void;
  speedDown: () => void;
  activeTool: ViewerToolId;
  onSelectTool: (id: ViewerToolId) => void;
  showMeasurePanel: boolean;
  setShowMeasurePanel: (val: boolean | ((p: boolean) => boolean)) => void;
  measureCount: number;
  visibility: VisibilityMode;
  cycleVisibility: () => void;
  handleScreenshot: () => void;
  screenshotFlash: boolean;
  handleResetCamera: () => void;
  handleSaveHome: () => void;
  saveFlash: boolean;
  toggleOrientation: () => void;
  on2DView?: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background";

const ToolButton: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: number;
}> = ({ label, active, onClick, children, className, badge }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors",
          active ? "bg-primary/15 text-primary dark:text-blue-300" : "text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10",
          focusRing,
          className,
        )}
      >
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[8px] font-black text-white">
            {badge}
          </span>
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="left">{label}</TooltipContent>
  </Tooltip>
);

const Divider = () => <div className="h-px w-6 shrink-0 bg-slate-200 dark:bg-white/10 max-md:h-6 max-md:w-px" />;

export const ViewerRightToolbar: React.FC<ViewerRightToolbarProps> = ({
  onClose, showHelp, setShowHelp, showBuildingsList, setShowBuildingsList, buildingsCount,
  renderMode, setRenderMode, modeLabels, speedIdx, speedSteps, speedUp, speedDown,
  activeTool, onSelectTool, showMeasurePanel, setShowMeasurePanel, measureCount,
  visibility, cycleVisibility, handleScreenshot, screenshotFlash, handleResetCamera,
  handleSaveHome, saveFlash, toggleOrientation, on2DView,
}) => {
  const { hasPermission } = useAuthorization();
  const tools = toolsFor("3d", hasPermission, TOOL_IDS);
  const [showRenders, setShowRenders] = useState(false);
  const [showSpeeds, setShowSpeeds] = useState(false);
  // Phones: start collapsed so the model is visible; one tap opens the tools.
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  const fmtSpeed = (s: number) => (s >= 1000 ? `${(s / 1000).toFixed(1)}k` : s.toFixed(1));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pointer-events-none fixed inset-x-2 bottom-2 z-30 flex flex-col items-end gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:top-6">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Show tools"
            className={cn("pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-background/90 px-4 text-sm font-semibold shadow-xl backdrop-blur-xl", focusRing)}
          >
            <Wrench className="h-4 w-4" /> Tools
          </button>
        ) : (
          <Card
            role="toolbar"
            aria-label="3D viewer tools"
            className="pointer-events-auto flex max-w-full flex-row items-center gap-1 overflow-x-auto rounded-3xl border border-slate-200 bg-background/90 p-1.5 shadow-2xl backdrop-blur-2xl no-scrollbar dark:border-white/6 md:w-14 md:flex-col md:overflow-y-auto md:rounded-4xl md:p-2"
          >
            <ToolButton label="Hide tools" onClick={() => setCollapsed(true)} className="md:hidden">
              <ChevronRight className="h-4 w-4" />
            </ToolButton>
            {onClose && (
              <ToolButton label="Close viewer" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
                <X className="h-4 w-4" />
              </ToolButton>
            )}
            <ToolButton label="Help & shortcuts (?)" active={showHelp} onClick={() => setShowHelp(!showHelp)}>
              <HelpCircle className="h-4 w-4" />
            </ToolButton>
            {on2DView && (
              <ToolButton label="Open in 2D map" onClick={on2DView}>
                <MapIcon className="h-4 w-4" />
              </ToolButton>
            )}

            <Divider />

            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <ToolButton key={t.id} label={toolTitle(t)} active={activeTool === t.id} onClick={() => onSelectTool(t.id)}>
                  <Icon className="h-4 w-4" />
                </ToolButton>
              );
            })}
            <ToolButton label="Measurements list" active={showMeasurePanel} badge={measureCount} onClick={() => setShowMeasurePanel((v) => !v)}>
              <ListOrdered className="h-4 w-4" />
            </ToolButton>
            <ToolButton label={`${VISIBILITY_LABEL[visibility]} — click to change`} active={visibility !== "all"} onClick={cycleVisibility}>
              <Eye className="h-4 w-4" />
            </ToolButton>

            <Divider />

            <ToolButton label="Buildings list" active={showBuildingsList} badge={buildingsCount} onClick={() => setShowBuildingsList(!showBuildingsList)}>
              <Building2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Render mode" active={showRenders} onClick={() => { setShowRenders(!showRenders); setShowSpeeds(false); }}>
              <Layers className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Movement speed" active={showSpeeds} onClick={() => { setShowSpeeds(!showSpeeds); setShowRenders(false); }}>
              <SlidersHorizontal className="h-4 w-4" />
            </ToolButton>

            <Divider />

            <ToolButton label="Save screenshot" onClick={handleScreenshot} className={cn(screenshotFlash && "animate-pulse")}>
              <Download className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Save this view as home" onClick={handleSaveHome} className={cn(saveFlash && "bg-emerald-500/20 text-emerald-400")}>
              <Home className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Return to home view" onClick={handleResetCamera}>
              <RefreshCcw className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Flip model orientation" onClick={toggleOrientation}>
              <RefreshCcw className="h-4 w-4 rotate-90" />
            </ToolButton>
          </Card>
        )}

        <div className="pointer-events-auto relative">
          {showRenders && (
            <Card className="absolute bottom-14 right-0 flex w-48 flex-col gap-1 rounded-3xl border border-slate-200 bg-background/95 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/6 md:-bottom-25 md:right-16">
              <div className="mb-1 px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Render mode</div>
              {(["unlit", "lit", "wireframe"] as RenderMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={renderMode === m}
                  className={cn(
                    "flex h-10 items-center justify-between rounded-xl border border-slate-200 px-3 text-xs font-semibold dark:border-white/10",
                    renderMode === m && "border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                    focusRing,
                  )}
                  onClick={() => { setRenderMode(m); setShowRenders(false); }}
                >
                  {modeLabels[m]}
                  {renderMode === m && <Check className="h-3 w-3" />}
                </button>
              ))}
            </Card>
          )}
          {showSpeeds && (
            <Card className="absolute bottom-14 right-0 flex w-56 flex-col gap-3 rounded-3xl border border-slate-200 bg-background/95 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/6 md:-bottom-10 md:right-16">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Movement speed</div>
                <div className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">{fmtSpeed(speedSteps[speedIdx])}</div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Decrease movement speed" className={cn("h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40", focusRing)} onClick={speedDown} disabled={speedIdx <= 0}>−</button>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(speedIdx / (speedSteps.length - 1)) * 100}%` }} />
                </div>
                <button type="button" aria-label="Increase movement speed" className={cn("h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40", focusRing)} onClick={speedUp} disabled={speedIdx >= speedSteps.length - 1}>+</button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default React.memo(ViewerRightToolbar);
