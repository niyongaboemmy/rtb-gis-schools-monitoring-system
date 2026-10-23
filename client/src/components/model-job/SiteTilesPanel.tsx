import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { useToast } from "../ui/toast";
import { api, apiErrorMessage } from "../../lib/api";
import { formatBytes, formatDateTime, formatDuration, formatNumber } from "../../lib/format";

/** GET /schools/:id/kmz/2d/tiles (server KmzService.getTilesStatus). */
export interface SiteTilesStatus {
  photos: number;
  tiles: {
    status: "queued" | "building" | "ready" | "failed" | "none";
    maxZoom?: number;
    groundCmPerPx?: number;
    sourceCmPerPx?: number;
    tiles?: number;
    bytes?: number;
    builtAt?: string;
    reason?: string;
  } | null;
  job: {
    jobId: string;
    state: "queued" | "running" | "retrying" | "done" | "failed";
    percent: number;
    attempt: number;
    maxAttempts: number;
    queuedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
  } | null;
}

const POLL_MS = 3000;
const isActive = (s: SiteTilesStatus | null) =>
  !!s?.job && (s.job.state === "queued" || s.job.state === "running" || s.job.state === "retrying");

/**
 * Sharp 2D map tiles (drone photos at full detail, built on the server).
 * Shows what the current tiles give, and lets an editor rebuild them with
 * live progress.
 */
export function SiteTilesPanel({ schoolId }: { schoolId: string }) {
  const toast = useToast();
  const [status, setStatus] = useState<SiteTilesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const active = isActive(status);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<SiteTilesStatus>(`/schools/${schoolId}/kmz/2d/tiles`);
      setStatus(data);
    } catch {
      /* keep the last state */
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const poll = window.setInterval(() => void refresh(), POLL_MS);
    const clock = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [active, refresh]);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post<{ queued: boolean; reason?: string }>(`/schools/${schoolId}/kmz/2d/tiles`);
      if (data.queued) toast.success("Building sharp map tiles. It runs on the server; you can leave this page.");
      else if (data.reason === "already-running") toast.info("Sharp map tiles are already being built.");
      else toast.error("This site map has no drone photos to build tiles from.");
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not start building the tiles."));
    } finally {
      setStarting(false);
    }
  };

  if (!loading && !status?.photos) return null;
  const t = status?.tiles;
  const job = status?.job;
  const started = job?.startedAt ? Date.parse(job.startedAt) : NaN;

  return (
    <section className="rounded-2xl bg-slate-50 dark:bg-white/3 ring-1 ring-slate-200 dark:ring-white/8 p-4 sm:p-5 space-y-4" aria-label="Sharp map tiles">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Sharp map tiles</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            The drone photos at full detail, cut into map tiles on the server, so zooming in stays sharp and light.
          </p>
        </div>
        <Button size="sm" onClick={start} disabled={starting || active || loading} className="shrink-0 shadow-none hover:shadow-none">
          {starting ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin motion-reduce:animate-none" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
          )}
          {active ? "Building…" : t?.status === "ready" ? "Rebuild" : "Build"}
        </Button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Checking…</p>}

      {active && job && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex justify-between text-xs">
            <span>
              {job.state === "queued" ? "Waiting to start" : job.state === "retrying" ? "Retrying shortly" : "Building tiles"}
              {job.attempt > 1 ? ` · attempt ${job.attempt} of ${job.maxAttempts}` : ""}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {job.percent}%{Number.isFinite(started) ? ` · ${formatDuration(now - started)}` : ""}
            </span>
          </div>
          <Progress value={job.percent} className="h-1.5 bg-slate-200 dark:bg-white/10" aria-label="Tile build progress" />
          {t?.status === "ready" && <p className="text-xs text-muted-foreground">The current tiles stay in use until the new ones are ready.</p>}
        </div>
      )}

      {(job?.state === "failed" || job?.state === "retrying") && job.error && (
        <p className="flex gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{job.error}</span>
        </p>
      )}

      {t?.status === "ready" ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Fact label="Detail" value={t.groundCmPerPx != null ? `${formatNumber(t.groundCmPerPx, 2)} cm per pixel` : "—"} />
          <Fact label="Deepest zoom" value={t.maxZoom != null ? String(t.maxZoom) : "—"} />
          <Fact label="Tiles" value={`${formatNumber(t.tiles)} · ${formatBytes(t.bytes)}`} />
          <Fact label="Built" value={formatDateTime(t.builtAt)} />
        </dl>
      ) : (
        !active &&
        !loading && (
          <p className="text-xs text-muted-foreground">
            {t?.status === "failed" ? `Not built: ${t.reason ?? "the last build failed"}.` : "Not built yet. Until then the map loads the photos one by one when zoomed in."}
          </p>
        )
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white dark:bg-white/4 ring-1 ring-slate-200 dark:ring-white/6 px-3 py-2 min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums truncate">{value}</dd>
    </div>
  );
}
