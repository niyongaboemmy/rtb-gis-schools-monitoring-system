import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton, SkeletonCards, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";

/**
 * Consistent loading / empty / error states for the dashboards (WS3.8).
 */

export function DashboardSkeleton({
  cards = 4,
  label = "Loading dashboard…",
  className,
}: {
  cards?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <SkeletonGroup label={label} className="space-y-2">
        <Skeleton className="h-7 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-1/2 max-w-xs" />
      </SkeletonGroup>
      <SkeletonCards count={cards} />
      <SkeletonGroup label="" className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-3xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-3xl" />
      </SkeletonGroup>
    </div>
  );
}

export function DashboardError({
  title = "We couldn't load this dashboard",
  message = "Check your connection and try again. If it keeps happening, contact your administrator.",
  onRetry,
  retrying = false,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="rounded-full border border-red-500/20 bg-red-500/10 p-4">
        <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} variant="outline" className="gap-2 rounded-full">
          <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} aria-hidden="true" />
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </div>
  );
}

export function DashboardEmpty({
  icon: Icon = Inbox,
  title = "No data yet",
  description,
  actionLabel,
  actionTo,
  onAction,
  children,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  /** Explain how to add the missing data. */
  description: ReactNode;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/10 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="rounded-2xl bg-primary/10 p-4">
        <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {actionLabel && actionTo && (
        <Button asChild className="rounded-full">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && !actionTo && onAction && (
        <Button onClick={onAction} className="rounded-full">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
