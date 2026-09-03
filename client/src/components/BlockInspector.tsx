import { useState, useEffect } from "react";
import {
  Building2,
  Maximize2,
  Pencil,
  X,
  Layers,
  Square,
  Calendar,
  Home,
} from "lucide-react";
import { Button } from "./ui/button";
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
  onReportStatusChange?: () => void;
}

const CONDITION_TONE: Record<
  string,
  { text: string; ring: string; chip: string; dot: string }
> = {
  good: {
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "stroke-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  fair: {
    text: "text-blue-600 dark:text-blue-400",
    ring: "stroke-blue-500",
    chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  poor: {
    text: "text-amber-600 dark:text-amber-400",
    ring: "stroke-amber-500",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  critical: {
    text: "text-red-600 dark:text-red-400",
    ring: "stroke-red-500",
    chip: "bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const STATUS_VALUE: Record<string, number> = {
  good: 4,
  fair: 3,
  poor: 2,
  critical: 1,
};

export function BlockInspector({
  building,
  schoolId,
  onEdit,
  onClose,
  onUpdateBuilding,
  initialTab,
  onReportStatusChange,
}: BlockInspectorProps) {
  const [activeTab, setActiveTab] = useState<"details" | "media" | "reporting">(
    initialTab ?? "details",
  );

  useEffect(() => {
    setActiveTab(initialTab ?? "details");
  }, [building.id, initialTab]);

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

  const avgVal =
    ((STATUS_VALUE[buildingStatus] ?? 3) + (STATUS_VALUE[roofStatus] ?? 3)) / 2;
  const avgLabel =
    avgVal >= 3.5
      ? "Good"
      : avgVal >= 2.5
        ? "Fair"
        : avgVal >= 1.5
          ? "Poor"
          : "Critical";
  const tone = CONDITION_TONE[avgLabel.toLowerCase()] ?? CONDITION_TONE.fair;
  const pct = Math.round((avgVal / 4) * 100);

  // Progress ring geometry
  const R = 26;
  const C = 2 * Math.PI * R;

  const name =
    building.buildingName ||
    building.name ||
    building.buildingCode ||
    building.code ||
    "Building Asset";
  const code = building.buildingCode || building.code || "NO-ID";

  const areaRaw =
    building.buildingArea || building.area || building.areaSquareMeters;
  const area =
    areaRaw && Number(areaRaw) > 0 ? `${Number(areaRaw).toFixed(0)} m²` : "N/A";

  const specs = [
    {
      label: "Function",
      value: building.buildingFunction || building.function || "N/A",
      icon: Layers,
    },
    {
      label: "Floors",
      value: `${building.buildingFloors || building.floors || "1"}`,
      icon: Maximize2,
    },
    {
      label: "Area",
      value: area,
      icon: Square,
    },
    {
      label: "Year built",
      value:
        building.buildingYearBuilt || building.yearBuilt || "Unknown",
      icon: Calendar,
    },
  ];

  const tabs = [
    { id: "details", label: "Details" },
    { id: "media", label: "Media" },
    { id: "reporting", label: "Reports" },
  ] as const;

  return (
    <div
      className={cn(
        "w-full md:w-90 flex flex-col h-full overflow-hidden",
        "bg-white/85 dark:bg-[#0d0f14]/85 backdrop-blur-2xl",
        "border-t md:border-t-0 md:border-l border-slate-200/70 dark:border-white/8",
        "rounded-t-[28px] md:rounded-none shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.25)] md:shadow-[-8px_0_40px_-12px_rgba(0,0,0,0.25)]",
        "z-70",
      )}
    >
      {/* Mobile grab handle */}
      <div className="flex md:hidden justify-center pt-2.5 pb-1 shrink-0">
        <div className="w-9 h-1.5 rounded-full bg-slate-300/70 dark:bg-white/15" />
      </div>

      {/* Header */}
      <div className="relative px-5 pt-4 pb-4 shrink-0">
        <div
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center w-11 h-11 rounded-2xl bg-linear-to-br from-primary to-primary/70 text-white shrink-0 shadow-lg shadow-primary/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[17px] leading-tight text-slate-900 dark:text-white truncate tracking-tight">
                {name}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/8 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 dark:text-white/45 tracking-wide">
                  {code}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-semibold",
                    tone.text,
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot)} />
                  {avgLabel}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors active:scale-95"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Segmented tabs */}
      <div className="px-5 pb-3 shrink-0">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                activeTab === tab.id
                  ? "bg-white dark:bg-white/12 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-white/45 hover:text-slate-700 dark:hover:text-white/70",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 custom-scrollbar min-h-0">
        {activeTab === "details" && (
          <div className="space-y-5 py-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {/* Condition hero */}
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200/70 dark:border-white/8 bg-slate-50/60 dark:bg-white/4">
              <div className="relative shrink-0 w-17 h-17">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r={R}
                    fill="none"
                    strokeWidth="6"
                    className="stroke-slate-200 dark:stroke-white/10"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={R}
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className={cn("transition-all duration-700", tone.ring)}
                    strokeDasharray={C}
                    strokeDashoffset={C - (pct / 100) * C}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <span className="text-[15px] font-bold text-slate-900 dark:text-white tabular-nums">
                    {pct}
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-white/40">
                      %
                    </span>
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">
                  Overall condition
                </p>
                <p
                  className={cn(
                    "text-lg font-bold tracking-tight leading-tight",
                    tone.text,
                  )}
                >
                  {avgLabel}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    { label: "Structure", status: buildingStatus },
                    { label: "Roof", status: roofStatus },
                  ].map((it) => {
                    const t =
                      CONDITION_TONE[it.status] ?? CONDITION_TONE.fair;
                    return (
                      <span
                        key={it.label}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                          t.chip,
                        )}
                      >
                        {it.label}: {it.status}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Specs grid */}
            <div>
              <p className="mb-2 pl-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                Specifications
              </p>
              <div className="grid grid-cols-2 gap-2">
                {specs.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-slate-200/70 dark:border-white/8 bg-white/60 dark:bg-white/4 p-3"
                  >
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-white/35">
                      <s.icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {s.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-bold text-slate-800 dark:text-white/90 truncate capitalize">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Facilities */}
            {building.facilities && building.facilities.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    Facilities
                  </p>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                    {building.facilities.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {building.facilities.map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 dark:border-white/8 bg-white/60 dark:bg-white/4 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Home className="w-4 h-4 text-slate-300 dark:text-white/25 shrink-0" />
                        <p className="text-[13px] font-semibold text-slate-700 dark:text-white/80 truncate">
                          {f.facility_name || f.name || "Facility"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-slate-100 dark:bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-white/50 tabular-nums">
                        {f.number_of_rooms || f.count || 1} rooms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "media" && (
          <div className="flex-1 flex flex-col min-h-0 py-3 animate-in fade-in slide-in-from-right-2 duration-300 overflow-hidden">
            <BuildingMediaTab
              building={building}
              schoolId={schoolId}
              onUpdateBuilding={onUpdateBuilding}
            />
          </div>
        )}

        {activeTab === "reporting" && (
          <div className="flex-1 flex flex-col min-h-0 py-3 animate-in fade-in slide-in-from-right-2 duration-300 overflow-hidden">
            <BuildingReportingTab
              buildingId={building.id}
              schoolId={schoolId}
              onReportStatusChange={onReportStatusChange}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      {activeTab === "details" && (
        <div className="p-4 shrink-0 border-t border-slate-200/70 dark:border-white/8 bg-white/70 dark:bg-[#0d0f14]/70 backdrop-blur-md">
          <Button
            className="w-full h-11 rounded-xl text-[12px] font-bold tracking-wide bg-primary hover:bg-primary/90 text-white transition-all active:scale-[0.98]"
            onClick={() => onEdit(building)}
          >
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Edit building
          </Button>
        </div>
      )}
    </div>
  );
}
