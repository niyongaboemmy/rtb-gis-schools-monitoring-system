import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { cn } from "../../lib/utils";

/* Rwanda (NISR outline, simplified) in a 100-wide box — enough to read as the
   country while the real map loads. */
const RW_VIEWBOX = "0 0 100 88";
const RW_OUTLINE =
  "M53.8 62.9 L53.1 65.0 L54.3 70.6 L53.1 71.3 L52.0 74.2 L52.7 78.3 L51.9 81.3 L49.9 84.1 L47.6 85.2 L46.4 84.1 L44.7 84.4 L43.8 86.6 L42.3 87.0 L38.6 85.5 L32.4 87.5 L30.6 86.2 L28.3 86.0 L25.0 88.0 L23.1 83.5 L24.2 82.7 L22.8 78.9 L19.8 77.2 L17.6 77.8 L14.1 75.8 L13.1 76.8 L11.3 75.8 L9.8 76.3 L8.8 83.3 L6.6 81.1 L5.1 81.3 L1.8 79.2 L1.6 74.7 L0.0 72.9 L1.5 70.9 L0.3 68.4 L1.1 66.1 L2.5 65.0 L4.9 65.1 L6.8 61.2 L11.4 60.4 L12.6 59.2 L15.4 52.6 L13.0 43.3 L13.5 39.7 L18.8 32.0 L18.7 30.5 L22.0 27.1 L24.5 22.7 L28.9 22.5 L32.6 17.8 L34.6 16.7 L39.2 17.0 L42.8 14.4 L45.9 16.0 L47.2 12.8 L49.1 15.4 L50.1 15.2 L50.2 18.5 L51.7 21.4 L54.8 20.2 L57.0 18.1 L58.4 18.9 L58.4 17.2 L59.4 16.3 L61.9 16.6 L62.2 15.5 L64.2 14.6 L64.3 11.1 L66.2 11.2 L70.2 7.0 L70.9 4.8 L72.8 4.1 L73.1 0.7 L78.9 0.3 L78.0 2.0 L79.2 3.7 L78.9 5.3 L80.8 6.1 L82.9 10.1 L83.8 14.2 L85.9 14.9 L86.7 16.6 L89.1 17.0 L92.1 19.6 L92.5 23.3 L97.0 29.7 L96.2 31.7 L96.6 37.5 L95.5 43.7 L100.0 50.6 L97.3 56.9 L97.9 62.2 L94.2 66.0 L91.0 64.3 L88.2 67.1 L85.7 66.4 L83.8 67.4 L78.9 64.8 L78.3 62.5 L76.9 62.9 L75.9 62.0 L74.5 62.8 L74.2 64.3 L66.4 65.0 L64.9 67.8 L62.5 68.3 L60.2 67.2 L57.4 64.0 L53.8 62.9Z";
const RW_PROVINCES =
  "M22.9 80.3 L24.8 77.8 L23.8 74.2 L22.4 73.2 L22.5 71.5 L19.8 70.0 L20.5 68.5 L22.7 67.9 L23.7 64.5 L22.5 62.5 L23.7 61.1 L29.8 60.2 L33.8 56.6 L36.5 56.0 L36.0 54.2 L38.2 49.2 L37.3 45.6 L39.8 44.8 L39.1 33.8 M39.1 33.8 L37.9 32.8 L38.1 26.8 L31.3 25.4 L28.9 22.5 M55.0 42.5 L51.4 39.8 L48.6 40.6 L46.1 39.5 L43.5 34.5 L39.1 33.8 M56.8 50.4 L56.7 52.6 L55.0 54.4 L55.4 57.4 L53.9 62.8 M55.0 42.5 L55.4 39.3 L56.6 38.7 L57.3 40.2 L59.0 38.4 L61.6 37.9 L62.6 36.0 L68.0 39.2 M56.8 50.4 L55.0 49.6 L56.6 47.4 L55.5 46.4 L56.0 44.6 L55.0 42.5 M68.0 39.2 L69.5 43.5 L67.3 44.9 L66.7 50.3 L64.3 48.2 L56.8 50.4 M59.3 16.9 L62.4 21.3 L62.7 23.6 L64.7 23.2 L64.2 26.4 L68.8 32.5 L68.0 33.1 L69.4 38.5 L68.0 39.2";
/** Province centres (Northern, Eastern, Kigali, Western, Southern), same box. */
const RW_ANCHORS: [number, number][] = [
  [51.5, 27.7],
  [82.3, 34.1],
  [62.4, 43.3],
  [26.0, 52.9],
  [40.2, 60.8],
];

/** The frosted surface the real dashboard cards use. */
const GLASS = "bg-white/55 shadow-float backdrop-blur-2xl dark:bg-[hsl(224_40%_6%)]/65";

/** Ring placeholder: an empty track with a short arc gently orbiting it. */
function RingSkeleton({ size, stroke }: { size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-900/[0.06] dark:stroke-white/[0.07]" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.22} ${c}`}
        className="skel-orbit stroke-primary/40"
      />
    </svg>
  );
}

/** Rwanda silhouette: dotted fill, province hairlines, a light tracing the
 *  border, and province beacons blinking in turn. */
function MapSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox={RW_VIEWBOX} className={cn("h-full w-full overflow-visible", className)} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <pattern id="skel-rw-dots" width="2.2" height="2.2" patternUnits="userSpaceOnUse">
          <circle cx="1.1" cy="1.1" r="0.28" className="fill-slate-900/[0.14] dark:fill-white/[0.12]" />
        </pattern>
      </defs>
      <path d={RW_OUTLINE} className="fill-slate-900/[0.035] dark:fill-white/[0.03]" />
      <path d={RW_OUTLINE} fill="url(#skel-rw-dots)" />
      <path
        d={RW_PROVINCES}
        fill="none"
        strokeWidth={1}
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
        className="stroke-slate-900/15 dark:stroke-white/15"
      />
      <path d={RW_OUTLINE} fill="none" strokeWidth={1.2} vectorEffect="non-scaling-stroke" className="stroke-primary/20" />
      <path
        d={RW_OUTLINE}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={100}
        className="skel-trace stroke-primary/70"
      />
      {RW_ANCHORS.map(([x, y], i) => (
        <g key={i} className="skel-beacon" style={{ animationDelay: `${i * 0.36}s`, transformOrigin: `${x}px ${y}px` }}>
          <circle cx={x} cy={y} r={4} className="fill-primary/10" />
          <circle cx={x} cy={y} r={1.4} className="fill-primary/50" />
        </g>
      ))}
    </svg>
  );
}

function StatCardSkeleton() {
  return (
    <div className={cn(GLASS, "flex items-center gap-3 rounded-[1.25rem] p-4")}>
      <RingSkeleton size={44} stroke={3.5} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-2.5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-2.5 w-24 rounded-full" />
      </div>
    </div>
  );
}

function DonutCardSkeleton({ vertical, className }: { vertical?: boolean; className?: string }) {
  return (
    <div className={cn(GLASS, "flex gap-5 rounded-[1.75rem] p-5", vertical ? "flex-col items-center" : "items-center", className)}>
      <RingSkeleton size={112} stroke={9} />
      <div className={cn("grid grid-cols-2 gap-x-5 gap-y-3", vertical ? "w-full" : "flex-1")}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-14 rounded-full" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for the national dashboard, laid out exactly like the page:
 * the title capsule, the map stage (priority ring · Rwanda · four network
 * counters on wide screens; ring + counters below on smaller ones) and the
 * condition-score panel — so nothing jumps when the data arrives.
 */
export function NationalDashboardSkeleton({ className }: { className?: string }) {
  return (
    <SkeletonGroup label="Loading national dashboard…" className={cn("space-y-8 pb-10", className)}>
      <section className="relative flex flex-col gap-4">
        {/* Title capsule */}
        <div className="z-20 flex justify-center lg:absolute lg:inset-x-0 lg:top-0">
          <div className={cn(GLASS, "flex items-center gap-1.5 rounded-full p-1.5")}>
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="mx-1.5 h-4 w-28 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>

        {/* Phones / tablets: the country sits behind the title */}
        <div className="mx-auto h-56 w-full max-w-sm px-6 lg:hidden">
          <MapSilhouette />
        </div>

        {/* Wide screens: ring · map · counters */}
        <div className="relative hidden lg:grid lg:h-[max(560px,calc(100dvh-6rem))] lg:grid-cols-1 xl:grid-cols-[clamp(220px,15vw,270px)_minmax(0,1fr)_clamp(220px,15vw,270px)] xl:gap-4">
          <div className="hidden min-h-0 flex-col justify-center pb-[clamp(6rem,18vh,11rem)] xl:flex">
            <DonutCardSkeleton vertical />
          </div>
          <div className="relative min-h-0 px-[2%] pb-[6%] pt-[2%]">
            <MapSilhouette />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <Skeleton className="h-7 w-64 rounded-full" />
            </div>
          </div>
          <div className="hidden min-h-0 flex-col justify-center gap-3 xl:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Below xl: ring + counters under the map */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2.65fr)] xl:hidden">
          <DonutCardSkeleton className="h-full" />
          <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Condition-score panel */}
      <div className={cn(GLASS, "overflow-hidden rounded-[1.75rem]")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-8">
          <Skeleton className="h-4 w-48 rounded-full" />
          <div className="flex gap-1.5">
            {[64, 84, 72].map((w) => (
              <Skeleton key={w} className="h-6 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <div className="flex flex-col items-center gap-6">
            <RingSkeleton size={176} stroke={10} />
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-20 rounded-full" />
                <Skeleton className="h-2.5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
          <div>
            <div className="flex justify-between pb-3">
              <Skeleton className="h-3.5 w-16 rounded-full" />
              <Skeleton className="h-3 w-32 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.03]">
                  <svg viewBox="0 0 100 54" className="h-[54px] w-[100px]" aria-hidden>
                    <path d="M10 50 A40 40 0 0 1 90 50" fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-slate-900/[0.06] dark:stroke-white/[0.08]" />
                  </svg>
                  <Skeleton className="h-2.5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3 border-t border-slate-900/[0.05] p-6 sm:px-8 dark:border-white/[0.05]">
          {[92, 78, 85].map((w, i) => (
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
