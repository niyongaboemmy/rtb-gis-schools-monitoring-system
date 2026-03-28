import React from "react";
import { motion } from "framer-motion";
import { BookOpen, FlaskConical, Monitor, Home, Coffee, Trophy, Droplets, Zap, Wifi, Shield, Building2, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { Permission, type PermissionType } from "../../lib/permissions";

interface FacilityBreakdownProps {
  facilityStats: any;
  setSelectedFacilityGroup: (group: any) => void;
  setIsFacilityModalOpen: (open: boolean) => void;
  setIsSurveyModalOpen: (open: boolean) => void;
  isAuthorized: (permission?: PermissionType) => boolean;
}

const getFacilityIcon = (facilityName: string) => {
  const n = facilityName.toLowerCase();
  if (n.includes("classroom") || n.includes("library")) return BookOpen;
  if (n.includes("lab") || n.includes("laboratory")) return FlaskConical;
  if (n.includes("computer")) return Monitor;
  if (n.includes("hostel")) return Home;
  if (n.includes("canteen")) return Coffee;
  if (n.includes("sports") || n.includes("field")) return Trophy;
  if (n.includes("washroom") || n.includes("toilet") || n.includes("water")) return Droplets;
  if (n.includes("electricity") || n.includes("power")) return Zap;
  if (n.includes("internet") || n.includes("wifi")) return Wifi;
  if (n.includes("security") || n.includes("fence")) return Shield;
  return Building2;
};

export const FacilityBreakdownSection = React.memo(({
  facilityStats,
  setSelectedFacilityGroup,
  setIsFacilityModalOpen,
  setIsSurveyModalOpen,
  isAuthorized,
}: FacilityBreakdownProps) => {
  if (!facilityStats.byFacility || facilityStats.byFacility.length === 0) {
    return (
      <Card className="border border-border/20 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden mt-6">
        <CardContent className="p-0">
          <div className="text-center py-10 text-muted-foreground">
            <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">No Facility Survey Data</p>
            <p className="text-sm mt-2 mb-4">Complete a facility survey to see compliance details</p>
            {isAuthorized(Permission.SCHOOL_SURVERY_EDIT) && (
              <Button onClick={() => setIsSurveyModalOpen(true)} className="rounded-full">
                Start Facility Survey
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-border/10">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          Structural Facility Breakdown
        </p>
        <div className="text-[10px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">
          Sorted by Compliance
        </div>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.05 } },
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {[...facilityStats.byFacility]
          .map((group: any) => {
            const compliant = group.items.filter((i: any) => i.compliance === "compliant").length;
            const total = group.items.length;
            const rate = total > 0 ? Math.round((compliant / total) * 100) : 0;
            return { ...group, rate, compliant, total };
          })
          .sort((a, b) => b.rate - a.rate)
          .map((facilityGroup, index) => {
            const FacilityIcon = getFacilityIcon(facilityGroup.facility);
            return (
              <motion.div
                key={facilityGroup.facility}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
                whileHover={{ scale: 1.01, translateY: -2 }}
                onClick={() => {
                  setSelectedFacilityGroup(facilityGroup);
                  setIsFacilityModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-muted/20 border border-border/5 hover:bg-muted/40 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-background shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <FacilityIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black truncate">{facilityGroup.facility}</span>
                      <span
                        className={cn(
                          "text-[10px] font-black tabular-nums",
                          facilityGroup.rate >= 70
                            ? "text-emerald-500"
                            : facilityGroup.rate >= 40 ? "text-amber-500" : "text-red-500"
                        )}
                      >
                        {facilityGroup.rate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${facilityGroup.rate}%` }}
                      transition={{ duration: 1, delay: 0.2 + index * 0.05 }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        facilityGroup.rate >= 70
                          ? "bg-emerald-500"
                          : facilityGroup.rate >= 40 ? "bg-amber-500" : "bg-red-500"
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                    <span>
                      {facilityGroup.rate >= 70
                        ? "Mainly Compliant"
                        : facilityGroup.rate >= 40 ? "Partially Compliant" : "Needs Attention"}
                    </span>
                    <span>{facilityGroup.total} Total</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </motion.div>
    </div>
  );
});
