import { useState } from "react";
import { 
  Building2, 
  Info, 
  MessageSquare, 
  Image as ImageIcon, 
  Pencil, 
  Calendar, 
  Layers, 
  Maximize2, 
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { BuildingData } from "./school-form-steps/BuildingsStep";

interface BlockInspectorProps {
  building: BuildingData;
  onEdit: (building: BuildingData) => void;
  onClose: () => void;
  onUpdateBuilding: (building: BuildingData) => Promise<void>;
  onAddAnnotation?: () => void;
  onUploadMedia?: () => void;
}

export function BlockInspector({ 
  building, 
  onEdit, 
  onClose,
  onUpdateBuilding: _onUpdateBuilding,
  onAddAnnotation,
  onUploadMedia
}: BlockInspectorProps) {
  const [activeTab, setActiveTab] = useState<"details" | "annotate" | "media">("details");

  const conditionColors: Record<string, string> = {
    good: "bg-green-500/10 text-green-600 border-green-500/20",
    fair: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    poor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    critical: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <div className="w-[380px] bg-background/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[600px] animate-in fade-in zoom-in duration-200">
      {/* Header */}
      <div className="p-4 bg-primary/5 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 shadow-sm">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground leading-tight">
              {building.buildingName || "Unnamed Block"}
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
              {building.buildingCode || "NO-CODE"}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex p-1 bg-muted/30 border-b border-border/20">
        {[
          { id: "details", label: "Details", icon: Info },
          { id: "annotate", label: "Annotate", icon: MessageSquare },
          { id: "media", label: "Media", icon: ImageIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all",
              activeTab === tab.id 
                ? "bg-background shadow-sm text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === "details" && (
          <div className="p-4 space-y-5">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/10">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Condition</p>
                <div className="mt-1">
                  <Badge variant="outline" className={cn("text-[10px] uppercase font-black px-1.5 h-5", conditionColors[building.buildingCondition] || "bg-muted")}>
                    {building.buildingCondition}
                  </Badge>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border/10">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Function</p>
                <p className="mt-1 text-sm font-semibold truncate">{building.buildingFunction || "N/A"}</p>
              </div>
            </div>

            {/* Detailed Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Maximize2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Area Coverage</p>
                  <p className="font-medium">{building.buildingArea ? `${building.buildingArea} m²` : "Not specified"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Levels (Floors)</p>
                  <p className="font-medium">{building.buildingFloors || "1"} Floor(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Year Established</p>
                  <p className="font-medium">{building.buildingYearBuilt || "Unknown"}</p>
                </div>
              </div>
            </div>

            {building.buildingNotes && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[10px] text-primary font-bold uppercase mb-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Notes
                </p>
                <p className="text-xs italic text-muted-foreground line-clamp-3">
                  "{building.buildingNotes}"
                </p>
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full text-xs font-bold gap-2 rounded-xl group"
              onClick={() => onEdit(building)}
            >
              <Pencil className="w-3.5 h-3.5" />
              Modify Building Profile
            </Button>
          </div>
        )}

        {activeTab === "annotate" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Annotations</h4>
              <Badge variant="secondary" className="text-[10px]">{(building as any).annotations?.length || 0}</Badge>
            </div>

            {((building as any).annotations?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-2xl border border-dashed border-border/30">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <MessageSquare className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  No annotations yet. Use the tool below to add specialized notes.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(building as any).annotations.map((ann: any) => (
                  <div key={ann.id} className="p-3 rounded-xl bg-background border border-border/40 group hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <Badge variant="outline" className="text-[9px] h-4 font-bold bg-primary/5">{ann.type}</Badge>
                      <button className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-destructive transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{ann.content}</p>
                    <p className="text-[9px] text-muted-foreground mt-2 font-medium">
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Button 
              className="w-full text-xs font-bold gap-2 rounded-xl h-9"
              onClick={onAddAnnotation}
            >
              <Plus className="w-4 h-4" />
              Drop New Annotation
            </Button>
          </div>
        )}

        {activeTab === "media" && (
          <div className="p-4 space-y-4">
             <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gallery Assets</h4>
              <Badge variant="secondary" className="text-[10px]">{(building as any).media?.length || 0}</Badge>
            </div>

            {((building as any).media?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/10 rounded-2xl border border-dashed border-border/30">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  No visual assets available for this block.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(building as any).media.map((item: any) => (
                  <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border border-border/30 group">
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full text-xs font-bold gap-2 rounded-xl h-9 border-dashed"
              onClick={onUploadMedia}
            >
              <Plus className="w-4 h-4" />
              Upload Assets
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-muted/10 border-t border-border/20 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-medium">Synced with Server</span>
         </div>
         <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold p-0 px-2 hover:bg-transparent hover:text-primary">
            BLOCK REPORT
         </Button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
