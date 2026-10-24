/**
 * Shared building blocks for the Settings tabs, in the national dashboard's
 * language: frosted glass panels, blur-in reveals, theme status tokens and
 * pill controls. Panels are size containers (`@container`), so their insides
 * respond to the panel's own width (sidebar open/closed, split layouts),
 * not the viewport's.
 *
 * Tables: render the same rows twice, `<DataTable>` (shown from @3xl) and
 * `<CardList>` (below @3xl). Both live inside a `<SettingsPanel>`.
 */
import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, User, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { EASE_OUT, GLASS, INSET, TONE_TILE, type Tone } from "../ui/surfaces";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { HeroSlotContext } from "./hero-slot";

// ── Hero summary ────────────────────────────────────────────────────────────

/**
 * Renders the tab's summary (e.g. stat tiles) inside the Settings hero, so the
 * page has one hero: identity, tabs and the active tab's numbers. Falls back
 * to rendering in place when there is no hero.
 */
export function HeroStats({ children }: { children: ReactNode }) {
  const slot = useContext(HeroSlotContext);
  return slot ? createPortal(children, slot) : <>{children}</>;
}

// ── Panels ──────────────────────────────────────────────────────────────────

export function IconTile({ icon: Icon, tone = "primary", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center ring-1 ring-inset",
        size === "md" ? "h-10 w-10 rounded-2xl" : "h-8 w-8 rounded-xl",
        TONE_TILE[tone],
      )}
    >
      <Icon className={size === "md" ? "h-[18px] w-[18px]" : "h-4 w-4"} />
    </span>
  );
}

interface PanelProps {
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** Buttons on the right of the header (wrap under the title when narrow). */
  actions?: ReactNode;
  /** Filters row under the header (search, selects…). */
  toolbar?: ReactNode;
  /** Reveal order. */
  index?: number;
  /** Body without padding (tables run edge to edge). */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Glass panel with a title row, optional toolbar and a body. */
export function SettingsPanel({
  title,
  subtitle,
  icon,
  tone = "primary",
  actions,
  toolbar,
  index = 0,
  flush,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.6, delay: 0.05 + index * 0.08, ease: EASE_OUT }}
      className={cn("@container min-w-0 overflow-hidden rounded-[1.75rem]", GLASS, className)}
    >
      <header className="flex flex-col gap-3 p-4 min-[400px]:p-5 @2xl:flex-row @2xl:items-center @2xl:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <IconTile icon={icon} tone={tone} />}
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 @2xl:justify-end">{actions}</div>}
      </header>
      {toolbar && <div className="px-4 pb-4 min-[400px]:px-5 sm:px-6">{toolbar}</div>}
      <div className={cn(!flush && "px-4 pb-5 min-[400px]:px-5 sm:px-6 sm:pb-6", bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/** Filters row: stacks on narrow panels, one line when there's room. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2 @lg:grid-cols-2 @3xl:flex @3xl:flex-wrap @3xl:items-center [&>*]:min-w-0 @3xl:[&>*]:w-auto", className)}>
      {children}
    </div>
  );
}

/** Small uppercase label (dashboard stat label style). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</p>
  );
}

/** Form label, matching the profile form. */
export function FieldLabel({ htmlFor, icon: Icon, children, hint }: { htmlFor?: string; icon?: LucideIcon; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs font-normal text-foreground/80">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        {children}
      </label>
      {hint && <span className="text-[13px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

/** Label / value row for detail dialogs and read-only facts. */
export function FactRow({ label, children, icon: Icon }: { label: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5", INSET)}>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-normal text-foreground">{children}</span>
    </div>
  );
}

// ── People ──────────────────────────────────────────────────────────────────

export function Initials({ first, last, size = "md", className }: { first?: string; last?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const text = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/12 font-medium text-primary ring-1 ring-inset ring-primary/20",
        size === "sm" && "h-8 w-8 text-[13px]",
        size === "md" && "h-10 w-10 text-xs",
        size === "lg" && "h-16 w-16 text-xl",
        className,
      )}
    >
      {text}
    </span>
  );
}

/** Quiet person glyph for list rows: a faint user icon instead of initials. */
export function PersonIcon({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-slate-900/[0.04] text-muted-foreground/60 dark:bg-white/[0.05]",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        className,
      )}
    >
      <User className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.75} />
    </span>
  );
}

// ── Actions ─────────────────────────────────────────────────────────────────

/**
 * Round icon button with a tooltip. Always visible (never hover-only, so it
 * works on touch). `danger` turns red on hover.
 */
export function IconAction({
  label,
  icon: Icon,
  onClick,
  tone = "default",
  disabled,
  loading,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled || loading}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
            tone === "danger" ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-primary/10 hover:text-primary",
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────

/** Wide layout (from @3xl). Pass `<thead>`/`<tbody>` built with Th / Tr / Td. */
export function DataTable({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("hidden overflow-x-auto @3xl:block", className)}>
      <table aria-label={label} className="w-full border-separate border-spacing-0 text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-y border-border/40 bg-slate-900/[0.02] px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground first:pl-6 last:pr-6 dark:bg-white/[0.02]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({ children, className, onClick, selected }: { children: ReactNode; className?: string; onClick?: () => void; selected?: boolean }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "group/row transition-colors [&>td]:border-b [&>td]:border-border/30 last:[&>td]:border-b-0",
        "hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.025]",
        onClick && "cursor-pointer",
        selected && "bg-primary/[0.06] hover:bg-primary/[0.08] dark:hover:bg-primary/[0.08]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle first:pl-6 last:pr-6",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Narrow layout (below @3xl): one card per row. */
export function CardList({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <ul aria-label={label} className={cn("grid gap-2 px-4 pb-4 min-[400px]:px-5 @xl:grid-cols-2 @3xl:hidden sm:px-6", className)}>
      {children}
    </ul>
  );
}

export function CardItem({ children, className, selected }: { children: ReactNode; className?: string; selected?: boolean }) {
  return (
    <li className={cn("min-w-0 rounded-2xl p-3.5", INSET, selected && "bg-primary/[0.06] ring-primary/25", className)}>
      {children}
    </li>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

export function ListSkeleton({ rows = 5, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <SkeletonGroup label={label} className="space-y-2 px-4 pb-5 min-[400px]:px-5 sm:px-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full @md:block" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/** Quiet empty / no-results block. */
export function EmptyNote({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
