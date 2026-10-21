import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
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
  const glass = "rounded-[1.5rem] bg-white/55 shadow-float backdrop-blur-2xl dark:bg-[hsl(224_40%_6%)]/65";
  return (
    <SkeletonGroup label={label} className={cn("space-y-6", className)}>
      <div className="space-y-2.5">
        <Skeleton className="h-6 w-2/3 max-w-xs rounded-full" />
        <Skeleton className="h-3.5 w-1/2 max-w-[14rem] rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className={cn(glass, "flex items-center gap-3 p-4")}>
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2.5 w-1/2 rounded-full" />
              <Skeleton className="h-5 w-2/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={cn(glass, "space-y-4 p-6 xl:col-span-2")}>
          <Skeleton className="h-4 w-40 rounded-full" />
          <div className="flex h-52 items-end gap-2">
            {[45, 70, 55, 85, 60, 75, 40, 65, 80, 50].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-lg rounded-b-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className={cn(glass, "space-y-3 p-6")}>
          <Skeleton className="h-4 w-32 rounded-full" />
          {[90, 75, 82, 68, 88].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-xl" />
              <Skeleton className="h-3 rounded-full" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
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
