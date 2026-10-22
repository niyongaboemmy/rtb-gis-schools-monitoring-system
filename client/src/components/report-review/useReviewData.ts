import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast } from "../ui/toast";
import { REPORTS_CHANGED_EVENT } from "../../hooks/usePendingReviewCount";
import { errorMessage } from "../ui/error-message";
import { useSchoolsStore } from "../../store/schoolsStore";
import { ageDays, categories, isOpen, STATUS, type ReviewAction, type ReviewReport, type Status } from "./review-utils";

/**
 * Reports for the review pages: loads every report in the user's scope
 * (batches of 1,000), adds school / facility names, and records decisions
 * (PATCH /reports/:id/status with an optional note).
 */
export function useReviewData() {
  const toast = useToast();
  const { allSchools, fetchAllSchools, facilities, fetchFacilities } = useSchoolsStore();
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetchAllSchools();
    void fetchFacilities();
  }, [fetchAllSchools, fetchFacilities]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const first = await api.get("/reports", { params: { page: 1, limit: 1000 }, signal: ctrl.signal });
      const batch: ReviewReport[] = first.data?.data ?? first.data ?? [];
      const total: number = first.data?.total ?? batch.length;
      const pages = Math.min(10, Math.ceil(total / 1000));
      let rows = batch;
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            api.get("/reports", { params: { page: i + 2, limit: 1000 }, signal: ctrl.signal }).then((r) => (r.data?.data ?? r.data ?? []) as ReviewReport[]),
          ),
        );
        rows = [...batch, ...rest.flat()];
      }
      setReports(Array.isArray(rows) ? rows : []);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "CanceledError" && name !== "AbortError") setError(errorMessage(err, "The reports could not be loaded."));
    } finally {
      // A superseded (aborted) request must not end the loading state.
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const schoolById = useMemo(() => new Map(allSchools.map((s) => [s.id, s])), [allSchools]);
  const rows = useMemo(
    () =>
      reports.map((r) => {
        const s = schoolById.get(r.schoolId);
        return {
          ...r,
          school: {
            id: r.schoolId,
            name: r.school?.name ?? s?.name ?? "Unknown school",
            district: r.school?.district ?? s?.district,
            province: r.school?.province ?? s?.province,
          },
        };
      }),
    [reports, schoolById],
  );

  const facilityById = useMemo(() => new Map((facilities ?? []).map((f) => [f.facilityId, f])), [facilities]);
  const facilityTitle = useCallback((id?: string) => (id ? facilityById.get(id)?.title ?? id.replace(/[_-]/g, " ") : null), [facilityById]);
  const itemLabel = useCallback(
    (fid?: string, iid?: string) => (fid && iid ? facilityById.get(fid)?.items?.find((it) => it.id === iid)?.label ?? null : null),
    [facilityById],
  );

  /** Issue Report figures (change requests counted separately), same rules as the dashboards. */
  const stats = useMemo(() => {
    const issues = rows.filter((r) => (r.type ?? "issue") === "issue");
    const n = (s: Status) => issues.filter((r) => r.status === s).length;
    const pending = issues.filter((r) => r.status === "PENDING");
    const oldest = pending.reduce<number | null>((m, r) => {
      const d = ageDays(r.createdAt);
      return d == null ? m : m == null ? d : Math.max(m, d);
    }, null);
    // Days from filing to the latest review (reviewed issues only).
    const waits = issues
      .filter((r) => r.reviewedAt && r.status !== "PENDING")
      .map((r) => (new Date(r.reviewedAt!).getTime() - new Date(r.createdAt).getTime()) / 86_400_000)
      .filter((d) => Number.isFinite(d) && d >= 0)
      .sort((a, b) => a - b);
    const requests = rows.filter((r) => r.type === "data_change_request");
    return {
      issues: issues.length,
      pending: pending.length,
      oldest,
      escalated: n("NEED_INTERVENTION"),
      solved: n("SOLVED"),
      failed: n("FAILED"),
      rate: issues.length ? Math.round((n("SOLVED") / issues.length) * 100) : null,
      medianDaysToDecision: waits.length ? waits[Math.floor(waits.length / 2)] : null,
      requestsOpen: requests.filter((r) => isOpen(r.status)).length,
      requests: requests.length,
    };
  }, [rows]);

  const decide = useCallback(
    async (r: ReviewReport, action: ReviewAction, note: string): Promise<boolean> => {
      setDeciding(true);
      try {
        const res = await api.patch(`/reports/${r.id}/status`, { status: action.status, ...(note ? { note } : {}) });
        const saved = res.data as Partial<ReviewReport> | undefined;
        setReports((prev) =>
          prev.map((x) =>
            x.id === r.id
              ? {
                  ...x,
                  status: action.status,
                  resolvedAt: saved?.resolvedAt ?? (action.status === "SOLVED" ? x.resolvedAt ?? new Date().toISOString() : null),
                  reviewNote: note || null,
                  reviewedAt: saved?.reviewedAt ?? new Date().toISOString(),
                  reviewer: saved?.reviewer ?? x.reviewer,
                }
              : x,
          ),
        );
        toast.success(`${r.school?.name ?? "Report"}: ${STATUS[action.status]?.label ?? action.status}`);
        // Let the sidebar's waiting count catch up.
        window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT));
        return true;
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not update the report. Please try again."));
        return false;
      } finally {
        setDeciding(false);
      }
    },
    [toast],
  );

  /** Text a search box matches against. */
  const haystack = useCallback(
    (r: ReviewReport) => [r.school?.name, r.school?.district, r.description, facilityTitle(r.facilityId), ...categories(r.issueCategory)].join(" ").toLowerCase(),
    [facilityTitle],
  );

  return { rows, loaded, loading, error, load, stats, decide, deciding, facilityTitle, itemLabel, haystack };
}
