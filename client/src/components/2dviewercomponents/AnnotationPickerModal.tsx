import { useId, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE } from "../school-dashboard/tokens";

interface AnnotationIcon {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  mapColor: string;
}

export const ANNOTATION_ICONS: AnnotationIcon[] = [
  { id: "pin",           label: "Pin",          icon: MapPin,        color: "text-blue-400", bg: "bg-blue-500/20",   border: "border-blue-500/30",  mapColor: "#8b5cf6" },
  { id: "warning",       label: "Warning",      icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/20",    border: "border-amber-500/30",   mapColor: "#f59e0b" },
  { id: "info",          label: "Info",         icon: Info,          color: "text-sky-400",    bg: "bg-sky-500/20",      border: "border-sky-500/30",     mapColor: "#38bdf8" },
  { id: "danger",        label: "Danger",       icon: AlertOctagon,  color: "text-red-400",    bg: "bg-red-500/20",      border: "border-red-500/30",     mapColor: "#ef4444" },
  { id: "construction",  label: "Construction", icon: Construction,  color: "text-orange-400", bg: "bg-orange-500/20",   border: "border-orange-500/30",  mapColor: "#f97316" },
  { id: "flag",          label: "Flag",         icon: Flag,          color: "text-pink-400",   bg: "bg-pink-500/20",     border: "border-pink-500/30",    mapColor: "#ec4899" },
  { id: "maintenance",   label: "Maintenance",  icon: Wrench,        color: "text-slate-400",  bg: "bg-slate-500/20",    border: "border-slate-500/20",   mapColor: "#94a3b8" },
  { id: "poi",           label: "Point of Int.", icon: Star,         color: "text-yellow-400", bg: "bg-yellow-500/20",   border: "border-yellow-500/30",  mapColor: "#eab308" },
  { id: "inspection",    label: "Inspection",   icon: Eye,           color: "text-cyan-400",   bg: "bg-cyan-500/20",     border: "border-cyan-500/30",    mapColor: "#06b6d4" },
  { id: "water",         label: "Water",        icon: Droplets,      color: "text-blue-400",   bg: "bg-blue-500/20",     border: "border-blue-500/20",    mapColor: "#3b82f6" },
  { id: "power",         label: "Electrical",   icon: Zap,           color: "text-lime-400",   bg: "bg-lime-500/20",     border: "border-lime-500/30",    mapColor: "#84cc16" },
  { id: "green",         label: "Green Area",   icon: Trees,         color: "text-emerald-400",bg: "bg-emerald-500/20",  border: "border-emerald-500/30", mapColor: "#10b981" },
  { id: "facility",      label: "Facility",     icon: School,        color: "text-blue-400", bg: "bg-blue-500/20",   border: "border-blue-500/30",  mapColor: "#6366f1" },
  { id: "path",          label: "Path/Route",   icon: Footprints,    color: "text-teal-400",   bg: "bg-teal-500/20",     border: "border-teal-500/30",    mapColor: "#14b8a6" },
  { id: "parking",       label: "Parking",      icon: ParkingCircle, color: "text-fuchsia-400",bg: "bg-fuchsia-500/20",  border: "border-fuchsia-500/30", mapColor: "#d946ef" },
];

interface AnnotationPickerModalProps {
  open: boolean;
  annotationType?: "text" | "line" | "polygon" | "point";
  initialTitle?: string;
  initialDescription?: string;
  onConfirm: (iconType: string, title: string, description: string, mapColor: string) => void;
  onCancel: () => void;
}

const fieldClass =
  "w-full rounded-xl bg-white/70 dark:bg-white/6 ring-1 ring-slate-900/10 dark:ring-white/12 px-3.5 text-[13px] text-slate-800 dark:text-white placeholder:text-slate-500/70 dark:placeholder:text-white/35 outline-none focus:ring-2 focus:ring-primary transition-shadow";

function subtitleFor(type: AnnotationPickerModalProps["annotationType"]) {
  if (type === "line") return "Line on the map";
  if (type === "polygon") return "Area on the map";
  return "Point on the map";
}

export function AnnotationPickerModal({
  open,
  annotationType = "text",
  initialTitle = "",
  initialDescription = "",
  onConfirm,
  onCancel,
}: AnnotationPickerModalProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="annotation-picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
          className="fixed inset-0 z-200 flex items-end justify-center sm:items-center sm:p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden
          />
          {/* Mounted fresh on every open, so the form starts from the initial values. */}
          <PickerPanel
            annotationType={annotationType}
            initialTitle={initialTitle}
            initialDescription={initialDescription}
            onConfirm={onConfirm}
            onCancel={onCancel}
            reduce={!!reduce}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PickerPanelProps
  extends Omit<AnnotationPickerModalProps, "open" | "initialTitle" | "initialDescription"> {
  initialTitle: string;
  initialDescription: string;
  reduce: boolean;
}

function PickerPanel({
  annotationType,
  initialTitle,
  initialDescription,
  onConfirm,
  onCancel,
  reduce,
}: PickerPanelProps) {
  const [selectedIcon, setSelectedIcon] = useState<AnnotationIcon>(ANNOTATION_ICONS[0]);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const titleId = useId();
  const nameId = useId();
  const descId = useId();

  const handleConfirm = () => {
    const finalTitle = title.trim() || selectedIcon.label;
    onConfirm(selectedIcon.id, finalTitle, description.trim(), selectedIcon.mapColor);
    setTitle("");
    setDescription("");
    setSelectedIcon(ANNOTATION_ICONS[0]);
  };

  const SelectedIcon = selectedIcon.icon;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: reduce ? 0 : 0.32, ease: EASE }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={cn(
        "relative w-full sm:w-[400px] max-h-[90dvh] overflow-y-auto",
        "rounded-t-[1.75rem] sm:rounded-[1.75rem]",
        "bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150",
        "ring-1 ring-white/40 dark:ring-white/10",
        "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {/* Grab handle on phones */}
      <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
        <span className="h-1 w-9 rounded-full bg-slate-900/15 dark:bg-white/20" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleConfirm();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-blue-300">
              <SelectedIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p id={titleId} className="text-[15px] font-medium text-slate-800 dark:text-white">
                New note
              </p>
              <p className="text-[12px] text-slate-600 dark:text-white/55">
                {subtitleFor(annotationType)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel annotation"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 dark:text-white/60 hover:bg-slate-900/5 dark:hover:bg-white/8 hover:text-slate-800 dark:hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="block text-[12px] font-medium text-slate-700 dark:text-white/70">
              Title
            </label>
            <input
              id={nameId}
              autoFocus
              placeholder={`e.g. ${selectedIcon.label}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(fieldClass, "h-10")}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor={descId} className="flex items-baseline gap-1.5 text-[12px] font-medium text-slate-700 dark:text-white/70">
              Description
              <span className="text-[11px] font-normal text-slate-500 dark:text-white/40">optional, shows on hover</span>
            </label>
            <textarea
              id={descId}
              placeholder="Add a short note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(fieldClass, "resize-none py-2.5 leading-snug")}
            />
          </div>

          {/* Category */}
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-[12px] font-medium text-slate-700 dark:text-white/70">
              Category
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {ANNOTATION_ICONS.map((ic) => {
                const selected = selectedIcon.id === ic.id;
                const Icon = ic.icon;
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setSelectedIcon(ic)}
                    title={ic.label}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-9 min-w-0 items-center gap-1.5 rounded-xl px-2.5 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      selected
                        ? "bg-primary text-white"
                        : "bg-white/50 dark:bg-white/5 text-slate-700 dark:text-white/75 ring-1 ring-slate-900/5 dark:ring-white/8 hover:bg-slate-900/5 dark:hover:bg-white/8",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-left">{ic.label.split("/")[0]}</span>
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        selected && "ring-1 ring-white/80",
                      )}
                      style={{ backgroundColor: ic.mapColor }}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-full px-4 text-[13px] font-medium text-slate-700 dark:text-white/75 hover:bg-slate-900/5 dark:hover:bg-white/8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Place on map
          </button>
        </div>
      </form>
    </motion.div>
  );
}
