import { cn } from "../../lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50 motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

/** Accessible wrapper: announces "Loading…" once, hides the shapes from AT. */
function SkeletonGroup({
  label = "Loading…",
  className,
  children,
}: {
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

/** Grid of KPI/stat card placeholders. */
function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/40 bg-background p-5 space-y-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** Table / list placeholder with a header row. */
function SkeletonTable({ rows = 6, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("rounded-2xl border border-border/40 bg-background p-4 space-y-3", className)}>
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-8 flex-1", c === 0 && "max-w-[40%]")} />
          ))}
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** Generic block of text lines (detail panels). */
function SkeletonText({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <SkeletonGroup className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </SkeletonGroup>
  )
}

export { Skeleton, SkeletonGroup, SkeletonCards, SkeletonTable, SkeletonText }
