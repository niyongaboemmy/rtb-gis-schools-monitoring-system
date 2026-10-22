import { useEffect, useState } from "react";
import { api } from "../lib/api";

/** Fired after a report's status changes, so the sidebar count updates at once. */
export const REPORTS_CHANGED_EVENT = "rtb:reports-changed";

const REFRESH_MS = 60_000;

/**
 * How many reports are waiting for review (status Pending) in the user's
 * access area — the server's own count, scoped like the review list.
 * Refreshes every minute, when the tab comes back into view, and after any
 * decision. Returns null until known, or when `enabled` is false.
 */
export function usePendingReviewCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      api
        .get("/reports", { params: { status: "PENDING", limit: 1 } })
        .then((res) => {
          if (alive) setCount(Number(res.data?.total ?? 0));
        })
        .catch(() => undefined); // keep the last known count
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(REPORTS_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(REPORTS_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return enabled ? count : null;
}
