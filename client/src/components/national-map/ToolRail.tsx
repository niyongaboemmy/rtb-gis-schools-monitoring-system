import { motion, useReducedMotion } from "framer-motion";
import {
  Focus,
  Layers,
  ListOrdered,
  Loader2,
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Radar,
  Ruler,
  Shapes,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { ToolMode } from "./types";
import { EASE, GLASS } from "./tokens";
import { IconButton } from "./ui";

interface Props {
  horizontal: boolean;
  tool: ToolMode;
  layersOpen: boolean;
  legendOpen: boolean;
  fullscreen: boolean;
  locating: boolean;
  located: boolean;
  onZoom: (d: 1 | -1) => void;
  onReset: () => void;
  onLocate: () => void;
  onTool: (t: ToolMode) => void;
  onLayers: () => void;
  onLegend: () => void;
  onFullscreen: () => void;
  className?: string;
}

/** Map tools: vertical capsule on desktop, horizontally scrollable on phones. */
export function ToolRail(p: Props) {
  const reduce = useReducedMotion();
  const sep = <span aria-hidden className={cn("shrink-0 bg-slate-900/10 dark:bg-white/10", p.horizontal ? "mx-0.5 h-6 w-px" : "my-0.5 h-px w-6 self-center")} />;
  const size = p.horizontal ? "sm" : "md";
  return (
    <motion.div
      role="toolbar"
      aria-label="Map tools"
      aria-orientation={p.horizontal ? "horizontal" : "vertical"}
      initial={reduce ? false : { opacity: 0, x: p.horizontal ? 0 : 12, y: p.horizontal ? -8 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
      className={cn(
        "pointer-events-auto flex items-center gap-1 rounded-full p-1",
        p.horizontal ? "no-scrollbar max-w-full flex-row overflow-x-auto" : "flex-col",
        GLASS,
        p.className,
      )}
    >
      <IconButton size={size} icon={Plus} label="Zoom in" onClick={() => p.onZoom(1)} />
      <IconButton size={size} icon={Minus} label="Zoom out" onClick={() => p.onZoom(-1)} />
      <IconButton size={size} icon={Focus} label="Reset to Rwanda (R)" onClick={p.onReset} />
      <IconButton
        size={size}
        icon={p.locating ? Loader2 : LocateFixed}
        label={p.locating ? "Finding your location…" : "Show my location"}
        active={p.located}
        onClick={p.onLocate}
        className={p.locating ? "[&>svg]:animate-spin" : undefined}
      />
      {sep}
      <IconButton size={size} icon={Ruler} label="Measure distance" active={p.tool === "distance"} onClick={() => p.onTool(p.tool === "distance" ? "none" : "distance")} />
      <IconButton size={size} icon={Shapes} label="Measure area" active={p.tool === "area"} onClick={() => p.onTool(p.tool === "area" ? "none" : "area")} />
      <IconButton size={size} icon={Radar} label="Nearest schools to a point" active={p.tool === "nearest"} onClick={() => p.onTool(p.tool === "nearest" ? "none" : "nearest")} />
      {sep}
      <IconButton size={size} icon={Layers} label="Layers (L)" active={p.layersOpen} onClick={p.onLayers} aria-expanded={p.layersOpen} />
      <IconButton size={size} icon={ListOrdered} label={p.legendOpen ? "Hide legend" : "Show legend"} active={p.legendOpen} onClick={p.onLegend} />
      <IconButton size={size} icon={p.fullscreen ? Minimize2 : Maximize2} label={p.fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} onClick={p.onFullscreen} />
    </motion.div>
  );
}
