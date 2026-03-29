import React from "react";
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Layers, 
  Image as ImageIcon,
  X,
  Building2,
  MapPin,
  Search,
  CheckCircle2,
  Navigation2
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";
import { OverlayUploader } from "./OverlayUploader";
import type { BuildingData } from "../school-form-steps/BuildingsStep";

interface LayerManagerProps {
  schoolId: string;
  manifest: any;
  onUpdateManifest: (newManifest: any) => void;
  onClose: () => void;
  visibleLayers: Set<number>;
  setVisibleLayers: React.Dispatch<React.SetStateAction<Set<number>>>;
  schoolBuildings: BuildingData[];
  siteAnnotations: any[];
  onDeleteAnnotation: (id: string) => void;
  onSelectBuilding: (b: BuildingData) => void;
  onFlyToAnnotation: (ann: any) => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  schoolId,
  manifest,
  onUpdateManifest,
  onClose,
  visibleLayers,
  setVisibleLayers,
  schoolBuildings,
  siteAnnotations,
  onDeleteAnnotation,
  onSelectBuilding,
  onFlyToAnnotation
}) => {
  const [activeTab, setActiveTab] = React.useState<"imagery" | "features" | "buildings">("imagery");
  const [isUploading, setIsUploading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const toggleLayer = (index: number) => {
    const next = new Set(visibleLayers);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setVisibleLayers(next);
  };

  const removeLayer = async (index: number) => {
    if (!confirm("Are you sure you want to remove this drone overlay?")) return;
    try {
      const res = await api.delete(`/schools/${schoolId}/kmz/2d/overlays/${index}`);
      if (res.data.success) {
        onUpdateManifest(res.data.manifest);
      }
    } catch (err) {
      console.error("Failed to remove overlay", err);
    }
  };

  const groundOverlays = manifest?.groundOverlays || [];

  const filteredBuildings = React.useMemo(() => {
    if (!searchQuery.trim()) return schoolBuildings;
    const q = searchQuery.toLowerCase();
    return schoolBuildings.filter(b => 
      b.buildingName?.toLowerCase().includes(q) || 
      b.buildingCode?.toLowerCase().includes(q)
    );
  }, [schoolBuildings, searchQuery]);

  const filteredAnnotations = React.useMemo(() => {
    if (!searchQuery.trim()) return siteAnnotations;
    const q = searchQuery.toLowerCase();
    return siteAnnotations.filter(a => a.label?.toLowerCase().includes(q));
  }, [siteAnnotations, searchQuery]);

  return (
    <Card className="fixed right-20 top-4 w-80 bg-background/80 backdrop-blur-3xl border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] z-40 overflow-hidden rounded-[24px] animate-in slide-in-from-right-4 duration-300 flex flex-col max-h-[calc(100vh-40px)]">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.15em] text-foreground/80">GIS Panel</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex p-1 gap-1 border-b border-white/5 bg-white/5">
        {[
          { id: "imagery", label: "Imagery", icon: ImageIcon },
          { id: "features", label: "Features", icon: MapPin },
          { id: "buildings", label: "Buildings", icon: Building2 },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all duration-300 relative",
              activeTab === t.id 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.label}</span>
            {activeTab === t.id && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]" />
            )}
          </button>
        ))}
      </div>

      {activeTab !== "imagery" && (
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-[11px] bg-black/20 border-white/10 rounded-xl focus-visible:ring-primary/40 focus:bg-black/40 transition-all font-medium"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[300px]">
        {activeTab === "imagery" && (
          <>
            {groundOverlays.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <ImageIcon className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-40">No drone imagery</p>
              </div>
            ) : (
              groundOverlays.map((layer: any, idx: number) => (
                <div 
                  key={idx}
                  className={cn(
                    "group flex items-center justify-between p-2.5 rounded-2xl transition-all border border-transparent hover:bg-white/10 hover:border-white/10",
                    visibleLayers.has(idx) ? "bg-white/5" : "opacity-40 grayscale"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden border border-white/5 shadow-inner">
                      {layer.imageUrl ? (
                        <img src={layer.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-foreground/90 leading-tight truncate max-w-[140px]">
                        {layer.name || `Drone Overlay #${idx + 1}`}
                      </span>
                      <span className="text-[9px] text-primary/60 uppercase font-black tracking-tighter">Site Map Layer</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-xl transition-all",
                        visibleLayers.has(idx) ? "bg-primary/20 text-primary" : "text-muted-foreground"
                      )}
                      onClick={() => toggleLayer(idx)}
                    >
                      {visibleLayers.has(idx) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-xl hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeLayer(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "features" && (
          <>
            {filteredAnnotations.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <MapPin className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-40">No site features</p>
              </div>
            ) : (
              filteredAnnotations.map((ann: any) => (
                <div 
                  key={ann.id}
                  onClick={() => onFlyToAnnotation(ann)}
                  className="group flex items-center justify-between p-2.5 rounded-2xl transition-all border border-transparent hover:bg-white/10 hover:border-white/10 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                      <Navigation2 className="h-5 w-5 text-amber-500 rotate-45" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-foreground/90 leading-tight">
                        {ann.label || "Untitled Annotation"}
                      </span>
                      <span className="text-[9px] text-amber-500/60 uppercase font-black tracking-tighter">
                        {ann.type} Measurement
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-10 group-hover:opacity-100 transition-all">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-xl hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(ann.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "buildings" && (
          <>
            {filteredBuildings.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Building2 className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-40">No blocks found</p>
              </div>
            ) : (
              filteredBuildings.map((b) => (
                <div 
                  key={b.id}
                  onClick={() => onSelectBuilding(b)}
                  className="group flex items-center justify-between p-2.5 rounded-2xl transition-all border border-transparent hover:bg-white/10 hover:border-white/10 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                      <Building2 className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-foreground/90 leading-tight">
                          {b.buildingName || "Unnamed Block"}
                        </span>
                        {b.buildingCondition === 'good' && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
                      </div>
                      <span className="text-[9px] text-blue-500/60 uppercase font-black tracking-tighter">
                        Code: {b.buildingCode || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="h-6 w-6 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-white/5 mt-auto">
        {activeTab === "imagery" && (
          <>
            {isUploading ? (
              <OverlayUploader 
                schoolId={schoolId} 
                onSuccess={(newManifest: any) => {
                  onUpdateManifest(newManifest);
                  setIsUploading(false);
                }} 
                onCancel={() => setIsUploading(false)} 
              />
            ) : (
              <Button 
                className="w-full h-11 rounded-[16px] gap-2.5 text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white transition-all shadow-xl shadow-primary/20 group"
                onClick={() => setIsUploading(true)}
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                Add Drone Overlay
              </Button>
            )}
          </>
        )}
        
        {activeTab === "features" && (
          <p className="text-[9px] text-center text-muted-foreground uppercase font-black tracking-widest py-1">
            Use GIS Tools to add more features
          </p>
        )}

        {activeTab === "buildings" && (
          <p className="text-[9px] text-center text-muted-foreground uppercase font-black tracking-widest py-1">
            Manage blocks via GIS toolbar
          </p>
        )}
      </div>
    </Card>
  );
};
