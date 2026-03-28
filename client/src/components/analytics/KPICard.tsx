import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

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
  className
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
        "h-full transition-all duration-300 border dark:border-blue-700/30 rounded-3xl backdrop-blur-sm shadow-none overflow-hidden group",
        style.border,
        style.bg
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
            {title}
          </CardTitle>
          <div className={cn("p-2 rounded-xl bg-background/50 border border-border/10 shadow-sm transition-transform group-hover:scale-110", style.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn("text-3xl font-black tabular-nums tracking-tight", style.value)}>
            {value}
          </div>
          {subValue && (
            <p className={cn("text-[10px] font-bold mt-1 flex items-center gap-1", subColor || "text-muted-foreground")}>
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
