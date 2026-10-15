import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export interface EmptyStateProps {
  /** Lucide icon shown in the badge (defaults to an inbox). */
  icon?: LucideIcon;
  title: ReactNode;
  /** "No data yet — here is how to add it" style guidance. */
  description?: ReactNode;
  /** Primary call to action. Omit when the user cannot act. */
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  /** Extra actions (e.g. "Clear filters"), rendered after the primary one. */
  secondaryAction?: { label: string; onClick: () => void };
  /** Compact variant for cards / table bodies. */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Consistent "nothing here yet" block (WS3.8). Always explains why the list is
 * empty and, when the user can do something about it, offers the next step.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  compact,
  className,
  children,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border/60 bg-background/60",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary/10 text-primary",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}
        aria-hidden="true"
      >
        <Icon className={compact ? "h-5 w-5" : "h-7 w-7"} />
      </span>
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {children}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {ActionIcon && <ActionIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
