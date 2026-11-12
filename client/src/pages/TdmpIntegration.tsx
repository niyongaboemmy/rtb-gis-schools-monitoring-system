import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock,
  CloudOff,
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
} from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { formatDateTime, formatDuration, formatNumber, formatRelative } from "../lib/format";
import { cn } from "../lib/utils";
import {
  fieldsLabel,
  progressLabel,
  totalsSummary,
  triggerLabel,
  type ConnectionReport,
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
import { Switch } from "../components/ui/switch";
import { StatusPill } from "../components/ui/status-pill";
import { fieldSurface } from "../components/ui/field-styles";
import { EASE_OUT, GLASS, PILL_BUTTON, type Tone } from "../components/ui/surfaces";
import { FloatingStat } from "../components/dashboard/FloatingStat";
import {
  SettingsPanel,
  DataTable,
  Th,
  Tr,
  Td,
  CardList,
  CardItem,
  ListSkeleton,
  EmptyNote,
  FactRow,
  FieldLabel,
} from "../components/settings/settings-ui";

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
  waiting: { label: "Waiting for TDMP", tone: "neutral" },
  manual: { label: "Confirm manually", tone: "primary" },
};

const AUTH_MODE_LABEL: Record<TdmpStatus["authMode"], string> = {
  local: "RTB GIS accounts only",
  both: "TDMP and RTB GIS accounts",
  tdmp: "TDMP only",
};

/** Probe interval as a sentence fragment. */
const every = (min: number) => (min < 60 ? `every ${min} minutes` : min === 60 ? "every hour" : `every ${min / 60} hours`);

function RunStatus({ run }: { run: SyncRun }) {
  const s = RUN_STATUS[run.status] ?? RUN_STATUS.failed;
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

function runDuration(run: SyncRun): string {
  if (!run.finishedAt) return "—";
  return formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime());
}

function HeroTitle() {
  const reduce = useReducedMotion();
  return (
    <motion.h1
      initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT }}
      className="text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-2xl"
    >
      TDMP integration
    </motion.h1>
  );
}

/** Live progress of the running sync. */
function RunProgress({ run }: { run: SyncRun | null }) {
  const p = run?.progress ?? null;
  const pct = p && p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : null;
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill tone="primary" pulse>
          {run?.dryRun ? "Dry run" : "Syncing"}
        </StatusPill>
        <span className="text-muted-foreground">{progressLabel(p)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10" aria-hidden>
        <div
          className={cn("h-full rounded-full bg-primary transition-[width] duration-500", pct === null && "w-1/3 animate-pulse")}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      {run && <p className="text-xs text-muted-foreground">{totalsSummary(run.totals, run.dryRun)}</p>}
    </div>
  );
}

/** One collapsible list of schools in a run report. */
function ReportList({
  title,
  hint,
  rows,
  icon: Icon,
  tone,
  render,
}: {
  title: string;
  hint: string;
  rows: ReportSchool[];
  icon: typeof School;
  tone: Tone;
  render?: (r: ReportSchool) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl bg-slate-900/[0.03] ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusPill tone={tone} dot={false}>
            {formatNumber(rows.length)}
          </StatusPill>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto border-t border-border/40 px-4">
          {rows.map((r, i) => (
            <li key={`${r.code}-${i}`} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="min-w-0">
                <span className="font-medium text-foreground">{r.name}</span>
                <span className="text-muted-foreground"> · {r.code}{r.district ? ` · ${r.district}` : ""}</span>
                {r.localName && <span className="block text-xs text-muted-foreground">In RTB GIS: {r.localName}</span>}
              </span>
              <span className="text-xs text-muted-foreground sm:text-right">{render ? render(r) : r.reason ?? fieldsLabel(r.fields)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The report of one run: what changed (or would change) and what needs a person. */
function RunReportView({ run }: { run: SyncRun }) {
  const r = run.report;
  if (!r) return <p className="text-sm text-muted-foreground">This run has no report.</p>;
  const dry = run.dryRun;
  const gisOnlyHint = (row: ReportSchool) => {
    if (!row.reason?.startsWith("suggest:")) return "No similar TDMP school";
    const [code, ...name] = row.reason.slice("suggest:".length).split("|");
    return `Maybe ${code} · ${name.join("|")}`;
  };
  const lists = [
    <ReportList key="loc" title="Need a location first" hint="In TDMP but not in RTB GIS, and TDMP has no usable GPS" rows={r.needsLocation} icon={MapPinOff} tone="warn" />,
    <ReportList key="new" title={dry ? "Schools to add" : "Schools added"} hint="In TDMP, not in RTB GIS; placed at TDMP's GPS" rows={r.created} icon={Sparkles} tone="primary" />,
    <ReportList key="link" title={dry ? "Schools to link" : "Schools linked"} hint="Matched to an RTB GIS school by code" rows={r.newLinks} icon={Link2} tone="good" />,
    <ReportList key="chg" title={dry ? "Schools to update" : "Schools updated"} hint="Fields TDMP updated" rows={r.changes} icon={RefreshCw} tone="primary" />,
    <ReportList key="miss" title="Missing from TDMP" hint="Linked schools TDMP no longer lists" rows={r.missing} icon={AlertTriangle} tone="danger" />,
    <ReportList key="gis" title="Only in RTB GIS" hint="No TDMP school with this code: link them below" rows={r.gisOnly} icon={Link2Off} tone="warn" render={gisOnlyHint} />,
    <ReportList key="skip" title="Left out" hint="TDMP test rows, or rows without a code or district" rows={r.skipped} icon={CircleDashed} tone="neutral" />,
  ];
  const any = [r.needsLocation, r.created, r.newLinks, r.changes, r.missing, r.gisOnly, r.skipped].some((l) => l.length);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {triggerLabel(run)} · {formatDateTime(run.startedAt)}
        {run.triggeredBy ? ` by ${run.triggeredBy}` : ""}
        {r.tdmpMaterialisedAt ? ` · TDMP data as of ${formatDateTime(r.tdmpMaterialisedAt)}` : ""}
      </p>
      {any ? lists : <EmptyNote icon={CheckCircle2} title="Nothing to review" hint="Every school matched and nothing needs attention." />}
      {run.errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-destructive/5 p-3 text-xs text-destructive ring-1 ring-inset ring-destructive/15">
          {run.errors.slice(0, 10).map((e, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{e}</span>
            </li>
          ))}
          {run.errors.length > 10 && <li className="pl-4">…and {formatNumber(run.errors.length - 10)} more</li>}
        </ul>
      )}
    </div>
  );
}

/** Automatic sync: on/off, probe interval, daily time. */
function AutomationPanel({
  settings,
  onSaved,
  index,
}: {
  settings: TdmpSyncSettings;
  onSaved: () => void;
  index: number;
}) {
  const toast = useToast();
  const [autoSync, setAutoSync] = useState(settings.autoSync);
  const [interval, setIntervalMin] = useState(settings.probeIntervalMinutes);
  const [daily, setDaily] = useState(settings.dailyRunAt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAutoSync(settings.autoSync);
    setIntervalMin(settings.probeIntervalMinutes);
    setDaily(settings.dailyRunAt);
  }, [settings.autoSync, settings.probeIntervalMinutes, settings.dailyRunAt]);

  const dirty =
    autoSync !== settings.autoSync || interval !== settings.probeIntervalMinutes || daily !== settings.dailyRunAt;

  const save = async (patch?: Partial<Pick<TdmpSyncSettings, "autoSync" | "probeIntervalMinutes" | "dailyRunAt">>) => {
    setSaving(true);
    try {
      await api.patch("/tdmp/settings", patch ?? { autoSync, probeIntervalMinutes: interval, dailyRunAt: daily });
      toast.success("Automatic sync settings saved.");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save the automatic sync settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel
      index={index}
      title="Automatic sync"
      subtitle="RTB GIS asks TDMP for changes on its own; no need to wait or press anything"
      icon={CalendarClock}
      actions={
        <Button className={PILL_BUTTON.small} onClick={() => void save()} disabled={!dirty || saving} isLoading={saving}>
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-900/[0.03] px-4 py-3 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8">
          <div className="min-w-0">
            <p id="tdmp-auto-label" className="text-sm font-medium text-foreground">
              Run automatically
            </p>
            <p className="text-xs text-muted-foreground">
              {autoSync
                ? `Checks TDMP ${every(interval)} and syncs as soon as TDMP's data changes, plus a full run every day at ${daily} (Kigali).`
                : "Paused. Schools change only when someone presses “Sync now”."}
            </p>
          </div>
          <Switch
            checked={autoSync}
            onCheckedChange={(v) => {
              setAutoSync(v);
              // Pausing / resuming is the one switch people reach for: save it at once.
              void save({ autoSync: v });
            }}
            disabled={saving}
            className="shrink-0"
          />
        </div>

        <div className="grid gap-4 @xl:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="tdmp-interval" icon={RefreshCw} hint="One small request each time">
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
            <FieldLabel htmlFor="tdmp-daily" icon={Clock} hint="Kigali time; TDMP refreshes about 06:00">
              Daily full run at
            </FieldLabel>
            <Input
              id="tdmp-daily"
              type="time"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              disabled={!autoSync}
              className="h-10 rounded-xl"
              required
            />
          </div>
        </div>

        <div className="grid gap-2 @xl:grid-cols-3">
          <FactRow label="Next daily run" icon={CalendarClock}>
            {settings.nextDailyRunAt ? formatDateTime(settings.nextDailyRunAt) : "Paused"}
          </FactRow>
          <FactRow label="Last check" icon={Clock}>
            {settings.lastProbeAt ? formatRelative(settings.lastProbeAt) : "Not yet"}
          </FactRow>
          <FactRow label="TDMP data as of" icon={RefreshCw}>
            {settings.tdmpMaterialisedAt ? formatDateTime(settings.tdmpMaterialisedAt) : "—"}
          </FactRow>
        </div>
        {settings.updatedBy && (
          <p className="text-xs text-muted-foreground">
            Last changed by {settings.updatedBy}
            {settings.updatedAt ? ` · ${formatRelative(settings.updatedAt)}` : ""}
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}

/** Connection check and where each request to the TDMP team stands. */
function ConnectionPanel({ index }: { index: number }) {
  const toast = useToast();
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(
    async (refresh: boolean) => {
      setChecking(true);
      try {
        const { data } = await api.get<ConnectionReport>("/tdmp/connection", { params: refresh ? { refresh: 1 } : {} });
        setReport(data);
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

  useEffect(() => {
    void check(false);
  }, [check]);

  const done = report?.requests.filter((r) => r.state === "done").length ?? 0;

  return (
    <SettingsPanel
      index={index}
      title="Connection and TDMP requests"
      subtitle="What our key can read today, and what we are still waiting for from the TDMP team"
      icon={PlugZap}
      actions={
        <Button variant="outline" className={PILL_BUTTON.small} onClick={() => void check(true)} isLoading={checking} disabled={checking}>
          <PlugZap className="h-3.5 w-3.5" aria-hidden /> Test connection
        </Button>
      }
    >
      {!report ? (
        <ListSkeleton rows={3} label="Checking TDMP…" />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 @xl:grid-cols-3">
            <FactRow label="TDMP" icon={PlugZap}>
              {report.authorised ? (
                <StatusPill tone="good">Connected</StatusPill>
              ) : report.configured.apiKey ? (
                <StatusPill tone="danger">{report.reachable ? "Key refused" : "Unreachable"}</StatusPill>
              ) : (
                <StatusPill tone="neutral">No API key</StatusPill>
              )}
            </FactRow>
            <FactRow label="TVET schools in TDMP" icon={School}>
              {report.tvetSchools != null ? formatNumber(report.tvetSchools) : "—"}
            </FactRow>
            <FactRow label="Checked" icon={Clock}>
              {formatRelative(report.checkedAt)}
              {report.latencyMs != null ? ` · ${formatNumber(report.latencyMs)} ms` : ""}
            </FactRow>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">Endpoints</p>
            <ul className="grid gap-2 @2xl:grid-cols-2" aria-label="TDMP endpoints">
              {report.endpoints.map((e) => (
                <li
                  key={e.key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/[0.03] px-3 py-2 text-sm ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{e.label}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{e.path}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {e.request && !e.ok && <span className="text-[11px] text-muted-foreground">{e.request}</span>}
                    <StatusPill tone={e.ok ? "good" : e.status === 403 ? "warn" : "danger"} dot={false}>
                      {e.ok ? "Readable" : e.status === 403 ? "Not granted" : e.status === 0 ? "No answer" : String(e.status)}
                    </StatusPill>
                  </span>
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
                  <li key={r.id} className="flex flex-col gap-1 py-2.5 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-4">
                    <span className="min-w-0">
                      <span className="text-sm text-foreground">
                        <span className="font-mono text-xs text-muted-foreground">{r.id}</span> {r.title}
                        <span className="ml-1.5 text-[11px] text-muted-foreground">{r.priority}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{r.evidence}</span>
                    </span>
                    <StatusPill tone={s.tone} className="shrink-0 self-start @2xl:self-auto">
                      {s.label}
                    </StatusPill>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}

/** Admin ▸ TDMP integration: run the sync now, schedule it, review what it found. */
export default function TdmpIntegration() {
  const toast = useToast();
  const reduce = useReducedMotion();
  const { isNational } = useScope();
  const [status, setStatus] = useState<TdmpStatus | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [selected, setSelected] = useState<SyncRun | null>(null);
  const [unlinked, setUnlinked] = useState<UnlinkedSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [starting, setStarting] = useState<"sync" | "dry" | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const wasRunning = useRef(false);

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
    const list = runsRes.data ?? [];
    setRuns(list);
    setSelected((cur) => list.find((r) => r.id === cur?.id) ?? list.find((r) => r.status !== "running") ?? null);
    setUnlinked(unlinkedRes.data ?? []);
  }, []);

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
    if (isNational) void loadAll();
    else setLoading(false);
  }, [loadAll, isNational]);

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
            if (run?.status === "failed") toast.error("The TDMP sync failed. See the report below.");
            else if (run) toast.success(`${run.dryRun ? "Dry run" : "TDMP sync"} finished: ${totalsSummary(run.totals, run.dryRun)}.`);
            if (run) setSelected(run);
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

  const last = status?.lastRun ?? null;
  const total = (status?.linkedSchools ?? 0) + (status?.unlinkedSchools ?? 0);
  const share = (n: number | undefined) => (loading || !total || n == null ? null : (n / total) * 100);
  const stat = (v: number | null | undefined) => (loading || v == null ? null : v);
  const stale = status?.lastSuccessAt ? Date.now() - new Date(status.lastSuccessAt).getTime() > 36 * 3_600_000 : false;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <motion.section
        aria-label="TDMP integration"
        initial={reduce ? false : { opacity: 0, y: -10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className={cn("@container relative overflow-hidden rounded-[1.75rem] p-4 min-[400px]:p-5 sm:p-6", GLASS)}
      >
        <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 right-0 h-64 w-96 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
              <RefreshCw className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <HeroTitle />
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                School profile, enrolment and staffing come from TDMP; location and map data stay in RTB GIS
              </p>
            </div>
          </div>
          {status && (
            <span className="flex flex-wrap items-center gap-2">
              {status.enabled.sync ? (
                <StatusPill tone={status.settings.autoSync ? "good" : "warn"}>
                  {status.settings.autoSync ? "Automatic sync on" : "Automatic sync paused"}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">Sync not configured</StatusPill>
              )}
              <StatusPill tone={status.enabled.login ? "good" : "neutral"}>
                {status.enabled.login ? "TDMP sign-in on" : "TDMP sign-in off"}
              </StatusPill>
            </span>
          )}
        </div>

        <dl className="relative mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 @4xl:grid-cols-4">
          <FloatingStat flat compact index={0} label="Linked schools" caption="kept in sync with TDMP" value={stat(status?.linkedSchools)} percent={share(status?.linkedSchools)} format={(n) => formatNumber(n)} icon={Link2} tone="text-primary" color="#3b82f6" />
          <FloatingStat flat compact index={1} label="Not linked" caption="RTB GIS only" value={stat(status?.unlinkedSchools)} percent={share(status?.unlinkedSchools)} format={(n) => formatNumber(n)} icon={Link2Off} tone="text-warning" color="#f59e0b" />
          <FloatingStat flat compact index={2} label="Last sync" caption={last ? `${triggerLabel(last)} · ${formatRelative(last.startedAt)}` : "never run"} value={stat(last?.totals.fetched ?? null)} format={(n) => `${formatNumber(n)} read`} icon={RefreshCw} tone="text-success" color="#10b981" />
          <FloatingStat flat compact index={3} label="Need attention" caption="no GPS, missing or failed" value={stat(last ? last.totals.skippedNoGps + last.totals.missing + last.totals.failed : null)} format={(n) => formatNumber(n)} icon={AlertTriangle} tone="text-destructive" color="#ef4444" />
        </dl>
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
        <div className="space-y-5">
          <SettingsPanel index={0} title="School sync" subtitle="Schools from TDMP" icon={RefreshCw} flush>
            <EmptyNote
              icon={CloudOff}
              title="TDMP sync is not configured (TDMP_API_KEY)"
              hint="Ask the server administrator to add the TDMP partner API key to the server settings. This page then runs and schedules the sync."
            />
          </SettingsPanel>
          <ConnectionPanel index={1} />
        </div>
      ) : (
        <div className="space-y-5">
          {stale && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-500/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              The last successful sync was {formatRelative(status.lastSuccessAt!)}. School details from TDMP may be out of date.
            </p>
          )}

          <SettingsPanel
            index={0}
            title="Sync now"
            subtitle="Pull the latest school data from TDMP right away, or preview what would change"
            icon={RefreshCw}
            actions={
              <>
                <Button variant="outline" className={PILL_BUTTON.secondary} onClick={() => void start(true)} isLoading={starting === "dry"} disabled={running || starting !== null}>
                  <Eye className="h-4 w-4" aria-hidden /> Dry run
                </Button>
                <Button className={PILL_BUTTON.primary} onClick={() => void start(false)} isLoading={starting === "sync"} disabled={running || starting !== null}>
                  <RefreshCw className={running ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
                  {running ? "Syncing…" : "Sync now"}
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              {running ? (
                <RunProgress run={status.currentRun} />
              ) : last ? (
                <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
                  <RunStatus run={last} />
                  <span className="text-foreground">{totalsSummary(last.totals, last.dryRun)}</span>
                  <span className="text-muted-foreground">
                    · {triggerLabel(last)} · {formatDateTime(last.startedAt)}
                    {last.triggeredBy ? ` by ${last.triggeredBy}` : ""}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sync has run yet. Start with a dry run to review the first link.</p>
              )}
              <div className="grid gap-2 @xl:grid-cols-2">
                <FactRow label="Sign in with TDMP" icon={ShieldCheck}>
                  {status.enabled.login ? <StatusPill tone="good">On</StatusPill> : <StatusPill tone="neutral">Off</StatusPill>}
                </FactRow>
                <FactRow label="Who can sign in" icon={ShieldCheck}>
                  {AUTH_MODE_LABEL[status.authMode] ?? status.authMode}
                </FactRow>
              </div>
            </div>
          </SettingsPanel>

          <div className="grid gap-5 xl:grid-cols-2">
            <AutomationPanel index={1} settings={status.settings} onSaved={() => void loadStatus()} />
            <SettingsPanel index={2} title="Run report" subtitle="What the selected run found" icon={ListChecks}>
              {selected ? <RunReportView run={selected} /> : <EmptyNote icon={ListChecks} title="No report yet" hint="Run a dry run or a sync to see one." />}
            </SettingsPanel>
          </div>

          <ConnectionPanel index={3} />

          <SettingsPanel
            index={4}
            title="Schools not linked to TDMP"
            subtitle="Enter the TDMP school code, or use the suggestion; its details then come from TDMP"
            icon={School}
            flush
          >
            {unlinked.length === 0 ? (
              <EmptyNote icon={CheckCircle2} title="Every school is linked" hint="New schools appear here only if no TDMP school has their code." />
            ) : (
              <ul className="divide-y divide-border/40 px-4 pb-4 min-[400px]:px-5 sm:px-6" aria-label="Unlinked schools">
                {unlinked.map((school) => {
                  const inputId = `tdmp-code-${school.id}`;
                  return (
                    <li key={school.id} className="flex flex-col gap-2 py-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[15px] text-foreground">
                          <span className="truncate">{school.name}</span>
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
                        {school.suggestion && (
                          <button
                            type="button"
                            onClick={() => void link(school, school.suggestion!.schoolCode)}
                            disabled={linking !== null}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          >
                            <Sparkles className="h-3 w-3" aria-hidden />
                            Link to {school.suggestion.schoolCode} · {school.suggestion.schoolName}
                          </button>
                        )}
                      </div>
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
                          className="h-9 w-44 rounded-xl"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          className={PILL_BUTTON.small}
                          isLoading={linking === school.id}
                          disabled={!(codes[school.id] ?? "").trim() || linking !== null}
                        >
                          <Link2 className="h-3.5 w-3.5" aria-hidden /> Link
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsPanel>

          <SettingsPanel index={5} title="Run history" subtitle="Automatic, manual and dry runs; select one to see its report" icon={History} flush>
            {runs.length === 0 ? (
              <EmptyNote icon={History} title="No runs yet" hint="Start a dry run above, or wait for the automatic sync." />
            ) : (
              <>
                <DataTable label="Run history">
                  <thead>
                    <tr>
                      <Th>Started</Th>
                      <Th>Trigger</Th>
                      <Th>Status</Th>
                      <Th>Result</Th>
                      <Th align="right">Took</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <Tr key={run.id} onClick={() => setSelected(run)} selected={selected?.id === run.id}>
                        <Td className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatDateTime(run.startedAt)}</Td>
                        <Td className="text-xs">
                          {triggerLabel(run)}
                          {run.triggeredBy ? ` · ${run.triggeredBy}` : ""}
                        </Td>
                        <Td>
                          <RunStatus run={run} />
                        </Td>
                        <Td className="text-xs text-foreground">{totalsSummary(run.totals, run.dryRun)}</Td>
                        <Td align="right" className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                          {runDuration(run)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
                <CardList label="Run history">
                  {runs.map((run) => (
                    <CardItem key={run.id} selected={selected?.id === run.id} className="flex flex-col gap-1.5">
                      <button type="button" className="flex flex-col gap-1.5 text-left" onClick={() => setSelected(run)}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                          <RunStatus run={run} />
                        </span>
                        <span className="text-sm text-foreground">{totalsSummary(run.totals, run.dryRun)}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {triggerLabel(run)} · took {runDuration(run)}
                        </span>
                      </button>
                    </CardItem>
                  ))}
                </CardList>
              </>
            )}
          </SettingsPanel>
        </div>
      )}
    </div>
  );
}
