/**
 * Progress of a 3D model processing job (`process-glb` on the KMZ queue),
 * whether started by an upload, the nightly sweep or the "Reprocess" button.
 * Stages come from the optimizer child (glb-tools/optimize.mjs prints
 * `@@progress <stage>` on stderr) and from KmzService.processGlbJob.
 */
export const MODEL_JOB_STAGES = [
  'queued',
  'reading',
  'measuring',
  'simplifying',
  'textures',
  'compressing',
  'writing',
  'draping',
  'saving',
  'gpu-copy',
  'done',
] as const;

export type ModelJobStage = (typeof MODEL_JOB_STAGES)[number];

/** Rough share of the total work done when a stage starts (simplifying is the long one). */
const STAGE_PERCENT: Record<ModelJobStage, number> = {
  queued: 0,
  reading: 3,
  measuring: 12,
  simplifying: 18,
  textures: 62,
  compressing: 68,
  writing: 76,
  draping: 80,
  saving: 86,
  'gpu-copy': 90,
  done: 100,
};

export interface ModelJobProgress {
  stage: ModelJobStage;
  percent: number;
  /** When this stage started (ISO). */
  at: string;
}

export const isModelJobStage = (s: unknown): s is ModelJobStage =>
  typeof s === 'string' && (MODEL_JOB_STAGES as readonly string[]).includes(s);

export function progressFor(
  stage: ModelJobStage,
  now = new Date(),
): ModelJobProgress {
  return { stage, percent: STAGE_PERCENT[stage], at: now.toISOString() };
}

/** What a finished job reports (KmzService.processGlbJob return value). */
export interface ModelJobResult {
  optimized: boolean;
  bytesIn: number;
  bytesOut: number | null;
  trisIn: number | null;
  trisOut: number | null;
  /** Ground and roofs, median cm per texture pixel, of the served model. */
  detailCm: number | null;
  /** Roofs and ground from the site map's photos: their detail, when draped. */
  drapeCm: number | null;
  ktx2: boolean;
  error: string | null;
}

export type ModelJobState =
  | 'queued'
  | 'running'
  | 'retrying'
  | 'done'
  | 'failed';

export interface ModelJob {
  jobId: string;
  state: ModelJobState;
  stage: ModelJobStage;
  percent: number;
  stageStartedAt: string | null;
  fileName: string;
  /** 'upload' (new file) or 'restore' (reprocess / sweep from the stored original). */
  source: 'upload' | 'restore';
  attempt: number;
  maxAttempts: number;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: ModelJobResult | null;
}

/** The fields of a BullMQ job this module reads (kept narrow for tests). */
export interface QueueJobLike {
  id?: string | null;
  data: { originalName?: string; source?: 'upload' | 'restore' };
  progress: unknown;
  attemptsMade: number;
  opts: { attempts?: number };
  timestamp: number;
  processedOn?: number | null;
  finishedOn?: number | null;
  failedReason?: string | null;
  returnvalue?: unknown;
}

const iso = (ms?: number | null) => (ms ? new Date(ms).toISOString() : null);

/** BullMQ job + its state → what the API and the "Reprocess" panel show. */
export function toModelJob(job: QueueJobLike, bullState: string): ModelJob {
  const maxAttempts = job.opts.attempts ?? 1;
  const p = job.progress as Partial<ModelJobProgress> | null;
  let state: ModelJobState;
  switch (bullState) {
    case 'active':
      state = 'running';
      break;
    case 'completed':
      state = 'done';
      break;
    case 'failed':
      state = 'failed';
      break;
    case 'delayed':
      state = job.attemptsMade > 0 ? 'retrying' : 'queued';
      break;
    default:
      state = 'queued';
  }
  let stage: ModelJobStage = p && isModelJobStage(p.stage) ? p.stage : 'queued';
  let percent = typeof p?.percent === 'number' ? p.percent : 0;
  if (state === 'done') {
    stage = 'done';
    percent = 100;
  } else if (state === 'queued' || state === 'retrying') {
    stage = 'queued';
    percent = 0;
  }
  return {
    jobId: String(job.id ?? ''),
    state,
    stage,
    percent,
    stageStartedAt: typeof p?.at === 'string' ? p.at : null,
    fileName: job.data.originalName ?? '',
    source: job.data.source ?? 'upload',
    // attemptsMade counts finished tries; the running one is the next.
    attempt: Math.min(
      maxAttempts,
      job.attemptsMade + (state === 'running' ? 1 : 0) || 1,
    ),
    maxAttempts,
    queuedAt: iso(job.timestamp),
    startedAt: iso(job.processedOn),
    finishedAt:
      state === 'done' || state === 'failed' ? iso(job.finishedOn) : null,
    error:
      state === 'failed' || state === 'retrying'
        ? (job.failedReason ?? null)
        : null,
    result:
      state === 'done' && job.returnvalue && typeof job.returnvalue === 'object'
        ? (job.returnvalue as ModelJobResult)
        : null,
  };
}

/** Still in progress (a new start would only duplicate it). */
export const isModelJobActive = (j: ModelJob | null): boolean =>
  !!j &&
  (j.state === 'queued' || j.state === 'running' || j.state === 'retrying');
