/**
 * Loads a school's site features and keeps them live (WS5.4 / WS5.7): any
 * create / update / delete — from either viewer, by anyone — arrives on the
 * `school:<id>` socket room as `site-feature:changed` and triggers a refetch.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { connectSocket } from "../socket";
import {
  createSiteFeature,
  deleteSiteFeature,
  fetchSiteFeatures,
  updateSiteFeature,
  type NewSiteFeature,
  type SiteFeature,
} from "./site-features";

export function useSiteFeatures(schoolId: string | null | undefined, { live = true } = {}) {
  const [features, setFeatures] = useState<SiteFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!schoolId) return;
    const req = ++reqRef.current;
    setLoading(true);
    try {
      const list = await fetchSiteFeatures(schoolId);
      if (req === reqRef.current) {
        setFeatures(list);
        setError(null);
      }
    } catch (e) {
      if (req === reqRef.current) setError(e instanceof Error ? e.message : "Failed to load site features");
    } finally {
      if (req === reqRef.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [schoolId]);

  useEffect(() => {
    setFeatures([]);
    setLoaded(false);
    void refresh();
  }, [refresh]);

  // Live updates. Debounced so a burst (e.g. a batch import) refetches once.
  useEffect(() => {
    if (!schoolId || !live) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      const room = `school:${schoolId}`;
      const join = () => socket?.emit("join", room);
      socket.on("connect", join);
      socket.on("site-feature:changed", (p: { schoolId?: string }) => {
        if (p?.schoolId && p.schoolId !== schoolId) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 250);
      });
    } catch {
      /* sockets unavailable — the list still works, just not live */
    }
    return () => {
      if (timer) clearTimeout(timer);
      try {
        socket?.emit("leave", `school:${schoolId}`);
        socket?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [schoolId, live, refresh]);

  const create = useCallback(
    async (body: NewSiteFeature) => {
      if (!schoolId) throw new Error("No school");
      const saved = await createSiteFeature(schoolId, body);
      setFeatures((prev) => (prev.some((f) => f.id === saved.id) ? prev : [...prev, saved]));
      return saved;
    },
    [schoolId],
  );

  const update = useCallback(
    async (id: string, body: Parameters<typeof updateSiteFeature>[2]) => {
      if (!schoolId) throw new Error("No school");
      const saved = await updateSiteFeature(schoolId, id, body);
      setFeatures((prev) => prev.map((f) => (f.id === id ? saved : f)));
      return saved;
    },
    [schoolId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!schoolId) throw new Error("No school");
      await deleteSiteFeature(schoolId, id);
      setFeatures((prev) => prev.filter((f) => f.id !== id));
    },
    [schoolId],
  );

  return { features, loading, loaded, error, refresh, create, update, remove };
}
