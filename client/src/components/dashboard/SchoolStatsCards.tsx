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
      <div className="grid gap-3 grid-cols-12 w-full h-max">
        {/* Total Students */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="col-span-4"
        >
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                    Students
                  </p>
                  <p className="text-xl font-black text-foreground">
                    {formatNumber(totalStudents)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/50">
                <TrendingUp className="w-3 h-3 text-emerald-500/50" />
                <span>Cap: {formatNumber(totalCapacity)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* All Staff */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-4"
        >
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                    Total Staff
                  </p>
                  <p className="text-xl font-black text-foreground">
                    {formatNumber(totalStaff)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <TeacherIcon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/50">
                <Target className="w-3 h-3 text-blue-500/50" />
                <span>Ratio: {totalTeachers > 0 ? `${Math.round((maleTeachers/totalTeachers)*100)}% M` : "N/A"}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Buildings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-4"
        >
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                    Blocks
                  </p>
                  <p className="text-xl font-black text-foreground">
                    {buildings.length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/50">
                <Activity className="w-3 h-3 text-emerald-500/50" />
                <span>Avg Year: {avgBuildingYear > 0 ? avgBuildingYear : "N/A"}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Land Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-4"
        >
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                    Land (ha)
                  </p>
                  <p className="text-xl font-black text-foreground">
                    {schoolData.usedLandArea !== undefined
                      ? `${Math.round(parseFloat(String(schoolData.usedLandArea))) || 0} / ${Math.round((parseFloat(String(schoolData.usedLandArea)) || 0) + (parseFloat(String(schoolData.unusedLandArea)) || 0))}`
                      : "--"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-amber-500" />
                </div>
              </div>
              {schoolData.usedLandArea !== undefined && schoolData.unusedLandArea !== undefined && (
                <div className="mt-2 w-full bg-muted/30 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                    style={{
                      width: `${Math.round((parseFloat(schoolData.usedLandArea || 0) / (parseFloat(schoolData.usedLandArea || 0) + parseFloat(schoolData.unusedLandArea || 0))) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* TVET Trades */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-4"
        >
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                    Trades
                  </p>
                  <p className="text-xl font-black text-foreground">
                    {schoolData.educationPrograms?.length || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/50">
                <Target className="w-3 h-3 text-blue-500/50" />
                <span>Active Programs</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Road Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="col-span-4"
        >
          <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                    Access
                  </p>
                  <p className="text-xl font-black text-foreground">
                    {schoolData.roadStatusPercentage
                      ? `${parseFloat(String(schoolData.roadStatusPercentage))}%`
                      : "--"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-slate-500/10 rounded-xl flex items-center justify-center">
                  <MapIcon className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/50">
                <Activity className="w-3 h-3 text-slate-500/50" />
                <span>Road Connectivity</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  },
);
