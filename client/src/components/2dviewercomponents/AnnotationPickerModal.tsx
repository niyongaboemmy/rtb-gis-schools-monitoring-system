import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Info,
  AlertOctagon,
  Construction,
  Star,
  MapPin,
  Flag,
  Wrench,
  Eye,
  Droplets,
  Zap,
  Trees,
  School,
  Footprints,
  ParkingCircle,
  X,
  Check,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

interface AnnotationIcon {
  id: string;
  label: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
  border: string;
  mapColor: string;
}

export const ANNOTATION_ICONS: AnnotationIcon[] = [
  { id: "pin",           label: "Pin",          icon: MapPin,        color: "text-violet-400", bg: "bg-violet-500/20",   border: "border-violet-500/30",  mapColor: "#8b5cf6" },
  { id: "warning",       label: "Warning",      icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/20",    border: "border-amber-500/30",   mapColor: "#f59e0b" },
  { id: "info",          label: "Info",         icon: Info,          color: "text-sky-400",    bg: "bg-sky-500/20",      border: "border-sky-500/30",     mapColor: "#38bdf8" },
  { id: "danger",        label: "Danger",       icon: AlertOctagon,  color: "text-red-400",    bg: "bg-red-500/20",      border: "border-red-500/30",     mapColor: "#ef4444" },
  { id: "construction",  label: "Construction", icon: Construction,  color: "text-orange-400", bg: "bg-orange-500/20",   border: "border-orange-500/30",  mapColor: "#f97316" },
  { id: "flag",          label: "Flag",         icon: Flag,          color: "text-pink-400",   bg: "bg-pink-500/20",     border: "border-pink-500/30",    mapColor: "#ec4899" },
  { id: "maintenance",   label: "Maintenance",  icon: Wrench,        color: "text-slate-400",  bg: "bg-slate-500/20",    border: "border-slate-500/30",   mapColor: "#94a3b8" },
  { id: "poi",           label: "Point of Int.", icon: Star,         color: "text-yellow-400", bg: "bg-yellow-500/20",   border: "border-yellow-500/30",  mapColor: "#eab308" },
  { id: "inspection",    label: "Inspection",   icon: Eye,           color: "text-cyan-400",   bg: "bg-cyan-500/20",     border: "border-cyan-500/30",    mapColor: "#06b6d4" },
  { id: "water",         label: "Water",        icon: Droplets,      color: "text-blue-400",   bg: "bg-blue-500/20",     border: "border-blue-500/30",    mapColor: "#3b82f6" },
  { id: "power",         label: "Electrical",   icon: Zap,           color: "text-lime-400",   bg: "bg-lime-500/20",     border: "border-lime-500/30",    mapColor: "#84cc16" },
  { id: "green",         label: "Green Area",   icon: Trees,         color: "text-emerald-400",bg: "bg-emerald-500/20",  border: "border-emerald-500/30", mapColor: "#10b981" },
  { id: "facility",      label: "Facility",     icon: School,        color: "text-indigo-400", bg: "bg-indigo-500/20",   border: "border-indigo-500/30",  mapColor: "#6366f1" },
  { id: "path",          label: "Path/Route",   icon: Footprints,    color: "text-teal-400",   bg: "bg-teal-500/20",     border: "border-teal-500/30",    mapColor: "#14b8a6" },
  { id: "parking",       label: "Parking",      icon: ParkingCircle, color: "text-fuchsia-400",bg: "bg-fuchsia-500/20",  border: "border-fuchsia-500/30", mapColor: "#d946ef" },
];

interface AnnotationPickerModalProps {
  open: boolean;
  annotationType?: "text" | "line" | "polygon" | "point";
  initialDescription?: string;
  onConfirm: (iconType: string, title: string, description: string, mapColor: string) => void;
  onCancel: () => void;
}

export function AnnotationPickerModal({
  open,
  annotationType = "text",
  initialDescription = "",
  onConfirm,
  onCancel,
}: AnnotationPickerModalProps) {
  const [selectedIcon, setSelectedIcon] = useState<AnnotationIcon>(ANNOTATION_ICONS[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription(initialDescription);
      setSelectedIcon(ANNOTATION_ICONS[0]);
    }
  }, [open, initialDescription]);

  const handleConfirm = () => {
    const finalTitle = title.trim() || selectedIcon.label;
    onConfirm(selectedIcon.id, finalTitle, description.trim(), selectedIcon.mapColor);
    setTitle("");
    setDescription("");
    setSelectedIcon(ANNOTATION_ICONS[0]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-200 flex items-center justify-center"
         >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className="relative w-[380px] bg-[#0f1117]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "p-2 rounded-xl border",
                    selectedIcon.bg,
                    selectedIcon.border
                  )}
                >
                  <selectedIcon.icon className={cn("w-4 h-4", selectedIcon.color)} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest">
                    New Annotation
                  </p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">
                    {annotationType === "text" || annotationType === "point"
                      ? "Point marker on map"
                      : annotationType === "line"
                      ? "Line / path marker"
                      : "Area / zone marker"}
                  </p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-xl text-white/20 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
            <div className="space-y-3">
              {/* Title */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Title</p>
                <Input
                  autoFocus
                  placeholder={`e.g. ${selectedIcon.label}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
                  className="h-10 bg-white/5 border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus-visible:ring-primary/40 focus:bg-white/[0.07] transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Description</p>
                  <span className="text-[8px] text-white/15 uppercase font-semibold">(shows on hover)</span>
                </div>
                <textarea
                  placeholder="Optional notes visible on map hover..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-white/[0.07] transition-all resize-none px-3 py-2 font-medium"
                />
              </div>
            </div>

              {/* Icon Selection */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                  Category / Color
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {ANNOTATION_ICONS.map((ic) => (
                    <button
                      key={ic.id}
                      onClick={() => setSelectedIcon(ic)}
                      title={ic.label}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 group",
                        selectedIcon.id === ic.id
                          ? cn(ic.bg, ic.border, "ring-1 ring-white/20 scale-105")
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                      )}
                    >
                      <ic.icon
                        className={cn(
                          "w-4 h-4 transition-all",
                          selectedIcon.id === ic.id ? ic.color : "text-white/25 group-hover:text-white/50"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[7px] font-bold leading-tight text-center truncate w-full",
                          selectedIcon.id === ic.id ? "text-white/80" : "text-white/20 group-hover:text-white/40"
                        )}
                      >
                        {ic.label.split("/")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex gap-2">
              <Button
                variant="ghost"
                onClick={onCancel}
                className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white border-none shadow-lg transition-all gap-2"
                style={{ backgroundColor: `${selectedIcon.mapColor}dd` }}
              >
                <Check className="w-3.5 h-3.5" />
                Place on Map
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
