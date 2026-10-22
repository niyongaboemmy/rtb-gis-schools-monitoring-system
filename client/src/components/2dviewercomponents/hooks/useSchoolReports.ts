import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { REPORTS_CHANGED_EVENT } from "../../../hooks/usePendingReviewCount";
import type { ReviewReport } from "../../report-review/review-utils";

/** Open reports on one building: Waiting (Pending) and Needs action. */
export interface BuildingReportCount {
  waiting: number;
  action: number;
  open: number;
}

const PAGE = 1000;
const MAX_PAGES = 5;

/**
 * Every report filed for one school (pages of 1,000), shared by the map
 * badges, the building list and the building panel so they always agree.
 * Reloads after any decision anywhere in the app (REPORTS_CHANGED_EVENT).
 */
export function useSchoolReports(schoolId: string | undefined) {
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    if (!schoolId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const first = await api.get("/reports", { params: { schoolId, page: 1, limit: PAGE }, signal: ctrl.signal });
      let rows: ReviewReport[] = first.data?.data ?? [];
      const pages = Math.min(MAX_PAGES, Math.ceil((first.data?.total ?? rows.length) / PAGE));
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            api
              .get("/reports", { params: { schoolId, page: i + 2, limit: PAGE }, signal: ctrl.signal })
              .then((r) => (r.data?.data ?? []) as ReviewReport[]),
          ),
        );
        rows = [...rows, ...rest.flat()];
      }
      if (!ctrl.signal.aborted) setReports(rows);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "CanceledError" && name !== "AbortError") console.error("Failed to load reports:", err);
    } finally {
      if (!ctrl.signal.aborted) setLoaded(true);
    }
  }, [schoolId]);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener(REPORTS_CHANGED_EVENT, onChange);
    return () => {
      abortRef.current?.abort();
      window.removeEventListener(REPORTS_CHANGED_EVENT, onChange);
    };
  }, [reload]);

  const counts = useMemo(() => {
    const m = new Map<string, BuildingReportCount>();
    for (const r of reports) {
      if (!r.buildingId || (r.status !== "PENDING" && r.status !== "NEED_INTERVENTION")) continue;
      const c = m.get(r.buildingId) ?? { waiting: 0, action: 0, open: 0 };
      if (r.status === "PENDING") c.waiting++;
      else c.action++;
      c.open++;
      m.set(r.buildingId, c);
    }
    return m;
  }, [reports]);

  /** Replace one report after a decision, without waiting for a reload. */
  const patch = useCallback((id: string, next: Partial<ReviewReport>) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  return { reports, counts, loaded, reload, patch };
}

export type SchoolReports = ReturnType<typeof useSchoolReports>;
