import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock,
  CloudOff,
  Compass,
  Eye,
  History,
  Link2,
  Link2Off,
  ListChecks,
  MapPinOff,
  PlugZap,
  RefreshCw,
  School,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { formatDateTime, formatDuration, formatNumber, formatRelative } from "../lib/format";
import { cn } from "../lib/utils";
import {
  areaCoverage,
  fieldsLabel,
  overallCoverage,
  progressLabel,
  totalsSummary,
  triggerLabel,
  type ConnectionReport,
  type CoverageArea,
  type ReportSchool,
  type RequestState,
  type SyncRun,
  type TdmpStatus,
  type TdmpSyncSettings,
  type UnlinkedSchool,
} from "../lib/tdmp";
import { useScope } from "../hooks/useScope";
import { useToast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Switch } from "../components/ui/switch";
import { StatusPill } from "../components/ui/status-pill";
import { fieldSurface } from "../components/ui/field-styles";
import { EASE_OUT, GLASS, PILL_BUTTON, type Tone } from "../components/ui/surfaces";
import { HelpHint, HowItWorks, NeedsLocationList, SetupChecklist, type SetupStep } from "../components/tdmp/TdmpGuide";
import {
  ActivityList,
  AttentionList,
  CoverageGrid,
  ProgressRing,
  SetupStepper,
  StatTile,
  type AttentionItem,
} from "../components/tdmp/TdmpOverview";
import { SettingsPanel, ListSkeleton, EmptyNote, FieldLabel } from "../components/settings/settings-ui";

/** While a run is going, how often the page asks for its progress. */
const POLL_MS = 2000;

const RUN_STATUS: Record<SyncRun["status"], { label: string; tone: Tone }> = {
  running: { label: "Running", tone: "primary" },
  completed: { label: "Completed", tone: "good" },
  failed: { label: "Failed", tone: "danger" },
};

const REQUEST_STATE: Record<RequestState, { label: string; tone: Tone }> = {
  done: { label: "Done", tone: "good" },
  partial: { label: "Partly done", tone: "warn" },
  waiting: { label: "Waiting", tone: "neutral" },
  manual: { label: "To confirm", tone: "primary" },
};

/** Probe interval in a few words. */
const every = (min: number) => (min < 60 ? `every ${min} min` : min === 60 ? "every hour" : `every ${min / 60} h`);

function RunStatus({ run }: { run: SyncRun }) {
  const s = RUN_STATUS[run.status] ?? RUN_STATUS.failed;
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

function runDuration(run: SyncRun): string {
  if (!run.finishedAt) return "—";
  return formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime());
}

/** A card on the summary screen: title row, optional action, body. */
function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
  index = 0,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.06, ease: EASE_OUT }}
      className={cn("@container min-w-0 rounded-[1.5rem] p-4 sm:p-5", GLASS, className)}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      {children}
    </motion.section>
  );
}

const LINK_BUTTON = "shrink-0 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// ── Detail views shown in modals ─────────────────────────────────────────────

/** One collapsible list of schools in a run report. */
function ReportList({
  title,
  rows,
  icon: Icon,
  tone,
  render,
}: {
  title: string;
  rows: ReportSchool[];
  icon: LucideIcon;
  tone: Tone;
  render?: (r: ReportSchool) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl bg-slate-900/[0.03] ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusPill tone={tone} dot={false}>
            {formatNumber(rows.length)}
          </StatusPill>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <ul className="max-h-72 divide-y divide-border/40 overflow-y-auto border-t border-border/40 px-4">
          {rows.map((r, i) => (
            <li key={`${r.code}-${i}`} className="py-2 text-sm">
              <span className="font-medium text-foreground">{r.name}</span>
              <span className="text-muted-foreground"> · {r.code}{r.district ? ` · ${r.district}` : ""}</span>
              {r.localName && <span className="block text-xs text-muted-foreground">In RTB GIS: {r.localName}</span>}
              <span className="block text-xs text-muted-foreground">{render ? render(r) : r.reason ?? fieldsLabel(r.fields)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Everything one run found. */
function RunReportView({ run }: { run: SyncRun }) {
  const r = run.report;
  const dry = run.dryRun;
  const gisOnlyHint = (row: ReportSchool) => {
    if (!row.reason?.startsWith("suggest:")) return "No similar TDMP school";
    const [code, ...name] = row.reason.slice("suggest:".length).split("|");
    return `Maybe ${code} · ${name.join("|")}`;
  };
  const any = r && [r.needsLocation, r.created, r.newLinks, r.changes, r.missing, r.gisOnly, r.skipped].some((l) => l.length);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <RunStatus run={run} />
        <span className="text-foreground">{totalsSummary(run.totals, dry)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {triggerLabel(run)} · {formatDateTime(run.startedAt)} · took {runDuration(run)}
        {run.triggeredBy ? ` · by ${run.triggeredBy}` : ""}
        {r?.tdmpMaterialisedAt ? ` · TDMP data as of ${formatDateTime(r.tdmpMaterialisedAt)}` : ""}
      </p>
      {!r ? (
        <p className="text-sm text-muted-foreground">This run has no report.</p>
      ) : any ? (
        <>
          <ReportList title="Need a location first" rows={r.needsLocation} icon={MapPinOff} tone="warn" />
          <ReportList title={dry ? "Schools to add" : "Schools added"} rows={r.created} icon={Sparkles} tone="primary" />
          <ReportList title={dry ? "Schools to link" : "Schools linked"} rows={r.newLinks} icon={Link2} tone="good" />
          <ReportList title={dry ? "Schools to update" : "Schools updated"} rows={r.changes} icon={RefreshCw} tone="primary" />
          <ReportList title="Missing from TDMP" rows={r.missing} icon={AlertTriangle} tone="danger" />
          <ReportList title="Only in RTB GIS" rows={r.gisOnly} icon={Link2Off} tone="warn" render={gisOnlyHint} />
          <ReportList title="Left out (test rows)" rows={r.skipped} icon={CircleDashed} tone="neutral" />
        </>
      ) : (
        <EmptyNote icon={CheckCircle2} title="Nothing to review" hint="Every school matched; nothing needs attention." />
      )}
      {run.errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-destructive/5 p-3 text-xs text-destructive ring-1 ring-inset ring-destructive/15">
          {run.errors.slice(0, 10).map((e, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Automatic sync form. */
function ScheduleForm({ settings, onSaved }: { settings: TdmpSyncSettings; onSaved: () => void }) {
  const toast = useToast();
  const [autoSync, setAutoSync] = useState(settings.autoSync);
  const [interval, setIntervalMin] = useState(settings.probeIntervalMinutes);
  const [daily, setDaily] = useState(settings.dailyRunAt);
  const [saving, setSaving] = useState(false);
  const dirty = autoSync !== settings.autoSync || interval !== settings.probeIntervalMinutes || daily !== settings.dailyRunAt;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/tdmp/settings", { autoSync, probeIntervalMinutes: interval, dailyRunAt: daily });
      toast.success("Schedule saved.");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save the schedule."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-900/[0.03] px-4 py-3 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8">
        <span className="min-w-0">
          <span className="flex items-start gap-1 text-sm font-medium text-foreground">
            Run automatically
            <HelpHint label="automatic sync">
              RTB GIS asks TDMP whether its data changed (one small request) at the interval below and syncs straight away when it did. The daily
              run catches anything else. Pausing never deletes data.
            </HelpHint>
          </span>
          <span className="block text-xs text-muted-foreground">{autoSync ? `Checks ${every(interval)} · full run daily at ${daily}` : "Paused: only “Sync now” changes schools"}</span>
        </span>
        <span data-tooltip={autoSync ? "Turn off to pause automatic runs. Nothing is deleted" : "Turn on so RTB GIS keeps school details current by itself"}>
          <Switch checked={autoSync} onCheckedChange={setAutoSync} disabled={saving} className="shrink-0" />
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="tdmp-interval" icon={RefreshCw}>
            Check TDMP for changes
          </FieldLabel>
          <select
            id="tdmp-interval"
            value={interval}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            disabled={!autoSync}
            className={cn(fieldSurface, "h-10 w-full rounded-xl px-3 text-sm")}
          >
            {settings.probeIntervals.map((m) => (
              <option key={m} value={m}>
                {every(m).replace(/^every/, "Every")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="tdmp-daily" icon={Clock}>
            Daily full run at
          </FieldLabel>
          <Input id="tdmp-daily" type="time" value={daily} onChange={(e) => setDaily(e.target.value)} disabled={!autoSync} className="h-10 rounded-xl" required />
          <p className="text-[11px] text-muted-foreground">Kigali time. TDMP refreshes about 06:00.</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        {[
          ["Next daily run", settings.nextDailyRunAt ? formatDateTime(settings.nextDailyRunAt) : "Paused"],
          ["Last check", settings.lastProbeAt ? formatRelative(settings.lastProbeAt) : "Not yet"],
          ["TDMP data as of", settings.tdmpMaterialisedAt ? formatDateTime(settings.tdmpMaterialisedAt) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-xl bg-slate-900/[0.03] px-3 py-2 dark:bg-white/[0.035]">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="truncate font-medium tabular-nums text-foreground" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {settings.updatedBy ? `Changed by ${settings.updatedBy}${settings.updatedAt ? ` · ${formatRelative(settings.updatedAt)}` : ""}` : ""}
        </p>
        <Button
          className={PILL_BUTTON.small}
          onClick={() => void save()}
          disabled={!dirty || saving}
          isLoading={saving}
          data-tooltip={dirty ? "Save the new schedule" : "Change a setting first"}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** Endpoints and the request tracker. */
function ConnectionDetails({ report, checking, onCheck }: { report: ConnectionReport | null; checking: boolean; onCheck: () => void }) {
  if (!report) return <ListSkeleton rows={3} label="Checking TDMP…" />;
  const done = report.requests.filter((r) => r.state === "done").length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm">
          {report.authorised ? (
            <StatusPill tone="good">Connected</StatusPill>
          ) : (
            <StatusPill tone="danger">{report.configured.apiKey ? (report.reachable ? "Key refused" : "Unreachable") : "No API key"}</StatusPill>
          )}
          <span className="text-muted-foreground">
            {report.tvetSchools != null ? `${formatNumber(report.tvetSchools)} TVET schools · ` : ""}checked {formatRelative(report.checkedAt)}
          </span>
        </span>
        <Button variant="outline" className={PILL_BUTTON.small} onClick={onCheck} isLoading={checking} disabled={checking} data-tooltip="Ask TDMP again now: key, endpoints and request status">
          <PlugZap className="h-3.5 w-3.5" aria-hidden /> Test again
        </Button>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">What our key can read</p>
        <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="TDMP endpoints">
          {report.endpoints.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/[0.03] px-3 py-2 text-sm dark:bg-white/[0.035]">
              <span className="min-w-0 truncate text-foreground" title={e.path}>
                {e.label}
              </span>
              <StatusPill tone={e.ok ? "good" : e.status === 403 ? "warn" : "danger"} dot={false}>
                {e.ok ? "Readable" : e.status === 403 ? `Waiting ${e.request ?? ""}`.trim() : e.status === 0 ? "No answer" : String(e.status)}
              </StatusPill>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">
          Requests to TDMP · {formatNumber(done)} of {formatNumber(report.requests.length)} done
        </p>
        <ul className="divide-y divide-border/40" aria-label="Requests to the TDMP team">
          {report.requests.map((r) => {
            const s = REQUEST_STATE[r.state];
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">
                    <span className="font-mono text-xs text-muted-foreground">{r.id}</span> {r.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{r.evidence}</span>
                </span>
                <StatusPill tone={s.tone} className="shrink-0">
                  {s.label}
                </StatusPill>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Fields of one data area: live, or waiting for a named request. */
function CoverageDetails({ area, requests }: { area: CoverageArea; requests: ConnectionReport["requests"] | undefined }) {
  const c = areaCoverage(area, requests);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{area.summary}</p>
      <ul className="space-y-1.5" aria-label={`${area.title} fields`}>
        {c.fields.map((f) => {
          const req = requests?.find((r) => r.id === f.request);
          return (
            <li key={f.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/[0.03] px-3 py-2 dark:bg-white/[0.035]">
              <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                {f.live ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="truncate">{f.label}</span>
              </span>
              {f.live ? (
                <StatusPill tone="good" dot={false}>
                  Live
                </StatusPill>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground" title={req?.title}>
                  Waiting · {f.request}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {c.live < c.total && <p className="text-xs text-muted-foreground">Waiting items go live by themselves once TDMP grants the request.</p>}
    </div>
  );
}

type ModalKey =
  | { kind: "setup" }
  | { kind: "step"; step: SetupStep }
  | { kind: "coverage"; area?: CoverageArea }
  | { kind: "run"; run: SyncRun }
  | { kind: "history" }
  | { kind: "schedule" }
  | { kind: "connection" }
  | { kind: "how" }
  | { kind: "locations" }
  | { kind: "unlinked" }
  | { kind: "missing" };

/** Admin ▸ TDMP integration: a summary of the sync, with details in modals. */
export default function TdmpIntegration() {
  const toast = useToast();
  const reduce = useReducedMotion();
  const { isNational } = useScope();
  const [status, setStatus] = useState<TdmpStatus | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [starting, setStarting] = useState<"sync" | "dry" | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [savingAuto, setSavingAuto] = useState(false);
  const [modal, setModal] = useState<ModalKey | null>(null);
  const wasRunning = useRef(false);
  const close = useCallback(() => setModal(null), []);

  const loadStatus = useCallback(async () => {
    const { data } = await api.get<TdmpStatus>("/tdmp/status");
    setStatus(data);
    return data;
  }, []);

  const loadDetails = useCallback(async () => {
    const [runsRes, unlinkedRes] = await Promise.all([
      api.get<SyncRun[]>("/tdmp/sync/runs", { params: { limit: 15 } }),
      api.get<UnlinkedSchool[]>("/tdmp/schools/unlinked"),
    ]);
    setRuns(runsRes.data ?? []);
    setUnlinked(unlinkedRes.data ?? []);
  }, []);

  const checkConnection = useCallback(
    async (refresh: boolean) => {
      setChecking(true);
      try {
        const { data } = await api.get<ConnectionReport>("/tdmp/connection", { params: refresh ? { refresh: 1 } : {} });
        setConnection(data);
        if (refresh) {
          if (data.authorised) toast.success(`Connected to TDMP (${formatNumber(data.latencyMs ?? 0)} ms).`);
          else toast.error(data.reachable ? "TDMP refused our API key." : "TDMP can't be reached.");
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not check the TDMP connection."));
      } finally {
        setChecking(false);
      }
    },
    [toast],
  );

  const loadAll = useCallback(async () => {
    setLoadFailed(false);
    try {
      const s = await loadStatus();
      wasRunning.current = s.running;
      if (s.enabled.sync) await loadDetails();
    } catch (err) {
      setLoadFailed(true);
      toast.error(apiErrorMessage(err, "Could not load the TDMP integration."));
    } finally {
      setLoading(false);
    }
  }, [loadStatus, loadDetails, toast]);

  useEffect(() => {
    if (isNational) {
      void loadAll();
      void checkConnection(false);
    } else setLoading(false);
  }, [loadAll, checkConnection, isNational]);

  // While a run is going, follow its progress; when it ends, reload once.
  const running = !!status?.running;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      void loadStatus()
        .then((s) => {
          if (wasRunning.current && !s.running) {
            void loadDetails();
            const run = s.lastRun;
            if (run?.status === "failed") toast.error("The TDMP sync failed. Open the run for details.");
            else if (run) toast.success(`${run.dryRun ? "Dry run" : "TDMP sync"} finished: ${totalsSummary(run.totals, run.dryRun)}.`);
          }
          wasRunning.current = s.running;
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, loadStatus, loadDetails, toast]);

  const start = async (dryRun: boolean) => {
    setStarting(dryRun ? "dry" : "sync");
    try {
      await api.post("/tdmp/sync", { dryRun });
      wasRunning.current = true;
      await loadStatus();
      toast.info(dryRun ? "Dry run started: nothing will be changed." : "TDMP sync started.");
    } catch (err) {
      const code = (err as { response?: { status?: number } })?.response?.status;
      if (code === 409) {
        toast.info("A TDMP sync is already running.");
        void loadStatus();
      } else toast.error(apiErrorMessage(err, "Could not start the TDMP sync."));
    } finally {
      setStarting(null);
    }
  };

  const link = async (school: UnlinkedSchool, code?: string) => {
    const schoolCode = (code ?? codes[school.id] ?? "").trim();
    if (!schoolCode) return;
    setLinking(school.id);
    try {
      await api.post(`/tdmp/schools/${school.id}/link`, { schoolCode });
      toast.success(`${school.name} is now linked to TDMP school ${schoolCode}.`);
      setUnlinked((prev) => prev.filter((s) => s.id !== school.id));
      void loadStatus().catch(() => undefined);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not link ${school.name}.`));
    } finally {
      setLinking(null);
    }
  };

  const setAutoSync = async (on: boolean) => {
    setSavingAuto(true);
    try {
      await api.patch("/tdmp/settings", { autoSync: on });
      toast.success(on ? "Automatic sync is on." : "Automatic sync is paused.");
      await loadStatus();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not change automatic sync."));
    } finally {
      setSavingAuto(false);
    }
  };

  const addWithLocation = async (school: ReportSchool, latitude: number, longitude: number) => {
    try {
      await api.post("/tdmp/schools/import", { schoolCode: school.code, latitude, longitude });
      toast.success(`${school.name} is now on the map.`);
      setImported((prev) => new Set(prev).add(school.code));
      void loadStatus().catch(() => undefined);
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not add ${school.name}.`));
      return false;
    }
  };

  // The latest real sync decides what is still waiting for a person.
  const lastSync = useMemo(() => runs.find((r) => !r.dryRun && r.status === "completed") ?? null, [runs]);
  const waitingForLocation = useMemo(
    () => (lastSync?.report?.needsLocation ?? []).filter((s) => !imported.has(s.code)),
    [lastSync, imported],
  );
  const missing = lastSync?.report?.missing ?? [];

  const steps: SetupStep[] = status
    ? [
        {
          id: "connect",
          short: "Connect",
          title: "Connect to TDMP",
          explain: "The server holds TDMP's read-only key. The connection test confirms TDMP accepts it.",
          done: !!connection?.authorised,
          blockedNote: !status.enabled.sync ? "Ask the server administrator to add TDMP_API_KEY" : undefined,
          action: status.enabled.sync ? { label: "Test connection", onClick: () => void checkConnection(true), busy: checking } : undefined,
        },
        {
          id: "preview",
          short: "Preview",
          title: "Preview with a dry run",
          explain: "Lists what a sync would change, without changing anything.",
          done: runs.some((r) => r.dryRun && r.status === "completed") || !!lastSync,
          action: status.enabled.sync ? { label: "Start dry run", onClick: () => void start(true), busy: starting === "dry" } : undefined,
        },
        {
          id: "sync",
          short: "First sync",
          title: "Run the first sync",
          explain: "Brings in every TVET school from TDMP. Map locations are never moved.",
          done: !!lastSync,
          action: status.enabled.sync ? { label: "Sync now", onClick: () => void start(false), busy: starting === "sync" } : undefined,
        },
        {
          id: "link",
          short: "Link",
          title: "Link schools only in RTB GIS",
          explain: `Match older schools to their TDMP code so no school appears twice.${unlinked.length ? ` ${formatNumber(unlinked.length)} left.` : ""}`,
          done: !!lastSync && unlinked.length === 0,
          action: { label: "Review", onClick: () => setModal({ kind: "unlinked" }) },
        },
        {
          id: "locate",
          short: "Locate",
          title: "Place schools without GPS",
          explain: `TDMP has no GPS for these schools: give each a location.${waitingForLocation.length ? ` ${formatNumber(waitingForLocation.length)} left.` : ""}`,
          done: !!lastSync && waitingForLocation.length === 0,
          action: { label: "Add locations", onClick: () => setModal({ kind: "locations" }) },
        },
        {
          id: "auto",
          short: "Automate",
          title: "Turn on automatic sync",
          explain: "Checks TDMP every hour and runs fully every morning, with no one pressing a button.",
          done: status.settings.autoSync,
          action: status.enabled.sync ? { label: "Turn on", onClick: () => void setAutoSync(true), busy: savingAuto } : undefined,
        },
      ]
    : [];
  const stepsDone = steps.filter((s) => s.done).length;
  const coveragePct = overallCoverage(connection?.requests);
  const requestsDone = connection?.requests.filter((r) => r.state === "done").length ?? 0;
  const last = status?.lastRun ?? null;
  const stale = status?.lastSuccessAt ? Date.now() - new Date(status.lastSuccessAt).getTime() > 36 * 3_600_000 : false;
  const total = (status?.linkedSchools ?? 0) + (status?.unlinkedSchools ?? 0);

  const attention: AttentionItem[] = [
    { id: "loc", icon: MapPinOff, label: "Schools without a map location", count: waitingForLocation.length, tone: "warn", tip: "In TDMP but without GPS: give each a location to put it on the map", onOpen: () => setModal({ kind: "locations" }) },
    { id: "unl", icon: Link2Off, label: "Schools not linked to TDMP", count: unlinked.length, tone: "warn", tip: "Match each to its TDMP code so its details come from TDMP and it is not counted twice", onOpen: () => setModal({ kind: "unlinked" }) },
    { id: "mis", icon: AlertTriangle, label: "Missing from TDMP's list", count: missing.length, tone: "danger", tip: "Linked schools TDMP no longer lists. Kept as they are until TDMP confirms", onOpen: () => setModal({ kind: "missing" }) },
    { id: "fail", icon: AlertTriangle, label: "Schools that failed last run", count: last?.totals.failed ?? 0, tone: "danger", tip: "Schools the last run could not update. Click to see why", onOpen: () => last && setModal({ kind: "run", run: last }) },
  ];

  const modalTitle = (m: ModalKey): string => {
    switch (m.kind) {
      case "setup":
        return "Setup";
      case "step":
        return m.step.title;
      case "coverage":
        return m.area ? m.area.title : "Data from TDMP";
      case "run":
        return `${triggerLabel(m.run)} run`;
      case "history":
        return "Run history";
      case "schedule":
        return "Automatic sync";
      case "connection":
        return "Connection and requests";
      case "how":
        return "How it works";
      case "locations":
        return "Schools without a map location";
      case "unlinked":
        return "Schools not linked to TDMP";
      case "missing":
        return "Missing from TDMP";
    }
  };
  const wide = modal && ["connection", "how", "run", "history", "coverage"].includes(modal.kind);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      {/* Hero: identity, actions, and the five numbers that matter */}
      <motion.section
        aria-label="TDMP integration"
        initial={reduce ? false : { opacity: 0, y: -10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className={cn("@container relative overflow-hidden rounded-[1.75rem] p-4 min-[400px]:p-5 sm:p-6", GLASS)}
      >
        <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
              <RefreshCw className={cn("h-5 w-5", running && "animate-spin")} />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">TDMP integration</h1>
              <p className="text-xs text-muted-foreground">School data from TDMP · map data stays in RTB GIS</p>
            </div>
          </div>
          {status?.enabled.sync && isNational && (
            <div className="flex w-full flex-wrap gap-2 min-[560px]:w-auto">
              <Button variant="outline" className={cn(PILL_BUTTON.secondary, "flex-1 min-[560px]:flex-none")} onClick={() => setModal({ kind: "how" })} data-tooltip="See, step by step, what a sync does and which data comes from TDMP">
                <Compass className="h-4 w-4" aria-hidden /> How it works
              </Button>
              <Button
                variant="outline"
                className={cn(PILL_BUTTON.secondary, "flex-1 min-[560px]:flex-none")}
                onClick={() => void start(true)}
                data-tooltip="Preview only: reads TDMP and shows what a sync would add, link or change. Nothing is saved"
                isLoading={starting === "dry"}
                disabled={running || starting !== null}
              >
                <Eye className="h-4 w-4" aria-hidden /> Dry run
              </Button>
              <Button
                className={cn(PILL_BUTTON.primary, "flex-1 min-[560px]:flex-none")}
                onClick={() => void start(false)}
                data-tooltip={running ? "A sync is running: progress shows below" : "Apply TDMP's latest school data now, without waiting for the schedule. Map locations are never moved"}
                isLoading={starting === "sync"}
                disabled={running || starting !== null}
              >
                <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} aria-hidden />
                {running ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          )}
        </div>

        {running && (
          <div role="status" aria-live="polite" className="relative mt-4 rounded-2xl bg-primary/[0.06] p-3 ring-1 ring-inset ring-primary/20">
            <p className="mb-2 text-xs text-foreground">{progressLabel(status?.currentRun?.progress ?? null)}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-primary/10" aria-hidden>
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{
                  width: status?.currentRun?.progress?.total
                    ? `${Math.round((status.currentRun.progress.done / status.currentRun.progress.total) * 100)}%`
                    : "15%",
                }}
              />
            </div>
          </div>
        )}

        {status?.enabled.sync && isNational && (
          <div className="relative mt-5 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 @5xl:grid-cols-[1.25fr_1.25fr_1fr_1fr_1fr]">
            <ProgressRing
              value={steps.length ? (stepsDone / steps.length) * 100 : 0}
              center={`${stepsDone}/${steps.length || 6}`}
              label="Setup"
              caption={stepsDone === steps.length ? "Complete" : `Next: ${steps.find((s) => !s.done)?.short ?? ""}`}
              tone={stepsDone === steps.length ? "good" : "primary"}
              tip="The one-time steps to set up the integration. Click for the checklist"
              onClick={() => setModal({ kind: "setup" })}
            />
            <ProgressRing
              value={coveragePct}
              center={`${coveragePct}%`}
              label="Data coverage"
              caption={connection ? `${requestsDone} of ${connection.requests.length} requests met` : "Checking…"}
              tone={coveragePct >= 80 ? "good" : "warn"}
              tip="Share of the school data we need from TDMP that is live today. The rest waits on TDMP requests"
              onClick={() => setModal({ kind: "coverage" })}
            />
            <StatTile
              icon={Link2}
              label="Linked schools"
              value={`${formatNumber(status.linkedSchools)} / ${formatNumber(total)}`}
              hint={status.unlinkedSchools ? `${formatNumber(status.unlinkedSchools)} not linked` : "All linked"}
              tone={status.unlinkedSchools ? "warn" : "good"}
              tip="Schools matched to their TDMP code. Click to link any that are not"
              onClick={() => setModal({ kind: "unlinked" })}
            />
            <StatTile
              icon={History}
              label="Last sync"
              value={last ? formatRelative(last.startedAt) : "Never"}
              hint={last ? (last.status === "failed" ? "Failed" : totalsSummary(last.totals, last.dryRun)) : "Run one now"}
              tone={last?.status === "failed" ? "danger" : "good"}
              tip="When TDMP data was last applied, and what changed. Click for the full report"
              onClick={() => (last ? setModal({ kind: "run", run: last }) : setModal({ kind: "history" }))}
            />
            <StatTile
              icon={CalendarClock}
              label="Automatic sync"
              value={status.settings.autoSync ? "On" : "Paused"}
              hint={status.settings.autoSync ? `${every(status.settings.probeIntervalMinutes)} · daily ${status.settings.dailyRunAt}` : "Manual runs only"}
              tone={status.settings.autoSync ? "good" : "warn"}
              tip="When RTB GIS checks TDMP on its own. Click to pause or change the schedule"
              onClick={() => setModal({ kind: "schedule" })}
            />
          </div>
        )}
      </motion.section>

      {!isNational ? (
        <SettingsPanel title="TDMP" subtitle="School sync and sign-in" icon={ShieldCheck} flush>
          <EmptyNote icon={ShieldCheck} title="National access needed" hint="The TDMP integration affects every school, so only national-level accounts can manage it." />
        </SettingsPanel>
      ) : loading ? (
        <SettingsPanel title="TDMP" subtitle="Loading…" icon={RefreshCw} flush>
          <ListSkeleton rows={4} label="Loading the TDMP integration…" />
        </SettingsPanel>
      ) : loadFailed || !status ? (
        <SettingsPanel title="TDMP" subtitle="School sync and sign-in" icon={CloudOff} flush>
          <EmptyNote
            icon={CloudOff}
            title="Could not load the TDMP integration"
            hint="Check your connection and try again."
            action={
              <Button variant="outline" className={PILL_BUTTON.small} onClick={() => void loadAll()}>
                Try again
              </Button>
            }
          />
        </SettingsPanel>
      ) : !status.enabled.sync ? (
        <SettingsPanel title="School sync" subtitle="Schools from TDMP" icon={RefreshCw} flush>
          <EmptyNote
            icon={CloudOff}
            title="TDMP sync is not configured (TDMP_API_KEY)"
            hint="Ask the server administrator to add the TDMP partner API key. This page then runs and schedules the sync."
          />
        </SettingsPanel>
      ) : (
        <>
          {stale && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-500/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Last successful sync {formatRelative(status.lastSuccessAt!)}: school details may be out of date.
            </p>
          )}

          <Card
            index={0}
            title="Setup progress"
            icon={ListChecks}
            action={
              <button type="button" className={LINK_BUTTON} onClick={() => setModal({ kind: "setup" })} data-tooltip="Every setup step with its explanation and action">
                All steps
              </button>
            }
          >
            <SetupStepper steps={steps} onOpen={(step) => setModal({ kind: "step", step })} />
          </Card>

          <Card
            index={1}
            title="Data from TDMP"
            icon={Sparkles}
            action={
              <button type="button" className={LINK_BUTTON} onClick={() => setModal({ kind: "connection" })} data-tooltip="What our TDMP key can read, and where each request to the TDMP team stands">
                Requests {requestsDone}/{connection?.requests.length ?? 12}
              </button>
            }
          >
            <CoverageGrid requests={connection?.requests} onOpen={(area) => setModal({ kind: "coverage", area })} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card index={2} title="Needs attention" icon={AlertTriangle}>
              <AttentionList items={attention} />
            </Card>
            <Card
              index={3}
              title="Recent activity"
              icon={Activity}
              action={
                <button type="button" className={LINK_BUTTON} onClick={() => setModal({ kind: "history" })} data-tooltip="Every sync and dry run, newest first">
                  All runs
                </button>
              }
            >
              <ActivityList runs={runs.slice(0, 5)} onOpen={(run) => setModal({ kind: "run", run })} />
            </Card>
          </div>
        </>
      )}

      {/* Details */}
      <Modal isOpen={!!modal} onClose={close} title={modal ? modalTitle(modal) : ""} maxWidth={wide ? "max-w-2xl" : "max-w-lg"}>
        {modal?.kind === "setup" && <SetupChecklist steps={steps} />}
        {modal?.kind === "step" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{modal.step.explain}</p>
            {modal.step.done ? (
              <StatusPill tone="good">Done</StatusPill>
            ) : modal.step.action ? (
              <Button
                className={PILL_BUTTON.primary}
                data-tooltip={modal.step.explain}
                onClick={() => {
                  const a = modal.step.action!;
                  close();
                  a.onClick();
                }}
              >
                {modal.step.action.label}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{modal.step.blockedNote}</p>
            )}
          </div>
        )}
        {modal?.kind === "coverage" &&
          (modal.area ? (
            <CoverageDetails area={modal.area} requests={connection?.requests} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {coveragePct}% of the school data RTB GIS needs from TDMP is live. The rest turns on as TDMP grants each request.
              </p>
              <CoverageGrid requests={connection?.requests} onOpen={(area) => setModal({ kind: "coverage", area })} />
            </div>
          ))}
        {modal?.kind === "run" && <RunReportView run={modal.run} />}
        {modal?.kind === "history" && <ActivityList runs={runs} onOpen={(run) => setModal({ kind: "run", run })} />}
        {modal?.kind === "schedule" && status && (
          <ScheduleForm
            settings={status.settings}
            onSaved={() => {
              void loadStatus();
              close();
            }}
          />
        )}
        {modal?.kind === "connection" && <ConnectionDetails report={connection} checking={checking} onCheck={() => void checkConnection(true)} />}
        {modal?.kind === "how" && <HowItWorks />}
        {modal?.kind === "locations" &&
          (lastSync ? (
            <NeedsLocationList schools={waitingForLocation} onAdd={addWithLocation} />
          ) : (
            <p className="text-sm text-muted-foreground">Run the first sync to see which schools need a location.</p>
          ))}
        {modal?.kind === "missing" &&
          (missing.length ? (
            <ul className="divide-y divide-border/40">
              {missing.map((m) => (
                <li key={m.code} className="py-2 text-sm">
                  <span className="font-medium text-foreground">{m.name}</span>
                  <span className="text-muted-foreground"> · {m.code}</span>
                  <span className="block text-xs text-muted-foreground">{m.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Every linked school is still in TDMP's list.</p>
          ))}
        {modal?.kind === "unlinked" &&
          (unlinked.length === 0 ? (
            <EmptyNote icon={CheckCircle2} title="Every school is linked" hint="New schools appear here only if no TDMP school has their code." />
          ) : (
            <ul className="divide-y divide-border/40" aria-label="Unlinked schools">
              {unlinked.map((school) => {
                const inputId = `tdmp-code-${school.id}`;
                return (
                  <li key={school.id} className="space-y-2 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        <School className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        {school.name}
                        {school.hasGisData && (
                          <StatusPill tone="primary" dot={false}>
                            Has GIS data
                          </StatusPill>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {school.code}
                        {school.district ? ` · ${school.district}` : ""}
                      </p>
                    </div>
                    {school.suggestion && (
                      <button
                        type="button"
                        onClick={() => void link(school, school.suggestion!.schoolCode)}
                        disabled={linking !== null}
                        data-tooltip="Suggested from a similar name in the same district. Linking copies TDMP's details; map, buildings and reports stay"
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3" aria-hidden /> Link to {school.suggestion.schoolCode} · {school.suggestion.schoolName}
                      </button>
                    )}
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void link(school);
                      }}
                    >
                      <label htmlFor={inputId} className="sr-only">
                        TDMP school code for {school.name}
                      </label>
                      <Input
                        id={inputId}
                        value={codes[school.id] ?? ""}
                        onChange={(e) => setCodes((prev) => ({ ...prev, [school.id]: e.target.value }))}
                        placeholder="TDMP school code"
                        className="h-9 min-w-0 flex-1 rounded-xl"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        className={PILL_BUTTON.small}
                        isLoading={linking === school.id}
                        disabled={!(codes[school.id] ?? "").trim() || linking !== null}
                        data-tooltip="Match this school to the TDMP code you typed"
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden /> Link
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ))}
      </Modal>
    </div>
  );
}
