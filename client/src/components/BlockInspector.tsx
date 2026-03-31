import { Building2, Maximize2, Pencil, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { BuildingData } from "./school-form-steps/BuildingsStep";

interface BlockInspectorProps {
  building: BuildingData & Record<string, any>;
  onEdit: (building: BuildingData) => void;
  onClose: () => void;
  onUpdateBuilding: (building: BuildingData) => Promise<void>;
  onAddAnnotation?: () => void;
  onUploadMedia?: () => void;
  on3DView?: () => void;
}

export function BlockInspector({
  building,
  onEdit,
  onClose,
  on3DView,
}: BlockInspectorProps) {
  const conditionColors: Record<string, string> = {
    good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    fair: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    poor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="w-[260px] bg-background/90 backdrop-blur-3xl border-r border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.3)] flex flex-col animate-in fade-in slide-in-from-left-6 duration-700 overflow-hidden pointer-events-auto h-full border-l-0">
      {/* Compact Header */}
      <div className="p-4 pb-3 bg-linear-to-b from-white/10 to-transparent flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary shadow-lg shadow-primary/20 text-white shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[13px] text-white leading-tight mb-0.5 truncate pr-1">
              {building.buildingName ||
                building.name ||
                building.buildingCode ||
                building.code ||
                "Unnamed Block"}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[7.5px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/40 font-black uppercase tracking-widest border border-white/5 shrink-0">
                {building.buildingCode || building.code || "ID-NONE"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-90 group shrink-0"
        >
          <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Main Body - Compact Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-1 custom-scrollbar space-y-3 pb-5">
        {/* Vital Info Grid - Smaller items */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 shadow-inner flex flex-col justify-between">
            <p className="text-[6.5px] text-white/20 uppercase font-black tracking-widest mb-0.5 font-mono">
              Condition
            </p>
            <Badge
              variant="outline"
              className={cn(
                "text-[6.5px] uppercase font-bold px-1.5 h-3.5 border-0 shadow-xs",
                conditionColors[
                  building.buildingCondition || building.condition
                ] || "bg-white/10 text-white",
              )}
            >
              {building.buildingCondition || building.condition || "N/A"}
            </Badge>
          </div>
          <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 shadow-inner flex flex-col justify-between">
            <p className="text-[6.5px] text-white/20 uppercase font-black tracking-widest mb-0.5 font-mono">
              Roof
            </p>
            <Badge
              variant="outline"
              className={cn(
                "text-[6.5px] uppercase font-bold px-1.5 h-3.5 border-0 shadow-xs bg-white/10 text-white",
              )}
            >
              {building.buildingRoofCondition ||
                building.roofCondition ||
                "N/A"}
            </Badge>
          </div>
          <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 flex flex-col justify-between">
            <p className="text-[6.5px] text-white/20 uppercase font-black tracking-widest font-mono">
              Function
            </p>
            <p className="text-[9px] font-bold text-white/80 truncate leading-tight">
              {building.buildingFunction || building.function || "N/A"}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 flex flex-col justify-between">
            <p className="text-[6.5px] text-white/20 uppercase font-black tracking-widest font-mono">
              Year Built
            </p>
            <p className="text-[9px] font-bold text-white/80 tabular-nums leading-tight">
              {building.buildingYearBuilt || building.yearBuilt || "N/A"}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 flex flex-col justify-between">
            <p className="text-[6.5px] text-white/20 uppercase font-black tracking-widest font-mono">
              Area
            </p>
            <p className="text-[9px] font-bold text-white/80 tabular-nums leading-tight">
              {(building.buildingArea ||
                building.area ||
                building.areaSquareMeters) &&
              Number(
                building.buildingArea ||
                  building.area ||
                  building.areaSquareMeters,
              ) > 0
                ? `${Number(building.buildingArea || building.area || building.areaSquareMeters).toFixed(0)} m²`
                : "N/A"}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/3 border border-white/5 flex flex-col justify-between">
            <p className="text-[6.5px] text-white/20 uppercase font-black tracking-widest font-mono">
              Floors
            </p>
            <p className="text-[9px] font-bold text-white/80 leading-tight">
              {building.buildingFloors || building.floors || "1"}
            </p>
          </div>
        </div>

        {/* Compact Structural Score */}
        {(building.buildingStructuralScore || building.structuralScore) && (
          <div className="p-3 rounded-2xl bg-linear-to-br from-primary/10 to-transparent border border-primary/5 shadow-inner flex justify-between items-center group">
            <div>
              <p className="text-[6.5px] text-primary/80 font-black uppercase tracking-widest mb-0.5">
                Health Score
              </p>
              <p className="text-base font-black text-white tabular-nums leading-none">
                {building.buildingStructuralScore || building.structuralScore}
                <span className="text-[8px] text-white/20 font-medium ml-1">
                  / 100
                </span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center relative bg-black/20">
              <svg className="w-full h-full -rotate-90 p-0.5">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-white/2"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="81.6"
                  strokeDashoffset={
                    81.6 *
                    (1 -
                      Number(
                        building.buildingStructuralScore ||
                          building.structuralScore,
                      ) /
                        100)
                  }
                  strokeLinecap="round"
                  className="text-primary transition-all duration-1000"
                />
              </svg>
              <span className="absolute text-[6px] font-black text-primary/60">
                {building.buildingStructuralScore || building.structuralScore}%
              </span>
            </div>
          </div>
        )}

        {/* Compact Notes */}
        {(building.buildingNotes || building.notes) && (
          <div className="bg-white/2 p-3 rounded-2xl border border-white/5 italic">
            <p className="text-[9px] text-white/40 leading-relaxed font-medium">
              "{building.buildingNotes || building.notes}"
            </p>
          </div>
        )}

        {/* Compact Facilities */}
        {building.facilities && building.facilities.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[6.5px] text-white/10 uppercase font-black tracking-widest ml-1">
              Facilities ({building.facilities.length})
            </p>
            <div className="space-y-0.5">
              {building.facilities.map((f: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2 rounded-xl bg-white/2 border border-transparent hover:border-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-lg bg-white/5 text-white/10 shrink-0">
                      <Maximize2 className="w-2 h-2" />
                    </div>
                    <span className="text-[9px] font-bold text-white/60 truncate">
                      {f.facility_name || f.name || "Facility"}
                    </span>
                  </div>
                  <span className="text-[8px] font-black text-white/20 tabular-nums uppercase shrink-0 bg-white/5 px-1.5 py-0.5 rounded-md ml-2">
                    {f.number_of_rooms || f.count || 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compact Action Footer */}
      <div className="p-4 pt-4 grid grid-cols-2 gap-2 shrink-0 border-t border-white/5 bg-black/20">
        <Button
          variant="outline"
          className="h-8 text-[7px] font-black uppercase tracking-widest rounded-full border-white/5 hover:bg-white/10 hover:text-white text-white/40 transition-all group shrink-0"
          onClick={() => onEdit(building)}
        >
          <Pencil className="w-2 h-2 mr-1 transition-transform group-hover:scale-110" />
          Edit Block
        </Button>
        <Button
          className="h-8 bg-blue-600/80 hover:bg-blue-600 text-white font-black text-[7px] uppercase tracking-widest rounded-full border-none shadow-lg shadow-blue-600/10 transition-all group shrink-0"
          onClick={() => on3DView?.()}
        >
          <Maximize2 className="w-2 h-2 mr-1 transition-transform group-hover:scale-110" />
          3D Explorer
        </Button>
      </div>
    </div>
  );
}
