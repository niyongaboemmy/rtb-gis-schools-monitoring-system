import { useCallback, useState } from "react";
import { ChevronDown, CloudDownload, Loader2, RefreshCw, Users } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { formatDateTime, formatNumber, formatRelative } from "../../lib/format";
import { titleCase } from "../../lib/labels";
import { cn } from "../../lib/utils";
import {
  infraKeyLabel,
  infraValueLabel,
  TDMP_INFRA_GROUPS,
  type TdmpLinkFields,
  type TdmpSchoolData,
  type TdmpStaffResponse,
} from "../../lib/tdmp";
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
 * TDMP's head counts. Details (infrastructure, staff) open in a dialog.
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
          <Fact label="Category" value={text(d.schoolCategory)} />
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

type StaffState =
  | { kind: "idle" | "loading" }
  | { kind: "loaded"; data: TdmpStaffResponse }
  | { kind: "error"; message: string };

/** Staff list, fetched live from TDMP the first time it is opened. */
function StaffList({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StaffState>({ kind: "idle" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const { data } = await api.get<TdmpStaffResponse>(`/schools/${schoolId}/staff`);
      setState({ kind: "loaded", data });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setState({
        kind: "error",
        message:
          status === 409
            ? "This school is not linked to TDMP, so there is no staff list."
            : status === 503
              ? "TDMP can't be reached right now. Try again in a few minutes."
              : apiErrorMessage(err, "Could not load the staff list."),
      });
    }
  }, [schoolId]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state.kind === "idle") void load();
  };

  const staff = state.kind === "loaded" ? state.data.staff : [];
  const panelId = `tdmp-staff-${schoolId}`;

  return (
    <DetailSection
      title={
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Users className="h-4 w-4 text-primary" aria-hidden />
          Staff
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      }
      aside={state.kind === "loaded" ? `${formatNumber(staff.length)} · fetched ${formatRelative(state.data.fetchedAt)}` : "Live from TDMP"}
    >
      {open && (
        <div id={panelId}>
          {state.kind === "loading" && (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading staff from TDMP…
            </p>
          )}
          {state.kind === "error" && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-white/60">
              <span>{state.message}</span>
              <Button type="button" variant="outline" onClick={() => void load()} className="h-8 rounded-full px-3 text-xs">
                Try again
              </Button>
            </div>
          )}
          {state.kind === "loaded" &&
            (staff.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-white/50">TDMP lists no staff for this school.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-900/5 dark:ring-white/8">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <caption className="sr-only">Staff from TDMP</caption>
                  <thead className="text-[12px] uppercase tracking-[0.06em] text-slate-500 dark:text-white/45">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Name</th>
                      <th scope="col" className="px-3 py-2 font-medium">Position</th>
                      <th scope="col" className="px-3 py-2 font-medium">Gender</th>
                      <th scope="col" className="px-3 py-2 font-medium">Qualification</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/5 dark:divide-white/8">
                    {staff.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 text-slate-900 dark:text-white">
                          {s.names || "—"}
                          {s.isHeadTeacher && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] text-primary">Head teacher</span>}
                          {s.isDeputyHeadTeacher && <span className="ml-2 rounded-full bg-slate-900/5 px-2 py-0.5 text-[12px] text-slate-600 dark:bg-white/8 dark:text-white/60">Deputy</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-white/65">{s.positionName || (s.staffType ? titleCase(s.staffType) : "—")}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-white/65">{text(s.gender)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-white/65">{s.qualificationLevel || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-white/65">{text(s.employmentStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}
    </DetailSection>
  );
}

/** Dialog body: TDMP facts, trades, infrastructure and the staff list. */
export function TdmpDetail({ schoolId, school }: { schoolId: string; school: TdmpLinkFields }) {
  const d: TdmpSchoolData = school.tdmpData ?? {};
  const staff = d.staff ?? {};
  const count = (n: unknown) => (isNum(n) ? formatNumber(n) : "—");
  const infra = d.infrastructure ?? null;
  const groups = TDMP_INFRA_GROUPS.map((g) => ({ ...g, values: infra?.[g.key] ?? null })).filter(
    (g) => g.values && Object.keys(g.values).length > 0,
  );

  return (
    <div className="space-y-6">
      <DetailSection title="School" aside={`TDMP code ${school.tdmpSchoolCode ?? "—"}`}>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <Fact label="Ownership" value={text(d.ownership)} />
          <Fact label="Institution type" value={text(d.institutionType)} />
          <Fact label="Category" value={text(d.schoolCategory)} />
          <Fact label="TDMP status" value={text(d.schoolStatus)} />
          <Fact label="Male teachers" value={count(staff.maleTeachers)} />
          <Fact label="Female teachers" value={count(staff.femaleTeachers)} />
          <Fact label="Head teacher" value={staff.headTeacher || "—"} />
          <Fact label="Levels" value={count(d.counts?.levels)} />
        </dl>
      </DetailSection>

      <DetailSection title="Trades">
        <TradeChips trades={d.trades ?? []} />
      </DetailSection>

      <DetailSection title="Infrastructure" aside="As reported to TDMP">
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-white/50">TDMP has no infrastructure figures for this school yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <section
                key={g.key}
                aria-label={g.label}
                className="rounded-2xl bg-slate-900/[0.035] px-3.5 py-3 ring-1 ring-slate-900/5 dark:bg-white/[0.045] dark:ring-white/8"
              >
                <h4 className="mb-1 text-[13px] font-semibold text-slate-900 dark:text-white">{g.label}</h4>
                <dl className="divide-y divide-slate-900/5 dark:divide-white/8">
                  {Object.entries(g.values ?? {}).map(([key, value]) => (
                    <Fact key={key} label={infraKeyLabel(key)} value={infraValueLabel(value)} />
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
      </DetailSection>

      <StaffList schoolId={schoolId} />
    </div>
  );
}
