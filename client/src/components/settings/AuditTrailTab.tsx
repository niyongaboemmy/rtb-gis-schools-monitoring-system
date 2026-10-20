import { useEffect, useMemo, useState } from "react";
import {
  Download,
  History,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { PeriodFilter, type PeriodRange } from "../ui/period-filter";
import { RichDropdown } from "../ui/rich-dropdown";
import { SearchInput } from "../ui/search-input";
import { SkeletonTable } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useToast } from "../ui/toast";
import { cn } from "../../lib/utils";
import { apiErrorMessage } from "../../lib/api";
import { formatDateTime, formatNumber, formatRelative } from "../../lib/format";
import {
  actionLabel,
  OUTCOME_LABELS,
  TARGET_TYPE_LABELS,
  targetTypeLabel,
  type AuditOutcome,
} from "../audit/auditLabels";
import { ActorSummary, OutcomeBadge } from "../audit/AuditBits";
import { AuditDetailDrawer } from "../audit/AuditDetailDrawer";
import {
  downloadAuditCsv,
  fetchAuditActions,
  verifyAuditChain,
  type AuditFilters,
  type AuditLogRow,
  type ChainVerification,
} from "../audit/auditApi";
import { useAuditLogs } from "../audit/useAuditLogs";

const OUTCOMES: AuditOutcome[] = ["success", "failure", "denied"];

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function TargetSummary({ row }: { row: AuditLogRow }) {
  return (
    <div className="min-w-0">
      <div className="text-sm truncate">{row.targetLabel ?? targetTypeLabel(row.targetType)}</div>
      <div className="text-xs text-muted-foreground truncate">
        {targetTypeLabel(row.targetType)}
        {row.targetId ? <span className="font-mono"> · {row.targetId.slice(0, 8)}</span> : null}
        {row.subjectUserId && row.subjectUserId !== row.targetId ? (
          <span> · affects user {row.subjectUserId.slice(0, 8)}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Settings → Audit Trail (WS11.8): who did what, when, to whom. Filterable,
 * cursor-paginated, exportable, with an integrity ("verify chain") check.
 */
export function AuditTrailTab() {
  const toast = useToast();
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [actorText, setActorText] = useState("");
  const [freeText, setFreeText] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [outcomes, setOutcomes] = useState<AuditOutcome[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<ChainVerification | null>(null);

  const actor = useDebounced(actorText);
  const q = useDebounced(freeText);

  const filters: AuditFilters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      actor: actor || undefined,
      q: q || undefined,
      action: action || undefined,
      targetType: targetType || undefined,
      outcome: outcomes.length ? outcomes.join(",") : undefined,
    }),
    [range, actor, q, action, targetType, outcomes],
  );

  const { rows, total, hasMore, loading, loadingMore, error, reload, loadMore } = useAuditLogs(filters);

  useEffect(() => {
    let cancelled = false;
    fetchAuditActions()
      .then((a) => {
        if (!cancelled) setActions(a);
      })
      .catch(() => {
        /* the dropdown simply stays short */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const actionOptions = useMemo(
    () => [
      { label: "All actions", value: "" },
      ...actions.map((a) => ({ label: `${actionLabel(a)} (${a})`, value: a })),
    ],
    [actions],
  );
  const targetOptions = useMemo(
    () => [
      { label: "All targets", value: "" },
      ...Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => ({ label, value })),
    ],
    [],
  );

  const hasFilters =
    !!(range.from || range.to || actorText || freeText || action || targetType) || outcomes.length > 0;

  const clearFilters = () => {
    setRange({});
    setActorText("");
    setFreeText("");
    setAction("");
    setTargetType("");
    setOutcomes([]);
  };

  const toggleOutcome = (o: AuditOutcome) =>
    setOutcomes((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const onRange = (r: PeriodRange) =>
    setRange({
      from: r.startDate ? r.startDate.toISOString() : undefined,
      to: r.endDate ? r.endDate.toISOString() : undefined,
    });

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadAuditCsv(filters);
      toast.success("Audit trail exported. The export itself is recorded in the trail.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not export the audit trail. Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const onVerify = async () => {
    setVerifying(true);
    try {
      const result = await verifyAuditChain();
      setVerification(result);
      if (result.ok) toast.success(`Integrity verified: ${formatNumber(result.checked)} records intact.`);
      else toast.error("Integrity check failed: the audit trail has been altered.", { duration: 0 });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not run the integrity check."));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" aria-hidden="true" /> Audit Trail
            </h2>
            <p className="text-sm text-muted-foreground">
              Every change and security event: what was done, by whom, when, and to whom.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void onVerify()} disabled={verifying}>
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Verify chain
            </Button>
            <Button size="sm" onClick={() => void onExport()} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Export CSV
            </Button>
          </div>
        </div>

        {verification && (
          <div
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
              verification.ok
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "bg-red-500/10 text-red-800 dark:text-red-300",
            )}
          >
            {verification.ok ? (
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {verification.ok
                ? `Chain intact — ${formatNumber(verification.checked)} records verified.`
                : `Chain broken at record ${verification.firstBrokenId} after ${formatNumber(
                    verification.checked,
                  )} valid records. Preserve the database and follow the breach runbook.`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <SearchInput
            aria-label="Search by actor email"
            placeholder="Actor email…"
            value={actorText}
            onChange={(e) => setActorText(e.target.value)}
            onClear={() => setActorText("")}
          />
          <SearchInput
            aria-label="Search actions, targets and emails"
            placeholder="Search action, target…"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onClear={() => setFreeText("")}
          />
          <RichDropdown
            options={actionOptions}
            value={action}
            onChange={setAction}
            placeholder="All actions"
            searchPlaceholder="Find an action…"
          />
          <RichDropdown options={targetOptions} value={targetType} onChange={setTargetType} placeholder="All targets" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter onRangeChange={onRange} />
          <div role="group" aria-label="Outcome" className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => {
              const active = outcomes.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleOutcome(o)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {OUTCOME_LABELS[o]}
                </button>
              );
            })}
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          {typeof total === "number" && !loading && (
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
              {formatNumber(total)} record{total === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <SkeletonTable rows={8} columns={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={History}
          title={hasFilters ? "No records match these filters" : "No activity recorded yet"}
          description={
            hasFilters
              ? "Try a wider date range or fewer filters."
              : "Actions such as editing a school or changing a role will appear here."
          }
          secondaryAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <Card className="hidden xl:block overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>By who</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>To whom / what</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${actionLabel(row.action)} by ${row.actorEmail ?? "system"}, open details`}
                    onClick={() => setSelected(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(row);
                      }
                    }}
                    className="cursor-pointer focus:outline-none focus-visible:bg-muted/60"
                  >
                    <TableCell className="max-w-[16rem]">
                      <div className="text-sm font-medium truncate">{actionLabel(row.action)}</div>
                      <OutcomeBadge outcome={row.outcome} className="mt-1" />
                    </TableCell>
                    <TableCell className="max-w-[16rem]">
                      <ActorSummary row={row} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">{formatDateTime(row.createdAt)}</div>
                      <div className="text-xs text-muted-foreground">{formatRelative(row.createdAt)}</div>
                    </TableCell>
                    <TableCell className="max-w-[18rem]">
                      <TargetSummary row={row} />
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Phones / tablets: stacked cards (the table needs xl width) */}
          <ul className="xl:hidden grid gap-2 md:grid-cols-2" aria-label="Audit records">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="w-full h-full text-left rounded-2xl border border-border/60 bg-card p-4 space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{actionLabel(row.action)}</span>
                    <OutcomeBadge outcome={row.outcome} />
                  </div>
                  <ActorSummary row={row} />
                  <TargetSummary row={row} />
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)} · {formatRelative(row.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
