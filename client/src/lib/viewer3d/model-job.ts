/**
 * A 3D model processing job, from GET /schools/:id/kmz/reoptimize
 * (server/src/modules/kmz/model-job.ts). Polled by the "Reprocess" panel.
 */
export type ModelJobStage =
  | "queued"
  | "reading"
  | "measuring"
  | "simplifying"
  | "textures"
  | "compressing"
  | "writing"
  | "saving"
  | "gpu-copy"
  | "done";

export type ModelJobState = "queued" | "running" | "retrying" | "done" | "failed";

export interface ModelJobResult {
  optimized: boolean;
  bytesIn: number;
  bytesOut: number | null;
  trisIn: number | null;
  trisOut: number | null;
  detailCm: number | null;
  ktx2: boolean;
  error: string | null;
}

export interface ModelJob {
  jobId: string;
  state: ModelJobState;
  stage: ModelJobStage;
  percent: number;
  stageStartedAt: string | null;
  fileName: string;
  source: "upload" | "restore";
  attempt: number;
  maxAttempts: number;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: ModelJobResult | null;
}

/** Steps in the order they run (the phone copy only when one is built). */
export const MODEL_JOB_STEPS: Array<{ stage: ModelJobStage; label: string }> = [
  { stage: "reading", label: "Read the original" },
  { stage: "measuring", label: "Measure detail" },
  { stage: "simplifying", label: "Simplify the mesh" },
  { stage: "textures", label: "Prepare textures" },
  { stage: "compressing", label: "Compress" },
  { stage: "writing", label: "Write the web model" },
  { stage: "saving", label: "Save and update the school" },
  { stage: "gpu-copy", label: "Build the phone copy" },
];

export const JOB_STATE_LABEL: Record<ModelJobState, string> = {
  queued: "Waiting to start",
  running: "Running",
  retrying: "Retrying shortly",
  done: "Done",
  failed: "Failed",
};

export const isJobActive = (j: ModelJob | null | undefined): boolean =>
  !!j && (j.state === "queued" || j.state === "running" || j.state === "retrying");

/** Each step: done, current or still to come. */
export function stepStatus(job: ModelJob, stage: ModelJobStage): "done" | "current" | "todo" {
  if (job.state === "done") return "done";
  const order = MODEL_JOB_STEPS.map((s) => s.stage);
  const cur = order.indexOf(job.stage);
  const i = order.indexOf(stage);
  if (cur < 0) return "todo";
  return i < cur ? "done" : i === cur ? (job.state === "failed" ? "todo" : "current") : "todo";
}

/** Steps worth listing: the phone copy only when it is (or was) part of this run. */
export function visibleSteps(job: ModelJob) {
  const withCopy = job.stage === "gpu-copy" || !!job.result?.ktx2;
  return MODEL_JOB_STEPS.filter((s) => s.stage !== "gpu-copy" || withCopy);
}
