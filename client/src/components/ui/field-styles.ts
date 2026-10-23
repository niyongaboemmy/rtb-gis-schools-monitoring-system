import { cn } from "../../lib/utils";

/**
 * Shared field surface: a hairline border and a whisper of fill that lifts on
 * hover and glows primary on focus. On dark it stays translucent so it reads
 * as part of the glass card, not a solid slab.
 */
export const fieldSurface = cn(
  "border outline-none transition-[border-color,background-color,box-shadow] duration-200",
  // Light
  "border-slate-900/[0.09] bg-white/70 text-foreground shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] placeholder:text-slate-400",
  "hover:border-slate-900/[0.16] focus-visible:border-primary/60 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-primary/10",
  // Dark
  "dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-none dark:placeholder:text-white/25",
  "dark:hover:border-white/[0.14] dark:hover:bg-white/[0.04]",
  "dark:focus-visible:border-primary/55 dark:focus-visible:bg-white/[0.05] dark:focus-visible:ring-primary/15",
  // States
  "read-only:cursor-default read-only:bg-slate-900/[0.02] read-only:text-muted-foreground read-only:shadow-none dark:read-only:bg-transparent",
  "read-only:hover:border-slate-900/[0.09] dark:read-only:hover:border-white/[0.07] read-only:focus-visible:ring-2",
  "aria-invalid:border-destructive/60 aria-invalid:focus-visible:ring-destructive/15 dark:aria-invalid:border-destructive/60",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * The same surface for a wrapper around a bare control (search pill, select
 * trigger): it lights up while anything inside has focus (or `data-open`).
 */
export const fieldShell = cn(
  "border transition-[border-color,background-color,box-shadow] duration-200",
  "border-slate-900/[0.09] bg-white/70 text-foreground shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)]",
  "hover:border-slate-900/[0.16] focus-within:border-primary/60 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10",
  "data-[open=true]:border-primary/60 data-[open=true]:bg-white data-[open=true]:ring-4 data-[open=true]:ring-primary/10",
  "dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-none",
  "dark:hover:border-white/[0.14] dark:hover:bg-white/[0.04]",
  "dark:focus-within:border-primary/55 dark:focus-within:bg-white/[0.05] dark:focus-within:ring-primary/15",
  "dark:data-[open=true]:border-primary/55 dark:data-[open=true]:bg-white/[0.05] dark:data-[open=true]:ring-primary/15",
);

/** Floating menu / popover surface (dropdown lists, flyouts). */
export const menuSurface =
  "rounded-2xl border border-border/60 bg-popover/95 text-popover-foreground shadow-float backdrop-blur-2xl";
