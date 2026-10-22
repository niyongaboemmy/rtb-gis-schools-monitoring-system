import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { useFocusTrap } from "../layout/useFocusTrap";
import { cn } from "../../lib/utils";
import { EASE } from "./tokens";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Icon chip next to the title (brand tinted). */
  icon?: LucideIcon;
  /** Small context line above the title, e.g. the school name. */
  eyebrow?: ReactNode;
  /** Key figures shown in the header, above the scrolling body. */
  summary?: ReactNode;
  /** Sticky bottom bar (refresh, last updated, …). */
  footer?: ReactNode;
  children: ReactNode;
  /** Tailwind max-width of the panel. */
  maxWidth?: string;
}

/**
 * The dashboard's "view more" dialog: header (icon, context, title, key
 * figures), scrolling body, optional sticky footer. A centred panel on wider
 * screens, a bottom sheet with a drag handle on phones. Fully opaque.
 *
 * Rendered into <body>: the school dashboard lives inside a blurred, fixed
 * viewer overlay, and a fixed dialog inside a `backdrop-filter` ancestor would
 * be positioned and clipped by that overlay instead of the viewport.
 */
export function DetailModal({ isOpen, ...rest }: DetailModalProps) {
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{isOpen && <Panel {...rest} />}</AnimatePresence>, document.body);
}

function Panel({
  onClose,
  title,
  description,
  icon: Icon,
  eyebrow,
  summary,
  footer,
  children,
  maxWidth = "max-w-4xl",
}: Omit<DetailModalProps, "isOpen">) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const [scrolled, setScrolled] = useState(false);
  // Phones get a bottom sheet that slides up and can be dragged away.
  const [sheet] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches);

  // Keeps Tab inside, closes on Escape, restores focus on close (WCAG 2.4.3).
  useFocusTrap(panelRef, true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const enter = reduce ? { opacity: 0 } : sheet ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.98 };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-md dark:bg-black/65"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        initial={enter}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={enter}
        transition={{ duration: reduce ? 0.15 : 0.38, ease: EASE }}
        drag={sheet ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white ring-1 ring-slate-900/8",
          "shadow-[0_40px_120px_-30px_rgba(15,23,42,0.45)] sm:max-h-[86dvh] sm:rounded-[1.75rem]",
          "dark:bg-[hsl(224_40%_7%)] dark:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] dark:ring-white/10",
          maxWidth,
        )}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="relative shrink-0 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_130%_at_0%_0%,rgb(37_99_235/0.09),transparent_60%)] dark:bg-[radial-gradient(110%_130%_at_0%_0%,rgb(59_130_246/0.16),transparent_60%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 mask-[radial-gradient(ellipse_55%_100%_at_100%_0%,black,transparent)] dark:opacity-40"
            style={{ backgroundImage: "radial-gradient(circle, rgb(100 116 139 / 0.3) 1px, transparent 1.3px)", backgroundSize: "18px 18px" }}
          />

          {sheet && (
            <div
              className="relative flex cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
              onPointerDown={(e) => drag.start(e)}
              aria-hidden
            >
              <span className="h-1.5 w-11 rounded-full bg-slate-900/15 dark:bg-white/20" />
            </div>
          )}

          <div className={cn("relative flex items-start gap-3.5 px-5 sm:px-7", sheet ? "pt-2" : "pt-6")}>
            {Icon && (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/15 dark:text-blue-300">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-white/45">{eyebrow}</p>
              )}
              <h2 id={titleId} className="text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl dark:text-white">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-slate-600 dark:text-white/55">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900/5 text-slate-500 transition-colors hover:bg-slate-900/10 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/6 dark:text-white/60 dark:hover:bg-white/12 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {summary ? <div className="relative px-5 pb-5 pt-4 sm:px-7">{summary}</div> : <div className="h-5" />}
          <div
            aria-hidden
            className={cn(
              "h-px transition-colors",
              scrolled ? "bg-slate-900/10 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.25)] dark:bg-white/12" : "bg-slate-900/6 dark:bg-white/8",
            )}
          />
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div
          className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-900/6 bg-slate-50/80 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7 dark:border-white/8 dark:bg-white/[0.02]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}
