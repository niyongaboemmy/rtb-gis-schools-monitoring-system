import {
  isModelJobActive,
  progressFor,
  toModelJob,
  type QueueJobLike,
} from './model-job';

const job = (over: Partial<QueueJobLike> = {}): QueueJobLike => ({
  id: '7',
  data: { originalName: 'site.glb', source: 'restore' },
  progress: progressFor('simplifying', new Date('2026-10-23T08:00:00Z')),
  attemptsMade: 0,
  opts: { attempts: 3 },
  timestamp: Date.parse('2026-10-23T07:59:00Z'),
  processedOn: Date.parse('2026-10-23T07:59:30Z'),
  finishedOn: null,
  failedReason: null,
  returnvalue: null,
  ...over,
});

describe('model job progress', () => {
  it('stages move forward and finish at 100%', () => {
    const order = [
      'reading',
      'measuring',
      'simplifying',
      'textures',
      'compressing',
      'writing',
      'saving',
      'gpu-copy',
      'done',
    ] as const;
    const pct = order.map((s) => progressFor(s).percent);
    expect([...pct].sort((a, b) => a - b)).toEqual(pct);
    expect(pct.at(-1)).toBe(100);
  });

  it('a running job shows its step, percent and attempt', () => {
    const j = toModelJob(job(), 'active');
    expect(j).toMatchObject({
      jobId: '7',
      state: 'running',
      stage: 'simplifying',
      percent: 18,
      stageStartedAt: '2026-10-23T08:00:00.000Z',
      fileName: 'site.glb',
      source: 'restore',
      attempt: 1,
      maxAttempts: 3,
      startedAt: '2026-10-23T07:59:30.000Z',
      finishedAt: null,
      error: null,
    });
    expect(isModelJobActive(j)).toBe(true);
  });

  it('a waiting retry shows the last error and attempt count', () => {
    const j = toModelJob(
      job({ attemptsMade: 1, failedReason: 'optimize.mjs exited 137' }),
      'delayed',
    );
    expect(j).toMatchObject({
      state: 'retrying',
      stage: 'queued',
      percent: 0,
      attempt: 1,
      error: 'optimize.mjs exited 137',
    });
    expect(isModelJobActive(j)).toBe(true);
  });

  it('a finished job carries its result; a failed one its reason', () => {
    const result = {
      optimized: true,
      bytesIn: 977016488,
      bytesOut: 18869744,
      trisIn: 38993013,
      trisOut: 1497415,
      detailCm: 8.2,
      ktx2: false,
      error: null,
    };
    const done = toModelJob(
      job({
        returnvalue: result,
        finishedOn: Date.parse('2026-10-23T08:05:00Z'),
      }),
      'completed',
    );
    expect(done).toMatchObject({
      state: 'done',
      stage: 'done',
      percent: 100,
      result,
    });
    expect(done.finishedAt).toBe('2026-10-23T08:05:00.000Z');
    expect(isModelJobActive(done)).toBe(false);

    const failed = toModelJob(
      job({ attemptsMade: 3, failedReason: 'timed out' }),
      'failed',
    );
    expect(failed).toMatchObject({
      state: 'failed',
      attempt: 3,
      error: 'timed out',
      result: null,
    });
    expect(isModelJobActive(null)).toBe(false);
  });
});
