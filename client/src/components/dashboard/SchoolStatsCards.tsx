import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  GraduationCap as TeacherIcon,
  Building2,
  MapPin,
  MapIcon,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { formatHectares, formatNumber, formatPercent } from "../../lib/format";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { MetricId } from "../metric-help/metrics";

/**
 * Server-computed school figures (GET /analytics/schools/:id/metrics).
 * Nothing here is derived from raw records — WS1.4.
 */
export interface SchoolStatsMetrics {
  totalStudents?: number | null;
  totalCapacity?: number | null;
  capacityUtilisation?: number | null;
  totalStaff?: number | null;
  totalTeachers?: number | null;
  maleTeacherShare?: number | null;
  studentToTeacherRatio?: number | null;
  buildingCount?: number | null;
  avgBuildingAge?: number | null;
  avgBuildingYear?: number | null;
  usedLandArea?: number | null;
  totalLandArea?: number | null;
  usedLandPct?: number | null;
  educationProgramsCount?: number | null;
  roadStatusPercentage?: number | null;
}

interface SchoolStatsCardsProps {
  metrics: SchoolStatsMetrics | null;
}

interface StatItem {
  label: string;
  value: string;
  subValue: string;
  benchmark: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  metricId: MetricId;
  /** 0–100 fill for the thin bar at the card bottom, if any. */
  bar?: number | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const SchoolStatsCards = React.memo(
  ({ metrics }: SchoolStatsCardsProps) => {
    const m = metrics ?? {};
    const road = isNum(m.roadStatusPercentage) ? m.roadStatusPercentage : null;
    const items: StatItem[] = [
      {
        label: "Total students",
        value: formatNumber(m.totalStudents ?? null),
        subValue: isNum(m.totalCapacity) && m.totalCapacity > 0 ? `Capacity ${formatNumber(m.totalCapacity)}` : "Capacity not recorded",
        benchmark: isNum(m.capacityUtilisation)
          ? `${formatPercent(m.capacityUtilisation, { decimals: 1 })} of capacity`
          : "No capacity data yet",
        icon: Users,
        color: "text-primary",
        bg: "bg-primary/5",
        metricId: "school.capacityUtilisation",
        bar: isNum(m.capacityUtilisation) ? Math.min(100, m.capacityUtilisation) : null,
      },
      {
        label: "Total staff",
        value: formatNumber(m.totalStaff ?? null),
        subValue: isNum(m.maleTeacherShare) ? `${formatPercent(m.maleTeacherShare)} male teachers` : "No gender breakdown",
        benchmark: isNum(m.studentToTeacherRatio)
          ? `${formatNumber(m.studentToTeacherRatio, 1)}:1 students per teacher`
          : "No teacher data",
        icon: TeacherIcon,
        color: "text-blue-500",
        bg: "bg-blue-500/5",
        metricId: "school.studentTeacherRatio",
      },
      {
        label: "Buildings",
        value: formatNumber(m.buildingCount ?? 0),
        subValue: isNum(m.avgBuildingYear) ? `Average year built ${m.avgBuildingYear}` : "Year unknown",
        benchmark: isNum(m.avgBuildingAge) ? `${formatNumber(m.avgBuildingAge)} years average age` : "No building ages",
        icon: Building2,
        color: "text-emerald-500",
        bg: "bg-emerald-500/5",
        metricId: "school.buildingCount",
      },
      {
        label: "Land area",
        value: formatHectares(m.usedLandArea ?? null),
        subValue: isNum(m.totalLandArea) ? `${formatHectares(m.totalLandArea)} total` : "No land data",
        benchmark: isNum(m.usedLandPct) ? `${formatPercent(m.usedLandPct, { decimals: 1 })} used` : "Land data unavailable",
        icon: MapPin,
        color: "text-amber-500",
        bg: "bg-amber-500/5",
        metricId: "school.landArea",
        bar: isNum(m.usedLandPct) ? m.usedLandPct : null,
      },
      {
        label: "TVET programmes",
        value: formatNumber(m.educationProgramsCount ?? 0),
        subValue: "Trades offered",
        benchmark: (m.educationProgramsCount ?? 0) > 0 ? `${formatNumber(m.educationProgramsCount ?? 0)} programmes` : "No programmes recorded",
        icon: GraduationCap,
        color: "text-indigo-500",
        bg: "bg-indigo-500/5",
        metricId: "school.programmes",
      },
      {
        label: "Road access",
        value: road != null ? formatPercent(road) : "—",
        subValue: "Accessibility",
        benchmark: road == null ? "Not recorded" : road > 80 ? "Good access" : road > 50 ? "Moderate access" : "Limited access",
        icon: MapIcon,
        color: "text-slate-500",
        bg: "bg-slate-500/5",
        metricId: "school.roadAccess",
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3 w-full h-max">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex w-full"
          >
            <Card className="group relative w-full border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/30 hover:bg-slate-50 dark:hover:bg-gray-900/50 transition-all rounded-3xl overflow-hidden duration-500">
              {/* Professional Gradient Border & Background */}
              <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 rounded-2xl p-px opacity-30 dark:opacity-20 group-hover:opacity-50 transition-opacity">
                <div className="w-full h-full bg-white dark:bg-gray-950 backdrop-blur-3xl rounded-[calc(1rem-1px)]" />
              </div>

              <CardContent className="p-4 relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/6 dark:border-white/4",
                        item.bg,
                      )}
                    >
                      <item.icon
                        className={cn(
                          "w-5 h-5 relative z-10 opacity-60 transition-all duration-500 group-hover:scale-110",
                          item.color,
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-1 text-[12px] font-normal text-slate-600 dark:text-white/80 tracking-wide mb-0.5">
                      {item.label}
                      <MetricInfo id={item.metricId} size="xs" />
                    </p>
                    <h4 className="text-xl font-medium text-slate-900 dark:text-white tracking-tight leading-none group-hover:translate-x-0.5 transition-transform duration-300">
                      {item.value}
                    </h4>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-blue-500/12 pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-normal text-slate-500 dark:text-white/40">
                    <TrendingUp
                      className={cn(
                        "w-3 h-3 opacity-60 dark:opacity-40",
                        item.color,
                      )}
                    />
                    <span className="group-hover:text-slate-900 dark:group-hover:text-white/60 transition-colors">
                      {item.subValue}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal border-slate-200 dark:border-blue-500/12 bg-slate-50 dark:bg-white/2 text-slate-500 dark:text-white/40 group-hover:text-primary dark:group-hover:text-primary/60 group-hover:border-primary/20 transition-all rounded-full h-5 px-2.5 shrink-0"
                  >
                    {item.benchmark}
                  </Badge>
                </div>
              </CardContent>

              {item.bar != null && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-slate-100 dark:bg-white/2 overflow-hidden" aria-hidden="true">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, item.bar))}%` }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className={cn("h-full opacity-30", item.color.replace("text-", "bg-"))}
                  />
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    );
  },
);
