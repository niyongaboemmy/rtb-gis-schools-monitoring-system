import React from "react";
import {
  X,
  Globe,
  Ruler,
  Square,
  Search,
  Eye,
  EyeOff,
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
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

interface MapToolbarProps {
  onClose?: () => void;
  showNavigator: boolean;
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  showPlacesOverlay: boolean;
  setShowPlacesOverlay: React.Dispatch<React.SetStateAction<boolean>>;
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
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
  onClose,
  showNavigator,
  setShowNavigator,
  showPlacesOverlay,
  setShowPlacesOverlay,
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
}) => {
  const [showVisuals, setShowVisuals] = React.useState(false);
  return (
    <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
      <Card className="bg-background/60 backdrop-blur-xl rounded-2xl border border-border/10 p-2 flex flex-col gap-1 shadow-xl">
        {/* Close */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
            onClick={onClose}
            title="Close viewer"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Feature navigator */}
        <Button
          variant={showNavigator ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setShowNavigator((v) => !v)}
          title="Feature navigator"
        >
          <Layers className="h-4 w-4" />
        </Button>

        {/* Places overlay toggle */}
        <Button
          variant={showPlacesOverlay ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            showPlacesOverlay && "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          )}
          onClick={() => setShowPlacesOverlay((v) => !v)}
          title={showPlacesOverlay ? "Hide places overlay" : "Show places overlay"}
        >
          {showPlacesOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>

        {/* KMZ opacity */}
        <Button
          variant={showOpacitySlider ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => {
            setShowOpacitySlider((v) => !v);
            setShowVisuals(false);
          }}
          title="KMZ layer opacity"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>

        {/* Visual Adjustments Toggle */}
        <Button
          variant={showVisuals ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            showVisuals && "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          )}
          onClick={() => {
            setShowVisuals(!showVisuals);
            setShowOpacitySlider(false);
          }}
          title="Adjust Visuals (GPU)"
        >
          <Satellite className="h-4 w-4" />
        </Button>

        <div className="h-px bg-border/20 mx-1" />

        {/* Basemaps */}
        <Button
          variant={basemapStyle === "google" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl border border-white/10"
          onClick={() => switchBasemap("google")}
          title="Google Satellite"
        >
          <Globe className="h-4 w-4 text-sky-400" />
        </Button>

        <Button
          variant={basemapStyle === "satellite" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => switchBasemap("satellite")}
          title="Esri World Imagery"
        >
          <Satellite className="h-4 w-4" />
        </Button>

        <Button
          variant={basemapStyle === "dark" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => switchBasemap("dark")}
          title="Dark basemap"
        >
          <Moon className="h-4 w-4" />
        </Button>

        <Button
          variant={basemapStyle === "street" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => switchBasemap("street")}
          title="Street map"
        >
          <MapIcon2 className="h-4 w-4" />
        </Button>

        <Button
          variant={basemapStyle === "nsdi" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => switchBasemap("nsdi")}
          title="Official Rwanda NSDI map"
        >
          <Globe className="h-4 w-4" />
        </Button>

        <Button
          variant={basemapStyle === "offline" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => switchBasemap("offline")}
          title="Offline cached map (PMTiles)"
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          variant={basemapStyle === "ghost" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => switchBasemap("ghost")}
          title="Low bandwidth mode"
        >
          <Layers className="h-4 w-4" />
        </Button>

        <div className="h-px bg-border/20 mx-1" />

        {/* Measurement Tools */}
        <Button
          variant={measurementMode === "distance" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            measurementMode === "distance" && "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          )}
          onClick={() => setMeasurementMode((m) => (m === "distance" ? "none" : "distance"))}
          title="Measure distance"
        >
          <Ruler className="h-4 w-4" />
        </Button>

        <Button
          variant={measurementMode === "area" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            measurementMode === "area" && "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
          )}
          onClick={() => setMeasurementMode((m) => (m === "area" ? "none" : "area"))}
          title="Measure area"
        >
          <Square className="h-4 w-4" />
        </Button>

        {measurementMode !== "none" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setMeasurementMode("none");
              clearMeasurements();
            }}
            title="Clear measurements"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        <div className="h-px bg-border/20 mx-1" />

        {/* Advanced GIS Tools */}
        <Button
          variant={activeTool === "select" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            activeTool === "select" && "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          )}
          onClick={() => setActiveTool(activeTool === "select" ? "none" : "select")}
          title="Select Building"
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>

        <Button
          variant={activeTool === "annotate_point" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            activeTool === "annotate_point" && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
          )}
          onClick={() => setActiveTool(activeTool === "annotate_point" ? "none" : "annotate_point")}
          title="Annotate Point"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        <Button
          variant={activeTool === "annotate_line" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            activeTool === "annotate_line" && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
          )}
          onClick={() => setActiveTool(activeTool === "annotate_line" ? "none" : "annotate_line")}
          title="Annotate Line"
        >
          <Ruler className="h-4 w-4" />
        </Button>

        <Button
          variant={activeTool === "annotate_poly" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            activeTool === "annotate_poly" && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
          )}
          onClick={() => setActiveTool(activeTool === "annotate_poly" ? "none" : "annotate_poly")}
          title="Annotate Area"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant={activeTool === "create_block" ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl",
            activeTool === "create_block" && "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
          )}
          onClick={() => setActiveTool(activeTool === "create_block" ? "none" : "create_block")}
          title="Create School Block"
        >
          <PlusCircle className="h-4 w-4" />
        </Button>

        <div className="h-px bg-border/20 mx-1" />

        {/* Navigation & Export */}
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onZoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onHome} title="Default view">
          <Home className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onFitExtent} title="Fit to imagery">
          <Search className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onExportPng} title="Export PNG">
          <Download className="h-4 w-4" />
        </Button>

        <Button
          variant={showBasicInfo ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => setShowBasicInfo(!showBasicInfo)}
          title="School Information"
        >
          <Info className="h-4 w-4" />
        </Button>
      </Card>

      {/* Opacity Slider Overlay */}
      {showOpacitySlider && (
        <Card className="bg-background/80 backdrop-blur-2xl rounded-2xl border border-border/10 p-4 shadow-2xl animate-in slide-in-from-right-4 duration-300 w-48">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-3 w-3" />
              KMZ Opacity
            </span>
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
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
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between mt-2">
             <button 
               onClick={() => setKmzOpacity(0)} 
               className="text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase font-bold"
             >
               Hide
             </button>
             <button 
               onClick={() => setKmzOpacity(1)} 
               className="text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase font-bold"
             >
               Full
             </button>
          </div>
        </Card>
      )}

      {/* Visual Adjustments Overlay */}
      {showVisuals && (
        <Card className="bg-background/80 backdrop-blur-2xl rounded-2xl border border-border/10 p-4 shadow-2xl animate-in slide-in-from-right-4 duration-300 w-56 flex flex-col gap-4">
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
        </Card>
      )}
    </div>
  );
};
