import React from "react";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { formatArea, formatDate, formatNumber } from "../../lib/format";
import { label } from "../../lib/labels";
import { MetricInfo } from "../metric-help/MetricInfo";

/** Building fields read here (GET /schools/:id → buildings[]). */
export interface FacilityBuilding {
  id: string;
  name?: string | null;
  function?: string | null;
  condition?: string | null;
  roofCondition?: string | null;
  yearBuilt?: number | string | null;
  floors?: number | string | null;
  areaSquareMeters?: number | string | null;
  structuralScore?: number | string | null;
  lastInspectionDate?: string | null;
}

interface FacilityBreakdownProps {
  buildings: FacilityBuilding[];
}

const CONDITION_TONE: Record<string, { text: string; bar: string; fill: number }> = {
  good: { text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500/60", fill: 100 },
  fair: { text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500/60", fill: 70 },
  poor: { text: "text-orange-700 dark:text-orange-400", bar: "bg-orange-500/60", fill: 30 },
  critical: { text: "text-red-700 dark:text-red-400", bar: "bg-red-500/60", fill: 10 },
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const FacilityBreakdownSection = React.memo(
  ({ buildings }: FacilityBreakdownProps) => {
    return (
      <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/40 overflow-hidden rounded-4xl transition-all duration-500">
        <CardHeader className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg font-medium flex items-center gap-3 text-slate-800 dark:text-white/90">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/20">
                <Building2 className="w-5 h-5 text-primary opacity-80" />
              </div>
              Buildings
              <MetricInfo id="component.infrastructure" size="xs" />
            </CardTitle>
            <Badge
              variant="outline"
              className="rounded-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-white/60 border-slate-200 dark:border-blue-500/20 text-[11px] font-normal px-3 py-0.5"
            >
              {formatNumber(buildings.length)} building{buildings.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 relative z-10">
          {buildings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-6 text-center">
              <p className="font-medium text-slate-800 dark:text-white">No buildings recorded yet</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
                Add buildings from the school's 2D map, or upload a site map (KMZ). Until then the Infrastructure part of the score is estimated.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {buildings.map((building, index) => {
              const cond = String(building.condition ?? "").toLowerCase();
              const tone = CONDITION_TONE[cond];
              const year = num(building.yearBuilt);
              const area = num(building.areaSquareMeters);
              const floors = num(building.floors);
              const structural = num(building.structuralScore);
              const details = [
                year ? `Built ${year}` : "Year unknown",
                floors ? `${formatNumber(floors)} floor${floors === 1 ? "" : "s"}` : null,
                area ? formatArea(area) : null,
              ].filter(Boolean);

              return (
                <motion.div
                  key={building.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.4) }}
                  className="relative rounded-3xl overflow-hidden bg-white dark:bg-gray-900/20 border border-slate-200 dark:border-blue-700/12"
                >
                  <div className="relative p-5 z-10">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-blue-500/20 flex items-center justify-center text-slate-500 dark:text-blue-500">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-slate-800 dark:text-white/90 leading-tight mb-0.5 break-words">
                            {building.name || `Building ${index + 1}`}
                          </h4>
                          <p className="text-[12px] font-normal text-slate-600 dark:text-white/50">
                            {building.function || "Use not recorded"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className={cn("text-[12px] font-semibold", tone?.text ?? "text-slate-500")}>
                          {cond ? label("buildingCondition", cond) : "Not assessed"}
                        </span>
                        <span className="text-[10px] font-normal text-slate-500 dark:text-white/50">
                          Condition
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden" aria-hidden="true">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${tone?.fill ?? 0}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className={cn("h-full rounded-full", tone?.bar ?? "bg-slate-300")}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-white/50">
                        {details.map((d) => (
                          <span key={d as string}>{d}</span>
                        ))}
                        {structural != null && <span>Structural score {formatNumber(structural)}</span>}
                        {building.roofCondition && (
                          <span>Roof: {label("roofCondition", building.roofCondition)}</span>
                        )}
                        <span>
                          {building.lastInspectionDate
                            ? `Inspected ${formatDate(building.lastInspectionDate)}`
                            : "Not inspected yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>
    );
  },
);
