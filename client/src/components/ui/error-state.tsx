import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export interface ErrorStateProps {
  title?: ReactNode;
  /** Plain-language explanation; avoid raw server messages where possible. */
  message?: ReactNode;
  /** When set, a "Try again" button calls it. */
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Consistent failure block with a retry button (WS3.8). Announced to screen
 * readers via role="alert".
 */
export function ErrorState({
  title = "Could not load this section",
  message,
  onRetry,
  retrying,
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-2xl border border-destructive/30 bg-destructive/5",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
        aria-hidden="true"
      >
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {message && (
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      )}
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} isLoading={retrying}>
          {!retrying && <RotateCw className="mr-1.5 h-4 w-4" aria-hidden="true" />}
          Try again
        </Button>
      )}
    </div>
  );
}
