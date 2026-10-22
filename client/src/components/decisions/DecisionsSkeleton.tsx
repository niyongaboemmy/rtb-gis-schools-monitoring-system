import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { glassSurface } from "../school-dashboard/tokens";

const Bar = ({ className }: { className?: string }) => <Skeleton className={cn("rounded-full", className)} />;

/** Mirrors the queue rows: dial, name + band, place, weakest factor, act, cost. */
export function QueueRowsSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <ul className="space-y-1" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 px-3 py-3 sm:px-4 lg:grid-cols-[2rem_auto_minmax(0,1.6fr)_minmax(0,1fr)_7rem_6rem_auto]"
        >
          <Bar className="hidden h-3 w-3 lg:block" />
          <Skeleton className="h-[46px] w-[46px] rounded-full" />
          <span className="space-y-2">
            <span className="flex items-center gap-2">
              <Bar className="h-3.5 w-48 max-w-full" />
              <Bar className="h-4 w-14" />
            </span>
            <Bar className="block h-2.5 w-32" />
          </span>
          <span className="hidden space-y-2 lg:block">
            <Bar className="block h-3 w-36" />
            <Bar className="block h-2.5 w-20" />
          </span>
          <Bar className="hidden h-3 w-20 lg:block" />
          <Bar className="hidden h-3 w-16 lg:block" />
          <Skeleton className="h-4 w-4 rounded" />
        </li>
      ))}
    </ul>
  );
}

/** Loading state for the whole Decision & Analytics page. */
export function DecisionsSkeleton() {
  return (
    <SkeletonGroup label="Loading priorities…">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div className="space-y-2">
              <Bar className="h-5 w-52" />
              <Bar className="h-3 w-72 max-w-[60vw]" />
            </div>
          </div>
          <div className="flex gap-2">
            <Bar className="h-9 w-24" />
            <Bar className="h-9 w-28" />
            <Bar className="h-9 w-24" />
          </div>
        </div>

        {/* Key figures */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-[1.4rem] bg-white/60 p-3.5 shadow-float dark:bg-blue-400/[0.05]">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2.5">
                <Bar className="h-3 w-20" />
                <Bar className="h-6 w-14" />
                <Bar className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className={cn("p-3 sm:p-4", glassSurface)}>
          <div className="flex flex-col gap-3 px-1 pb-3 pt-1 sm:px-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Bar className="h-4 w-36" />
              <Bar className="h-8 w-56" />
            </div>
            <Bar className="h-2.5 w-full" />
            <div className="flex flex-wrap items-center gap-2">
              {["w-14", "w-20", "w-16", "w-20", "w-14"].map((w, i) => (
                <Bar key={i} className={cn("h-7", w)} />
              ))}
              <Bar className="ml-auto h-9 w-full sm:w-56" />
            </div>
          </div>
          <QueueRowsSkeleton />
        </div>
      </div>
    </SkeletonGroup>
  );
}
