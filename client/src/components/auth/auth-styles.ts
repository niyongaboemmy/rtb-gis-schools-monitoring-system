/**
 * One size scale for every sign-in screen (login, 2FA, password reset,
 * forced change) so fields, buttons and links line up across steps.
 * Matches the app's <Input> (rounded-xl, white/20 border in dark) and
 * <Button> (rounded-full).
 */
export const authInputClass =
  "flex h-11 w-full rounded-xl border border-gray-300 dark:border-white/20 bg-background dark:bg-white/[0.03] " +
  "px-4 text-sm text-foreground dark:text-white placeholder:text-muted-foreground/70 dark:placeholder:text-white/35 " +
  "transition-colors outline-none hover:border-gray-400 dark:hover:border-white/30 " +
  "focus:border-primary dark:focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50 " +
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/15";

export const authLabelClass = "block text-sm font-medium text-foreground dark:text-white";

/** Secondary copy — brighter than muted-foreground in dark mode. */
export const authMutedClass = "text-muted-foreground dark:text-white/70";

export const authPrimaryButtonClass = "w-full h-11 rounded-full text-sm font-semibold";

export const authSecondaryButtonClass =
  "h-11 rounded-full border-gray-300 dark:border-white/20 bg-transparent dark:text-white dark:hover:bg-white/5";

export const authLinkClass =
  "text-sm font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

export const authSubtleLinkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground dark:text-white/70 hover:text-foreground " +
  "dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full px-2 py-1";

/** Bordered card / list surface (method options, app list, backup codes). */
export const authCardClass = "rounded-xl border border-gray-300/80 dark:border-white/15";
