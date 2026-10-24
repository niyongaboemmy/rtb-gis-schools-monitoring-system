import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, ClipboardCheck, Landmark, MapPin, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import { label } from "../../lib/labels";
import { BAND_HEX } from "../../lib/scoring";
import type { PriorityKey } from "../dashboard/types";
import { EASE } from "../school-dashboard/tokens";

const pill =
  "inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-900/5 backdrop-blur-md dark:bg-white/8 dark:text-white/75 dark:ring-white/10";

const STATUS_DOT: Record<string, string> = { active: "#10b981", inactive: "#94a3b8", under_renovation: "#f59e0b" };

interface Props {
  name: string;
  code?: string | null;
  place?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: PriorityKey | null;
  establishedYear?: number | null;
  updatedAt?: string | null;
  onEditProfile?: () => void;
  onUpdateSurvey?: () => void;
}

/**
 * The school's identity, in the dashboard's hero language but quieter (no
 * score): chips, the name, record dates, and the two record actions.
 */
export function DetailsHero({ name, code, place, status, type, priority, establishedYear, updatedAt, onEditProfile, onUpdateSurvey }: Props) {
  const reduce = useReducedMotion();
  return (
    <header className="relative isolate overflow-hidden">
      {/* Backdrop: soft brand light, dot matrix, contour lines — all decorative */}
      <div aria-hidden className="absolute inset-0 -z-10 mask-[linear-gradient(to_bottom,black_70%,transparent)]">
        <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-white to-blue-50/70 dark:from-[#070b16] dark:via-[#090f1f] dark:to-[#0b1428]" />
        <div className="absolute -right-32 -top-40 h-120 w-120 rounded-full bg-primary/15 blur-[120px] dark:bg-primary/20" />
        <div
          className="absolute inset-0 opacity-60 mask-[radial-gradient(ellipse_70%_90%_at_75%_40%,black,transparent)] dark:opacity-40"
          style={{ backgroundImage: "radial-gradient(circle, rgb(100 116 139 / 0.3) 1px, transparent 1.3px)", backgroundSize: "22px 22px" }}
        />
        <svg className="absolute -right-24 top-0 h-full w-[46rem] max-w-none text-primary/15 dark:text-blue-300/10" viewBox="0 0 600 300" fill="none" preserveAspectRatio="xMaxYMid slice">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.ellipse
              key={i}
              cx="420"
              cy="140"
              rx={70 + i * 42}
              ry={40 + i * 26}
              stroke="currentColor"
              strokeWidth="1"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, delay: 0.1 + i * 0.12, ease: EASE }}
            />
          ))}
        </svg>
      </div>

      {/* top padding clears the viewer's floating navigation */}
      <div className="mx-auto max-w-[1400px] px-5 pb-12 pt-24 sm:px-8 sm:pb-14 sm:pt-28 lg:px-10 lg:pb-16 lg:pt-28">
        <motion.div
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="min-w-0 max-w-3xl">
            <ul className="mb-5 flex flex-wrap items-center gap-2">
              {code && <li className={cn(pill, "font-mono text-[13px] tracking-wide")}>{code}</li>}
              {status && (
                <li className={pill}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[status] ?? "#94a3b8" }} aria-hidden />
                  {label("schoolStatus", status)}
                </li>
              )}
              {type && <li className={pill}>{label("schoolTypeShort", type)}</li>}
              {priority && (
                <li className={pill}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: BAND_HEX[priority] }} aria-hidden />
                  {label("priority", priority)} priority
                </li>
              )}
            </ul>

            <h1
              title={name}
              className="line-clamp-3 max-w-[36ch] break-words text-[clamp(1.5rem,1.05rem+1.5vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.015em] text-balance text-slate-900 sm:line-clamp-2 dark:text-white"
            >
              {name}
            </h1>

            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-white/50">
              {place && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {place}
                </span>
              )}
              {establishedYear && (
                <span className="inline-flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5" aria-hidden />
                  Est. {establishedYear}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                Updated {updatedAt ? formatDate(updatedAt) : "—"}
              </span>
            </p>
          </div>

          {(onEditProfile || onUpdateSurvey) && (
            <div className="flex flex-wrap gap-2">
              {onEditProfile && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_-12px_rgb(37_99_235/0.7)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit profile
                </button>
              )}
              {onUpdateSurvey && (
                <button
                  type="button"
                  onClick={onUpdateSurvey}
                  className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-800 ring-1 ring-slate-900/10 backdrop-blur-md transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/8 dark:text-white/85 dark:ring-white/12 dark:hover:bg-white/12"
                >
                  <ClipboardCheck className="h-4 w-4 text-primary dark:text-blue-300" aria-hidden />
                  Update survey
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </header>
  );
}
