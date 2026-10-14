import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon, Activity, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { formatNumber, formatPercent, formatScore } from '../../lib/format';
import { label } from '../../lib/labels';
import { MetricInfo } from '../metric-help/MetricInfo';
import { DataGapBadge } from '../metric-help/DataGapBadge';
import type { MetricId } from '../metric-help/metrics';

interface MetricBreakdown {
  label: string;
  /** null means the metric is not yet available — renders `emptyText` instead of a number */
  score: number | null;
  icon: LucideIcon;
  /** "score" renders 0–100 without a % sign; "percent" renders with %. */
  unit?: 'score' | 'percent';
  metricId?: MetricId;
  /** Shown instead of "—" when score is null. */
  emptyText?: string;
  /** Data-gap note, e.g. "Estimated for 5 schools". */
  estimatedNote?: string | null;
}

interface IntelligenceScoreProps {
  /** School Condition Score (0–100); null when no school has been scored. */
  score: number | null;
  urgencyMonths?: number;
  metrics: MetricBreakdown[];
  className?: string;
  isAggregate?: boolean;
  /** Number of scored schools behind an aggregate score. */
  assessedCount?: number;
  children?: ReactNode;
}

/** Tone by Intervention Priority band (Critical < 35, High < 55, Medium < 75, Low ≥ 75). */
function bandOf(s: number): 'critical' | 'high' | 'medium' | 'low' {
  if (s < 35) return 'critical';
  if (s < 55) return 'high';
  if (s < 75) return 'medium';
  return 'low';
}
const BAND_STYLE = {
  low: { color: 'text-emerald-500', bg: 'bg-emerald-500' },
  medium: { color: 'text-amber-500', bg: 'bg-amber-500' },
  high: { color: 'text-orange-500', bg: 'bg-orange-500' },
  critical: { color: 'text-red-500', bg: 'bg-red-500' },
} as const;

export function IntelligenceScore({
  score,
  urgencyMonths,
  metrics,
  className,
  isAggregate = false,
  assessedCount,
  children
}: IntelligenceScoreProps) {
  const hasHero = score != null && Number.isFinite(score);
  const band = hasHero ? bandOf(score) : null;
  const status = band ? { ...BAND_STYLE[band], label: label('priority', band) } : { color: 'text-muted-foreground', bg: 'bg-muted-foreground/40', label: 'Not assessed' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={cn("col-span-1", className)}
    >
      <Card className="border border-border/20 dark:border-blue-700/20 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden shadow-none">
        <CardHeader className="border-b border-border/10 dark:border-blue-700/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary shrink-0" />
              {isAggregate ? "Average School Condition Score" : "School Condition Score"}
              <MetricInfo id={isAggregate ? "national.avgConditionScore" : "school.conditionScore"} />
            </CardTitle>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex rounded-full bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-black px-3"
            >
              {isAggregate ? "Active schools in your area" : "This school"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-hidden">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/10 dark:divide-blue-700/30">

            {/* ── Hero Score ─────────────────────────────────────────────── */}
            <div className="lg:w-2/5 p-6 sm:p-8 flex flex-col items-center justify-center bg-linear-to-br from-primary/5 via-transparent to-transparent">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 15, delay: 0.2 }}
                className="relative w-40 h-40 sm:w-48 sm:h-48"
              >
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192" role="img" aria-label={hasHero ? `School Condition Score ${formatScore(score)} out of 100` : 'Not assessed yet'}>
                  <circle
                    cx="96" cy="96" r="88"
                    stroke="currentColor" strokeWidth="12" fill="none"
                    className="text-muted/10"
                  />
                  <motion.circle
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: hasHero ? score / 100 : 0 }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                    cx="96" cy="96" r="88"
                    stroke="currentColor" strokeWidth="12" fill="none"
                    strokeLinecap="round"
                    className={status.color}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-5xl font-black tracking-tight"
                  >
                    {formatScore(score)}
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1"
                  >
                    out of 100
                  </motion.span>
                </div>
                <div className={cn("absolute -inset-4 rounded-full opacity-20 blur-2xl -z-10 animate-pulse", status.bg)} />
              </motion.div>

              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {isAggregate ? "Band of average" : "Intervention Priority"}
                  </p>
                  <Badge className={cn("rounded-full font-black text-[10px] uppercase text-white", status.bg)}>
                    {status.label}
                  </Badge>
                </div>
                <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {isAggregate ? "Assessed schools" : "Months to intervention"}
                  </p>
                  <p className="text-sm font-black text-primary leading-tight">
                    {isAggregate
                      ? formatNumber(assessedCount ?? null)
                      : urgencyMonths != null
                        ? urgencyMonths === 0 ? "Now" : `${urgencyMonths} months`
                        : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Breakdown ──────────────────────────────────────────────── */}
            <div className="lg:w-3/5 p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {metrics.map((metric, index) => {
                  const safeScore = metric.score;
                  const hasScore  = safeScore != null && !isNaN(safeScore);
                  const barStatus = hasScore && metric.unit !== 'percent' ? BAND_STYLE[bandOf(safeScore)] : hasScore ? { bg: 'bg-primary' } : null;
                  const display = !hasScore
                    ? (metric.emptyText ?? "—")
                    : metric.unit === 'percent'
                      ? formatPercent(safeScore)
                      : formatScore(safeScore);

                  return (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index + 0.3 }}
                      className="p-3 rounded-2xl bg-muted/30 border border-border/5 transition-all group cursor-default"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-background dark:bg-blue-900/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <metric.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="flex-1 min-w-0 text-xs font-bold text-muted-foreground dark:text-white/80 group-hover:text-foreground transition-colors uppercase tracking-tight">
                          {metric.label}
                        </span>
                        {metric.metricId && <MetricInfo id={metric.metricId} size="xs" />}
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <span className={cn("font-black leading-none", hasScore ? "text-lg" : "text-xs text-muted-foreground")}>
                          {display}
                        </span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: hasScore ? `${Math.min(100, Math.max(0, safeScore))}%` : "0%" }}
                            transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                            className={cn(
                              "h-full rounded-full",
                              barStatus ? barStatus.bg : "bg-muted-foreground/20",
                            )}
                          />
                        </div>
                      </div>
                      {metric.estimatedNote && (
                        <DataGapBadge metricId={metric.metricId} text={metric.estimatedNote} className="mt-2" />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {isAggregate && (
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                  <h4 className="text-[10px] font-black text-primary flex items-center gap-2 uppercase tracking-widest mb-2">
                    <Sparkles className="w-3 h-3" />
                    How this is calculated
                  </h4>
                  <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                    The average School Condition Score of every scored active
                    school you can see. Each school's score combines
                    Infrastructure 35%, Building Age Score 25%, Facility
                    Compliance 15%, Accessibility 10%, Population Pressure 10%
                    and Resolution Rate 5%. Higher is better.
                  </p>
                </div>
              )}
            </div>
          </div>

          {children && (
            <div className="p-6 pt-0 border-t border-border/10 dark:border-blue-700/20">
              {children}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
