export const KMZ_QUEUE = 'kmz-processing';

/**
 * Shared BullMQ options for GLB jobs. A transient optimizer failure (OOM under
 * memory pressure, a timed-out fork) is worth retrying with backoff; without
 * this a single failure left the raw multi-GB model served forever.
 */
export const GLB_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: 50,
  removeOnFail: 100,
};
