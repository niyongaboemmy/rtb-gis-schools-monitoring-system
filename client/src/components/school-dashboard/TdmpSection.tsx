import { AlertTriangle, CloudDownload, RefreshCw } from "lucide-react";
import { formatDate, formatDateTime, formatNumber, formatRelative } from "../../lib/format";
import { titleCase } from "../../lib/labels";
import { cn } from "../../lib/utils";
import { type TdmpLinkFields, type TdmpSchoolData } from "../../lib/tdmp";
import { Button } from "../ui/button";
import { GlassCard } from "./GlassCard";
import { DetailSection, SummaryStat, SummaryStats } from "./details/primitives";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: string | null | undefined) => (v ? titleCase(v) : "—");

/** One "label: value" line. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="shrink-0 text-slate-500 dark:text-white/50">{label}</dt>
      <dd className="min-w-0 truncate text-right text-slate-900 tabular-nums dark:text-white">{value}</dd>
    </div>
  );
}

function TradeChips({ trades, limit }: { trades: string[]; limit?: number }) {
  if (!trades.length) return <p className="text-sm text-slate-500 dark:text-white/50">No trades recorded in TDMP.</p>;
  const shown = limit ? trades.slice(0, limit) : trades;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Trades">
      {shown.map((t) => (
        <li key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[13px] text-primary">
          {t}
        </li>
      ))}
      {limit && trades.length > limit && (
        <li className="px-1 py-0.5 text-[13px] text-slate-500 dark:text-white/50">+{formatNumber(trades.length - limit)} more</li>
      )}
    </ul>
  );
}

function syncedLabel(at: string | null | undefined): string {
  return at ? `Synced ${formatRelative(at)}` : "Not synced yet";
}

/**
 * Overview card for a TDMP-linked school: who owns it, its trades and
 * TDMP's head counts. Details open in a dialog.
 */
export function TdmpCard({
  school,
  onOpen,
  onRefresh,
  refreshing,
  index = 0,
}: {
  school: TdmpLinkFields;
  onOpen: () => void;
  /** Present when the user may pull a fresh copy from TDMP. */
  onRefresh?: () => void;
  refreshing?: boolean;
  index?: number;
}) {
  const d: TdmpSchoolData = school.tdmpData ?? {};
  const counts = d.counts ?? {};
  return (
    <GlassCard
      title="From TDMP"
      icon={CloudDownload}
      actionLabel="Details"
      onAction={onOpen}
      index={index}
      badge={
        <span className="truncate text-[13px] text-slate-500 dark:text-white/50" title={formatDateTime(school.tdmpSyncedAt)}>
          {syncedLabel(school.tdmpSyncedAt)}
        </span>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <dl className="divide-y divide-slate-900/5 dark:divide-white/8">
          <Fact label="TDMP code" value={school.tdmpSchoolCode ?? "—"} />
          <Fact label="Ownership" value={text(d.ownership)} />
          <Fact label="Category" value={d.band ?? text(d.schoolCategory)} />
          <Fact label="Students" value={isNum(counts.students) ? formatNumber(counts.students) : "—"} />
          <Fact label="Teachers" value={isNum(counts.teachers) ? formatNumber(counts.teachers) : "—"} />
        </dl>
        <div className="min-w-0 space-y-3">
          <p className="text-[13px] font-medium text-slate-500 dark:text-white/50">Trades</p>
          <TradeChips trades={d.trades ?? []} limit={8} />
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
              {refreshing ? "Refreshing…" : "Refresh from TDMP"}
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export function TdmpSummary({ school }: { school: TdmpLinkFields }) {
  const counts = school.tdmpData?.counts ?? {};
  const value = (n: unknown) => (isNum(n) ? formatNumber(n) : "—");
  return (
    <SummaryStats>
      <SummaryStat label="Students" value={value(counts.students)} />
      <SummaryStat label="Teachers" value={value(counts.teachers)} />
      <SummaryStat label="Trades" value={value(counts.trades)} />
      <SummaryStat label="Last sync" value={school.tdmpSyncedAt ? formatRelative(school.tdmpSyncedAt) : "—"} hint={formatDateTime(school.tdmpSyncedAt)} />
    </SummaryStats>
  );
}

/** Dialog body: what TDMP says about the school, and what it doesn't yet. */
export function TdmpDetail({ school }: { schoolId: string; school: TdmpLinkFields }) {
  const d: TdmpSchoolData = school.tdmpData ?? {};
  const count = (n: unknown) => (isNum(n) ? formatNumber(n) : "—");

  return (
    <div className="space-y-6">
      {d.missingFromTdmp && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-500/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          TDMP's latest school list no longer includes this school. Its details are kept as they were until TDMP confirms.
        </p>
      )}

      <DetailSection title="School" aside={`TDMP code ${school.tdmpSchoolCode ?? "—"}`}>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <Fact label="Ownership" value={text(d.ownership)} />
          <Fact label="Institution type" value={text(d.institutionType)} />
          <Fact label="Band" value={d.band ?? (d.typeUnverified ? "Not classified in TDMP" : "—")} />
          <Fact label="TDMP status" value={text(d.isActive)} />
          <Fact label="Established" value={d.establishmentDate ? formatDate(d.establishmentDate) : "—"} />
          <Fact label="Academic year" value={d.academicYear ?? "—"} />
          <Fact label="TMIS code" value={d.tmisSchoolCode ?? "—"} />
          <Fact label="Levels" value={count(d.counts?.levels)} />
          <Fact label="Modules" value={count(d.counts?.modules)} />
          <Fact label="TDMP data as of" value={d.sourceUpdatedAt ? formatDateTime(d.sourceUpdatedAt) : "—"} />
        </dl>
      </DetailSection>

      <DetailSection title="Trades" aside="Codes as listed in TDMP">
        <TradeChips trades={d.trades ?? []} />
      </DetailSection>

      <p className="text-[13px] text-slate-500 dark:text-white/50">
        Learner and teacher gender splits, learners per programme and seat capacity are not available from TDMP yet;
        they stay editable here until TDMP provides them.
      </p>
    </div>
  );
}
