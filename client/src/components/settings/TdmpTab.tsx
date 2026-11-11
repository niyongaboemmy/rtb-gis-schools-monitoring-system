import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Link2,
  Link2Off,
  RefreshCw,
  School,
  ShieldCheck,
  History,
} from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { formatDateTime, formatDuration, formatNumber, formatRelative } from "../../lib/format";
import type { SyncRun, TdmpStatus, UnlinkedSchool } from "../../lib/tdmp";
import { useToast } from "../ui/toast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { StatusPill } from "../ui/status-pill";
import { PILL_BUTTON, type Tone } from "../ui/surfaces";
import { FloatingStat } from "../dashboard/FloatingStat";
import {
  SettingsPanel,
  HeroStats,
  DataTable,
  Th,
  Tr,
  Td,
  CardList,
  CardItem,
  ListSkeleton,
  EmptyNote,
  FactRow,
} from "./settings-ui";

const POLL_MS = 3000;

const RUN_STATUS: Record<SyncRun["status"], { label: string; tone: Tone }> = {
  running: { label: "Running", tone: "primary" },
  completed: { label: "Completed", tone: "good" },
  failed: { label: "Failed", tone: "danger" },
};

const AUTH_MODE_LABEL: Record<TdmpStatus["authMode"], string> = {
  local: "RTB GIS accounts only",
  both: "TDMP and RTB GIS accounts",
  tdmp: "TDMP only",
};

function RunStatus({ run }: { run: SyncRun }) {
  const s = RUN_STATUS[run.status] ?? RUN_STATUS.failed;
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

/** "12 new · 340 updated · 2 failed" — only the parts that happened. */
function totalsSummary(run: SyncRun): string {
  const t = run.totals;
  const parts = [
    [t.created, "new"],
    [t.updated, "updated"],
    [t.linked, "linked"],
    [t.unchanged, "unchanged"],
    [t.skippedNoGps, "skipped (no GPS)"],
    [t.failed, "failed"],
  ] as const;
  const shown = parts.filter(([n]) => n > 0).map(([n, what]) => `${formatNumber(n)} ${what}`);
  return shown.length ? shown.join(" · ") : "No changes";
}

function runDuration(run: SyncRun): string {
  if (!run.finishedAt) return "—";
  return formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime());
}

/** Settings ▸ TDMP — school sync status, history and unlinked schools. */
export function TdmpTab() {
  const toast = useToast();
  const [status, setStatus] = useState<TdmpStatus | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [starting, setStarting] = useState(false);
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
      api.get<SyncRun[]>("/tdmp/sync/runs", { params: { limit: 10 } }),
      api.get<UnlinkedSchool[]>("/tdmp/schools/unlinked"),
    ]);
    setRuns(runsRes.data ?? []);
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
      toast.error(apiErrorMessage(err, "Could not load the TDMP status."));
    } finally {
      setLoading(false);
    }
  }, [loadStatus, loadDetails, toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // While a sync runs, poll its status; when it ends, reload history and the
  // unlinked list once.
  const running = !!status?.running;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      void loadStatus()
        .then((s) => {
          if (wasRunning.current && !s.running) {
            void loadDetails();
            const run = s.lastRun;
            if (run?.status === "failed") toast.error("The TDMP sync failed. See the errors below.");
            else if (run) toast.success(`TDMP sync finished: ${totalsSummary(run)}.`);
          }
          wasRunning.current = s.running;
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, loadStatus, loadDetails, toast]);

  const startSync = async () => {
    setStarting(true);
    try {
      await api.post("/tdmp/sync");
      wasRunning.current = true;
      setStatus((s) => (s ? { ...s, running: true } : s));
      toast.info("TDMP sync started. This page updates when it finishes.");
    } catch (err) {
      const code = (err as { response?: { status?: number } })?.response?.status;
      if (code === 409) {
        toast.info("A TDMP sync is already running.");
        setStatus((s) => (s ? { ...s, running: true } : s));
      } else toast.error(apiErrorMessage(err, "Could not start the TDMP sync."));
    } finally {
      setStarting(false);
    }
  };

  const link = async (school: UnlinkedSchool) => {
    const schoolCode = (codes[school.id] ?? "").trim();
    if (!schoolCode) return;
    setLinking(school.id);
    try {
      await api.post(`/tdmp/schools/${school.id}/link`, { schoolCode });
      toast.success(`${school.name} is now linked to TDMP school ${schoolCode}.`);
      setUnlinked((prev) => prev.filter((s) => s.id !== school.id));
      setCodes((prev) => {
        const next = { ...prev };
        delete next[school.id];
        return next;
      });
      void loadStatus().catch(() => undefined);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not link ${school.name}.`));
    } finally {
      setLinking(null);
    }
  };

  const last = status?.lastRun ?? null;
  const stat = (v: number | null | undefined) => (loading || v == null ? null : v);
  const totalSchools = (status?.linkedSchools ?? 0) + (status?.unlinkedSchools ?? 0);
  const share = (n: number | undefined) => (loading || !totalSchools || n == null ? null : (n / totalSchools) * 100);

  const heroStats = (
    <HeroStats>
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 @4xl:grid-cols-4">
        <FloatingStat flat compact index={0} label="Linked schools" caption="kept in sync with TDMP" value={stat(status?.linkedSchools)} percent={share(status?.linkedSchools)} format={(n) => formatNumber(n)} icon={Link2} tone="text-primary" color="#3b82f6" />
        <FloatingStat flat compact index={1} label="Not linked" caption="RTB GIS only" value={stat(status?.unlinkedSchools)} percent={share(status?.unlinkedSchools)} format={(n) => formatNumber(n)} icon={Link2Off} tone="text-warning" color="#f59e0b" />
        <FloatingStat flat compact index={2} label="Last sync" caption={last ? formatRelative(last.startedAt) : "never run"} value={stat(last?.totals.fetched ?? null)} format={(n) => `${formatNumber(n)} read`} icon={RefreshCw} tone="text-success" color="#10b981" />
        <FloatingStat flat compact index={3} label="Last sync problems" caption="schools that failed" value={stat(last?.totals.failed ?? null)} format={(n) => formatNumber(n)} icon={AlertTriangle} tone="text-destructive" color="#ef4444" />
      </dl>
    </HeroStats>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        {heroStats}
        <SettingsPanel title="TDMP" subtitle="Loading…" icon={RefreshCw} flush>
          <ListSkeleton rows={4} label="Loading TDMP status…" />
        </SettingsPanel>
      </div>
    );
  }

  if (loadFailed || !status) {
    return (
      <SettingsPanel title="TDMP" subtitle="School sync and sign-in" icon={CloudOff} flush>
        <EmptyNote
          icon={CloudOff}
          title="Could not load the TDMP status"
          hint="Check your connection and try again."
          action={
            <Button variant="outline" className={PILL_BUTTON.small} onClick={() => void loadAll()}>
              Try again
            </Button>
          }
        />
      </SettingsPanel>
    );
  }

  const signIn = (
    <div className="grid gap-2 @xl:grid-cols-2">
      <FactRow label="Sign in with TDMP" icon={ShieldCheck}>
        {status.enabled.login ? <StatusPill tone="good">On</StatusPill> : <StatusPill tone="neutral">Off</StatusPill>}
      </FactRow>
      <FactRow label="Who can sign in" icon={ShieldCheck}>
        {AUTH_MODE_LABEL[status.authMode] ?? status.authMode}
      </FactRow>
    </div>
  );

  if (!status.enabled.sync) {
    return (
      <div className="space-y-5">
        <SettingsPanel index={0} title="TDMP sign-in" subtitle="How people sign in" icon={ShieldCheck}>
          {signIn}
        </SettingsPanel>
        <SettingsPanel index={1} title="School sync" subtitle="Schools from TDMP" icon={RefreshCw} flush>
          <EmptyNote
            icon={CloudOff}
            title="TDMP sync is not configured (TDMP_API_KEY)"
            hint="Ask the server administrator to add the TDMP API key. Schools are then read from TDMP every night."
          />
        </SettingsPanel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {heroStats}

      <SettingsPanel
        index={0}
        title="School sync"
        subtitle="School details come from TDMP; GPS and GIS data stay in RTB GIS"
        icon={RefreshCw}
        actions={
          <Button className={PILL_BUTTON.primary} onClick={() => void startSync()} isLoading={starting} disabled={running || starting}>
            <RefreshCw className={running ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
            {running ? "Syncing…" : "Sync schools now"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
            {running ? (
              <>
                <StatusPill tone="primary">Running</StatusPill>
                <span className="text-muted-foreground">Reading schools from TDMP…</span>
              </>
            ) : last ? (
              <>
                <RunStatus run={last} />
                <span className="text-foreground">{totalsSummary(last)}</span>
                <span className="text-muted-foreground">
                  · {formatDateTime(last.startedAt)}
                  {last.trigger === "schedule" ? " (nightly)" : last.triggeredBy ? ` by ${last.triggeredBy}` : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No sync has run yet.</span>
            )}
          </div>
          {!running && last && last.errors.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-destructive/5 p-3 text-xs text-destructive ring-1 ring-inset ring-destructive/15">
              {last.errors.slice(0, 8).map((e, i) => (
                <li key={i} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{e}</span>
                </li>
              ))}
              {last.errors.length > 8 && <li className="pl-4">…and {formatNumber(last.errors.length - 8)} more</li>}
            </ul>
          )}
          {signIn}
        </div>
      </SettingsPanel>

      <SettingsPanel index={1} title="Recent syncs" subtitle="Nightly and manual runs" icon={History} flush>
        {runs.length === 0 ? (
          <EmptyNote icon={History} title="No syncs yet" hint="Run one now, or wait for the nightly sync." />
        ) : (
          <>
            <DataTable label="Recent syncs">
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
                  <Tr key={run.id}>
                    <Td className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatDateTime(run.startedAt)}</Td>
                    <Td className="text-xs">{run.trigger === "schedule" ? "Nightly" : `Manual${run.triggeredBy ? ` · ${run.triggeredBy}` : ""}`}</Td>
                    <Td>
                      <RunStatus run={run} />
                    </Td>
                    <Td className="text-xs text-foreground">{totalsSummary(run)}</Td>
                    <Td align="right" className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {runDuration(run)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
            <CardList label="Recent syncs">
              {runs.map((run) => (
                <CardItem key={run.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                    <RunStatus run={run} />
                  </div>
                  <p className="text-sm text-foreground">{totalsSummary(run)}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {run.trigger === "schedule" ? "Nightly" : "Manual"} · took {runDuration(run)}
                  </p>
                </CardItem>
              ))}
            </CardList>
          </>
        )}
      </SettingsPanel>

      <SettingsPanel
        index={2}
        title="Schools not linked to TDMP"
        subtitle="Enter the TDMP school code to link a school; its details then come from TDMP"
        icon={School}
        flush
      >
        {unlinked.length === 0 ? (
          <EmptyNote icon={CheckCircle2} title="Every school is linked" hint="New schools appear here only if they have no TDMP school code." />
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
    </div>
  );
}
