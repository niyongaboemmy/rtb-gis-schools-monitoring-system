import React from "react";
import {
  Building2,
  MapPin,
  X,
  Layers,
  Search,
  Trash2,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { BuildingData } from "../school-form-steps/BuildingsStep";
import { ANNOTATION_ICONS } from "./AnnotationPickerModal";
import { SearchInput } from "../ui/search-input";

interface LayerManagerProps {
  onClose: () => void;
  schoolBuildings: BuildingData[];
  siteAnnotations: any[];
  onDeleteAnnotation: (id: string) => void;
  onSelectBuilding: (b: BuildingData) => void;
  onFlyToAnnotation: (ann: any) => void;
  selectedBuildingId?: string;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  onClose,
  schoolBuildings,
  siteAnnotations,
  onDeleteAnnotation,
  onSelectBuilding,
  onFlyToAnnotation,
  selectedBuildingId,
}) => {
  const [activeTab, setActiveTab] = React.useState<"features" | "buildings">(
    "features",
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeTab === "buildings" && selectedBuildingId && listRef.current) {
      const element = listRef.current.querySelector(`[data-id="${selectedBuildingId}"]`);
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

  return (
    <Card
      className={cn(
        "fixed z-40 bg-background/80 backdrop-blur-3xl border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] md:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition-all duration-500 ease-out",
        "inset-x-0 bottom-0 h-[60vh] rounded-t-[32px] md:rounded-[24px]", // Mobile: bottom sheet
        "md:inset-auto md:right-20 md:top-4 md:w-85 md:h-auto md:max-h-[calc(100vh-60px)]", // Desktop: floating panel
        "animate-in slide-in-from-bottom md:slide-in-from-right-4",
      )}
    >
      {/* Mobile Drag Handle */}
      <div className="flex md:hidden justify-center pt-3 pb-1 shrink-0">
        <div className="w-12 h-1.5 rounded-full bg-white/20" />
      </div>

      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.15em] text-foreground/80">
            GIS Panel
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex p-1 gap-1 border-b border-white/5 bg-white/5">
        {[
          { id: "features", label: "Features", icon: MapPin },
          { id: "buildings", label: "Buildings", icon: Building2 },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "flex-1 flex flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-full transition-all duration-300 relative",
              activeTab === t.id
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black uppercase tracking-tighter">
              {t.label}
            </span>
            {activeTab === t.id && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]" />
            )}
          </button>
        ))}
      </div>

      <div className="p-3 border-b border-white/5">
        <SearchInput
          placeholder={`Search ${activeTab === "features" ? "site features" : "building blocks"}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
          className="h-9 text-[11px] bg-transparent border-white/10 rounded-xl focus-visible:ring-primary/40 focus:bg-black/40 transition-all font-medium"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[300px]">
        {activeTab === "features" && (
          <>
            {filteredAnnotations.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <MapPin className="h-6 w-6 opacity-20" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-40">
                  No site features
                </p>
              </div>
            ) : (
              filteredAnnotations.map((ann: any) => {
                const iconType =
                  ann.icon || ann.iconType || ann.style?.iconType || "pin";
                const iconDef =
                  ANNOTATION_ICONS.find((ic) => ic.id === iconType) ||
                  ANNOTATION_ICONS[0];
                const IconComp = iconDef.icon;
                return (
                  <div
                    key={ann.id}
                    onClick={() => onFlyToAnnotation(ann)}
                    className="group flex items-center justify-between p-2.5 rounded-2xl transition-all border border-transparent hover:bg-white/10 hover:border-white/10 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center border shadow-inner",
                          iconDef.bg,
                          iconDef.border,
                        )}
                      >
                        <IconComp className={cn("h-5 w-5", iconDef.color)} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-foreground/90 leading-tight">
                          {ann.title || ann.label || "Untitled Annotation"}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] uppercase font-black tracking-tighter",
                            iconDef.color + "/60",
                          )}
                        >
                          {iconDef.label} · {ann.type}
                        </span>
                        {ann.description && (
                          <span className="text-[8px] text-white/30 font-medium mt-0.5 truncate max-w-[140px]">
                            {ann.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-10 group-hover:opacity-100 transition-all">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAnnotation(ann.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
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
                <p className="text-[10px] uppercase font-black tracking-widest opacity-40">
                  No blocks found
                </p>
              </div>
            ) : (
              filteredBuildings.map((b) => (
                <div
                  key={b.id}
                  data-id={b.id}
                  onClick={() => onSelectBuilding(b)}
                  className={cn(
                    "group flex items-center justify-between p-2.5 rounded-2xl transition-all border cursor-pointer",
                    selectedBuildingId === b.id 
                      ? "bg-primary/10 border-primary/40 shadow-sm" 
                      : "border-transparent hover:bg-white/10 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                      <Building2 className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[11px] font-bold leading-tight",
                          selectedBuildingId === b.id ? "text-primary" : "text-foreground/90"
                        )}>
                          {b.buildingName || "Unnamed Block"}
                        </span>
                        {b.buildingCondition === "good" && (
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                        )}
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
