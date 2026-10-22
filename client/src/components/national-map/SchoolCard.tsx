import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Box, ChevronDown, Copy, Crosshair, Navigation, Share2, X } from "lucide-react";
import { viewerLink } from "../../lib/viewer-tools";
import { cn } from "../../lib/utils";
import { formatLength, formatNumber } from "../../lib/format";
import { label } from "../../lib/labels";
import { useToast } from "../ui/toast";
import { MetricInfo } from "../metric-help/MetricInfo";
import { PRIORITY_META, priorityMeta, scoreBand } from "../maps/schoolMap";
import { formatCoord } from "./geo";
import type { PlottedSchool } from "./types";
import { EASE, MUTED, STRONG, scoreColor } from "./tokens";
import { IconButton, ScoreRing } from "./ui";

/** Extra columns the /schools list API returns beyond the store's `School` type. */
interface SchoolExtras {
  totalStudents?: number | null;
  totalTeachers?: number | null;
  establishedYear?: number | null;
}

const BAND_RANGE: Record<string, string> = {
  critical: "under 35",
  high: "35–54",
  medium: "55–74",
  low: "75+",
};

/** "Eastern Province" → "Eastern"; the card has little room. */
const shortProvince = (p?: string | null) => (p ?? "").replace(/\s+Province$/i, "");

/** Whether "More details" was left open — kept while hopping between schools. */
let detailsOpenPref = false;

async function copy(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

export interface SchoolCardProps {
  point: PlottedSchool;
  nearby: { point: PlottedSchool; meters: number }[];
  canDecision: boolean;
  can3d: boolean;
  /** Hidden (e.g. a filter excludes it) — shown as a note. */
  filteredOut: boolean;
  onClose: () => void;
  onZoom: () => void;
  onPick: (p: PlottedSchool) => void;
  /** Close button is rendered by the bottom sheet on phones. */
  hideClose?: boolean;
}

/**
 * Selected-school card: a glanceable summary (score, priority, size) and the
 * main action. Everything else sits behind "More details" — the school's own
 * page has the full picture.
 */
export function SchoolCardBody({
  point,
  nearby,
  canDecision,
  can3d,
  filteredOut,
  onClose,
  onZoom,
  onPick,
  hideClose,
}: SchoolCardProps) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(detailsOpenPref);
  const s = point.school as typeof point.school & SchoolExtras;
  const prio = priorityMeta(point.priority);
  const band = point.score === null ? null : scoreBand(point.score);
  const coords = formatCoord(point.lat, point.lng);

  const toggle = () => {
    detailsOpenPref = !open;
    setOpen(!open);
  };

  const stats: { k: string; v: string }[] = [
    { k: "Students", v: formatNumber(s.totalStudents ?? null) },
    { k: "Teachers", v: formatNumber(s.totalTeachers ?? null) },
    { k: "Type", v: label("schoolTypeShort", s.type) },
  ];
  const details: { k: string; v: string }[] = [
    { k: "Code", v: s.code || "—" },
    { k: "Sector", v: s.sector || "—" },
    { k: "Established", v: s.establishedYear ? String(s.establishedYear) : "—" },
    { k: "Site model", v: label("kmzStatus", s.kmzStatus) },
  ];

  const share = async () => {
    const url = new URL("/map", window.location.origin);
    url.searchParams.set("school", s.id);
    try {
      await copy(url.toString());
      toast.success("Link copied — it opens the map on this school");
    } catch {
      toast.error("Could not copy the link");
    }
  };
  const copyCoords = async () => {
    try {
      await copy(coords);
      toast.success(`Coordinates copied: ${coords}`);
    } catch {
      toast.error("Could not copy the coordinates");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: score, name, place */}
      <div className="relative flex items-start gap-3 px-4 pb-3 pt-4">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full blur-3xl"
          style={{ background: `${scoreColor(point.score)}24` }}
        />
        <ScoreRing score={point.score} size={46} stroke={4} delay={0.1} />
        <div className="relative min-w-0 flex-1 pt-0.5">
          <h2 className={cn("line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight", STRONG)}>{s.name}</h2>
          <p className={cn("mt-0.5 flex items-center gap-1.5 truncate text-xs", MUTED)}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: prio.color }} />
            <span className="truncate">
              {point.priority ? `${prio.label} priority` : "Not assessed"} · {s.district}, {shortProvince(s.province)}
            </span>
          </p>
        </div>
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close school details"
            className={cn("relative -mr-1.5 -mt-1 rounded-full p-1.5 transition-colors hover:bg-slate-900/5 dark:hover:bg-white/10", MUTED)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">
        {filteredOut && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            Hidden on the map by your filters.
          </p>
        )}

        {/* Three numbers that matter at a glance */}
        <dl className="grid grid-cols-3 divide-x divide-slate-900/[0.06] rounded-2xl bg-slate-900/[0.03] py-2.5 dark:divide-white/[0.06] dark:bg-white/[0.04]">
          {stats.map((f) => (
            <div key={f.k} className="min-w-0 px-3 text-center">
              <dd className={cn("truncate text-[13px] tabular-nums", STRONG)}>{f.v}</dd>
              <dt className={cn("text-[10.5px]", MUTED)}>{f.k}</dt>
            </div>
          ))}
        </dl>

        {/* Main action + quick actions */}
        <div className="flex items-center gap-1.5">
          {canDecision && (
            <Link
              to={`/schools/${s.id}/decision`}
              className="group inline-flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-primary pl-4 pr-1 text-[13px] text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.8)] transition-transform hover:-translate-y-px motion-reduce:hover:translate-y-0"
            >
              Open school
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          )}
          <div className={cn("flex items-center gap-0.5 rounded-full bg-slate-900/[0.04] p-0.5 dark:bg-white/[0.06]", !canDecision && "mx-auto")}>
            {can3d && (
              // The school viewer, opened on its 3D tab.
              <Link
                to={viewerLink("3d", s.id)}
                aria-label="3D view"
                title="3D view"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <Box className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Directions (opens Google Maps)"
              title="Directions"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Navigation className="h-4 w-4" aria-hidden />
            </a>
            <IconButton icon={Share2} label="Copy link to this school" title="Share link" size="sm" onClick={() => void share()} />
          </div>
        </div>

        {/* More details */}
        <div>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="school-card-details"
            className={cn(
              "flex w-full items-center justify-center gap-1 rounded-full py-1 text-xs transition-colors hover:text-slate-900 dark:hover:text-white",
              MUTED,
            )}
          >
            {open ? "Fewer details" : "More details"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden />
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id="school-card-details"
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-2">
                  {/* Score in words */}
                  <p className={cn("flex items-center gap-1.5 text-xs", MUTED)}>
                    {band ? (
                      <span>
                        Condition score <span className={cn("tabular-nums", STRONG)}>{Math.round(point.score!)}</span> ·{" "}
                        <span style={{ color: PRIORITY_META[band].color }}>{PRIORITY_META[band].label}</span> band,{" "}
                        {BAND_RANGE[band]}
                      </span>
                    ) : (
                      <span>Not assessed yet, so there is no condition score.</span>
                    )}
                    <MetricInfo id="school.conditionScore" size="xs" />
                  </p>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {details.map((f) => (
                      <div key={f.k} className="min-w-0">
                        <dt className={cn("text-[10.5px]", MUTED)}>{f.k}</dt>
                        <dd className={cn("truncate text-[13px] tabular-nums", STRONG)}>{f.v}</dd>
                      </div>
                    ))}
                    <div className="col-span-2 flex min-w-0 items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <dt className={cn("text-[10.5px]", MUTED)}>Coordinates</dt>
                        <dd className={cn("truncate font-mono text-xs", STRONG)}>{coords}</dd>
                      </div>
                      <IconButton icon={Copy} label="Copy coordinates" size="sm" onClick={() => void copyCoords()} />
                      <IconButton icon={Crosshair} label="Zoom to school" size="sm" onClick={onZoom} />
                    </div>
                  </dl>

                  {nearby.length > 0 && (
                    <div>
                      <p className={cn("pb-1 text-[11px]", MUTED)}>Nearest schools</p>
                      <ul>
                        {nearby.slice(0, 3).map(({ point: n, meters }) => (
                          <li key={n.school.id}>
                            <button
                              type="button"
                              onClick={() => onPick(n)}
                              className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]"
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: scoreColor(n.score) }} />
                              <span className={cn("min-w-0 flex-1 truncate text-[13px]", STRONG)}>{n.school.name}</span>
                              <span className={cn("shrink-0 text-[11px] tabular-nums", MUTED)}>{formatLength(meters)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
