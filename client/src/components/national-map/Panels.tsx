import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE, GLASS_STRONG, MUTED, STRONG } from "./tokens";

/** Floating glass side panel (tablet / desktop). */
export function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  className,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          id="national-map-panel"
          aria-label="Filters and school list"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.98 }}
          transition={{ duration: 0.45, ease: EASE }}
          className={cn("pointer-events-auto flex flex-col overflow-hidden rounded-[1.75rem]", GLASS_STRONG, className)}
        >
          <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-4">
            <div className="min-w-0">
              <h2 className={cn("text-base font-semibold tracking-tight", STRONG)}>{title}</h2>
              {subtitle && <p className={cn("truncate text-xs", MUTED)}>{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide filters and list"
              className={cn("rounded-full p-2 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/10", MUTED)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export type SheetSnap = "peek" | "half" | "full";
const PEEK = 74;

/**
 * Phone bottom sheet with a drag handle and three snap points (peek, half,
 * full). Only the handle area starts a drag, so the list inside scrolls.
 */
export function BottomSheet({
  snap,
  onSnap,
  header,
  label,
  id,
  children,
}: {
  snap: SheetSnap;
  onSnap: (s: SheetSnap) => void;
  header: ReactNode;
  label: string;
  id?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(600);
  const y = useMotionValue(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const snaps: Record<SheetSnap, number> = { full: 0, half: Math.round(h * 0.45), peek: Math.max(0, h - PEEK) };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const projected = y.get() + info.velocity.y * 0.18;
    const best = (Object.keys(snaps) as SheetSnap[]).reduce((a, b) =>
      Math.abs(snaps[b] - projected) < Math.abs(snaps[a] - projected) ? b : a,
    );
    onSnap(best);
  };

  return (
    <motion.section
      ref={ref}
      id={id}
      aria-label={label}
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: snaps.peek }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      style={{ y }}
      initial={reduce ? false : { y: snaps.peek + 40 }}
      animate={{ y: snaps[snap] }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 38 }}
      className={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 top-[68px] flex flex-col overflow-hidden rounded-t-[1.75rem]",
        GLASS_STRONG,
      )}
    >
      <div
        onPointerDown={(e) => controls.start(e)}
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <button
          type="button"
          onClick={() => onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")}
          aria-label={snap === "peek" ? "Expand panel" : snap === "half" ? "Expand panel fully" : "Collapse panel"}
          data-tooltip="off"
          className="mx-auto flex w-full justify-center pb-1 pt-2.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-900/20 dark:bg-white/25" />
        </button>
        {header}
      </div>
      {/* Hidden below the fold while peeking: keep it out of the tab order. */}
      <div className="flex min-h-0 flex-1 flex-col" inert={snap === "peek" || undefined}>
        {children}
      </div>
    </motion.section>
  );
}
