import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon, Activity, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface MetricBreakdown {
  label: string;
  score: number;
  icon: LucideIcon;
}

interface IntelligenceScoreProps {
  score: number;
  urgencyMonths?: number;
  metrics: MetricBreakdown[];
  className?: string;
  isAggregate?: boolean;
  children?: ReactNode;
}

export function IntelligenceScore({
  score,
  urgencyMonths,
  metrics,
  className,
  isAggregate = false,
  children
}: IntelligenceScoreProps) {
  const getStatus = (s: number) => {
    if (s >= 70) return { label: 'Optimal', color: 'text-emerald-500', bg: 'bg-emerald-500', lightBg: 'bg-emerald-500/10' };
    if (s >= 50) return { label: 'Acceptable', color: 'text-amber-500', bg: 'bg-amber-500', lightBg: 'bg-amber-500/10' };
    return { label: 'Critical', color: 'text-red-500', bg: 'bg-red-500', lightBg: 'bg-red-500/10' };
  };

  const status = getStatus(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className={cn("col-span-1", className)}
    >
      <Card className="border border-border/20 dark:border-blue-700/30 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden shadow-none">
        <CardHeader className="border-b border-border/10 dark:border-blue-700/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {isAggregate ? "National Intelligence Score" : "Decision Intelligence Score"}
            </CardTitle>
            <Badge
              variant="outline"
              className="rounded-full bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-black px-3"
            >
              {isAggregate ? "System-wide Analysis" : "Dynamic Analysis"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/10 dark:divide-blue-700/30">
            {/* Hero Score Section */}
            <div className="lg:w-2/5 p-8 flex flex-col items-center justify-center bg-linear-to-br from-primary/5 via-transparent to-transparent">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 15, delay: 0.2 }}
                className="relative w-48 h-48"
              >
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted/10"
                  />
                  <motion.circle
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: score / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
                    cx="96"
                    cy="96"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
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
                    {Math.round(score)}
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1"
                  >
                    Overall Score
                  </motion.span>
                </div>

                <div className={cn("absolute -inset-4 rounded-full opacity-20 blur-2xl -z-10 animate-pulse", status.bg)} />
              </motion.div>

              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <Badge className={cn("rounded-full font-black text-[10px] uppercase", status.bg)}>
                    {status.label}
                  </Badge>
                </div>
                <div className="p-3 rounded-2xl bg-background/40 border border-border/10 text-center">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">
                    {isAggregate ? "Priority" : "Urgency"}
                  </p>
                  <p className="text-sm font-black text-primary uppercase leading-tight">
                    {isAggregate ? (score < 50 ? "High" : "Normal") : `${urgencyMonths} Months`}
                  </p>
                </div>
              </div>
            </div>

            {/* Breakdown Section */}
            <div className="lg:w-3/5 p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {metrics.map((metric, index) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index + 0.3 }}
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(var(--primary), 0.05)" }}
                    className="p-3 rounded-2xl bg-muted/30 border border-border/5 transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-background dark:bg-blue-900/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <metric.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground dark:text-white group-hover:text-foreground transition-colors uppercase tracking-tight">
                        {metric.label}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-lg font-black leading-none">
                        {Math.round(metric.score)}%
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metric.score}%` }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                          className={cn("h-full rounded-full", getStatus(metric.score).bg)}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {isAggregate && (
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                   <h4 className="text-[10px] font-black text-primary flex items-center gap-2 uppercase tracking-widest mb-2">
                    <Sparkles className="w-3 h-3" />
                    Strategic Overview
                  </h4>
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                    This score represents the weighted average of infrastructure, accessibility, and compliance metrics across all registered institutions.
                  </p>
                </div>
              )}
            </div>
          </div>
          {children && (
            <div className="p-6 pt-0 border-t border-border/10 dark:border-blue-700/30">
              {children}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
