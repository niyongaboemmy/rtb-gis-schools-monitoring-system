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

interface MapToolbarProps {
  onClose?: () => void;
  showNavigator: boolean;
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  showOpacitySlider: boolean;
  setShowOpacitySlider: React.Dispatch<React.SetStateAction<boolean>>;
  basemapStyle: string;
  switchBasemap: (style: any) => void;
  measurementMode: "none" | "distance" | "area";
  setMeasurementMode: React.Dispatch<React.SetStateAction<"none" | "distance" | "area">>;
  clearMeasurements: () => void;
  activeTool: string;
  setActiveTool: React.Dispatch<React.SetStateAction<any>>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHome: () => void;
  onFitExtent: () => void;
  onExportPng: () => void;
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
      // If we're setting a primary tool, clear measurements
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
      clearMeasurements(); // Clear previous measurement when switching types
      setShowAnnotationTools(false);
      setShowBasemaps(false);
      setShowVisuals(false);
      setShowOpacitySlider(false);
    }
  };

  return (
    <div className="absolute right-4 top-4 z-30 flex flex-col gap-3 items-end">
      <Card className="bg-background/80 backdrop-blur-2xl rounded-[26px] border border-white/10 p-2 flex flex-col gap-2 shadow-2xl w-[52px] items-center">
        {/* Exit & Info */}
        <div className="flex flex-col gap-1 w-full text-center">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-all"
              onClick={onClose}
              title="Close viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={showBasicInfo ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-2xl"
            onClick={() => setShowBasicInfo(!showBasicInfo)}
            title="School Information"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-px w-6 bg-white/5" />

        {/* GIS Panel Toggle */}
        <div className="flex flex-col gap-1 w-full text-center">
          <Button
            variant={showNavigator ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", showNavigator && "bg-primary text-white shadow-lg shadow-primary/20")}
            onClick={() => setShowNavigator((v) => !v)}
            title="GIS Panel (Imagery, Features, Buildings)"
          >
            <Layers className="h-4 w-4" />
          </Button>

          <Button
            variant={showBuildingsList ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", showBuildingsList && "bg-indigo-500/20 text-indigo-400")}
            onClick={() => setShowBuildingsList((v) => !v)}
            title="Building Directory"
          >
            <Building2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-px w-6 bg-white/5" />

        {/* GIS Tools Group */}
        <div className="flex flex-col gap-1 w-full">
          <Button
            variant={activeTool === "select" ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", activeTool === "select" && "bg-blue-500/20 text-blue-400")}
            onClick={() => handleToolClick("select")}
            title="Select"
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>

          <Button
            variant={activeTool.startsWith("annotate") ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", activeTool.startsWith("annotate") && "bg-emerald-500/20 text-emerald-400")}
            onClick={() => {
              setShowAnnotationTools(!showAnnotationTools);
              setShowBasemaps(false);
              setShowVisuals(false);
              setShowOpacitySlider(false);
            }}
            title="Annotations"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>

          <Button
            variant={activeTool === "create_block" ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", activeTool === "create_block" && "bg-purple-500/20 text-purple-400")}
            onClick={() => handleToolClick("create_block")}
            title="Create Block"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-px w-6 bg-white/5" />

        {/* Measurement Group */}
        <div className="flex flex-col gap-1 w-full font-bold">
          <Button
            variant={measurementMode === "distance" ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", measurementMode === "distance" && "bg-amber-500/20 text-amber-400")}
            onClick={() => handleMeasureClick("distance")}
            title="Distance Measurement"
          >
            <Ruler className="h-4 w-4" />
          </Button>

          <Button
            variant={measurementMode === "area" ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", measurementMode === "area" && "bg-amber-500/20 text-amber-400")}
            onClick={() => handleMeasureClick("area")}
            title="Area Measurement"
          >
            <Square className="h-4 w-4" />
          </Button>

          {measurementMode !== "none" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl text-destructive hover:bg-destructive/10"
              onClick={() => {
                setMeasurementMode("none");
                clearMeasurements();
              }}
              title="Clear Measurement"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="h-px w-6 bg-white/5" />

        {/* Visuals Group */}
        <div className="flex flex-col gap-1 w-full text-center">
          <Button
            variant={showBasemaps ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-2xl"
            onClick={() => {
              setShowBasemaps(!showBasemaps);
              setShowVisuals(false);
              setShowOpacitySlider(false);
            }}
            title="Switch Basemap"
          >
            <Globe className="h-4 w-4 text-sky-400" />
          </Button>

          <Button
            variant={showOpacitySlider ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-2xl"
            onClick={() => {
              setShowOpacitySlider(!showOpacitySlider);
              setShowBasemaps(false);
              setShowVisuals(false);
              setShowAnnotationTools(false);
            }}
            title="Opacity"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <Button
            variant={showPlacesOverlay ? "default" : "ghost"}
            size="icon"
            className={cn("h-9 w-9 rounded-2xl", showPlacesOverlay && "bg-orange-500/20 text-orange-400")}
            onClick={() => setShowPlacesOverlay(!showPlacesOverlay)}
            title="Toggle Places Overlay"
          >
            <MapPin className="h-4 w-4" />
          </Button>

          <Button
            variant={showVisuals ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-2xl"
            onClick={() => {
              setShowVisuals(!showVisuals);
              setShowBasemaps(false);
              setShowOpacitySlider(false);
              setShowAnnotationTools(false);
            }}
            title="Visuals"
          >
            <Satellite className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-px w-6 bg-white/5" />

        {/* Navigation & Utilities */}
        <div className="flex flex-col gap-1 w-full text-center">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={onZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={onZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={onFitExtent} title="Fit to Extent">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={onExportPng} title="Export PNG">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl" onClick={onHome} title="Home View">
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Popovers */}
      <div className="relative">
        {/* Annotation Type Popover */}
        {showAnnotationTools && (
          <Card className="absolute right-2 top-[-260px] bg-background/90 backdrop-blur-2xl rounded-2xl border border-white/10 p-3 shadow-2xl animate-in slide-in-from-right-4 duration-300 w-40 flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 px-1">Annotation Type</div>
            <div className="grid grid-cols-1 gap-1">
              {[
                { id: "annotate_point", name: "Point", icon: <MousePointer className="h-3 w-3" /> },
                { id: "annotate_line", name: "Polyline", icon: <PenTool className="h-3 w-3" /> },
                { id: "annotate_poly", name: "Polygon", icon: <Box className="h-3 w-3" /> },
                { id: "annotate_text", name: "Text Labl", icon: <Type className="h-3 w-3" /> },
              ].map((tool) => (
                <Button
                  key={tool.id}
                  variant={activeTool === tool.id ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex items-center justify-start gap-3 h-9 px-3 rounded-xl border-white/5",
                    activeTool === tool.id && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}
                  onClick={() => {
                    handleToolClick(tool.id);
                    setShowAnnotationTools(false);
                  }}
                >
                  {tool.icon}
                  <span className="text-[10px] font-bold uppercase tracking-tight">{tool.name}</span>
                </Button>
              ))}
              <div className="h-px bg-white/5 my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 h-8 rounded-lg"
                onClick={() => {
                  setActiveTool("none");
                  setShowAnnotationTools(false);
                }}
              >
                Cancel / Clear
              </Button>
            </div>
          </Card>
        )}

        {/* Basemap Switcher Popover */}
        {showBasemaps && (
          <Card className="absolute right-2 top-[-510px] bg-background/90 backdrop-blur-2xl rounded-2xl border border-white/10 p-4 shadow-2xl animate-in slide-in-from-right-4 duration-300 w-64">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Select Basemap</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "google", name: "Google Sat", icon: <Globe className="h-4 w-4 text-sky-400" /> },
                { id: "satellite", name: "Satellite", icon: <Satellite className="h-4 w-4" /> },
                { id: "street", name: "Street Map", icon: <MapIcon2 className="h-4 w-4" /> },
                { id: "dark", name: "Dark Mode", icon: <Moon className="h-4 w-4" /> },
                { id: "nsdi", name: "Official Rwanda NSDI", icon: <Globe className="h-4 w-4" /> },
                { id: "offline", name: "Offline Mode", icon: <Download className="h-4 w-4" /> },
                { id: "ghost", name: "Lite Mode", icon: <Layers className="h-4 w-4" /> },
              ].map((bm) => (
                <Button
                  key={bm.id}
                  variant={basemapStyle === bm.id ? "default" : "outline"}
                  className={cn(
                    "flex flex-col items-center gap-2 h-auto py-3 rounded-xl border-white/5",
                    basemapStyle === bm.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  onClick={() => switchBasemap(bm.id)}
                >
                  {bm.icon}
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{bm.name}</span>
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Opacity Slider Popover */}
        {showOpacitySlider && (
          <Card className="absolute right-2 top-[-80px] bg-background/90 backdrop-blur-2xl rounded-2xl border border-white/10 p-4 shadow-2xl animate-in slide-in-from-right-4 duration-300 w-48">
            <div className="flex items-center justify-between mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
               <span>KMZ Opacity</span>
               <span className="tabular-nums font-mono text-primary bg-primary/10 px-1 rounded">{Math.round(kmzOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={kmzOpacity}
              onChange={(e) => setKmzOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </Card>
        )}

        {/* Visual Adjustments Popover */}
        {showVisuals && (
          <Card className="absolute right-2 top-[-10px] bg-background/90 backdrop-blur-2xl rounded-2xl border border-white/10 p-4 shadow-2xl animate-in slide-in-from-right-4 duration-300 w-56 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <Satellite className="h-3 w-3" />
                GPU Visuals
              </span>
              <button 
                onClick={() => setVisuals({ brightness: 1, contrast: 1, saturation: 1 })}
                className="text-[9px] font-bold text-muted-foreground hover:text-white uppercase transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="space-y-4">
              {/* Brightness */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                  <span>Brightness</span>
                  <span className="text-white/80 tabular-nums">{visuals.brightness.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={visuals.brightness}
                  onChange={(e) => setVisuals(v => ({ ...v, brightness: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                  <span>Contrast</span>
                  <span className="text-white/80 tabular-nums">{visuals.contrast.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={visuals.contrast}
                  onChange={(e) => setVisuals(v => ({ ...v, contrast: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                  <span>Saturation</span>
                  <span className="text-white/80 tabular-nums">{visuals.saturation.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.1"
                  value={visuals.saturation}
                  onChange={(e) => setVisuals(v => ({ ...v, saturation: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
