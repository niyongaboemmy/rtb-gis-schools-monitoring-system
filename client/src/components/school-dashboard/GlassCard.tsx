import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE, glassSurface } from "./tokens";

interface GlassCardProps {
  title: string;
  icon: LucideIcon;
  /** Tailwind text colour for the icon chip, e.g. "text-primary". */
  tone?: string;
  info?: ReactNode;
  /** "View details" style action shown at the top right. */
  actionLabel?: string;
  onAction?: () => void;
  /** Small chip next to the title (e.g. "Indicative"). */
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Entrance order for the stagger. */
  index?: number;
}

/**
 * A bento tile: title row with an icon chip, optional info button and a
 * "details" action, then a compact summary. Detail lives in a modal.
 */
export function GlassCard({
  title,
  icon: Icon,
  tone = "text-primary",
  info,
  actionLabel,
  onAction,
  badge,
  children,
  className,
  index = 0,
}: GlassCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay: 0.15 + index * 0.08, ease: EASE }}
      className={cn("group/card relative flex min-w-0 flex-col overflow-hidden p-4 sm:p-5", glassSurface, className)}
    >
      {/* soft top light, like the national cards */}
      <span aria-hidden className="pointer-events-none absolute -inset-x-8 -top-20 h-28 rotate-[-6deg] bg-linear-to-b from-white/50 to-transparent blur-2xl dark:from-white/[0.04]" />
      <header className="relative mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900/4 dark:bg-white/6", tone)}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <h2 className="min-w-[3rem] truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          {badge}
          {info}
        </div>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/65 dark:hover:bg-white/8"
          >
            {actionLabel ?? "Details"}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5" aria-hidden />
          </button>
        )}
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.section>
  );
}
