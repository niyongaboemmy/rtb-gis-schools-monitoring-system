import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate, formatPercent, formatScore } from "../../lib/format";
import { label } from "../../lib/labels";
import { BAND_HEX, bandOf, COMPONENT_ORDER, modelOf, weightOf } from "../../lib/scoring";
import type { PriorityKey, ScoringModel } from "../dashboard/types";
import { ScoreBreakdown } from "../school-dashboard/ScoreBreakdown";
import { parseRecommendation } from "../school-dashboard/recommendation-utils";
import { DetailSection, SummaryStat, SummaryStats } from "../school-dashboard/details/primitives";
import { FACTOR_NAME, asMetrics, num, rwf, urgencyText, type DecisionRow } from "./decision-utils";

/** Header figures for one school in the queue. */
export function DecisionSummary({ d, model }: { d: DecisionRow; model?: ScoringModel | null }) {
  const score = num(d.overallScore);
  const band = (d.priorityLevel as PriorityKey) || (score != null ? bandOf(score, model) : null);
  const coverage = num(d.dataCoverage);
  return (
    <SummaryStats>
      <SummaryStat label="Condition score" value={formatScore(score)} hint="out of 100" accent={band ? BAND_HEX[band] : undefined} meter={score} />
      <SummaryStat label="Priority" value={band ? label("priority", band) : "—"} hint={urgencyText(d.urgencyMonths)} accent={band ? BAND_HEX[band] : undefined} />
      <SummaryStat label="Estimated cost" value={rwf(d.estimatedBudgetRwf)} hint="rough estimate" />
      <SummaryStat label="Real data" value={coverage == null ? "—" : formatPercent(coverage * 100)} hint="of the score is based on records" meter={coverage == null ? null : coverage * 100} />
    </SummaryStats>
  );
}

/** The score breakdown and the server's recommendations for one school. */
export function DecisionDetail({ d, model }: { d: DecisionRow; model?: ScoringModel | null }) {
  const recs = Array.isArray(d.recommendations) ? d.recommendations : [];
  return (
    <div className="space-y-8">
      <DetailSection title="Recommended actions" aside={recs.length ? `${recs.length}` : undefined}>
        {recs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-white/55">No recommendations at this time.</p>
        ) : (
          <ol className="space-y-2">
            {recs.map((r, i) => {
              const { tag, text } = parseRecommendation(r);
              return (
                <li key={i} className="flex items-start gap-3 rounded-2xl bg-slate-900/[0.03] p-3 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:ring-white/8">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary dark:text-blue-300" aria-hidden>
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed text-slate-700 dark:text-white/80">
                    {tag && <span className={cn("mr-1.5 inline-block rounded-md px-1.5 py-px align-[1px] text-[10px] font-semibold", tag.tone)}>{tag.label}</span>}
                    {text}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </DetailSection>

      <ScoreBreakdown metrics={asMetrics(d, model)} />

      <p className="text-[11px] text-slate-400 dark:text-white/40">
        Scored {d.updatedAt || d.createdAt ? formatDate(d.updatedAt ?? d.createdAt) : "—"} · scores update when school records change.
      </p>
    </div>
  );
}

/** Footer: open the school's own dashboard. */
export function DecisionFooter({ d }: { d: DecisionRow }) {
  const id = d.schoolId ?? d.school?.id;
  return (
    <>
      <p className="truncate text-[11px] text-slate-500 dark:text-white/50">{d.school?.code ?? ""}</p>
      {id && (
        <Link
          to={`/schools/${id}/decision`}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
        >
          Open school dashboard
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </>
  );
}

/** "How scoring works": the served model as a weight bar, factor list and bands. */
export function ScoringModelInfo({ model: m }: { model?: ScoringModel | null }) {
  const model = modelOf(m);
  const colors = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)"];
  return (
    <div className="space-y-7">
      <p className="text-[15px] leading-relaxed text-slate-700 dark:text-white/85">
        Each school gets a School Condition Score from 0 to 100 — higher is better. Six factors are each scored 0–100 and weighted; the weighted
        parts add up to the score. A factor without data uses a neutral {model.neutral} and is marked “Estimated”.
      </p>

      <DetailSection title="How much each part counts" aside="sum to 100%">
        <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={COMPONENT_ORDER.map((k) => `${FACTOR_NAME[k]} ${Math.round(weightOf(k, model) * 100)}%`).join(", ")}>
          {COMPONENT_ORDER.map((k, i) => (
            <span key={k} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${weightOf(k, model) * 100}%`, background: colors[i] }} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {COMPONENT_ORDER.map((k, i) => (
            <li key={k} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colors[i] }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-white/80">{FACTOR_NAME[k]}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{Math.round(weightOf(k, model) * 100)}%</span>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="Priority levels">
        <div className="flex gap-[2px]">
          {(["critical", "high", "medium", "low"] as const).map((b) => (
            <div key={b} className="min-w-0" style={{ flexGrow: model.bands[b].max - model.bands[b].min + 1, flexBasis: 0 }}>
              <span className="block h-2.5 rounded-full" style={{ background: BAND_HEX[b] }} />
              <p className="mt-1.5 truncate text-xs font-medium text-slate-800 dark:text-white/85">{label("priority", b)}</p>
              <p className="text-[11px] tabular-nums text-slate-500 dark:text-white/45">
                {model.bands[b].min}–{model.bands[b].max}
              </p>
            </div>
          ))}
        </div>
      </DetailSection>

      <p className="rounded-2xl bg-slate-900/[0.03] p-3.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:text-white/60 dark:ring-white/8">
        Inputs: building condition and age, the facility survey, population within 2 km, road access and Issue Report resolution. Scores update
        automatically when school records change, and nightly. Recalculate is only needed after bulk imports.
      </p>
    </div>
  );
}
