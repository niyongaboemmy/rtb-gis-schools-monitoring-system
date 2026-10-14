import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAuditLogs, type AuditFilters, type AuditLogRow } from "./auditApi";

function errorMessage(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { message?: unknown } }; message?: string };
  if (e?.response?.status === 403) return "You do not have permission to view the audit trail.";
  const m = e?.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join("; ");
  return e?.message ?? "Could not load activity.";
}

/**
 * Cursor-paginated audit rows for a filter set. Changing the filters reloads
 * from the first page; `loadMore` appends the next page.
 */
export function useAuditLogs(filters: AuditFilters, pageSize = 50) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(filters);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchAuditLogs(JSON.parse(key) as AuditFilters, { limit: pageSize });
      if (seq !== requestSeq.current) return;
      setRows(page.data ?? []);
      setTotal(page.total);
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setRows([]);
      setCursor(null);
      setError(errorMessage(err));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [key, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchAuditLogs(JSON.parse(key) as AuditFilters, { cursor, limit: pageSize });
      if (seq !== requestSeq.current) return;
      setRows((prev) => [...prev, ...(page.data ?? [])]);
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, key, loadingMore, pageSize]);

  return { rows, total, hasMore: !!cursor, loading, loadingMore, error, reload: load, loadMore };
}
