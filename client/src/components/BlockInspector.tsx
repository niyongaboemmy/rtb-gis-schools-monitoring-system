import { useState, useEffect } from "react";
import {
  Building2,
  Maximize2,
  Pencil,
  X,
  Shield,
  Layers,
  Square,
  Calendar,
  Home,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import { BuildingMediaTab } from "./2dviewercomponents/BuildingMediaTab";
import { BuildingReportingTab } from "./2dviewercomponents/BuildingReportingTab";

interface BlockInspectorProps {
  building: BuildingData & Record<string, any>;
  schoolId: string;
  onEdit: (building: BuildingData) => void;
  onClose: () => void;
  onUpdateBuilding: (building: BuildingData) => Promise<void>;
  onAddAnnotation?: () => void;
  onUploadMedia?: () => void;
  on3DView?: () => void;
  initialTab?: "details" | "media" | "reporting";
}

export function BlockInspector({
  building,
  schoolId,
  onEdit,
  onClose,
  onUpdateBuilding,
  initialTab,
}: BlockInspectorProps) {
  const [activeTab, setActiveTab] = useState<"details" | "media" | "reporting">(
    initialTab ?? "details",
  );

  useEffect(() => {
    setActiveTab(initialTab ?? "details");
  }, [building.id, initialTab]);

  const conditionColors: Record<string, string> = {
    good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    fair: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    poor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };

  const statusValues: Record<string, number> = {
    good: 4,
    fair: 3,
    poor: 2,
    critical: 1,
  };

  const buildingStatus = (
    building.buildingCondition ||
    building.condition ||
    "fair"
  ).toLowerCase();
  const roofStatus = (
    building.buildingRoofCondition ||
    building.roofCondition ||
    "fair"
  ).toLowerCase();

  const avgVal = (statusValues[buildingStatus] + statusValues[roofStatus]) / 2;

  const getAvgLabel = (val: number) => {
    if (val >= 3.5) return "Good";
    if (val >= 2.5) return "Fair";
    if (val >= 1.5) return "Poor";
    return "Critical";
  };

  const avgLabel = getAvgLabel(avgVal);
  const avgColorClass =
    conditionColors[avgLabel.toLowerCase()] ||
    "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white";

  return (
    <div
      className={cn(
        "w-full md:w-[360px] bg-white/95 dark:bg-[#0f1117]/95 backdrop-blur-3xl border-t md:border-t-0 md:border-r border-slate-200 dark:border-white/10 flex flex-col h-full overflow-y-auto transition-all duration-500",
        "rounded-t-[32px] md:rounded-none z-60",
      )}
    >
      {/* Mobile Handle */}
      <div className="flex md:hidden justify-center py-2 shrink-0">
        <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 active:bg-slate-300 dark:active:bg-white/20 transition-colors cursor-grab active:cursor-grabbing" />
      </div>

      {/* Header */}
      <div className="px-5 pt-3 pb-4 flex items-center justify-between shrink-0 bg-linear-to-b from-slate-50 dark:from-white/3 to-transparent border-b border-slate-100 dark:border-white/2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-2xl bg-primary text-white shrink-0 group hover:scale-105 transition-transform">
            <Building2 className="w-4.5 h-4.5 group-hover:rotate-6 transition-transform" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight truncate tracking-tight">
              {building.buildingName ||
                building.name ||
                building.buildingCode ||
                building.code ||
                "Building Asset"}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-slate-400 dark:text-white/30 uppercase tracking-[0.2em] leading-none">
                {building.buildingCode || building.code || "ID-NONE"}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-300 dark:text-white/20 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-95 group"
        >
          <X className="w-4.5 h-4.5 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="px-5 py-2.5 shrink-0 bg-slate-50/50 dark:bg-[#0f1117]/50">
        <div className="flex gap-1 p-1 rounded-full bg-white dark:bg-card/95 border border-slate-200 dark:border-white/10">
          {["details", "media", "reporting"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "flex-1 py-1.5 rounded-full text-[13px] transition-all relative overflow-hidden group",
                activeTab === tab
                  ? "font-black bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/5"
                  : "text-slate-400 dark:text-white hover:text-slate-900 dark:hover:text-white/40 hover:bg-slate-50 dark:hover:bg-white/2",
              )}
            >
              {tab === "reporting" ? "Reports" : tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar min-h-0">
        {activeTab === "details" && (
          <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Status Section */}
            <div className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-card/30 border border-slate-200 dark:border-white/10 relative overflow-hidden group hover:border-slate-300 dark:hover:border-white/20 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <Shield className="w-20 h-20 -mr-6 -mt-4 rotate-12" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Scorecard
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">
                        {avgLabel}
                      </span>
                      <Badge
                        className={cn(
                          "px-2 py-0.5 rounded-lg border-slate-200 dark:border-white/10 font-bold text-[9px] uppercase",
                          avgColorClass,
                        )}
                      >
                        {((avgVal / 4) * 100).toFixed(0)}% Condition
                      </Badge>
                    </div>
                  </div>
                  <div className="w-12 h-12 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-white/5" />
                    <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-[spin_4s_linear_infinite]" />
                    <Shield className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Structure",
                    status: buildingStatus,
                    color: conditionColors[buildingStatus],
                    icon: Building2,
                  },
                  {
                    label: "Roofing",
                    status: roofStatus,
                    color: conditionColors[roofStatus],
                    icon: Home,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-2 px-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-3 h-3 text-slate-300 dark:text-white/20 group-hover:text-primary" />
                      <span className="text-[8px] font-black text-slate-400 dark:text-white/50 uppercase tracking-widest font-mono">
                        {item.label}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] font-black uppercase px-2.5 py-0 border-none",
                        item.color || "bg-white/10 text-white",
                      )}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Specifications */}
            <div className="space-y-2.5">
              <p className="text-[9px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.2em] pl-1 font-mono">
                Technical Specs
              </p>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 overflow-hidden backdrop-blur-3xl">
                {[
                  {
                    label: "Function",
                    value:
                      building.buildingFunction || building.function || "N/A",
                    icon: Layers,
                    color: "text-blue-500 dark:text-blue-400",
                  },
                  {
                    label: "Floors",
                    value:
                      (building.buildingFloors || building.floors || "1") +
                      " Floor(s)",
                    icon: Maximize2,
                    color: "text-purple-500 dark:text-purple-400",
                  },
                  {
                    label: "Area",
                    value:
                      (building.buildingArea ||
                        building.area ||
                        building.areaSquareMeters) &&
                      Number(
                        building.buildingArea ||
                          building.area ||
                          building.areaSquareMeters,
                      ) > 0
                        ? `${Number(building.buildingArea || building.area || building.areaSquareMeters).toFixed(0)}m²`
                        : "N/A",
                    icon: Square,
                    color: "text-emerald-500 dark:text-emerald-400",
                  },
                  {
                    label: "Year Built",
                    value:
                      building.buildingYearBuilt ||
                      building.yearBuilt ||
                      "Historic",
                    icon: Calendar,
                    color: "text-amber-500 dark:text-amber-400",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between p-3.5 hover:bg-slate-100 dark:hover:bg-white/3 transition-all group cursor-default",
                      i !== 3 &&
                        "border-b border-slate-100 dark:border-white/3",
                    )}
                  >
                    <div className="flex items-center gap-3 group-hover:translate-x-1 transition-transform">
                      <item.icon
                        className={cn("w-3.5 h-3.5 transition-all", item.color)}
                      />
                      <span className="text-[10px] font-normal text-slate-500 dark:text-white/60 uppercase tracking-wider">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 dark:text-white/70 group-hover:text-slate-900 dark:hover:text-white transition-colors tabular-nums">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Facilities */}
            {building.facilities && building.facilities.length > 0 && (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.2em] font-mono">
                    Facilities
                  </p>
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary text-[8px] font-black border-none rounded-full px-2.5 h-5"
                  >
                    {building.facilities.length} Rooms
                  </Badge>
                </div>
                <div className="space-y-2">
                  {building.facilities.map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group overflow-hidden relative"
                    >
                      <div className="absolute inset-y-0 left-0 w-0.5 bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Home className="w-4 h-4 text-slate-200 dark:text-white/10 group-hover:text-primary transition-all" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-600 dark:text-white/60 group-hover:text-slate-900 dark:hover:text-white truncate transition-colors tracking-tight">
                            {f.facility_name || f.name || "Facility"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-black border-slate-200 dark:border-white/5 bg-blue-50 dark:bg-blue-800/20 text-blue-600 dark:text-primary px-2 py-0.5 rounded-full group-hover:border-primary/20"
                      >
                        {f.number_of_rooms || f.count || 1} Rooms
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "media" && (
          <div className="flex-1 flex flex-col min-h-0 py-4 animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <BuildingMediaTab
              building={building}
              schoolId={schoolId}
              onUpdateBuilding={onUpdateBuilding}
            />
          </div>
        )}

        {activeTab === "reporting" && (
          <div className="flex-1 flex flex-col min-h-0 py-4 animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <BuildingReportingTab
              buildingId={building.id}
              schoolId={schoolId}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      {activeTab === "details" && (
        <div className="p-5 pt-3 shrink-0 border-t border-slate-100 dark:border-white/10 bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-md">
          <Button
            variant="outline"
            className="w-full h-12 text-[10px] font-black uppercase tracking-[0.25em] rounded-2xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/2 hover:bg-primary hover:border-primary hover:text-white transition-all duration-300 active:scale-[0.97] group"
            onClick={() => onEdit(building)}
          >
            <Pencil className="w-3.5 h-3.5 mr-2 group-hover:scale-110 transition-transform" />
            Edit Parameters
          </Button>
        </div>
      )}
    </div>
  );
}
