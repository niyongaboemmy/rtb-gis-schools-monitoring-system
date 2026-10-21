import { motion, useReducedMotion } from "framer-motion";
import { Check, Droplets, Grid2x2, Layers, MapPinned, ScanEye, Sparkles, SquareDashed, Type, X, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { BASEMAPS, basemapPreviewUrl, type BasemapId } from "../maps/schoolMap";
import { OVERLAY_META, type OverlayId } from "./types";
import { EASE, GLASS_STRONG, MUTED, STRONG } from "./tokens";
import { ToggleRow } from "./ui";

const OVERLAY_ICONS: Record<OverlayId, LucideIcon> = {
  provinces: MapPinned,
  districts: SquareDashed,
  labels: Type,
  lake: Droplets,
  focus: ScanEye,
  clusters: Grid2x2,
  density: Sparkles,
};
const ORDER: OverlayId[] = ["provinces", "districts", "labels", "focus", "lake", "clusters", "density"];

/** Basemap switcher with live tile previews, plus overlay toggles. */
export function LayersPanel({
  theme,
  basemap,
  overlays,
  onBasemap,
  onToggle,
  onClose,
  className,
}: {
  theme: "light" | "dark";
  basemap: BasemapId;
  overlays: Set<OverlayId>;
  onBasemap: (b: BasemapId) => void;
  onToggle: (o: OverlayId, on: boolean) => void;
  onClose: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="dialog"
      aria-label="Map layers"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn("pointer-events-auto flex flex-col overflow-hidden rounded-[1.75rem]", GLASS_STRONG, className)}
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className={cn("flex items-center gap-2 text-base font-semibold tracking-tight", STRONG)}>
          <Layers className="h-4 w-4 text-primary" aria-hidden /> Layers
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close layers"
          className={cn("rounded-full p-2 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/10", MUTED)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        <p className={cn("px-2 pb-2 text-xs", MUTED)}>Basemap</p>
        <div className="grid grid-cols-3 gap-2 px-2" role="radiogroup" aria-label="Basemap">
          {BASEMAPS.map((b) => {
            const on = basemap === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={on}
                data-tooltip="off"
                onClick={() => onBasemap(b.id)}
                className="group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-xl bg-slate-200 transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0 dark:bg-slate-800",
                    on ? "shadow-[0_0_0_2px_hsl(var(--primary))]" : "shadow-[0_0_0_1px_rgba(15,23,42,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                  )}
                >
                  <img
                    src={basemapPreviewUrl(b, theme)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className={cn("h-full w-full scale-[1.6] object-cover", b.tone?.(theme) && `scm-tiles--${b.tone(theme)}`)}
                  />
                  {on && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                </span>
                <span className={cn("w-full truncate text-center text-[11px]", on ? "text-primary" : MUTED)}>{b.label}</span>
              </button>
            );
          })}
        </div>

        <p className={cn("px-2 pb-1 pt-4 text-xs", MUTED)}>Overlays</p>
        <div className="space-y-0.5">
          {ORDER.map((o) => (
            <ToggleRow
              key={o}
              icon={OVERLAY_ICONS[o]}
              label={OVERLAY_META[o].label}
              hint={OVERLAY_META[o].hint}
              checked={overlays.has(o)}
              onChange={(on) => onToggle(o, on)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
