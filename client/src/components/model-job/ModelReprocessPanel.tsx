import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { useToast } from "../ui/toast";
import { apiErrorMessage } from "../../lib/api";
import { formatBytes, formatDateTime, formatDuration, formatNumber } from "../../lib/format";
import { JOB_STATE_LABEL, isJobActive, stepStatus, visibleSteps, type ModelJob } from "../../lib/viewer3d/model-job";
import { useModelJob } from "./useModelJob";

/** Ticks once a second while `on`, for elapsed times. */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0); // not the time the page opened
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [on]);
  return now;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

/** Triangle counts: "39 M", "1.5 M", "820,000". */
const tris = (n: number) => (n >= 1e6 ? `${formatNumber(n / 1e6, 1)} M` : formatNumber(n));

/**
 * Re-processes a school's 3D model from its stored original, in the
 * background (POST /schools/:id/kmz/reoptimize), and follows the job step by
 * step. Also shows the last run, whatever started it (upload or nightly sweep).
 */
export function ModelReprocessPanel({ schoolId }: { schoolId: string }) {
  const toast = useToast();
  const { job, loading, starting, error, start } = useModelJob(schoolId);
  const active = isJobActive(job);
  const now = useNow(active);

  const onStart = async () => {
    try {
      const r = await start();
      if (!r) return;
      if (r.reason === "already-running") toast.info("This model is already being processed.");
      else if (r.reason === "no-model") toast.error("No 3D model found for this school.");
      else toast.success("Reprocessing started. You can leave this page; it runs on the server.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not start reprocessing."));
    }
  };

  return (
    <section className="rounded-2xl bg-slate-50 dark:bg-white/3 ring-1 ring-slate-200 dark:ring-white/8 p-4 sm:p-5 space-y-4" aria-label="Reprocess 3D model">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Reprocess 3D model</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rebuild the web model from the original upload with the current settings. Runs on the server; the current model stays online meanwhile.
          </p>
        </div>
        <Button size="sm" onClick={onStart} disabled={starting || active || loading} className="shrink-0 shadow-none hover:shadow-none">
          {starting ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin motion-reduce:animate-none" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
          )}
          {active ? "Running…" : "Reprocess"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {loading && !job && <p className="text-xs text-muted-foreground">Checking for a running job…</p>}
      {!loading && !job && !error && <p className="text-xs text-muted-foreground">No processing run recorded yet.</p>}
      {job && <JobView job={job} now={now} />}
    </section>
  );
}

function JobView({ job, now }: { job: ModelJob; now: number }) {
  const active = isJobActive(job);
  const started = ms(job.startedAt);
  const ended = ms(job.finishedAt);
  const elapsed = Number.isFinite(started) ? (Number.isFinite(ended) ? ended : now) - started : NaN;
  const stageElapsed = active && job.state === "running" ? now - ms(job.stageStartedAt) : NaN;
  const r = job.result;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
        <span className={job.state === "failed" ? "text-destructive" : job.state === "done" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
          {JOB_STATE_LABEL[job.state]}
          {job.source === "upload" ? " · started by an upload" : ""}
          {job.maxAttempts > 1 && (job.attempt > 1 || job.state === "retrying") ? ` · attempt ${job.attempt} of ${job.maxAttempts}` : ""}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {active
            ? Number.isFinite(elapsed) ? `${formatDuration(elapsed)} so far` : `Queued ${formatDateTime(job.queuedAt)}`
            : `${formatDateTime(job.finishedAt ?? job.queuedAt)}${Number.isFinite(elapsed) ? ` · took ${formatDuration(elapsed)}` : ""}`}
        </span>
      </div>

      {active && (
        <Progress
          value={job.percent}
          className="h-1.5 bg-slate-200 dark:bg-white/10"
          aria-label="Processing progress"
          aria-valuetext={`${job.percent}%`}
        />
      )}

      <ol className="grid gap-1.5 sm:grid-cols-2" aria-live="polite">
        {visibleSteps(job).map(({ stage, label }) => {
          const st = stepStatus(job, stage);
          return (
            <li key={stage} className="flex items-center gap-2 text-xs">
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                {st === "done" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-label="done" />
                ) : st === "current" ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin motion-reduce:animate-none" aria-label="in progress" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-white/20" aria-hidden />
                )}
              </span>
              <span className={st === "todo" ? "text-muted-foreground" : "text-foreground"}>{label}</span>
              {st === "current" && Number.isFinite(stageElapsed) && (
                <span className="text-muted-foreground tabular-nums">· {formatDuration(stageElapsed)}</span>
              )}
            </li>
          );
        })}
      </ol>

      {(job.state === "failed" || job.state === "retrying") && job.error && (
        <p className="flex gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{job.error}</span>
        </p>
      )}

      {job.state === "done" && r && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Fact label="Original" value={formatBytes(r.bytesIn)} />
          <Fact label="Web model" value={formatBytes(r.bytesOut)} />
          <Fact label="Triangles" value={r.trisIn != null && r.trisOut != null ? `${tris(r.trisIn)} → ${tris(r.trisOut)}` : "—"} />
          <Fact
            label={r.drapeCm ? "Detail: roofs / walls" : "Detail"}
            value={
              r.drapeCm && r.detailCm != null
                ? `${formatNumber(r.drapeCm, 1)} / ${formatNumber(r.detailCm, 1)} cm per pixel`
                : r.detailCm != null
                  ? `${formatNumber(r.detailCm, 1)} cm per pixel`
                  : "—"
            }
          />
          {!r.optimized && r.error && <p className="col-span-full text-destructive">Kept the previous model: {r.error}</p>}
        </dl>
      )}
    </div>
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
