/**
 * One size scale for every sign-in screen (login, 2FA, password reset,
 * forced change) so fields, buttons and links line up across steps.
 */
export const authInputClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 transition-colors outline-none " +
  "focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50 " +
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/15";

export const authLabelClass = "block text-sm font-medium text-foreground";

export const authPrimaryButtonClass = "w-full h-11 rounded-lg text-sm font-semibold";

export const authLinkClass =
  "text-sm font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

export const authSubtleLinkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";
