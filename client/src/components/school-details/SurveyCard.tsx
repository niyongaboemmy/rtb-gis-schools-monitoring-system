import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronDown, ClipboardCheck, UserRound } from "lucide-react";
import { formatDate, formatNumber, formatPercent } from "../../lib/format";
import { MetricInfo } from "../metric-help/MetricInfo";
import { GlassCard } from "../school-dashboard/GlassCard";
import { COMPLIANCE, type ComplianceKey } from "../school-dashboard/status-colors";
import { StackBar } from "../school-dashboard/charts/StackBar";
import { StatusPill } from "../school-dashboard/details/primitives";
import { EASE } from "../school-dashboard/tokens";

export interface Facility {
  facilityId: string;
  title: string;
  items: { id: string; label: string; tags?: string[] }[];
}

export interface SurveyItem {
  id: string;
  facilityId: string;
  itemId: string;
  compliance: Exclude<ComplianceKey, "none">;
  notes?: string;
  inspectedBy?: string;
  inspectedAt?: string;
}

const META = Object.fromEntries(COMPLIANCE.map((c) => [c.key, c])) as Record<ComplianceKey, (typeof COMPLIANCE)[number]>;
const keyOf = (s?: SurveyItem): ComplianceKey => (s && s.compliance in META ? s.compliance : "none");

interface Props {
  facilities: Facility[];
  survey: SurveyItem[];
  /** Server facility-compliance score (0–100), shown as the headline. */
  complianceScore?: number | null;
  onUpdateSurvey?: () => void;
  index?: number;
}

/** Facility survey: overall mix, then each facility as a collapsible group. */
export function SurveyCard({ facilities, survey, complianceScore, onUpdateSurvey, index }: Props) {
  const reduce = useReducedMotion();
  const groups = useMemo(
    () =>
      facilities.map((f) => {
        const rows = f.items.map((item) => {
          const record = survey.find((s) => s.facilityId === f.facilityId && s.itemId === item.id);
          return { item, record, key: keyOf(record) };
        });
        const counts = Object.fromEntries(COMPLIANCE.map((c) => [c.key, rows.filter((r) => r.key === c.key).length])) as Record<ComplianceKey, number>;
        return { f, rows, counts };
      }),
    [facilities, survey],
  );
  const totals = useMemo(() => {
    const t = Object.fromEntries(COMPLIANCE.map((c) => [c.key, 0])) as Record<ComplianceKey, number>;
    groups.forEach((g) => COMPLIANCE.forEach((c) => (t[c.key] += g.counts[c.key])));
    return t;
  }, [groups]);
  const items = groups.reduce((a, g) => a + g.rows.length, 0);

  return (
    <GlassCard
      title="Facilities checklist"
      icon={ClipboardCheck}
      index={index}
      info={<MetricInfo id="component.facilityCompliance" size="xs" />}
      actionLabel={onUpdateSurvey ? "Update" : undefined}
      onAction={onUpdateSurvey}
    >
      {facilities.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[15px] text-slate-500 dark:border-white/12 dark:text-white/50">
          No survey checklist is set up yet.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)] md:items-center">
            <div>
              <p className="text-[13px] font-medium text-slate-500 dark:text-white/45">Checklist score</p>
              <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {complianceScore == null ? "—" : formatPercent(complianceScore)}
              </p>
              <p className="text-[13px] text-slate-500 dark:text-white/45">
                {formatNumber(items - totals.none)} of {formatNumber(items)} items checked
              </p>
            </div>
            <div>
              <StackBar
                max={Math.max(1, items)}
                height={12}
                ariaLabel="Checklist items by result"
                segments={COMPLIANCE.map((c) => ({
                  key: c.key,
                  value: totals[c.key],
                  color: c.color,
                  textured: c.key === "none",
                  tip: (
                    <span>
                      {c.label}: <b>{formatNumber(totals[c.key])}</b>
                    </span>
                  ),
                }))}
              />
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500 dark:text-white/50">
                {COMPLIANCE.map((c) => (
                  <li key={c.key} className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} aria-hidden />
                    {c.label} <b className="font-semibold tabular-nums text-slate-800 dark:text-white/85">{formatNumber(totals[c.key])}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5 lg:grid-cols-2">
            {groups.map(({ f, rows, counts }, gi) => {
              const ok = counts.compliant;
              // Open the groups that need attention; the rest stay folded.
              const attention = counts.non_compliant + counts.partial > 0;
              return (
                <motion.details
                  key={f.facilityId}
                  open={attention}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + gi * 0.04, ease: EASE }}
                  className="group/fac self-start overflow-hidden rounded-2xl ring-1 ring-slate-900/6 open:bg-slate-900/[0.02] dark:ring-white/8 dark:open:bg-white/[0.025]"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 outline-none transition-colors hover:bg-slate-900/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{f.title}</p>
                      <div className="mt-1.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-slate-900/6 dark:bg-white/8" aria-hidden>
                        {COMPLIANCE.map((c) =>
                          counts[c.key] ? (
                            <span key={c.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(counts[c.key] / rows.length) * 100}%`, background: c.color }} />
                          ) : null,
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] tabular-nums text-slate-500 dark:text-white/50">
                      <b className="font-semibold text-slate-800 dark:text-white/85">{ok}</b>/{rows.length} meet the standard
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/fac:rotate-180" aria-hidden />
                  </summary>
                  <ul className="divide-y divide-slate-900/5 border-t border-slate-900/6 dark:divide-white/6 dark:border-white/8">
                    {rows.map(({ item, record, key }) => {
                      const c = META[key];
                      return (
                        <li key={item.id} className="px-3.5 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 text-[15px] leading-snug text-slate-800 dark:text-white/85">{item.label}</p>
                            <StatusPill color={c.color}>{c.label}</StatusPill>
                          </div>
                          {record?.notes && <p className="mt-1 line-clamp-2 text-xs italic text-slate-500 dark:text-white/50">“{record.notes}”</p>}
                          {(record?.inspectedAt || record?.inspectedBy || (item.tags?.length ?? 0) > 0) && (
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-slate-400 dark:text-white/40">
                              {record?.inspectedAt && (
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" aria-hidden />
                                  {formatDate(record.inspectedAt)}
                                </span>
                              )}
                              {record?.inspectedBy && (
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="h-3 w-3" aria-hidden />
                                  {record.inspectedBy}
                                </span>
                              )}
                              {item.tags?.map((t) => (
                                <span key={t} className="rounded bg-slate-900/5 px-1.5 py-px text-[12px] text-slate-500 dark:bg-white/6 dark:text-white/50">
                                  {t.toLowerCase()}
                                </span>
                              ))}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </motion.details>
              );
            })}
          </div>
        </>
      )}
    </GlassCard>
  );
}
