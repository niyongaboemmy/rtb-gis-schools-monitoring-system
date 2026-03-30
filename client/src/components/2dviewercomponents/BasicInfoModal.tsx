import React from "react";
import { X, MapPin } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface BasicInfoModalProps {
  school: any;
  onClose: () => void;
}

export const BasicInfoModal: React.FC<BasicInfoModalProps> = ({
  school,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 text-white overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-1">
              {school.name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-white/50 font-medium tracking-wide">
              <MapPin className="h-3.5 w-3.5" />
              {[school.province, school.district, school.sector]
                .filter(Boolean)
                .join(" • ") || "Location Unknown"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/20 text-white/70 hover:text-white shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              School Code
            </p>
            <p className="text-lg font-mono font-medium">
              {school.code || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              Level
            </p>
            <p className="text-lg font-medium">{school.level || "N/A"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              Type
            </p>
            <p className="text-lg font-medium capitalize">
              {school.type?.toLowerCase() || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              Status
            </p>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  school.status === "ACTIVE"
                    ? "bg-emerald-400"
                    : "bg-amber-400",
                )}
              />
              <p className="text-lg font-medium capitalize">
                {school.status?.toLowerCase() || "Active"}
              </p>
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
              Coordinates
            </p>
            <p className="text-sm font-mono text-white/70">
              {Number(school.latitude).toFixed(6)},{" "}
              {Number(school.longitude).toFixed(6)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
