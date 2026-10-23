import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { isJobActive, type ModelJob } from "../../lib/viewer3d/model-job";

const POLL_MS = 3000;

/** Latest 3D model job of a school, polled every 3 s while it runs. */
export function useModelJob(schoolId: string | undefined) {
  const [job, setJob] = useState<ModelJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!schoolId) return null;
    try {
      const { data } = await api.get<{ job: ModelJob | null }>(`/schools/${schoolId}/kmz/reoptimize`);
      setJob(data.job);
      setError(null);
      return data.job;
    } catch {
      setError("Could not read the job status.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const active = isJobActive(job);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    timer.current = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current != null) window.clearInterval(timer.current);
    };
  }, [active, refresh]);

  const start = useCallback(async () => {
    if (!schoolId) return null;
    setStarting(true);
    try {
      const { data } = await api.post<{ started: boolean; reason: string; job: ModelJob | null }>(
        `/schools/${schoolId}/kmz/reoptimize`,
      );
      setJob(data.job);
      return data;
    } finally {
      setStarting(false);
    }
  }, [schoolId]);

  return { job, loading, starting, error, start, refresh };
}
