import type { ReactNode } from "react";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { glassSurface } from "../school-dashboard/tokens";

const Bar = ({ className }: { className?: string }) => <Skeleton className={cn("rounded-full", className)} />;

function Header({ actions }: { actions: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <div className="space-y-2">
          <Bar className="h-5 w-32" />
          <Bar className="h-3 w-72 max-w-[60vw]" />
        </div>
      </div>
      <div className="flex gap-2">
        {actions.map((w, i) => (
          <Bar key={i} className={cn("h-9", w)} />
        ))}
      </div>
    </div>
  );
}

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

/** List-group rows: avatar, school + age, facility line, snippet, status. */
function Rows({ n = 6 }: { n?: number }) {
  return (
    <div className="divide-y divide-slate-900/6 overflow-hidden rounded-2xl ring-1 ring-slate-900/6 dark:divide-white/6 dark:ring-white/8">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Bar className="h-3.5 w-40" />
              <Bar className="h-3.5 w-8" />
            </div>
            <Bar className="h-2.5 w-32" />
            <Bar className="h-2.5 w-full max-w-xs" />
          </div>
          <Bar className="hidden h-5 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Reports dashboard: header, four figures, pipeline, waiting + decisions, exports. */
export function ReportsDashboardSkeleton() {
  return (
    <SkeletonGroup label="Loading reports…">
      <div className="space-y-5">
        <Header actions={["w-9", "w-24", "w-40"]} />
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
        <Card>
          <Bar className="h-3 w-full" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <Rows n={4} />
          </Card>
          <Card>
            <Rows n={4} />
          </Card>
        </div>
      </div>
    </SkeletonGroup>
  );
}

/** Review page, step 1: header, tabs + filters, list group, pager. */
export function ValidationSkeleton() {
  return (
    <SkeletonGroup label="Loading reports to review…">
      <div className="mx-auto max-w-4xl space-y-5">
        <Header actions={["w-44", "w-9"]} />
        <div className={cn("space-y-3 p-3 sm:p-4", glassSurface)}>
          <div className="flex flex-wrap justify-between gap-2">
            <Bar className="h-9 w-72 max-w-full" />
            <div className="flex gap-1.5">
              <Bar className="h-7 w-12" />
              <Bar className="h-7 w-20" />
              <Bar className="h-7 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Bar className="h-9 flex-1" />
            <Bar className="h-9 w-40" />
          </div>
          <Rows n={8} />
          <div className="flex justify-between">
            <Bar className="h-3 w-24" />
            <Bar className="h-8 w-40" />
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}
