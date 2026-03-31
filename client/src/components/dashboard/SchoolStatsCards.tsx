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

interface SchoolStatsCardsProps {
  schoolData: any;
  totalStudents: number;
  totalCapacity: number;
  totalStaff: number;
  totalTeachers: number;
  maleTeachers: number;
  buildings: any[];
  avgBuildingYear: number;
  formatNumber: (num: number | undefined | null) => string;
}

export const SchoolStatsCards = React.memo(
  ({
    schoolData,
    totalStudents,
    totalCapacity,
    totalStaff,
    totalTeachers,
    maleTeachers,
    buildings,
    avgBuildingYear,
    formatNumber,
  }: SchoolStatsCardsProps) => {
    return (
      <div className="flex flex-col gap-3 w-full h-max">
        {[
          {
            label: "Total students",
            value: formatNumber(totalStudents),
            subValue: `Cap: ${formatNumber(totalCapacity)}`,
            icon: Users,
            color: "text-primary",
            bg: "bg-primary/5",
            border: "border-primary/20",
            benchmark: "Top 5% in district",
            trend: [20, 35, 45, 40, 50, 65, 80],
          },
          {
            label: "Total staff",
            value: formatNumber(totalStaff),
            subValue:
              totalTeachers > 0
                ? `Ratio: ${Math.round((maleTeachers / totalTeachers) * 100)}% m`
                : "N/A",
            icon: TeacherIcon,
            color: "text-blue-500",
            bg: "bg-blue-500/5",
            border: "border-blue-500/20",
            benchmark: "Optimal staffing",
            trend: [40, 42, 45, 43, 44, 45, 45],
          },
          {
            label: "Block count",
            value: buildings.length,
            subValue: `Avg year: ${avgBuildingYear > 0 ? avgBuildingYear : "N/A"}`,
            icon: Building2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/5",
            border: "border-emerald-500/20",
            benchmark: "Strategic estate",
            trend: [10, 10, 12, 12, 12, 14, 15],
          },
          {
            label: "Land allocation",
            value:
              schoolData.usedLandArea !== undefined
                ? `${Math.round(parseFloat(String(schoolData.usedLandArea)))}h`
                : "--",
            subValue: `${Math.round((parseFloat(String(schoolData.usedLandArea)) || 0) + (parseFloat(String(schoolData.unusedLandArea)) || 0))}h total`,
            icon: MapPin,
            color: "text-amber-500",
            bg: "bg-amber-500/5",
            border: "border-amber-500/20",
            benchmark: "Expansion ready",
            trend: [100, 95, 90, 85, 80, 82, 85],
          },
          {
            label: "TVET programs",
            value: schoolData.educationPrograms?.length || 0,
            subValue: "Active trades",
            icon: GraduationCap,
            color: "text-indigo-500",
            bg: "bg-indigo-500/5",
            border: "border-indigo-500/20",
            benchmark: "Academic leader",
            trend: [5, 6, 8, 8, 10, 12, 12],
          },
          {
            label: "Accessibility",
            value: schoolData.roadStatusPercentage
              ? `${parseFloat(String(schoolData.roadStatusPercentage))}%`
              : "--",
            subValue: "Connectivity",
            icon: MapIcon,
            color: "text-slate-500",
            bg: "bg-slate-500/5",
            border: "border-slate-500/20",
            benchmark: "Standard access",
            trend: [20, 25, 40, 50, 60, 75, 80],
          },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex w-full"
          >
            <Card className="group relative w-full border-0 bg-gray-950/30 group-hover:opacity-40 transition-opacity rounded-3xl overflow-hidden duration-500">
              {/* Professional Gradient Border & Background */}
              <div className="absolute inset-0 bg-linear-to-b from-blue-500/30 to-blue-500/0 rounded-2xl p-px opacity-20 group-hover:opacity-40 transition-opacity">
                <div className="w-full h-full bg-gray-950 backdrop-blur-3xl rounded-[calc(1rem-1px)]" />
              </div>

              <CardContent className="p-4 relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center relative",
                        item.bg,
                        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
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
                    <p className="text-[10px] font-normal text-white/50 tracking-wide mb-0.5">
                      {item.label}
                    </p>
                    <h4 className="text-xl font-medium text-white/90 tracking-tight leading-none group-hover:translate-x-0.5 transition-transform">
                      {item.value}
                    </h4>
                  </div>

                  <div className="w-12 h-6 flex items-center justify-end">
                    <svg
                      viewBox="0 0 100 40"
                      className="w-full h-full overflow-visible"
                    >
                      <defs>
                        <linearGradient
                          id={`grad-${index}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="currentColor"
                            stopOpacity="0.2"
                          />
                          <stop
                            offset="100%"
                            stopColor="currentColor"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M 0,${40 - item.trend[0] / 2.5} ${item.trend.map((v, i) => `L ${i * 16.6},${40 - v / 2.5}`).join(" ")}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn(
                          item.color,
                          "opacity-20 group-hover:opacity-80 transition-opacity duration-700",
                        )}
                      />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-blue-500/20 pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-normal text-white/40">
                    <TrendingUp
                      className={cn("w-3 h-3 opacity-40", item.color)}
                    />
                    <span className="group-hover:text-white/60 transition-colors truncate max-w-[80px]">
                      {item.subValue}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] font-normal border-blue-500/20 bg-white/2 text-white/40 group-hover:text-primary/60 group-hover:border-primary/20 transition-all rounded-full h-5 px-2.5 shrink-0"
                  >
                    {item.benchmark}
                  </Badge>
                </div>
              </CardContent>

              {item.label === "Land allocation" &&
                schoolData.usedLandArea !== undefined &&
                schoolData.unusedLandArea !== undefined && (
                  <div className="absolute bottom-0 inset-x-0 h-0.5 bg-white/2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.round((parseFloat(schoolData.usedLandArea || 0) / (parseFloat(schoolData.usedLandArea || 0) + parseFloat(schoolData.unusedLandArea || 0))) * 100)}%`,
                      }}
                      transition={{ duration: 1.5, delay: 0.5 }}
                      className={cn(
                        "h-full opacity-30",
                        item.color.replace("text-", "bg-"),
                      )}
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
