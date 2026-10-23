import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  Download,
  History,
  ListFilter,
  Loader2,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";
import { endOfDay, startOfDay, startOfMonth, startOfYear, subDays } from "date-fns";
import { Button } from "../ui/button";
import { ErrorState } from "../ui/error-state";
import { RichDropdown } from "../ui/rich-dropdown";
import { SearchInput } from "../ui/search-input";
import { StatusPill } from "../ui/status-pill";
import { EASE_OUT, INSET, PILL_BUTTON, type Tone } from "../ui/surfaces";
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
import {
  CardItem,
  CardList,
  DataTable,
  EmptyNote,
  Eyebrow,
  IconTile,
  ListSkeleton,
  SettingsPanel,
  Td,
  Th,
  Toolbar,
  Tr,
  HeroStats,
} from "./settings-ui";

const OUTCOMES: AuditOutcome[] = ["success", "failure", "denied"];

/** Date presets. Computed when chosen, so "today" is always today. */
const PERIODS: Array<{ value: string; label: string; range: () => { from?: Date; to?: Date } }> = [
  { value: "", label: "All time", range: () => ({}) },
  { value: "today", label: "Today", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    value: "yesterday",
    label: "Yesterday",
    range: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }),
  },
  { value: "7d", label: "Last 7 days", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { value: "30d", label: "Last 30 days", range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { value: "month", label: "This month", range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { value: "year", label: "This year", range: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }) },
];
const PERIOD_OPTIONS = PERIODS.map(({ value, label }) => ({ value, label }));

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function rowLabel(row: AuditLogRow): string {
  return `${actionLabel(row.action)} by ${row.actorEmail ?? "system"}, open details`;
}

function TargetSummary({ row }: { row: AuditLogRow }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm text-foreground">{row.targetLabel ?? targetTypeLabel(row.targetType)}</div>
      <div className="truncate text-xs text-muted-foreground">
        {targetTypeLabel(row.targetType)}
        {row.targetId ? <span className="font-mono"> · {row.targetId.slice(0, 8)}</span> : null}
        {row.subjectUserId && row.subjectUserId !== row.targetId ? (
          <span>
            {" "}
            · affects user <span className="font-mono">{row.subjectUserId.slice(0, 8)}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function When({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={`${formatDateTime(iso)} (Kigali time)`} className={cn("min-w-0", className)}>
      <span className="block truncate text-sm text-foreground">{formatRelative(iso)}</span>
      <span className="block truncate text-xs text-muted-foreground">{formatDateTime(iso)}</span>
    </time>
  );
}

/** Small stat tile inside the overview panel. */
function OverviewTile({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.06, ease: EASE_OUT }}
      className={cn("min-w-0 rounded-2xl p-3.5", INSET)}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </motion.div>
  );
}

/**
 * Settings → Audit Trail (WS11.8): who did what, when, to whom. Filterable,
 * cursor-paginated, exportable, with an integrity ("verify chain") check.
 */
export function AuditTrailTab() {
  const toast = useToast();
  const [period, setPeriod] = useState("");
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
      ...actions
        .map((a) => ({ label: actionLabel(a), value: a }))
        .sort((a, b) => a.label.localeCompare(b.label)),
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

  const hasFilters = !!(period || actorText || freeText || action || targetType) || outcomes.length > 0;

  const clearFilters = () => {
    setPeriod("");
    setRange({});
    setActorText("");
    setFreeText("");
    setAction("");
    setTargetType("");
    setOutcomes([]);
  };

  const toggleOutcome = (o: AuditOutcome) =>
    setOutcomes((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const onPeriod = (value: string) => {
    const r = (PERIODS.find((p) => p.value === value) ?? PERIODS[0]).range();
    setPeriod(value);
    setRange({ from: r.from?.toISOString(), to: r.to?.toISOString() });
  };

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

  const chainTone: Tone = !verification ? "neutral" : verification.ok ? "good" : "danger";
  const ChainIcon = !verification ? ShieldQuestion : verification.ok ? ShieldCheck : ShieldAlert;
  const permissionDenied = !!error && error.startsWith("You do not have permission");

  return (
    <div className="space-y-4">
      {/* ── Overview (shown in the Settings hero): integrity + volume ── */}
      <HeroStats>
        <div className="grid gap-2 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <OverviewTile label="Integrity" index={0}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={ChainIcon} tone={chainTone} size="sm" />
                <div className="min-w-0 space-y-1" role="status">
                  <StatusPill tone={chainTone} pulse={verification?.ok === false}>
                    {!verification ? "Not checked yet" : verification.ok ? "Chain intact" : "Broken"}
                  </StatusPill>
                  <p className="text-xs text-muted-foreground/80">
                    {!verification
                      ? "Check that no record has been altered or removed."
                      : verification.ok
                        ? `${formatNumber(verification.checked)} records verified.`
                        : `Broken at record ${verification.firstBrokenId} after ${formatNumber(
                            verification.checked,
                          )} valid records. Preserve the database and follow the breach runbook.`}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className={PILL_BUTTON.small}
                onClick={() => void onVerify()}
                disabled={verifying}
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                )}
                Verify chain
              </Button>
            </div>
          </OverviewTile>
          <OverviewTile label={hasFilters ? "Matching records" : "Records"} index={1}>
            <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums" aria-live="polite">
              {loading || typeof total !== "number" ? (
                <span className="text-muted-foreground/60">—</span>
              ) : (
                <span>
                  {formatNumber(total)} record{total === 1 ? "" : "s"}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {hasFilters ? "With the filters below" : "Newest first · Kigali time"}
            </p>
          </OverviewTile>
        </div>
      </HeroStats>

      {/* ── Filters + records ────────────────────────────────────────── */}
      <SettingsPanel
        index={0}
        title="Records"
        subtitle="Open a record to see the field changes and request details."
        icon={ListFilter}
        flush
        actions={
          <>
            {hasFilters && (
              <Button variant="ghost" className={PILL_BUTTON.small} onClick={clearFilters}>
                <X className="h-4 w-4" aria-hidden />
                Clear filters
              </Button>
            )}
            <Button variant="outline" className={PILL_BUTTON.small} onClick={() => void onExport()} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              Export CSV
            </Button>
          </>
        }
        toolbar={
          <div className="space-y-2">
            <Toolbar className="@3xl:*:flex-1 @3xl:*:basis-44">
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
              <RichDropdown
                options={targetOptions}
                value={targetType}
                onChange={setTargetType}
                placeholder="All targets"
                searchPlaceholder="Find a target type…"
              />
            </Toolbar>
            <div className="flex flex-col gap-2 @lg:flex-row @lg:items-center">
              <div
                role="group"
                aria-label="Outcome"
                className={cn("grid grid-cols-3 gap-1 rounded-full p-1 @lg:inline-grid @lg:w-auto", INSET)}
              >
                {OUTCOMES.map((o) => {
                  const active = outcomes.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleOutcome(o)}
                      className={cn(
                        "h-9 min-w-0 rounded-full px-4 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  );
                })}
              </div>
              <div className="min-w-0 @lg:w-52">
                <RichDropdown
                  options={PERIOD_OPTIONS}
                  value={period}
                  onChange={onPeriod}
                  placeholder="All time"
                  searchPlaceholder="Find a period…"
                />
              </div>
            </div>
          </div>
        }
      >
        {loading ? (
          <ListSkeleton rows={6} label="Loading audit records…" />
        ) : error ? (
          <div className="px-4 pb-5 min-[400px]:px-5 sm:px-6">
            {permissionDenied ? (
              <ErrorState title="Access restricted" message={error} />
            ) : (
              <ErrorState message={error} onRetry={() => void reload()} />
            )}
          </div>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyNote
              icon={SearchX}
              title="No records match these filters"
              hint="Try a wider date range or fewer filters."
              action={
                <Button variant="outline" className={PILL_BUTTON.small} onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyNote
              icon={History}
              title="No activity recorded yet"
              hint="Actions such as editing a school or changing a role will appear here."
            />
          )
        ) : (
          <>
            <DataTable label="Audit records">
              <thead>
                <tr>
                  <Th className="w-44">Time</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Outcome</Th>
                  <Th className="w-12">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id} onClick={() => setSelected(row)} selected={selected?.id === row.id}>
                    <Td className="whitespace-nowrap">
                      <When iso={row.createdAt} />
                    </Td>
                    <Td className="max-w-56">
                      <ActorSummary row={row} />
                    </Td>
                    <Td className="max-w-56">
                      <div className="truncate text-sm font-normal text-foreground">{actionLabel(row.action)}</div>
                    </Td>
                    <Td className="max-w-64">
                      <TargetSummary row={row} />
                    </Td>
                    <Td>
                      <OutcomeBadge outcome={row.outcome} />
                    </Td>
                    <Td align="right">
                      <button
                        type="button"
                        aria-label={rowLabel(row)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(row);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>

            <CardList label="Audit records">
              {rows.map((row) => (
                <CardItem key={row.id} selected={selected?.id === row.id} className="p-0">
                  <button
                    type="button"
                    aria-label={rowLabel(row)}
                    onClick={() => setSelected(row)}
                    className="flex h-full w-full min-w-0 flex-col gap-2.5 rounded-2xl p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex w-full min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-normal text-foreground">{actionLabel(row.action)}</span>
                      <OutcomeBadge outcome={row.outcome} className="shrink-0" />
                    </div>
                    <div className="w-full min-w-0">
                      <ActorSummary row={row} />
                    </div>
                    <div className="w-full min-w-0">
                      <TargetSummary row={row} />
                    </div>
                    <div className="flex w-full min-w-0 items-center justify-between gap-2 border-t border-border/30 pt-2 text-xs text-muted-foreground">
                      <time dateTime={row.createdAt} title={`${formatDateTime(row.createdAt)} (Kigali time)`} className="truncate">
                        {formatRelative(row.createdAt)} · {formatDateTime(row.createdAt)}
                      </time>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    </div>
                  </button>
                </CardItem>
              ))}
            </CardList>

            <div className="flex flex-col items-center gap-2 border-t border-border/30 px-4 py-4 sm:px-6">
              {typeof total === "number" && (
                <p className="text-xs text-muted-foreground/80">
                  Showing {formatNumber(rows.length)} of {formatNumber(total)}
                </p>
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  className={PILL_BUTTON.small}
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </SettingsPanel>

      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
