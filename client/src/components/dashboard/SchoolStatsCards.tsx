import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  GraduationCap as TeacherIcon,
  Target,
  Building2,
  Activity,
  MapPin,
  MapIcon,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";

interface SchoolStatsCardsProps {
  schoolData: any;
  totalStudents: number;
  totalCapacity: number;
  totalStaff: number;
  totalTeachers: number;
  maleTeachers: number;
  femaleTeachers: number;
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
    femaleTeachers,
    buildings,
    avgBuildingYear,
    formatNumber,
  }: SchoolStatsCardsProps) => {
    return (
      <div className="col-span-2 grid gap-4 grid-cols-12 w-full h-max">
        {/* Total Students */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          whileHover={{ scale: 1.02, y: -5 }}
          className="col-span-6"
        >
          <Card className="border border-border/20 bg-blue-50 dark:bg-blue-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">
                    Total Students
                  </p>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                    {formatNumber(totalStudents)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-blue-600/70">
                <TrendingUp className="w-3 h-3" />
                <span>Capacity: {formatNumber(totalCapacity)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* All Staff */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.02, y: -5 }}
          className="col-span-6"
        >
          <Card className="border border-border/20 bg-blue-50 dark:bg-blue-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">
                    All Staff
                  </p>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                    {formatNumber(totalStaff)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <TeacherIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-blue-600/70">
                <Target className="w-3 h-3" />
                <span>
                  Gender Ratio:{" "}
                  {totalTeachers > 0
                    ? `${maleTeachers}:${femaleTeachers}`
                    : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Buildings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02, y: -5 }}
          className="col-span-6"
        >
          <Card className="border border-border/20 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">
                    Buildings
                  </p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {buildings.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-600/70">
                <Activity className="w-3 h-3" />
                <span>
                  Avg Year:{" "}
                  {avgBuildingYear > 0
                    ? avgBuildingYear
                    : parseFloat(String(schoolData.establishedYear)) || "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Land Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02, y: -5 }}
          className="col-span-6"
        >
          <Card className="border border-border/20 bg-green-50 dark:bg-green-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-green-100/80 dark:hover:bg-green-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-600/70">
                    Land Usage (ha)
                  </p>
                  <p className="text-2xl font-black text-green-700 dark:text-green-300 mt-1">
                    {schoolData.usedLandArea !== undefined
                      ? `${Math.round(parseFloat(String(schoolData.usedLandArea))) || 0} / ${Math.round((parseFloat(String(schoolData.usedLandArea)) || 0) + (parseFloat(String(schoolData.unusedLandArea)) || 0))}`
                      : "--"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
              </div>
              {schoolData.usedLandArea !== undefined &&
                schoolData.unusedLandArea !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-green-600/70 mb-1">
                      <span>Used / Total</span>
                      <span>
                        {Math.round(
                          (parseFloat(schoolData.usedLandArea) /
                            (parseFloat(schoolData.usedLandArea || 0) +
                              parseFloat(schoolData.unusedLandArea || 0))) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-green-200 dark:bg-green-900/30 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-green-500 transition-all"
                        style={{
                          width: `${Math.round((parseFloat(schoolData.usedLandArea || 0) / (parseFloat(schoolData.usedLandArea || 0) + parseFloat(schoolData.unusedLandArea || 0))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Road Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02, y: -5 }}
          className="col-span-6"
        >
          <Card className="border border-border/20 bg-slate-50 dark:bg-slate-950/30 rounded-2xl transition-all dark:border-blue-700/30 duration-300 hover:bg-slate-100/80 dark:hover:bg-slate-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600/70 dark:text-gray-300/50">
                    Accessibility
                  </p>
                  <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                    {schoolData.roadStatusPercentage
                      ? `${parseFloat(String(schoolData.roadStatusPercentage))}%`
                      : "--"}
                  </p>
                </div>
                <div className="w-12 h-12 bg-slate-500/20 rounded-2xl flex items-center justify-center">
                  <MapIcon className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* TVET Trades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          whileHover={{ scale: 1.02, y: -5 }}
          className="col-span-6"
        >
          <Card className="border border-border/20 bg-teal-50 dark:bg-teal-950/30 rounded-2xl transition-all dark:border-blue-900/30 duration-300 hover:bg-teal-100/80 dark:hover:bg-teal-900/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/70">
                    TVET Trades
                  </p>
                  <p className="text-2xl font-black text-teal-700 dark:text-teal-300 mt-1">
                    {schoolData.educationPrograms?.length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-500/20 rounded-2xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  },
);
