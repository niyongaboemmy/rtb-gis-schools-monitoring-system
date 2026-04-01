import React, { useState } from 'react';
import { 
  X, Building2, Layers, SlidersHorizontal, MessageSquare, 
  Ruler, Square, Box, Download, Home, RefreshCcw, Check, Trash2, HelpCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type RenderMode = "unlit" | "lit" | "wireframe";
type MeasureMode = "distance" | "area" | "perimeter" | "annotate" | null;
type Unit = "m" | "ft" | "in" | "cm" | "mm" | "km";
type VisibilityMode = "all" | "annotations" | "measures" | "clear";

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
  measureMode: MeasureMode;
  toggleMode: (mode: MeasureMode) => void;
  setMeasureMode: (m: MeasureMode) => void;
  unit: Unit;
  setUnit: (u: Unit) => void;
  unitLabels: Record<Unit, string>;
  visibility: VisibilityMode;
  cycleVisibility: () => void;
  finalizeMeasure: () => void;
  pendingPtsCount: number;
  handleScreenshot: () => void;
  screenshotFlash: boolean;
  handleResetCamera: () => void;
  handleSaveHome: () => void;
  saveFlash: boolean;
  toggleOrientation: () => void;
}

export const ViewerRightToolbar: React.FC<ViewerRightToolbarProps> = ({
  onClose,
  showHelp,
  setShowHelp,
  showBuildingsList,
  setShowBuildingsList,
  buildingsCount,
  renderMode,
  setRenderMode,
  modeLabels,
  speedIdx,
  speedSteps,
  speedUp,
  speedDown,
  measureMode,
  toggleMode,
  setMeasureMode,
  unit,
  setUnit,
  unitLabels,
  visibility,
  cycleVisibility,
  finalizeMeasure,
  pendingPtsCount,
  handleScreenshot,
  screenshotFlash,
  handleResetCamera,
  handleSaveHome,
  saveFlash,
  toggleOrientation
}) => {
  const [showRenders, setShowRenders] = useState(false);
  const [showSpeeds, setShowSpeeds] = useState(false);

  const fmtSpeed = (s: number) => s >= 1000 ? `${(s / 1000).toFixed(1)}k` : s.toFixed(1);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed right-6 top-6 bottom-6 z-30 flex flex-col items-end gap-3 pointer-events-none">
        <Card className="bg-background/80 backdrop-blur-2xl rounded-[32px] border border-white/10 p-2 flex flex-col gap-2 shadow-2xl pointer-events-auto items-center w-[56px] overflow-y-auto no-scrollbar">
          
          {/* Group 1: Session */}
          <div className="flex flex-col gap-1 shrink-0">
            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-destructive/10 hover:text-destructive" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Close Viewer</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={showHelp ? "default" : "ghost"} size="icon" className="h-10 w-10 rounded-2xl" onClick={() => setShowHelp(!showHelp)}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Help & Shortcuts</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-px w-6 bg-white/10 shrink-0" />

          {/* Group 2: Data & Layers */}
          <div className="flex flex-col gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={showBuildingsList ? "default" : "ghost"} 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl relative", showBuildingsList && "bg-indigo-500/20 text-indigo-400")} 
                  onClick={() => setShowBuildingsList(!showBuildingsList)}
                >
                  <Building2 className="h-4 w-4" />
                  {buildingsCount != null && buildingsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-black rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 border-2 border-[#1a1c23]">
                      {buildingsCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Buildings List</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={showRenders ? "default" : "ghost"} 
                  size="icon" 
                  className="h-10 w-10 rounded-2xl" 
                  onClick={() => {
                    setShowRenders(!showRenders);
                    setShowSpeeds(false);
                  }}
                >
                  <Layers className="h-4 w-4 text-emerald-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Render Modes</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-px w-6 bg-white/10 shrink-0" />

          {/* Group 3: Tools */}
          <div className="flex flex-col gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={showSpeeds ? "default" : "ghost"} 
                  size="icon" 
                  className="h-10 w-10 rounded-2xl" 
                  onClick={() => {
                    setShowSpeeds(!showSpeeds);
                    setShowRenders(false);
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Movement Speed</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={measureMode === "annotate" ? "default" : "ghost"} 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl", measureMode === "annotate" && "bg-blue-500/20 text-blue-400")} 
                  onClick={() => toggleMode("annotate")}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Annotate</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-px w-6 bg-white/10 shrink-0" />

          {/* Group 4: Measurements */}
          <div className="flex flex-col gap-1 shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={measureMode === "distance" ? "default" : "ghost"} 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl", measureMode === "distance" && "bg-amber-500/20 text-amber-400")} 
                  onClick={() => toggleMode("distance")}
                >
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Distance</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={measureMode === "area" ? "default" : "ghost"} 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl", measureMode === "area" && "bg-amber-500/20 text-amber-400")} 
                  onClick={() => toggleMode("area")}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Area</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={measureMode === "perimeter" ? "default" : "ghost"} 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl", measureMode === "perimeter" && "bg-amber-500/20 text-amber-400")} 
                  onClick={() => toggleMode("perimeter")}
                >
                  <Box className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Perimeter</TooltipContent>
            </Tooltip>

            {(measureMode || visibility !== "all") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10" 
                    onClick={() => {
                      if (measureMode) {
                        setMeasureMode(null);
                      } else {
                        cycleVisibility();
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Clear / Reset</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="h-px w-6 bg-white/10 shrink-0" />

          {/* Group 5: Views & Capture */}
          <div className="flex flex-col gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl", screenshotFlash && "animate-pulse")} 
                  onClick={handleScreenshot}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Screenshot</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-10 w-10 rounded-2xl", saveFlash && "bg-emerald-500/20 text-emerald-400")} 
                  onClick={handleSaveHome}
                >
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Save Home View</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-2xl" 
                  onClick={handleResetCamera}
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Return Home</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-2xl" 
                  onClick={toggleOrientation}
                >
                  <RefreshCcw className="h-4 w-4 rotate-90" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Flip Orientation</TooltipContent>
            </Tooltip>
          </div>
        </Card>

        {/* Popovers */}
        <div className="relative pointer-events-auto">
          {/* Render Modes Popover */}
          {showRenders && (
            <Card className="absolute bottom-[-100px] right-16 bg-background/90 backdrop-blur-2xl rounded-3xl border border-white/10 p-3 shadow-2xl w-44 flex flex-col gap-1 animate-in slide-in-from-right-4 duration-200">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 px-1">Render Mode</div>
              {(["unlit", "lit", "wireframe"] as RenderMode[]).map(m => (
                <Button
                  key={m}
                  variant={renderMode === m ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex items-center justify-between h-10 px-3 rounded-xl border-white/5",
                    renderMode === m && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}
                  onClick={() => { setRenderMode(m); setShowRenders(false); }}
                >
                  <span className="text-[10px] font-black uppercase tracking-tight">{modeLabels[m]}</span>
                  {renderMode === m && <Check className="h-3 w-3" />}
                </Button>
              ))}
            </Card>
          )}

          {/* Speed Control Popover */}
          {showSpeeds && (
            <Card className="absolute bottom-[-40px] right-16 bg-background/90 backdrop-blur-2xl rounded-3xl border border-white/10 p-4 shadow-2xl w-56 flex flex-col gap-4 animate-in slide-in-from-right-4 duration-200">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Movement Speed</div>
                <div className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{fmtSpeed(speedSteps[speedIdx])}</div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={speedDown} disabled={speedIdx <= 0}>-</Button>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(speedIdx / (speedSteps.length - 1)) * 100}%` }} />
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={speedUp} disabled={speedIdx >= speedSteps.length - 1}>+</Button>
              </div>
            </Card>
          )}

          {/* Measurement Unit Popover (Only if measuring) */}
          {measureMode && measureMode !== "annotate" && (
            <Card className="absolute bottom-[200px] right-16 bg-background/90 backdrop-blur-2xl rounded-3xl border border-white/10 p-3 shadow-2xl w-40 flex flex-col gap-1 animate-in slide-in-from-right-4 duration-200">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 px-1">Units</div>
              {(Object.keys(unitLabels) as Unit[]).map(u => (
                <Button
                  key={u}
                  variant={unit === u ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex items-center justify-between h-9 px-3 rounded-xl border-white/5",
                    unit === u && "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  )}
                  onClick={() => setUnit(u)}
                >
                  <span className="text-[10px] font-black uppercase">{unitLabels[u]}</span>
                  {unit === u && <Check className="h-3 w-3" />}
                </Button>
              ))}
            </Card>
          )}

          {/* Finalize Button */}
          {measureMode && pendingPtsCount >= 2 && measureMode !== "annotate" && (
            <div className="absolute top-[-60px] right-0 animate-in fade-in slide-in-from-bottom-2">
              <Button 
                onClick={finalizeMeasure} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-full shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Done ({pendingPtsCount} pts)
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default React.memo(ViewerRightToolbar);
