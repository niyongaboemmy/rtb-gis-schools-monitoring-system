import React from "react";
import { motion } from "framer-motion";
import { Building2, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface FacilityBreakdownProps {
  buildings: any[];
}

export const FacilityBreakdownSection = React.memo(
  ({ buildings }: FacilityBreakdownProps) => {
    return (
      <Card className="group relative border border-slate-200 dark:border-0 bg-white dark:bg-gray-950/40 overflow-hidden rounded-4xl transition-all duration-500">
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-3 text-slate-800 dark:text-white/90">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-blue-500/30">
                <Building2 className="w-5 h-5 text-primary opacity-80" />
              </div>
              Facility inventory matrix
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/40 border-slate-200 dark:border-blue-500/30 text-[11px] font-normal px-3 py-0.5"
              >
                {buildings.length} Assets
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
            {buildings.map((building, index) => {
              const integrity = building.structuralIntegrity ?? 85;

              return (
                <motion.div
                  key={building.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01, translateY: -2 }}
                  transition={{ delay: index * 0.05 }}
                  className="group/item relative p-px rounded-3xl overflow-hidden transition-all duration-500 cursor-pointer bg-white dark:bg-gray-900/20 border border-slate-200 dark:border-blue-700/20"
                >
                  <div className="relative p-5 z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-blue-500/30 flex items-center justify-center text-slate-400 dark:text-blue-500 group-hover/item:text-primary transition-colors shadow-inner">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-800 dark:text-white/90 leading-tight mb-0.5">
                            {building.name || `Block ${index + 1}`}
                          </h4>
                          <p className="text-[11px] font-normal text-slate-500 dark:text-white/50">
                            {building.type || "Institutional facility"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            integrity >= 80
                              ? "text-green-600 dark:text-green-400/80"
                              : integrity >= 60
                                ? "text-blue-600 dark:text-blue-400/80"
                                : "text-red-600 dark:text-red-400/80",
                          )}
                        >
                          {integrity}%
                        </span>
                        <span className="text-[9px] font-normal text-slate-500 dark:text-white/50">
                          Integrity
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${integrity}%` }}
                          transition={{
                            duration: 1,
                            delay: 0.2 + index * 0.05,
                          }}
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            integrity >= 80
                              ? "bg-green-500/50"
                              : integrity >= 60
                                ? "bg-blue-500/50"
                                : "bg-red-500/50",
                          )}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                integrity >= 70
                                  ? "bg-emerald-500"
                                  : "bg-amber-500",
                              )}
                            />
                            <span className="text-[9px] font-normal text-slate-500 dark:text-white/50 whitespace-nowrap">
                              Audit complete
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400 dark:text-white/30" />
                            <span className="text-[9px] font-normal text-slate-500 dark:text-white/50">
                              {building.capacity || 0} cap
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  },
);
