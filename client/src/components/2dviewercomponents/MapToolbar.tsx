import React from "react";
import {
  X,
  Globe,
  Ruler,
  Square,
  Search,
  Layers,
  Trash2,
  ZoomIn,
  ZoomOut,
  Home,
  Satellite,
  Moon,
  Map as MapIcon2,
  Download,
  Info,
  SlidersHorizontal,
  MousePointer2,
  MessageSquare,
  PlusCircle,
  Type,
  MousePointer,
  PenTool,
  Box,
  MapPin,
  Building2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface MapToolbarProps {
  onClose?: () => void;
  showNavigator: boolean;
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  showOpacitySlider: boolean;
  setShowOpacitySlider: React.Dispatch<React.SetStateAction<boolean>>;
  basemapStyle: string;
  switchBasemap: (style: any) => void;
  measurementMode: "none" | "distance" | "area";
  setMeasurementMode: React.Dispatch<
    React.SetStateAction<"none" | "distance" | "area">
  >;
  clearMeasurements: () => void;
  activeTool: string;
  setActiveTool: React.Dispatch<React.SetStateAction<any>>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHome: () => void;
  onFitExtent: () => void;
  onExportPng: () => void;
  on3DView?: () => void;
  showBasicInfo: boolean;
  setShowBasicInfo: React.Dispatch<React.SetStateAction<boolean>>;
  kmzOpacity: number;
  setKmzOpacity: (val: number) => void;
  visuals: { brightness: number; contrast: number; saturation: number };
  setVisuals: React.Dispatch<
    React.SetStateAction<{
      brightness: number;
      contrast: number;
      saturation: number;
    }>
  >;
  showPlacesOverlay: boolean;
  setShowPlacesOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  showBuildingsList: boolean;
  setShowBuildingsList: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
  onClose,
  showNavigator,
  setShowNavigator,
  showOpacitySlider,
  setShowOpacitySlider,
  basemapStyle,
  switchBasemap,
  measurementMode,
  setMeasurementMode,
  clearMeasurements,
  activeTool,
  setActiveTool,
  onZoomIn,
  onZoomOut,
  onHome,
  onFitExtent,
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
}) => {
  const [showVisuals, setShowVisuals] = React.useState(false);
  const [showBasemaps, setShowBasemaps] = React.useState(false);
  const [showAnnotationTools, setShowAnnotationTools] = React.useState(false);

  // Helper to handle tool selection and deactivate others
  const handleToolClick = (tool: string) => {
    if (activeTool === tool) {
      setActiveTool("none");
    } else {
      setActiveTool(tool);
      if (measurementMode !== "none") {
        setMeasurementMode("none");
        clearMeasurements();
      }
      setShowBasemaps(false);
      setShowVisuals(false);
      setShowOpacitySlider(false);
    }
    if (!tool.startsWith("annotate")) {
      setShowAnnotationTools(false);
    }
  };

  const handleMeasureClick = (mode: "distance" | "area") => {
    if (measurementMode === mode) {
      setMeasurementMode("none");
      clearMeasurements();
    } else {
      setMeasurementMode(mode);
      setActiveTool("none");
      clearMeasurements();
      setShowAnnotationTools(false);
      setShowBasemaps(false);
      setShowVisuals(false);
      setShowOpacitySlider(false);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed inset-x-4 bottom-4 md:inset-auto md:right-4 md:top-4 md:bottom-4 z-30 flex flex-col items-end gap-3 pointer-events-none">
        <Card
          className={cn(
            "bg-white/90 dark:bg-card/95 backdrop-blur-2xl rounded-[26px] md:rounded-[32px] border border-slate-200 dark:border-white/10 p-1.5 md:p-2",
            "flex flex-row md:flex-col gap-1.5 md:gap-2",
            "pointer-events-auto max-w-[calc(100vw-32px)] md:w-[56px] md:max-h-full items-center transition-all duration-500",
            "selection:bg-transparent overflow-visible",
          )}
        >
          <div className="flex flex-row md:flex-col gap-1.5 md:gap-2 items-center w-full overflow-x-auto md:overflow-y-auto no-scrollbar md:custom-scrollbar md:max-h-full py-1">
            {/* Module 1: Session & System */}
            <div className="flex flex-row md:flex-col gap-1 shrink-0">
              {onClose && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 md:h-10 md:w-10 rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all"
                      onClick={onClose}
                    >
                      <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                    Close Viewer
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                      variant={showBasicInfo ? "default" : "ghost"}
                      size="icon"
                      className={cn(
                        "h-9 w-9 md:h-10 md:w-10 rounded-2xl",
                        showBasicInfo
                          ? "bg-primary text-white"
                          : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-primary dark:hover:text-white",
                      )}
                      onClick={() => setShowBasicInfo(!showBasicInfo)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Overview
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="hidden md:block h-px w-6 bg-white/10 shrink-0" />
            <div className="md:hidden w-px h-6 bg-white/10 shrink-0" />

            {/* Module 2: GIS Layers & Data */}
            <div className="flex flex-row md:flex-col gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showNavigator ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl",
                      showNavigator
                        ? "bg-primary text-white"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-primary dark:hover:text-white",
                    )}
                    onClick={() => setShowNavigator((v) => !v)}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  GIS Layers
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showBuildingsList ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl",
                      showBuildingsList
                        ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-indigo-600 dark:hover:text-indigo-400",
                    )}
                    onClick={() => setShowBuildingsList((v) => !v)}
                  >
                    <Building2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Buildings Catalog
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showPlacesOverlay ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl",
                      showPlacesOverlay
                        ? "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-orange-600 dark:hover:text-orange-400",
                    )}
                    onClick={() => setShowPlacesOverlay(!showPlacesOverlay)}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Searchable Places
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showBasemaps ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl transition-all",
                      showBasemaps
                        ? "bg-sky-500/20 text-sky-600 dark:text-sky-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-sky-600 dark:hover:text-sky-400",
                    )}
                    onClick={() => {
                      setShowBasemaps(!showBasemaps);
                      setShowVisuals(false);
                      setShowOpacitySlider(false);
                      setShowAnnotationTools(false);
                    }}
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Basemap Library
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="hidden md:block h-px w-6 bg-slate-200 dark:bg-white/10 shrink-0" />
            <div className="md:hidden w-px h-6 bg-slate-200 dark:bg-white/10 shrink-0" />

            {/* Module 3: Construction & Drawing */}
            <div className="flex flex-row md:flex-col gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "select" ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl",
                      activeTool === "select"
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-blue-400",
                    )}
                    onClick={() => handleToolClick("select")}
                  >
                    <MousePointer2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Selection Tool
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showAnnotationTools ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl transition-all",
                      showAnnotationTools
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-emerald-600 dark:hover:text-emerald-400",
                    )}
                    onClick={() => {
                      setShowAnnotationTools(!showAnnotationTools);
                      setShowBasemaps(false);
                      setShowVisuals(false);
                      setShowOpacitySlider(false);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Annotations
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      activeTool === "create_block" ? "default" : "ghost"
                    }
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl transition-all",
                      activeTool === "create_block"
                        ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-purple-600 dark:hover:text-purple-400",
                    )}
                    onClick={() => handleToolClick("create_block")}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Design New Block
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="hidden md:block h-px w-6 bg-white/10 shrink-0" />
            <div className="md:hidden w-px h-6 bg-white/10 shrink-0" />

            {/* Module 4: Spatial Analysis */}
            <div className="flex flex-row md:flex-col gap-1 shrink-0 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      measurementMode === "distance" ? "default" : "ghost"
                    }
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl transition-all",
                      measurementMode === "distance"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-amber-600 dark:hover:text-amber-400",
                    )}
                    onClick={() => handleMeasureClick("distance")}
                  >
                    <Ruler className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Measure Distance
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={measurementMode === "area" ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl transition-all",
                      measurementMode === "area"
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-emerald-600 dark:hover:text-emerald-400",
                    )}
                    onClick={() => handleMeasureClick("area")}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Measure Area
                </TooltipContent>
              </Tooltip>

              {measurementMode !== "none" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 md:h-9 md:w-9 rounded-xl text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setMeasurementMode("none");
                        clearMeasurements();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl"
                  >
                    Reset Measure
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="hidden md:block h-px w-6 bg-slate-200 dark:bg-white/10 shrink-0" />
            <div className="md:hidden w-px h-6 bg-slate-200 dark:bg-white/10 shrink-0" />

            {/* Module 5: View & Navigation */}
            <div className="flex flex-row md:flex-col gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showOpacitySlider ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl",
                      showOpacitySlider
                        ? "bg-primary text-white"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-primary dark:hover:text-white",
                    )}
                    onClick={() => {
                      setShowOpacitySlider(!showOpacitySlider);
                      setShowBasemaps(false);
                      setShowVisuals(false);
                      setShowAnnotationTools(false);
                    }}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Adjust Opacity
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showVisuals ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-9 w-9 md:h-10 md:w-10 rounded-2xl transition-all",
                      showVisuals
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-blue-600 dark:hover:text-blue-400",
                    )}
                    onClick={() => {
                      setShowVisuals(!showVisuals);
                      setShowBasemaps(false);
                      setShowOpacitySlider(false);
                      setShowAnnotationTools(false);
                    }}
                  >
                    <Satellite className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Visual Post-FX
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-white/50 hover:text-primary dark:hover:text-white"
                    onClick={onZoomIn}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Zoom In
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10 rounded-2xl"
                    onClick={onZoomOut}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Zoom Out
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10 rounded-2xl"
                    onClick={onFitExtent}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Fit to Extent
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10 rounded-2xl"
                    onClick={onExportPng}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Export Map Image
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10 rounded-2xl"
                    onClick={onHome}
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                  Reset Home View
                </TooltipContent>
              </Tooltip>

              {on3DView && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 md:h-10 md:w-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all group"
                      onClick={on3DView}
                    >
                      <Globe className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="hidden md:flex items-center px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white text-xs font-medium shadow-xl">
                    3D Digital Twin
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </Card>

        {/* Popovers */}
        <div className="relative pointer-events-auto">
          {/* Annotation Type Popover */}
          {showAnnotationTools && (
            <Card className="absolute bottom-full right-0 md:bottom-auto md:top-[-460px] md:right-16 mb-3 md:mb-0 bg-white/95 dark:bg-card/95 backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/10 p-3 animate-in slide-in-from-bottom md:slide-in-from-right-4 duration-300 w-44 flex flex-col gap-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/60 mb-1 px-1">
                Toolbox
              </div>
              <div className="grid grid-cols-1 gap-1">
                {[
                  {
                    id: "annotate_point",
                    name: "Location Pin",
                    icon: <MousePointer className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "annotate_line",
                    name: "Path / Boundary",
                    icon: <PenTool className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "annotate_poly",
                    name: "Area Polygon",
                    icon: <Box className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "annotate_text",
                    name: "Text Label",
                    icon: <Type className="h-3.5 w-3.5" />,
                  },
                ].map((tool) => (
                  <Button
                    key={tool.id}
                    variant={activeTool === tool.id ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex items-center justify-start gap-3 h-10 px-3 rounded-xl border-slate-100 dark:border-white/5",
                      activeTool === tool.id
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-transparent text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5",
                    )}
                    onClick={() => {
                      handleToolClick(tool.id);
                      setShowAnnotationTools(false);
                    }}
                  >
                    {tool.icon}
                    <span className="text-[10px] font-black uppercase tracking-tight">
                      {tool.name}
                    </span>
                  </Button>
                ))}
                <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[9px] font-black uppercase text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 h-9 rounded-xl transition-colors"
                  onClick={() => {
                    setActiveTool("none");
                    setShowAnnotationTools(false);
                  }}
                >
                  Deactivate Tools
                </Button>
              </div>
            </Card>
          )}

          {/* Basemap Switcher Popover */}
          {showBasemaps && (
            <Card className="absolute bottom-full right-0 md:bottom-auto md:top-[-440px] md:right-4 mb-3 md:mb-0 bg-white/95 dark:bg-card/95 backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/10 p-4 animate-in slide-in-from-bottom md:slide-in-from-right-4 duration-300 w-64">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/60 mb-4">
                Basemap Library
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "google",
                    name: "Google",
                    icon: <Globe className={cn("h-4 w-4", basemapStyle === "google" ? "text-white" : "text-sky-500")} />,
                  },
                  {
                    id: "satellite",
                    name: "Sentinel",
                    icon: <Satellite className="h-4 w-4" />,
                  },
                  {
                    id: "street",
                    name: "Roadmap",
                    icon: <MapIcon2 className="h-4 w-4" />,
                  },
                  {
                    id: "dark",
                    name: "Dark Sky",
                    icon: <Moon className="h-4 w-4" />,
                  },
                  {
                    id: "offline",
                    name: "Local Cache",
                    icon: <Download className="h-4 w-4" />,
                  },
                  {
                    id: "ghost",
                    name: "Ultra Lite",
                    icon: <Layers className="h-4 w-4" />,
                  },
                ].map((bm) => (
                  <Button
                    key={bm.id}
                    variant={basemapStyle === bm.id ? "default" : "outline"}
                    className={cn(
                      "flex flex-col items-center gap-2 h-auto py-3 rounded-2xl border-slate-100 dark:border-white/5 transition-all text-slate-600 dark:text-white/70",
                      basemapStyle === bm.id
                        ? "ring-2 ring-primary bg-primary text-white"
                        : "hover:bg-slate-50 dark:hover:bg-white/5",
                    )}
                    onClick={() => switchBasemap(bm.id)}
                  >
                    {bm.icon}
                    <span className="text-[9px] font-bold uppercase tracking-tighter">
                      {bm.name}
                    </span>
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Opacity Slider Popover */}
          {showOpacitySlider && (
            <Card className="absolute bottom-full right-0 md:bottom-auto md:top-[-100px] md:right-4 mb-3 md:mb-0 bg-white/95 dark:bg-card/95 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/10 p-5 animate-in slide-in-from-bottom md:slide-in-from-right-4 duration-300 w-56">
              <div className="flex items-center justify-between mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground/60">
                <span>Layer Opacity</span>
                <span className="tabular-nums font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                  {Math.round(kmzOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={kmzOpacity}
                onChange={(e) => setKmzOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </Card>
          )}

          {/* Visual Adjustments Popover */}
          {showVisuals && (
            <Card className="absolute bottom-full right-0 md:bottom-auto md:top-[-40px] md:right-4 mb-3 md:mb-0 bg-white/95 dark:bg-card/95 backdrop-blur-3xl rounded-3xl border border-slate-200 dark:border-white/10 p-5 animate-in slide-in-from-bottom md:slide-in-from-right-4 duration-300 w-64 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Satellite className="h-3 w-3" />
                  Visual Post-FX
                </span>
                <button
                  onClick={() =>
                    setVisuals({ brightness: 1, contrast: 1, saturation: 1 })
                  }
                  className="text-[9px] font-black text-slate-400 dark:text-muted-foreground hover:text-primary dark:hover:text-white uppercase transition-colors"
                >
                  Default
                </button>
              </div>

              <div className="space-y-5">
                {[
                  {
                    label: "Brightness",
                    key: "brightness",
                    icon: <Globe className="h-3 w-3" />,
                  },
                  {
                    label: "Contrast",
                    key: "contrast",
                    icon: <SlidersHorizontal className="h-3 w-3" />,
                  },
                  {
                    label: "Saturation",
                    key: "saturation",
                    icon: <Square className="h-3 w-3" />,
                  },
                ].map((fx) => (
                  <div key={fx.key} className="space-y-2.5">
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-500 dark:text-white/40 uppercase tracking-widest">
                      <span className="flex items-center gap-2">
                        {fx.icon} {fx.label}
                      </span>
                      <span className="text-slate-900 dark:text-white/80 tabular-nums">
                        {visuals[fx.key as keyof typeof visuals].toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={visuals[fx.key as keyof typeof visuals]}
                      onChange={(e) =>
                        setVisuals((v) => ({
                          ...v,
                          [fx.key]: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
