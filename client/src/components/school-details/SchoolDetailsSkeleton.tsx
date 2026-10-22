import type { ReactNode } from "react";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { glassSurface } from "../school-dashboard/tokens";

const Bar = ({ className }: { className?: string }) => <Skeleton className={cn("rounded-full", className)} />;

/** Same shell as GlassCard: icon chip + title, then the body. */
function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col p-4 sm:p-5", glassSurface, className)}>
      <div className="mb-4 flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Bar className="h-3.5 w-28" />
      </div>
      {children}
    </div>
  );
}

const FieldPair = () => (
  <div className="space-y-1.5">
    <Bar className="h-2.5 w-14" />
    <Bar className="h-3.5 w-24" />
  </div>
);

const Split = () => (
  <div className="space-y-2">
    <div className="flex justify-between">
      <Bar className="h-2.5 w-16" />
      <Bar className="h-5 w-12" />
    </div>
    <Bar className="h-2 w-full" />
    <div className="flex justify-between">
      <Bar className="h-2.5 w-20" />
      <Bar className="h-2.5 w-20" />
    </div>
  </div>
);

/**
 * Loading state that mirrors the Details tab: hero (chips, name, meta,
 * actions), the key-figure tiles, the record cards and the survey card.
 */
export function SchoolDetailsSkeleton() {
  return (
    <SkeletonGroup label="Loading school details…" className="relative min-h-full">
      {/* Hero */}
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-br from-slate-50 via-white to-blue-50/70 mask-[linear-gradient(to_bottom,black_70%,transparent)] dark:from-[#070b16] dark:via-[#090f1f] dark:to-[#0b1428]" />
        <div className="mx-auto max-w-[1400px] px-5 pb-12 pt-24 sm:px-8 sm:pb-14 sm:pt-28 lg:px-10 lg:pb-16 lg:pt-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-5 flex flex-wrap gap-2">
                <Bar className="h-7 w-24" />
                <Bar className="h-7 w-20" />
                <Bar className="h-7 w-14" />
                <Bar className="h-7 w-28" />
              </div>
              <Bar className="h-6 w-full max-w-xl sm:h-10" />
              <Bar className="mt-2 h-6 w-2/3 max-w-sm sm:h-8 lg:hidden" />
              <div className="mt-4 flex gap-4">
                <Bar className="h-3 w-32" />
                <Bar className="h-3 w-16" />
                <Bar className="h-3 w-28" />
              </div>
            </div>
            <div className="flex gap-2">
              <Bar className="h-10 w-32" />
              <Bar className="h-10 w-36" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto -mt-4 max-w-[1400px] space-y-5 px-4 pb-10 sm:-mt-6 sm:px-8 lg:px-10">
        {/* Key figures */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("flex items-center gap-2.5 rounded-[1.4rem] bg-white/60 p-3.5 shadow-float dark:bg-blue-400/[0.05]", i === 4 && "hidden sm:flex")}>
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2.5">
                <Bar className="h-3 w-14" />
                <Bar className="h-6 w-12" />
                <Bar className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Location */}
          <CardShell>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <FieldPair key={i} />
              ))}
            </div>
            <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
          </CardShell>
          {/* Contact */}
          <CardShell>
            <Skeleton className="h-[68px] w-full rounded-2xl" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <FieldPair />
                </div>
              ))}
            </div>
          </CardShell>
          {/* People */}
          <CardShell>
            <div className="space-y-5">
              <Split />
              <Split />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <FieldPair />
                <FieldPair />
              </div>
            </div>
          </CardShell>
          {/* Land & access */}
          <CardShell>
            <Split />
            <div className="mt-6 space-y-4">
              <div className="flex justify-between">
                <Bar className="h-2.5 w-16" />
                <Bar className="h-3.5 w-28" />
              </div>
              <Bar className="h-1.5 w-full" />
            </div>
          </CardShell>
          {/* Buildings (two columns wide on large screens) */}
          <CardShell className="md:col-span-2 xl:col-span-2">
            <Bar className="h-2.5 w-full" />
            <div className="mt-2 flex gap-3">
              <Bar className="h-2.5 w-16" />
              <Bar className="h-2.5 w-14" />
            </div>
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                  <Skeleton className="h-8 w-1 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Bar className="h-3 w-40" />
                    <Bar className="h-2.5 w-56" />
                  </div>
                  <Bar className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        {/* Survey */}
        <CardShell>
          <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-center">
            <div className="space-y-2">
              <Bar className="h-2.5 w-24" />
              <Bar className="h-8 w-20" />
              <Bar className="h-2.5 w-32" />
            </div>
            <div className="space-y-2">
              <Bar className="h-3 w-full" />
              <div className="flex gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <Bar key={i} className="h-2.5 w-20" />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2.5 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[58px] w-full rounded-2xl" />
            ))}
          </div>
        </CardShell>
      </div>
    </SkeletonGroup>
  );
}
