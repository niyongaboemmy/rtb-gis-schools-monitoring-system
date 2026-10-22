import { motion, useReducedMotion } from "framer-motion";
import { CircleDollarSign, Clock, Users } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatNumber, formatPercent } from "../../../lib/format";
import { MetricInfo } from "../../metric-help/MetricInfo";
import type { RiskAssessmentData } from "../../dashboard/types";
import { RISK_LEVEL } from "../status-colors";
import { useChartTooltip } from "../charts/useChartTooltip";
import { BRAND, EASE } from "../tokens";
import { DetailSection, EmptyNote, Meter, RuleTip, StatusPill, SummaryStat, SummaryStats } from "./primitives";

const PRIORITY: Record<string, { label: string; color: string }> = {
  immediate: { label: "Immediate", color: "#ef4444" },
  "short-term": { label: "Short term", color: "#f59e0b" },
  "long-term": { label: "Long term", color: BRAND },
};
const COST_LABEL: Record<string, string> = { low: "Low cost", medium: "Medium cost", high: "High cost" };
const levelOf = (l: string) => RISK_LEVEL[l] ?? RISK_LEVEL.unknown;

/** Factors that count first (by risk), "not counted" ones last. */
const sortFactors = (risk: RiskAssessmentData) =>
  [...risk.factors].sort((a, b) => Number(b.applies !== false) - Number(a.applies !== false) || b.riskScore - a.riskScore);

/** Header figures: overall indicative risk, its two inputs, how many drivers count. */
export function RiskSummary({ risk }: { risk: RiskAssessmentData | null | undefined }) {
  if (!risk) return null;
  const level = levelOf(risk.overall.level);
  const counted = risk.factors.filter((f) => f.applies !== false).length;
  return (
    <SummaryStats>
      <SummaryStat
        label="Indicative risk"
        value={formatNumber(risk.overall.score)}
        hint={`${level.label} · out of 100`}
        accent={level.color}
        meter={risk.overall.score}
        info={<MetricInfo id="risk.overall" size="xs" />}
      />
      <SummaryStat label="Impact" value={formatNumber(risk.impactScore)} hint="how bad if it happens" meter={risk.impactScore} info={<MetricInfo id="risk.impact" size="xs" />} />
      <SummaryStat
        label="Probability"
        value={formatNumber(risk.probabilityScore)}
        hint="how likely it is"
        meter={risk.probabilityScore}
        info={<MetricInfo id="risk.probability" size="xs" />}
      />
      <SummaryStat label="Drivers counted" value={`${counted} of ${risk.factors.length}`} hint="others: no data or nothing seen" />
    </SummaryStats>
  );
}

/** Impact × probability map: one numbered dot per counted driver. */
function RiskMap({ factors }: { factors: RiskAssessmentData["factors"] }) {
  const reduce = useReducedMotion();
  const { boxRef, bind, tooltip } = useChartTooltip();
  return (
    <figure className="min-w-0">
      <div className="flex gap-2">
        <span className="flex w-3 items-center justify-center text-[10px] text-slate-400 [writing-mode:vertical-rl] rotate-180 dark:text-white/40">Probability →</span>
        <div
          ref={boxRef}
          className="relative aspect-square w-full overflow-visible rounded-2xl ring-1 ring-slate-900/6 dark:ring-white/8"
          role="img"
          aria-label={`Risk map: ${factors.map((f, i) => `${i + 1} ${f.title}, impact ${f.impact}, probability ${f.probability}`).join("; ") || "no counted drivers"}`}
        >
          {/* Severity wash (low → high toward the top-right) + 4×4 grid */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl opacity-70 dark:opacity-60"
            style={{
              background:
                "radial-gradient(130% 130% at 100% 0%, rgb(239 68 68 / 0.22), rgb(245 158 11 / 0.12) 45%, rgb(16 185 129 / 0.08) 80%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgb(100 116 139 / 0.14) 1px, transparent 1px), linear-gradient(to top, rgb(100 116 139 / 0.14) 1px, transparent 1px)",
              backgroundSize: "25% 25%",
            }}
          />
          {factors.map((f, i) => {
            const l = levelOf(f.level);
            return (
              <motion.span
                key={f.id}
                tabIndex={0}
                className="absolute flex h-6 w-6 -translate-x-1/2 translate-y-1/2 cursor-default items-center justify-center rounded-full text-[11px] font-semibold text-white outline-none ring-2 ring-white focus-visible:ring-primary dark:ring-[hsl(224_40%_7%)]"
                style={{ left: `${Math.min(94, Math.max(6, f.impact))}%`, bottom: `${Math.min(94, Math.max(6, f.probability))}%`, background: l.color }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : 0.2 + i * 0.08, ease: EASE }}
                {...bind(
                  <span>
                    {f.title}: impact <b>{f.impact}</b>, probability <b>{f.probability}</b>
                  </span>,
                )}
              >
                {i + 1}
              </motion.span>
            );
          })}
          {factors.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-500 dark:text-white/50">No active drivers</p>
          )}
          {tooltip}
        </div>
      </div>
      <figcaption className="mt-1.5 pl-5 text-center text-[10px] text-slate-400 dark:text-white/40">Impact →</figcaption>
    </figure>
  );
}

/** Drivers (map + list) and the mitigation options. Indicative, rule-based. */
export function RiskDetail({ risk }: { risk: RiskAssessmentData | null | undefined }) {
  const reduce = useReducedMotion();
  if (!risk) {
    return <EmptyNote title="Indicative risk is not available yet">It appears once the school has been scored.</EmptyNote>;
  }
  const factors = sortFactors(risk);
  const counted = factors.filter((f) => f.applies !== false);

  return (
    <div className="space-y-8">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
        Indicative — rules of thumb to help plan, not a measurement
      </p>

      <DetailSection title="Risk drivers" aside={`${counted.length} counted`}>
        <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[15rem]">
            <RiskMap factors={counted} />
          </div>
          <ol className="space-y-2">
            {factors.map((f, i) => {
              const l = levelOf(f.level);
              const off = f.applies === false;
              return (
                <motion.li
                  key={f.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * i, ease: EASE }}
                  className={cn(
                    "rounded-2xl bg-slate-900/[0.025] p-3.5 ring-1 ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8",
                    off && "opacity-65",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        off ? "bg-slate-900/8 text-slate-500 dark:bg-white/10 dark:text-white/50" : "text-white",
                      )}
                      style={off ? undefined : { background: l.color }}
                      aria-hidden
                    >
                      {off ? "–" : counted.indexOf(f) + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white">{f.title}</h4>
                        <RuleTip rule={f.rule} label={f.title} />
                        <StatusPill color={l.color}>{f.level === "unknown" ? "Unknown — no data" : l.label}</StatusPill>
                        {off && <span className="text-[11px] text-slate-500 dark:text-white/45">Not counted in the overall risk</span>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-white/60">{f.mitigation}</p>
                      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                        {(["impact", "probability"] as const).map((k) => (
                          <div key={k}>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-white/50">
                              <span className="capitalize">{k}</span>
                              <span className="font-medium tabular-nums text-slate-700 dark:text-white/75">{formatNumber(f[k])}</span>
                            </div>
                            <Meter value={f[k]} color={off ? undefined : l.color} height={4} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-white/50">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {f.timeline}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          {f.owner}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold leading-none tabular-nums text-slate-900 dark:text-white">{formatNumber(f.riskScore)}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40">Risk</p>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </DetailSection>

      {risk.strategies.length > 0 && (
        <DetailSection
          title={
            <>
              Mitigation options <MetricInfo id="risk.mitigation" size="xs" />
            </>
          }
          aside="estimated effectiveness"
        >
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {risk.strategies.map((s, i) => {
              const p = PRIORITY[s.priority] ?? { label: s.priority, color: BRAND };
              const R = 15;
              const C = 2 * Math.PI * R;
              return (
                <li key={s.id} className="flex gap-3.5 rounded-2xl p-3.5 ring-1 ring-slate-900/6 dark:ring-white/8">
                  <div className="relative h-11 w-11 shrink-0" role="img" aria-label={`Estimated effectiveness ${formatPercent(s.effectiveness)}`}>
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
                      <circle cx="18" cy="18" r={R} fill="none" strokeWidth="3.5" className="stroke-slate-900/6 dark:stroke-white/8" />
                      <motion.circle
                        cx="18"
                        cy="18"
                        r={R}
                        fill="none"
                        stroke={BRAND}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={C}
                        initial={{ strokeDashoffset: C }}
                        animate={{ strokeDashoffset: C * (1 - s.effectiveness / 100) }}
                        transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : 0.2 + i * 0.06, ease: EASE }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatNumber(s.effectiveness)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1">
                      <h4 className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-white">{s.title}</h4>
                      <RuleTip rule={s.rule} label={s.title} />
                    </div>
                    <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-white/60">{s.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill color={p.color}>{p.label}</StatusPill>
                      <StatusPill>
                        <CircleDollarSign className="h-3 w-3 text-slate-400 dark:text-white/45" aria-hidden />
                        {COST_LABEL[s.cost] ?? s.cost}
                      </StatusPill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}
