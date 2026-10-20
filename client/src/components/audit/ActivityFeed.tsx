import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { formatDateTime, formatRelative } from "../../lib/format";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { SkeletonText } from "../ui/skeleton";
import { actionLabel, targetTypeLabel } from "./auditLabels";
import { OutcomeBadge } from "./AuditBits";
import { AuditDetailDrawer } from "./AuditDetailDrawer";
import type { AuditFilters, AuditLogRow } from "./auditApi";
import { useAuditLogs } from "./useAuditLogs";

export interface ActivityFeedProps {
  filters: AuditFilters;
  pageSize?: number;
  emptyText?: string;
  className?: string;
}

/**
 * Compact, timeline-style activity list (e.g. a school's Activity section).
 * Each entry opens the full audit details drawer.
 */
export function ActivityFeed({ filters, pageSize = 20, emptyText, className }: ActivityFeedProps) {
  const { rows, hasMore, loading, loadingMore, error, reload, loadMore } = useAuditLogs(filters, pageSize);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  if (loading) return <SkeletonText lines={5} className={className} />;
  if (error) return <ErrorState compact message={error} onRetry={() => void reload()} className={className} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={History}
        title="No activity yet"
        description={emptyText ?? "Changes made to this record will appear here."}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      <ol className="relative border-l border-border/60 ml-2 space-y-1" aria-label="Activity">
        {rows.map((row) => (
          <li key={row.id} className="ml-4">
            <span
              className="absolute -left-[5px] mt-4 h-2.5 w-2.5 rounded-full bg-primary/60 ring-4 ring-background"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setSelected(row)}
              className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{actionLabel(row.action)}</span>
                {row.outcome !== "success" && <OutcomeBadge outcome={row.outcome} />}
                {row.targetType !== "school" && (
                  <span className="text-xs text-muted-foreground">
                    {targetTypeLabel(row.targetType)}
                    {row.targetLabel ? `: ${row.targetLabel}` : ""}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.actorEmail ?? "System"} ·{" "}
                <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
                  {formatRelative(row.createdAt)}
                </time>
                {row.changes ? ` · ${Object.keys(row.changes).length} field(s) changed` : ""}
              </div>
            </button>
          </li>
        ))}
      </ol>
      {hasMore && (
        <div className="pt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
