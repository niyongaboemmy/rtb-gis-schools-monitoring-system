import type { ReactNode } from "react";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { glassSurface } from "./tokens";

/** Rounded bar placeholder. */
const Bar = ({ className }: { className?: string }) => <Skeleton className={cn("rounded-full", className)} />;

/** Ring placeholder (donut / gauge track) — a stroked circle, not a filled disc. */
function Ring({ size, stroke = 10, className }: { size?: number; stroke?: number; className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
        mask: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
      }}
    />
  );
}

/** Same shell as GlassCard: icon chip + title + action, then the body. */
function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col p-4 sm:p-5", glassSurface, className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Bar className="h-3.5 w-24" />
        </div>
        <Bar className="h-3 w-12" />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Donut + legend rows (Issue Reports, Buildings). */
function DonutBody({ rows, footer }: { rows: number; footer: ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Ring size={112} stroke={12} />
        <div className="flex-1 space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Bar className="h-2.5 flex-1" />
              <Bar className="h-2.5 w-5" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto pt-3">{footer}</div>
    </>
  );
}

interface Props {
  /**
   * "page" — the full-screen school view before the viewer mounts: adds the
   * viewer's top bar so nothing jumps when the real chrome appears.
   * "embedded" — inside the viewer's Dashboard tab.
   */
  variant?: "page" | "embedded";
}

/**
 * Loading state that mirrors the school dashboard 1:1 — the full-bleed hero
 * (chips, name, date, score ring + stats panel), the key-figure tiles and the
 * six cards with chart-shaped placeholders, on the same responsive grid.
 */
export function SchoolDashboardSkeleton({ variant = "embedded" }: Props) {
  return (
    <SkeletonGroup label="Loading school dashboard…" className="relative min-h-full">
      {variant === "page" && (
        <>
          {/* Viewer chrome: back + name pill (left), tab pill (centre) */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Bar className="hidden h-8 w-44 lg:block" />
          </div>
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
            <Skeleton className="h-9 w-40 rounded-full sm:w-[22.5rem]" />
          </div>
        </>
      )}

      {/* ── Hero (same paddings as SchoolHero) ───────────────────────── */}
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-br from-slate-50 via-white to-blue-50/70 mask-[linear-gradient(to_bottom,black_74%,transparent)] dark:from-[#070b16] dark:via-[#090f1f] dark:to-[#0b1428]" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60 mask-[radial-gradient(ellipse_75%_85%_at_72%_45%,black,transparent)] dark:opacity-40"
          style={{ backgroundImage: "radial-gradient(circle, rgb(100 116 139 / 0.3) 1px, transparent 1.3px)", backgroundSize: "22px 22px" }}
        />
        <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-24 sm:px-8 sm:pb-16 sm:pt-28 lg:px-10 lg:pb-24 lg:pt-32">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            <div className="min-w-0 flex-1">
              <div className="mb-5 flex flex-wrap gap-2 sm:mb-6">
                <Bar className="h-7 w-28 sm:w-24" />
                <Bar className="h-7 w-40 sm:w-36" />
                <Bar className="h-7 w-24 sm:w-20" />
              </div>
              <Bar className="h-6 w-full max-w-xl sm:h-10" />
              <Bar className="mt-2 h-6 w-2/3 max-w-sm sm:h-8 lg:hidden" />
              <Bar className="mt-4 h-3 w-28 sm:mt-5" />
            </div>
            <div className="flex items-center gap-5 sm:gap-7">
              <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32 lg:h-36 lg:w-36">
                <Ring stroke={9} className="absolute inset-0" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Bar className="h-7 w-12" />
                  <Bar className="h-2 w-8" />
                </div>
              </div>
              <div className="grid min-w-0 gap-3 rounded-2xl bg-white/55 px-4 py-3.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-white/70 sm:min-w-[11.5rem] sm:px-5 sm:py-4 dark:bg-white/[0.05] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] dark:ring-white/10">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={cn("min-h-[3.4rem] space-y-2", i > 0 && "border-t border-slate-900/6 pt-3 dark:border-white/8")}>
                    <Bar className="h-2.5 w-14" />
                    <Bar className="h-4 w-20" />
                    {i !== 1 && <Bar className="h-1.5 w-28" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content (same container as the page) ─────────────────────── */}
      <div className="relative mx-auto -mt-4 max-w-[1400px] space-y-5 px-4 pb-10 sm:-mt-6 sm:px-8 lg:px-10">
        {/* Key-figure tiles: 2 → 3 → 6 columns; phones show four */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2.5 rounded-[1.4rem] bg-white/60 p-3.5 shadow-float dark:bg-blue-400/[0.05]",
                i >= 4 && "hidden sm:flex",
              )}
            >
              <Ring size={44} stroke={3} />
              <div className="flex-1 space-y-2.5">
                <Bar className="h-3 w-14" />
                <Bar className="h-6 w-12" />
                <Bar className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Six cards: 1 → 2 → 3 columns */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Score factors: number, stacked bar, legend with mini bars */}
          <CardShell>
            <div className="flex items-baseline justify-between">
              <Bar className="h-8 w-20" />
              <Bar className="h-2.5 w-20" />
            </div>
            <Bar className="mt-3 h-4 w-full" />
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-2.5 w-2.5 rounded-[3px]" />
                    <Bar className="h-2.5 flex-1" />
                    <Bar className="h-2.5 w-5" />
                  </div>
                  <Bar className="h-1 w-full" />
                </div>
              ))}
            </div>
          </CardShell>

          {/* Next actions: progress bar + three rows */}
          <CardShell>
            <div className="flex items-center gap-2">
              <Bar className="h-1.5 flex-1" />
              <Bar className="h-2.5 w-6" />
            </div>
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-slate-900/3 px-3 py-2.5 dark:bg-white/4">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Bar className="h-4 w-10" />
                  <Bar className="h-3 flex-1" />
                </div>
              ))}
            </div>
          </CardShell>

          {/* Issue Reports: donut + legend, sparkline + chips */}
          <CardShell>
            <DonutBody
              rows={4}
              footer={
                <>
                  <div className="flex h-[30px] items-end gap-[3px]">
                    {[30, 45, 20, 60, 35, 50, 25, 70, 40, 55, 30, 80].map((h, i) => (
                      <Skeleton key={i} className="flex-1 rounded-t-[4px] rounded-b-none" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Bar className="h-5 w-20" />
                    <Bar className="h-5 w-20" />
                    <Bar className="h-5 w-12" />
                  </div>
                </>
              }
            />
          </CardShell>

          {/* Buildings: donut + legend, attention row */}
          <CardShell>
            <DonutBody rows={5} footer={<Skeleton className="h-8 w-full rounded-xl" />} />
          </CardShell>

          {/* Risk: half gauge + level pill, factor bars */}
          <CardShell>
            <div className="flex items-center gap-3">
              <div className="relative h-[52px] w-[94px] shrink-0 overflow-hidden">
                <Ring size={94} stroke={9} className="absolute left-0 top-0" />
              </div>
              <div className="space-y-1.5">
                <Bar className="h-5 w-20" />
                <Bar className="h-2 w-14" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[90, 60, 30].map((w, i) => (
                <div key={i} className="grid grid-cols-[5.5rem_1fr_1.75rem] items-center gap-2">
                  <Bar className="h-2.5 w-16" />
                  <div className="h-2 rounded-full bg-slate-900/5 dark:bg-white/6">
                    <Skeleton className="h-full rounded-full" style={{ width: `${w}%` }} />
                  </div>
                  <Bar className="h-2.5 w-5" />
                </div>
              ))}
            </div>
          </CardShell>

          {/* Data quality: concentric rings + legend, chips, peer pills */}
          <CardShell>
            <div className="flex items-center gap-4">
              <div className="relative h-26 w-26 shrink-0">
                <Ring size={104} stroke={8} className="absolute inset-0" />
                <Ring size={76} stroke={8} className="absolute left-[14px] top-[14px]" />
              </div>
              <div className="flex-1 space-y-2.5">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Bar className="h-2.5 flex-1" />
                    <Bar className="h-2.5 w-8" />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Bar className="h-5 w-24" />
              <Bar className="h-5 w-24" />
              <Bar className="h-5 w-16" />
            </div>
            <div className="mt-auto flex gap-1.5 pt-3">
              <Bar className="h-5 w-20" />
              <Bar className="h-5 w-20" />
            </div>
          </CardShell>
        </div>
      </div>
    </SkeletonGroup>
  );
}
