import { useState } from "react";
import { Globe, Box, Zap, Mountain, Ruler, PenLine } from "lucide-react";
import { Modal } from "./ui/modal";
import { cn } from "../lib/utils";

interface ViewerModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: "2D" | "3D") => void;
}

const OPTIONS = [
  {
    mode: "2D" as const,
    icon: Globe,
    label: "2D View",
    tagline: "Flat map — OpenLayers",
    features: [
      { icon: Zap, text: "Lightweight & fast" },
      { icon: Ruler, text: "Distance & area measurement" },
      { icon: PenLine, text: "Drawing & annotation" },
      { icon: Globe, text: "Full KMZ / KML support" },
    ],
  },
  {
    mode: "3D" as const,
    icon: Box,
    label: "3D View",
    tagline: "Immersive — Cesium",
    features: [
      { icon: Mountain, text: "Real terrain & elevation" },
      { icon: Box, text: "3D building models" },
      { icon: Globe, text: "Satellite imagery" },
      { icon: Zap, text: "GPU-accelerated rendering" },
    ],
  },
];

export default function ViewerModeModal({
  isOpen,
  onClose,
  onSelect,
}: ViewerModeModalProps) {
  const [hovered, setHovered] = useState<"2D" | "3D" | null>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Viewer Mode"
      description="Select how you want to explore the school's spatial data."
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
        {OPTIONS.map(({ mode, icon: Icon, label, tagline, features }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            onMouseEnter={() => setHovered(mode)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "text-left rounded-3xl border-2 p-6 flex flex-col gap-4 transition-all duration-200 cursor-pointer",
              "hover:border-primary/50 hover:bg-primary/5",
              hovered === mode
                ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5"
                : "border-border/20 bg-card/30",
            )}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
                  hovered === mode
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/60 text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black text-base uppercase tracking-tight leading-tight">
                  {label}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">
                  {tagline}
                </p>
              </div>
            </div>

            {/* Feature list */}
            <ul className="flex flex-col gap-2">
              {features.map(({ icon: FIcon, text }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <FIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>

            {/* CTA hint */}
            <p
              className={cn(
                "text-[10px] font-black uppercase tracking-widest mt-auto transition-opacity",
                hovered === mode ? "opacity-100 text-primary" : "opacity-0",
              )}
            >
              Select {label} →
            </p>
          </button>
        ))}
      </div>
    </Modal>
  );
}
