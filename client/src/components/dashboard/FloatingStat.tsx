import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Counts up to `value` with an ease-out: from 0 (after `delay`) on first
 * show, then from the number on screen when the value changes (e.g. a new
 * period), so it never drops back to 0. Instant for reduced motion.
 */
function useCountUp(value: number | null, duration = 1400, delay = 0) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const raf = useRef(0);
  const current = useRef(0);
  const started = useRef(false);
  useEffect(() => {
    if (value === null || reduce) return;
    const from = current.current;
    const wait = started.current ? 0 : delay;
    started.current = true;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t + wait;
      const k = Math.max(0, Math.min(1, (t - start) / duration));
      current.current = from + (value - from) * (1 - Math.pow(1 - k, 3));
      setShown(current.current);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration, delay, reduce]);
  // Missing data or reduced motion: show the real value straight away.
  return value === null || reduce ? value : shown;
}

interface Props {
  label: string;
  caption: string;
  value: number | null;
  /** Formats the (animated) number, e.g. formatPercent / formatNumber. */
  format: (n: number | null) => string;
  /** 0–100: draws a progress ring around the icon. */
  percent?: number | null;
  icon: LucideIcon;
  /** Tailwind text colour class for the icon / ring, e.g. "text-primary". */
  tone: string;
  /** Same accent as a CSS colour (hex), for glows and edges. */
  color: string;
  info?: ReactNode;
  /** Entrance order (staggers the reveal and offsets the float rhythm). */
  index?: number;
  /** Large screens: float in place with a gentle drift. */
  floating?: boolean;
  /** Tighter layout for grids (smaller icon and number). */
  compact?: boolean;
  /** No drop shadow: for cards sitting on another surface (e.g. the Settings hero). */
  flat?: boolean;
  /** @deprecated No effect: icons are always flat and sharp (the old glow / 3D lift rendered blurry). */
  depth?: boolean;
  className?: string;
}

/**
 * Glass statistic card for the dashboard hero: frosted and borderless,
 * counts up on reveal, optional progress ring, and (when floating) drifts
 * gently so the stats feel suspended over the map.
 */
export function FloatingStat({
  label,
  caption,
  value,
  format,
  percent = null,
  icon: Icon,
  tone,
  color,
  info,
  index = 0,
  floating = false,
  compact = false,
  flat = false,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const shown = useCountUp(value, 1400, 500 + index * 120);
  const ring = percent === null ? null : Math.max(0, Math.min(100, percent));
  const C = 2 * Math.PI * 21;

  // Cursor-driven 3D tilt + glow, eased by springs.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotX = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 220, damping: 18 });
  const rotY = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 220, damping: 18 });
  const glow = useMotionTemplate`radial-gradient(220px circle at ${useTransform(mx, (v) => `${v * 100}%`)} ${useTransform(my, (v) => `${v * 100}%`)}, ${color}33, transparent 70%)`;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay: 0.35 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={cn("[perspective:900px]", className)}
    >
      <motion.div
        animate={floating && !reduce ? { y: [0, -7, 0] } : undefined}
        transition={floating ? { duration: 6 + (index % 3), repeat: Infinity, ease: "easeInOut", delay: index * 0.9 } : undefined}
      >
        <motion.div
          onPointerMove={(e) => {
            if (reduce) return;
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width);
            my.set((e.clientY - r.top) / r.height);
          }}
          onPointerLeave={() => {
            mx.set(0.5);
            my.set(0.5);
          }}
          whileHover={reduce ? undefined : { scale: 1.035, y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={reduce ? undefined : { rotateX: rotX, rotateY: rotY }}
          className={cn(
            cn("group relative min-w-0 overflow-hidden rounded-[1.4rem]", compact ? "p-3.5" : "p-4"),
            // Readable glass: mostly opaque, still frosted over the map
            "bg-linear-to-br from-white/60 via-white/35 to-white/20 backdrop-blur-2xl backdrop-saturate-[1.8]",
            !flat && "shadow-float",
            "dark:from-blue-400/[0.07] dark:via-blue-500/[0.03] dark:to-transparent",
            "transition-shadow duration-300",
          )}
        >
          {/* glass reflection: a soft diagonal light across the top */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-16 h-24 rotate-[-8deg] bg-linear-to-b from-white/50 to-transparent blur-xl dark:hidden"
          />
          {/* cursor glow */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: glow }}
            />
          )}

          {/* Icons stay flat and crisp: no translateZ layer (rasterised soft)
              and no glow filter (clipped into a blurry square by the SVG box). */}
          <div className={cn("relative flex items-center", compact ? "gap-2.5" : "gap-3.5")}>
            {/* Icon tile, ringed with progress when there's a percentage */}
            <span className={cn("relative flex shrink-0 items-center justify-center", compact ? "h-11 w-11" : "h-[52px] w-[52px]", tone)} aria-hidden>
              <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="3" />
                {ring !== null && (
                  <motion.circle
                    cx="24"
                    cy="24"
                    r="21"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    initial={{ strokeDashoffset: C }}
                    animate={{ strokeDashoffset: C * (1 - ring / 100) }}
                    transition={{ duration: reduce ? 0 : 1.4, delay: reduce ? 0 : 0.6 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </svg>
              <span
                className="absolute inset-[7px] rounded-full transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${color}1f` }}
              />
              <Icon className="relative h-[18px] w-[18px] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
            </span>

            <div className="min-w-0 flex-1">
              <dt className={cn("flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-white/55", compact ? "font-medium" : "font-semibold uppercase tracking-[0.08em]")}>
                <span className="truncate">{label}</span>
                {info}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-2">
                <span className={cn("font-semibold leading-none tabular-nums tracking-tight text-slate-900 dark:text-white", compact ? "text-[1.4rem]" : "text-[1.75rem]")}>
                  {format(shown === null ? null : Math.round(shown))}
                </span>
              </dd>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-white/55">{caption}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
