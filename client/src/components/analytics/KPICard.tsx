import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import { MetricInfo } from '../metric-help/MetricInfo';
import { DataGapBadge } from '../metric-help/DataGapBadge';
import type { MetricId } from '../metric-help/metrics';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subValue?: string;
  subColor?: string;
  trendIcon?: LucideIcon;
  variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info';
  delay?: number;
  className?: string;
  /** Metric-help registry id — adds the "What does this mean?" button. */
  metricId?: MetricId;
  /** True when the value relies on the neutral 50 for missing data. */
  estimated?: boolean;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  subValue,
  subColor,
  trendIcon: TrendIcon,
  variant = 'default',
  delay = 0,
  className,
  metricId,
  estimated = false,
}: KPICardProps) {
  const variantStyles = {
    default: {
      icon: 'text-muted-foreground',
      value: '',
      border: 'border-border/20',
      bg: 'bg-card/60'
    },
    destructive: {
      icon: 'text-destructive',
      value: 'text-destructive',
      border: 'border-destructive/20',
      bg: 'bg-destructive/5'
    },
    warning: {
      icon: 'text-amber-500',
      value: 'text-amber-600',
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/5'
    },
    success: {
      icon: 'text-emerald-500',
      value: 'text-emerald-600',
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-500/5'
    },
    info: {
      icon: 'text-primary',
      value: 'text-primary',
      border: 'border-primary/20',
      bg: 'bg-primary/5'
    }
  };

  const style = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className={cn("h-full", className)}
    >
      <Card className={cn(
        "relative h-full transition-all duration-300 border dark:border-blue-700/20 rounded-3xl backdrop-blur-sm shadow-none overflow-hidden group",
        style.border,
        style.bg
      )}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex min-w-0 items-center gap-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/80 transition-colors">
              {title}
            </CardTitle>
            {metricId && <MetricInfo id={metricId} size="xs" />}
          </div>
          <div className={cn("p-2 rounded-xl bg-background/50 border border-border/10 transition-transform group-hover:scale-110", style.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl sm:text-3xl font-black tabular-nums tracking-tight break-words", style.value)}>
            {value}
          </div>
          {estimated && <DataGapBadge metricId={metricId} className="mt-1.5" />}
          {subValue && (
            <p className={cn("text-[11px] font-semibold mt-1 flex items-center gap-1", subColor || "text-muted-foreground")}>
              {TrendIcon && <TrendIcon className="h-3 w-3" />}
              {subValue}
            </p>
          )}
        </CardContent>
        
        {/* Subtle background decoration */}
        <div className={cn(
          "absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 -z-10 group-hover:opacity-20 transition-opacity",
          variant === 'destructive' ? "bg-destructive" : variant === 'warning' ? "bg-amber-500" : variant === 'success' ? "bg-emerald-500" : "bg-primary"
        )} />
      </Card>
    </motion.div>
  );
}
