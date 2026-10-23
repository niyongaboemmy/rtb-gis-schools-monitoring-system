/** Shared surfaces, matching the national dashboard (command bar / FloatingStat). */

/** Frosted glass card: content panels, heroes, tab capsules. */
export const GLASS =
  "bg-white/45 shadow-float backdrop-blur-2xl backdrop-saturate-[1.8] dark:bg-white/[0.04]";

/** Quiet inset block inside a glass card (fact tiles, grouped rows). */
export const INSET =
  "bg-slate-900/[0.02] ring-1 ring-inset ring-border/40 dark:bg-white/[0.02]";

/** Same easing as the dashboard reveals. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Status tone, mapped to the theme's status tokens only. */
export type Tone = "good" | "warn" | "danger" | "neutral" | "primary";

/** Icon tile (rounded square behind an icon), per tone. Add `ring-1 ring-inset`. */
export const TONE_TILE: Record<Tone, string> = {
  good: "bg-success/12 text-success ring-success/20",
  warn: "bg-warning/12 text-warning ring-warning/25",
  danger: "bg-destructive/12 text-destructive ring-destructive/20",
  neutral: "bg-slate-900/[0.05] text-muted-foreground ring-border/50 dark:bg-white/[0.05]",
  primary: "bg-primary/10 text-primary ring-primary/20",
};

/** Status pill body + dot colour, per tone. */
export const TONE_PILL: Record<Tone, { box: string; dot: string }> = {
  good: { box: "bg-success/12 text-success", dot: "bg-success" },
  warn: { box: "bg-warning/12 text-warning", dot: "bg-warning" },
  danger: { box: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  neutral: { box: "bg-slate-900/[0.04] text-muted-foreground dark:bg-white/[0.04]", dot: "bg-muted-foreground/60" },
  primary: { box: "bg-primary/10 text-primary", dot: "bg-primary" },
};

/** Pill button classes, to pass to `<Button className>`. */
export const PILL_BUTTON = {
  primary: "group h-10 gap-1.5 rounded-full px-5 text-sm font-medium",
  secondary: "h-10 gap-1.5 rounded-full px-4 text-sm font-medium",
  small: "h-9 gap-1.5 rounded-full px-4 text-xs font-medium",
} as const;
