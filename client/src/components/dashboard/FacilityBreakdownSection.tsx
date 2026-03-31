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
      <Card className="group relative border-0 bg-gray-950/40 overflow-hidden shadow-2xl rounded-4xl transition-all duration-500">
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-3 text-white/90">
              <div className="p-2 rounded-xl bg-white/5 border border-blue-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <Building2 className="w-5 h-5 text-primary opacity-80" />
              </div>
              Facility inventory matrix
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full bg-white/5 text-white/40 border-blue-500/30 text-[11px] font-normal px-3 py-0.5"
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
                  transition={{ delay: index * 0.05 }}
                  className="group/item relative p-px rounded-3xl overflow-hidden transition-all duration-500 cursor-pointer bg-gray-900/20 border border-blue-700/20"
                >
                  <div className="relative p-5 z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-blue-500/30 flex items-center justify-center text-white/30 group-hover/item:text-primary transition-colors shadow-inner">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white/90 leading-tight mb-0.5">
                            {building.name || `Block ${index + 1}`}
                          </h4>
                          <p className="text-[11px] font-normal text-white/50">
                            {building.type || "Institutional facility"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            integrity >= 80
                              ? "text-emerald-400/80"
                              : integrity >= 60
                                ? "text-blue-400/80"
                                : "text-red-400/80",
                          )}
                        >
                          {integrity}%
                        </span>
                        <span className="text-[9px] font-normal text-white/50">
                          Integrity
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
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
                              ? "bg-emerald-500/50"
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
                                  ? "bg-emerald-500/40"
                                  : "bg-amber-500/40",
                              )}
                            />
                            <span className="text-[9px] font-normal text-white/50 whitespace-nowrap">
                              Audit complete
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-white/30" />
                            <span className="text-[9px] font-normal text-white/50">
                              {building.capacity || 0} cap
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="h-5 px-2 text-[8px] font-normal border-blue-500/20 bg-white/5 text-white/40 rounded-md"
                        >
                          Verified
                        </Badge>
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
