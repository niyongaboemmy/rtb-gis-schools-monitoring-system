import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Box, Calendar, ChevronRight, ClipboardPlus, Home, Layers, NotebookText, Pencil, Play, Ruler, X } from "lucide-react";
import { cn } from "../lib/utils";
import { formatArea, formatNumber } from "../lib/format";
import { EASE } from "./school-dashboard/tokens";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import type { BuildingPanelTab } from "../lib/viewer-tools";
import type { ReviewReport } from "./report-review/review-utils";
import { isOpen } from "./report-review/review-utils";
import { BuildingMediaTab } from "./2dviewercomponents/BuildingMediaTab";
import { BuildingReportingTab } from "./2dviewercomponents/BuildingReportingTab";
import { NewReportModal } from "./2dviewercomponents/NewReportModal";
import { buildingArea, buildingCode, buildingCondition, buildingFloors, buildingFunction, buildingInitials, buildingName, buildingYear, type AnyBuilding, type ConditionView } from "./2dviewercomponents/building-utils";
import { isVideoMedia, type MediaEntry } from "./2dviewercomponents/media/media-utils";

interface BlockInspectorProps {
  building: AnyBuilding;
  schoolId: string;
  onClose: () => void;
  /** Open the building form (undefined = no permission). */
  onEdit?: () => void;
  onUpdateBuilding: (building: BuildingData) => Promise<void>;
  on3DView?: () => void;
  /** Tab to open on. The panel is re-keyed when it should change. */
  initialTab?: BuildingPanelTab;
  initialReportId?: string | null;
  /** This building's reports (shared with the map badges and the list). */
  reports: ReviewReport[];
  reportsLoaded: boolean;
  canEditMedia: boolean;
  canCreateReport: boolean;
  canOpenReview: boolean;
  canDecide: (r: ReviewReport) => boolean;
  onReportPatched: (id: string, next: Partial<ReviewReport>) => void;
  onReportSubmitted: () => void;
  onOpenMedia: (index: number) => void;
  onOpenGallery?: () => void;
}

/**
 * The building panel on the map: condition and facts, photos, and reports
 * (with the review flow for users who can decide). Open reports show as a
 * banner with a shortcut to review them.
 */
export function BlockInspector({
  building,
  schoolId,
  onClose,
  onEdit,
  onUpdateBuilding,
  on3DView,
  initialTab = "media",
  initialReportId,
  reports,
  reportsLoaded,
  canEditMedia,
  canCreateReport,
  canOpenReview,
  canDecide,
  onReportPatched,
  onReportSubmitted,
  onOpenMedia,
  onOpenGallery,
}: BlockInspectorProps) {
  const reduce = useReducedMotion();
  const ids = useId();
  const [tab, setTab] = useState<BuildingPanelTab>(initialTab);
  const [reporting, setReporting] = useState(false);

  const name = buildingName(building);
  const code = buildingCode(building);
  const fn = buildingFunction(building);
  const cond = buildingCondition(building);
  const media = ((building.media ?? []) as MediaEntry[]).filter((m) => m?.path);
  const open = reports.filter((r) => isOpen(r.status));
  const action = open.filter((r) => r.status === "NEED_INTERVENTION").length;
  const waiting = open.length - action;
  const canDecideAny = open.some(canDecide);

  const tabs: { key: BuildingPanelTab; label: string; badge?: number; alert?: boolean }[] = [
    { key: "media", label: "Media", badge: media.length || undefined },
    { key: "details", label: "Details" },
    { key: "reporting", label: "Reports", badge: open.length || undefined, alert: open.length > 0 },
  ];

  const actionBtn =
    "inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-900/[0.04] px-3 text-xs text-slate-700 transition-colors hover:bg-slate-900/[0.08] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/6 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white";

  return (
    <div
      className={cn(
        "flex h-[82dvh] w-full flex-col overflow-hidden md:h-full",
        "rounded-t-[1.75rem] bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 md:rounded-[1.5rem]",
        "dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10",
        "shadow-[0_-12px_40px_-16px_rgba(15,23,42,0.35)] md:shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
      )}
      role="complementary"
      aria-label={`Building: ${name}`}
    >
      {/* Phone grab handle */}
      <div className="flex shrink-0 justify-center pb-1 pt-2.5 md:hidden" aria-hidden>
        <div className="h-1.5 w-10 rounded-full bg-slate-300/80 dark:bg-white/15" />
      </div>

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="shrink-0 px-5 pb-3 pt-3 md:pt-5">
        <div className="flex items-start gap-3">
          <motion.span
            initial={reduce ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[15px] font-medium text-primary dark:text-blue-300"
            aria-hidden
          >
            {buildingInitials(building)}
          </motion.span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-medium leading-tight text-slate-900 dark:text-white">{name}</h3>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 dark:text-white/50">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cond.overall.color }} aria-hidden />
              <span className="shrink-0">{cond.overall.label}</span>
              {fn && <span className="truncate capitalize">· {fn}</span>}
              {code && code !== name && <span className="shrink-0 font-mono text-[13px] text-slate-400 dark:text-white/35">· {code}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close building panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>

        {(onEdit || on3DView || canCreateReport) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {canCreateReport && (
              <button type="button" className={actionBtn} onClick={() => setReporting(true)}>
                <ClipboardPlus className="h-3.5 w-3.5" aria-hidden /> Report a problem
              </button>
            )}
            {onEdit && (
              <button type="button" className={actionBtn} onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
            )}
            {on3DView && (
              <button type="button" className={actionBtn} onClick={on3DView}>
                <Box className="h-3.5 w-3.5" aria-hidden /> 3D
              </button>
            )}
          </div>
        )}

        {/* Open reports: a shortcut straight to them */}
        <AnimatePresence initial={false}>
          {open.length > 0 && tab !== "reporting" && (
            <motion.button
              key="alert"
              type="button"
              onClick={() => setTab("reporting")}
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 12 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={cn(
                "group flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-2.5 text-left transition-colors",
                "bg-primary/[0.07] hover:bg-primary/[0.11] dark:bg-primary/15 dark:hover:bg-primary/20",
              )}
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-50" />}
                <span className="relative h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <span className="min-w-0 flex-1 text-[15px] text-slate-800 dark:text-white/85">
                {open.length} open report{open.length === 1 ? "" : "s"}
                <span className="block text-[13px] text-slate-500 dark:text-white/50">
                  {[action && `${action} need${action === 1 ? "s" : ""} action`, waiting && `${waiting} waiting`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-primary dark:text-blue-300">
                {canDecideAny ? "Review" : "View"}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-3">
        <div role="tablist" aria-label="Building" className="flex rounded-full bg-slate-900/5 p-1 dark:bg-white/6">
          {tabs.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${ids}-tab-${t.key}`}
                aria-selected={on}
                aria-controls={`${ids}-panel`}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  on ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-white/55 dark:hover:text-white/85",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={`${ids}-thumb`}
                    className="absolute inset-0 rounded-full bg-white ring-1 ring-slate-900/5 dark:bg-white/12 dark:ring-white/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{t.label}</span>
                {t.badge != null && (
                  <span
                    className={cn(
                      "relative min-w-4.5 rounded-full px-1 text-[12px] leading-4.5 tabular-nums",
                      t.alert ? "bg-primary text-white" : "bg-slate-900/8 text-slate-500 dark:bg-white/10 dark:text-white/60",
                    )}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {tab === "details" && (
              <Details building={building} cond={cond} media={media} onOpenMedia={onOpenMedia} onAllMedia={() => setTab("media")} />
            )}
            {tab === "media" && (
              <BuildingMediaTab building={building} schoolId={schoolId} canEdit={canEditMedia} onUpdateBuilding={onUpdateBuilding} onOpen={onOpenMedia} onGallery={onOpenGallery} />
            )}
            {tab === "reporting" && (
              <BuildingReportingTab
                reports={reports}
                loaded={reportsLoaded}
                initialReportId={initialReportId}
                canDecide={canDecide}
                canOpenReview={canOpenReview}
                onNew={canCreateReport ? () => setReporting(true) : undefined}
                onPatched={onReportPatched}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {canCreateReport && (
        <NewReportModal
          open={reporting}
          schoolId={schoolId}
          buildingId={String(building.id)}
          buildingName={name}
          onClose={() => setReporting(false)}
          onSubmitted={() => {
            setReporting(false);
            setTab("reporting");
            onReportSubmitted();
          }}
        />
      )}
    </div>
  );
}

/* ── Details tab ─────────────────────────────────────────────────────────── */

const R = 26;
const C = 2 * Math.PI * R;

function Details({
  building,
  cond,
  media,
  onOpenMedia,
  onAllMedia,
}: {
  building: AnyBuilding;
  cond: ReturnType<typeof buildingCondition>;
  media: MediaEntry[];
  onOpenMedia: (i: number) => void;
  onAllMedia: () => void;
}) {
  const reduce = useReducedMotion();
  const area = buildingArea(building);
  const floors = buildingFloors(building);
  const year = buildingYear(building);
  const age = year ? new Date().getFullYear() - year : null;
  const facilities = (building.facilities ?? []) as Array<{ facility_name?: string; name?: string; number_of_rooms?: number | string; count?: number | string }>;
  const notes: string = building.buildingNotes || building.notes || "";
  const pct = cond.overall.pct;

  const facts = [
    { label: "Use", value: buildingFunction(building), icon: Layers },
    { label: "Floors", value: floors ? formatNumber(floors) : null, icon: Home },
    { label: "Area", value: area ? formatArea(area) : null, icon: Ruler },
    { label: "Built", value: year ? `${year}${age != null && age >= 0 ? ` · ${age} yrs` : ""}` : null, icon: Calendar },
  ];

  return (
    <div className="space-y-5">
      {/* Condition */}
      <section aria-label="Condition" className="flex items-center gap-4 rounded-2xl bg-slate-900/[0.03] p-4 dark:bg-white/[0.04]">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="5" className="stroke-slate-900/8 dark:stroke-white/10" />
            {pct != null && (
              <motion.circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                className="stroke-primary"
                strokeDasharray={C}
                initial={reduce ? false : { strokeDashoffset: C }}
                animate={{ strokeDashoffset: C - (pct / 100) * C }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            )}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm tabular-nums text-slate-900 dark:text-white">
            {pct != null ? pct : "—"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-slate-500 dark:text-white/45">Condition</p>
          <p className="text-lg leading-tight text-slate-900 dark:text-white">
            {cond.overall.label}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Part label="Structure" v={cond.structure} />
            <Part label="Roof" v={cond.roof} />
          </div>
        </div>
      </section>

      {/* Facts */}
      <dl className="grid grid-cols-2 gap-2">
        {facts.map((f) => (
          <div key={f.label} className="rounded-2xl px-3.5 py-3 ring-1 ring-slate-900/6 dark:ring-white/8">
            <dt className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-white/45">
              <f.icon className="h-3.5 w-3.5" aria-hidden /> {f.label}
            </dt>
            <dd className={cn("mt-1 truncate text-[15px]", f.label === "Use" && "capitalize", f.value ? "text-slate-900 dark:text-white/90" : "text-slate-400 dark:text-white/35")}>{f.value ?? "Not recorded"}</dd>
          </div>
        ))}
      </dl>

      {/* Photos peek */}
      {media.length > 0 && (
        <section aria-label="Photos" className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs text-slate-500 dark:text-white/50">Photos</h4>
            <button type="button" onClick={onAllMedia} className="text-xs text-primary hover:underline">
              See all {media.length}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {media.slice(0, 4).map((m, i) => (
              <button
                key={`${m.path}:${i}`}
                type="button"
                onClick={() => onOpenMedia(i)}
                aria-label={`Open ${m.title || "photo"}`}
                className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/5"
              >
                {isVideoMedia(m) ? (
                  <span className="flex h-full w-full items-center justify-center text-slate-500 dark:text-white/60">
                    <Play className="h-4 w-4" aria-hidden />
                  </span>
                ) : (
                  <img src={m.path} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                )}
                {i === 3 && media.length > 4 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-sm text-white">+{media.length - 4}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Facilities */}
      {facilities.length > 0 && (
        <section aria-label="Facilities" className="space-y-2">
          <h4 className="text-xs text-slate-500 dark:text-white/50">
            Facilities <span className="tabular-nums text-slate-400 dark:text-white/35">{facilities.length}</span>
          </h4>
          <ul className="divide-y divide-slate-900/5 overflow-hidden rounded-2xl ring-1 ring-slate-900/6 dark:divide-white/6 dark:ring-white/8">
            {facilities.map((f, i) => {
              const rooms = Number(f.number_of_rooms || f.count || 0);
              return (
                <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="truncate text-[15px] text-slate-800 dark:text-white/85">{f.facility_name || f.name || "Facility"}</span>
                  {rooms > 0 && (
                    <span className="shrink-0 text-[13px] tabular-nums text-slate-500 dark:text-white/50">
                      {rooms} room{rooms === 1 ? "" : "s"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notes && (
        <section aria-label="Notes" className="flex gap-2.5 rounded-2xl bg-slate-900/[0.03] p-3.5 dark:bg-white/[0.04]">
          <NotebookText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-white/40" aria-hidden />
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-700 dark:text-white/75">{notes}</p>
        </section>
      )}
    </div>
  );
}

function Part({ label, v }: { label: string; v: ConditionView }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[13px] text-slate-600 ring-1 ring-slate-900/6 dark:bg-white/6 dark:text-white/70 dark:ring-white/8">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} aria-hidden />
      {label}: {v.label}
    </span>
  );
}
