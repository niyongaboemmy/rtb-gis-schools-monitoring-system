import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatScore } from "../../lib/format";
import { label } from "../../lib/labels";
import { MetricInfo } from "../metric-help/MetricInfo";

export interface RankedSchool {
  id: string;
  name: string;
  district?: string;
  calculatedScore: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const RING = 2 * Math.PI * 18;

type Band = "critical" | "high" | "medium" | "low";
const bandOf = (s: number): Band => (s < 35 ? "critical" : s < 55 ? "high" : s < 75 ? "medium" : "low");
const BAND_HEX: Record<Band, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#10b981" };

/**
 * Splits a list sorted best-first into a "highest" and a "lowest" group of up
 * to `n` each, never listing the same school twice (small networks).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function splitRankings<T>(sorted: T[], n = 5) {
  const k = Math.min(n, Math.ceil(sorted.length / 2));
  const top = sorted.slice(0, k);
  const bottom = sorted.slice(k).reverse().slice(0, Math.min(n, sorted.length - k));
  return { top, bottom };
}

function RankList({
  title,
  caption,
  icon: Icon,
  tone,
  schools,
  delay,
}: {
  title: string;
  caption: string;
  icon: LucideIcon;
  tone: string;
  schools: RankedSchool[];
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${tone}1f`, color: tone }}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-white/45">{caption}</p>
        </div>
      </div>

      {schools.length === 0 ? (
        <p className="rounded-2xl bg-slate-900/3 px-4 py-6 text-center text-sm text-slate-500 dark:bg-white/4 dark:text-white/50">
          No scored schools yet.
        </p>
      ) : (
        <ol className="grid gap-2">
          {schools.map((s, i) => {
            const band = bandOf(s.calculatedScore);
            const c = BAND_HEX[band];
            const pct = Math.max(0, Math.min(100, s.calculatedScore));
            return (
              <motion.li
                key={s.id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: delay + i * 0.06, ease: EASE }}
              >
                <Link
                  to={`/schools/${s.id}/decision`}
                  aria-label={`Open ${s.name}`}
                  className="group flex items-center gap-3.5 rounded-2xl bg-slate-900/3 p-2.5 pr-3.5 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/4 dark:hover:bg-white/7"
                >
                  {/* Score ring */}
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
                      <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3.5" className="stroke-slate-900/7 dark:stroke-white/10" />
                      <motion.circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke={c}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={RING}
                        initial={{ strokeDashoffset: RING }}
                        whileInView={{ strokeDashoffset: RING * (1 - pct / 100) }}
                        viewport={{ once: true }}
                        transition={{ duration: reduce ? 0 : 1, delay: delay + 0.15 + i * 0.06, ease: EASE }}
                      />
                    </svg>
                    <span className="text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatScore(s.calculatedScore)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{s.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500 dark:text-white/45">
                      <span className="tabular-nums">#{i + 1}</span>
                      <span aria-hidden>·</span>
                      <span className="truncate">{s.district ?? "—"}</span>
                    </p>
                  </div>
                  <span
                    className="hidden shrink-0 rounded-full px-2 py-0.5 text-[13px] font-medium sm:inline"
                    style={{ background: `${c}1f`, color: c }}
                  >
                    {label("priority", band)}
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary dark:text-white/25"
                    aria-hidden
                  />
                </Link>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Highest and lowest School Condition Scores side by side, in one glass panel. */
export function SchoolRankings({
  top,
  bottom,
  embedded = false,
  className,
}: {
  top: RankedSchool[];
  bottom: RankedSchool[];
  /** Render without its own glass panel (inside another panel). */
  embedded?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn(
        !embedded && [
          "overflow-hidden rounded-[1.75rem] shadow-float",
          "bg-white/55 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_6%)]/65 dark:backdrop-saturate-75",
        ],
        className,
      )}
    >
      <header className="flex items-center gap-2 px-6 pt-6 sm:px-8">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">School rankings</h2>
        <MetricInfo id="national.rankings" />
      </header>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:gap-10">
        <RankList title="Highest scores" caption="Best-maintained schools" icon={TrendingUp} tone="#10b981" schools={top} delay={0.1} />
        <RankList title="Lowest scores" caption="Prioritise for intervention" icon={TrendingDown} tone="#ef4444" schools={bottom} delay={0.2} />
      </div>
    </motion.section>
  );
}
