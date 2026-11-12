import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  CloudDownload,
  ExternalLink,
  GitCompareArrows,
  Info,
  Lock,
  MapPin,
  MapPinPlus,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber } from "../../lib/format";
import type { ReportSchool } from "../../lib/tdmp";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { StatusPill } from "../ui/status-pill";
import { EASE_OUT, PILL_BUTTON } from "../ui/surfaces";

/** A small ⓘ that opens a plain-language explanation in place (works on touch). */
export function HelpHint({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What is ${label}?`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.span
            id={id}
            role="note"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-1.5 block max-w-sm rounded-xl bg-primary/[0.07] px-3 py-2 text-xs font-normal leading-relaxed text-foreground ring-1 ring-inset ring-primary/15"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── Guided setup ─────────────────────────────────────────────────────────────

export interface SetupStep {
  id: string;
  /** One or two words for the stepper. */
  short: string;
  title: string;
  /** What this step means, in one or two plain sentences. */
  explain: string;
  done: boolean;
  /** Shown instead of a button when the step can't be done from here. */
  blockedNote?: string;
  action?: { label: string; onClick: () => void; busy?: boolean };
}

/**
 * The first-time path through the integration as a checklist. Each step's
 * state comes from live data, and the next step to do is highlighted.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const reduce = useReducedMotion();
  const done = steps.filter((s) => s.done).length;
  const nextIdx = steps.findIndex((s) => !s.done);
  const pct = Math.round((done / steps.length) * 100);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground" aria-live="polite">
          {done === steps.length ? "All set" : `${done} of ${steps.length} done`}
        </span>
      </div>
      <ol className="space-y-2" aria-label="Setup steps">
        {steps.map((s, i) => {
          const isNext = i === nextIdx;
          return (
            <li
              key={s.id}
              className={cn(
                "flex flex-col gap-2 rounded-2xl px-4 py-3 ring-1 ring-inset transition-colors @2xl:flex-row @2xl:items-center @2xl:justify-between",
                isNext
                  ? "bg-primary/[0.06] ring-primary/30"
                  : "bg-slate-900/[0.02] ring-slate-900/5 dark:bg-white/[0.03] dark:ring-white/8",
              )}
              aria-current={isNext ? "step" : undefined}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : isNext ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", s.done ? "text-muted-foreground" : "text-foreground")}>
                    {s.title}
                    {s.done && <span className="sr-only"> (done)</span>}
                    {isNext && (
                      <span className="ml-2 align-middle">
                        <StatusPill tone="primary" dot={false}>
                          Next
                        </StatusPill>
                      </span>
                    )}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.explain}</p>
                </div>
              </div>
              {!s.done && (s.action || s.blockedNote) && (
                <div className="shrink-0 pl-8 @2xl:pl-0">
                  {s.action ? (
                    <Button
                      variant={isNext ? "default" : "outline"}
                      className={PILL_BUTTON.small}
                      onClick={s.action.onClick}
                      data-tooltip={s.explain}
                      isLoading={s.action.busy}
                      disabled={s.action.busy}
                    >
                      {s.action.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{s.blockedNote}</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────

const STAGES = [
  {
    id: "read",
    icon: CloudDownload,
    title: "Read",
    short: "From TDMP",
    body: "RTB GIS reads TDMP's list of TVET schools with a read-only key. It never writes anything back to TDMP. TDMP refreshes its own data about 06:00 each morning.",
  },
  {
    id: "compare",
    icon: GitCompareArrows,
    title: "Compare",
    short: "By school code",
    body: "Each TDMP school is matched to an RTB GIS school by its official SDMS code. Schools that did not change since the last sync are skipped, so nothing is rewritten without a reason.",
  },
  {
    id: "update",
    icon: Building2,
    title: "Update",
    short: "Profiles, not maps",
    body: "Matched schools get TDMP's latest name, status, location names, ownership and learner and teacher totals. A school TDMP has but RTB GIS does not is added at TDMP's GPS point. The map location you set in RTB GIS is never moved.",
  },
] as const;

const OWNED_BY_TDMP: Array<[string, string]> = [
  ["Name and code", "The official SDMS code and school name."],
  ["Type (TSS / VTC)", "From TDMP's TSS and VTC lists; schools in neither keep the type set here."],
  ["Status", "Active or inactive in TDMP. “Under renovation”, set here, is kept."],
  ["Province … village", "The administrative location names and their TDMP ids."],
  ["Ownership", "Public, government aided, private or other."],
  ["Year established", "From the school's TDMP record."],
  ["Learners and teachers (totals)", "Head counts from TDMP. Gender splits come later, when TDMP opens them."],
];
const OWNED_BY_GIS: Array<[string, string]> = [
  ["Map location", "The GPS point, set by a person, a KMZ upload or a 3D model. TDMP's point is only used for a school new to RTB GIS."],
  ["Boundaries, 3D and drone maps", "Everything uploaded and processed in RTB GIS."],
  ["Buildings and infrastructure", "Buildings, facilities, utilities, roads and land stay managed here."],
  ["Programme capacity", "Seats per programme stay editable here until TDMP provides them."],
  ["Condition score and reports", "Calculated and managed in RTB GIS."],
  ["Contact details", "Phone, email and website (TDMP has none)."],
];

function OwnershipColumn({
  title,
  icon: Icon,
  tone,
  items,
  locked,
}: {
  title: string;
  icon: typeof Lock;
  tone: string;
  items: Array<[string, string]>;
  locked?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const hint = items.find(([k]) => k === picked)?.[1];
  return (
    <div className="space-y-2">
      <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", tone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([k]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPicked((p) => (p === k ? null : k))}
            aria-pressed={picked === k}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              picked === k
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-white/60 text-foreground ring-slate-900/10 hover:ring-primary/40 dark:bg-white/[0.04] dark:ring-white/10",
            )}
          >
            {k}
          </button>
        ))}
      </div>
      <p className="min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground" aria-live="polite">
        {hint ?? (locked ? "Tap a field to see why. These are read-only on linked schools: correct them in TDMP." : "Tap a field to see why.")}
      </p>
    </div>
  );
}

/** Interactive explanation: the three stages of a sync, and who owns which field. */
export function HowItWorks() {
  const [stage, setStage] = useState<(typeof STAGES)[number]["id"]>("read");
  const current = STAGES.find((s) => s.id === stage)!;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-2 @xl:grid-cols-3" role="tablist" aria-label="How a sync works">
        {STAGES.map((s, i) => {
          const active = s.id === stage;
          return (
            <div key={s.id} className="relative">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStage(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 ring-inset transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/10 ring-primary/40"
                    : "bg-slate-900/[0.02] ring-slate-900/5 hover:ring-primary/25 dark:bg-white/[0.03] dark:ring-white/8",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-primary text-primary-foreground" : "bg-slate-900/[0.05] text-muted-foreground dark:bg-white/10",
                  )}
                  aria-hidden
                >
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    <span className="mr-1 tabular-nums text-muted-foreground">{i + 1}</span>
                    {s.title}
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground">{s.short}</span>
                </span>
              </button>
              {i < STAGES.length - 1 && (
                <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/60 @xl:block" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
      <motion.p
        key={current.id}
        role="tabpanel"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl bg-slate-900/[0.03] px-4 py-3 text-sm leading-relaxed text-foreground ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8"
      >
        {current.body}
      </motion.p>
      <div className="grid gap-5 @2xl:grid-cols-2">
        <OwnershipColumn title="Comes from TDMP" icon={Lock} tone="text-primary" items={OWNED_BY_TDMP} locked />
        <OwnershipColumn title="Stays in RTB GIS" icon={MapPin} tone="text-success" items={OWNED_BY_GIS} />
      </div>
    </div>
  );
}

// ── Schools waiting for a location ───────────────────────────────────────────

function LocationForm({
  school,
  onSubmit,
}: {
  school: ReportSchool;
  onSubmit: (lat: number, lng: number) => Promise<boolean>;
}) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();
  const ok = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${school.name} ${school.district ?? ""} Rwanda`)}`;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setBusy(true);
        const done = await onSubmit(Number(lat), Number(lng));
        setBusy(false);
        if (done) {
          setLat("");
          setLng("");
        }
      }}
    >
      <label className="space-y-1">
        <span className="block text-[11px] text-muted-foreground" id={`${id}-lat`}>
          Latitude
        </span>
        <Input aria-labelledby={`${id}-lat`} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-1.9441" className="h-9 w-28 rounded-xl" />
      </label>
      <label className="space-y-1">
        <span className="block text-[11px] text-muted-foreground" id={`${id}-lng`}>
          Longitude
        </span>
        <Input aria-labelledby={`${id}-lng`} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="30.0619" className="h-9 w-28 rounded-xl" />
      </label>
      <Button
        type="submit"
        className={PILL_BUTTON.small}
        disabled={!ok || busy}
        isLoading={busy}
        data-tooltip={ok ? "Add this school at these coordinates; its details come from TDMP" : "Enter latitude and longitude first"}
      >
        <MapPinPlus className="h-3.5 w-3.5" aria-hidden /> Add school
      </Button>
      <a href={mapUrl} target="_blank" rel="noreferrer" data-tooltip="Search for the school in Google Maps (new tab), then copy its coordinates" className="inline-flex h-9 items-center gap-1 text-xs font-medium text-primary hover:underline">
        Find on map <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </form>
  );
}

/**
 * TDMP schools the sync could not add because TDMP has no usable GPS for
 * them. A person gives the point; everything else comes from TDMP.
 */
export function NeedsLocationList({
  schools,
  onAdd,
}: {
  schools: ReportSchool[];
  onAdd: (school: ReportSchool, lat: number, lng: number) => Promise<boolean>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!schools.length)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-success" aria-hidden /> Every TDMP school has a place on the map.
      </p>
    );
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        TDMP has these {formatNumber(schools.length)} schools but no GPS point inside Rwanda for them, so they are not on the map yet. Find the
        school, copy its coordinates (in Google Maps: right-click the spot → click the numbers), and add it. Everything else comes from TDMP.
      </p>
      <ul className="divide-y divide-border/40" aria-label="Schools waiting for a location">
        {schools.map((s) => (
          <li key={s.code} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-sm">
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-muted-foreground"> · {s.code}{s.district ? ` · ${s.district}` : ""}</span>
              </span>
              <Button
                variant="outline"
                className={PILL_BUTTON.small}
                aria-expanded={open === s.code}
                data-tooltip="Enter this school's coordinates to put it on the map"
                onClick={() => setOpen((o) => (o === s.code ? null : s.code))}
              >
                <MapPinPlus className="h-3.5 w-3.5" aria-hidden /> {open === s.code ? "Close" : "Add with location"}
              </Button>
            </div>
            {open === s.code && (
              <div className="mt-2 rounded-xl bg-slate-900/[0.03] p-3 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8">
                <LocationForm school={s} onSubmit={(lat, lng) => onAdd(s, lat, lng)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
