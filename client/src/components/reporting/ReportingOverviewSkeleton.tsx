import type { ReactNode } from "react";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { glassSurface } from "../school-dashboard/tokens";

const Bar = ({ className }: { className?: string }) => <Skeleton className={cn("rounded-full", className)} />;

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col p-4 sm:p-5", glassSurface, className)}>
      <div className="mb-4 flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Bar className="h-3.5 w-32" />
      </div>
      {children}
    </div>
  );
}

/** Mirrors the reporting overview: period bar, four figures, status + trend, urgent + schools. */
export function ReportingOverviewSkeleton() {
  return (
    <SkeletonGroup label="Loading reporting overview…">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Bar className="h-9 w-80 max-w-full" />
          <Bar className="h-8 w-44" />
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-[1.4rem] bg-white/60 p-3.5 shadow-float dark:bg-blue-400/[0.05]">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2.5">
                <Bar className="h-3 w-20" />
                <Bar className="h-6 w-12" />
                <Bar className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card>
            <Bar className="h-3 w-full" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Bar className="h-3 flex-1" />
                  <Bar className="h-3 w-6" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex h-[170px] items-end gap-1.5 pl-8">
              {[30, 55, 20, 70, 40, 85, 35, 60, 25, 75, 45, 50].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-b-none rounded-t-[4px]" style={{ height: `${h}%` }} />
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          </Card>
          <Card>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Bar className="h-3 w-48 max-w-full" />
                    <Bar className="h-2.5 w-28" />
                  </div>
                  <Bar className="h-3 w-8" />
                  <Bar className="h-3 w-8" />
                  <Bar className="h-1.5 w-20" />
                  <Bar className="h-3 w-10" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SkeletonGroup>
  );
}
