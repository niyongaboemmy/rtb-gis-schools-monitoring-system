import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

interface DistributionItem {
  label: string;
  total: number;
  critical?: number;
  high?: number;
  optimal?: number;
}

interface DistributionChartProps {
  title: string;
  items: DistributionItem[];
  className?: string;
}

export function DistributionChart({
  title,
  items,
  className
}: DistributionChartProps) {
  return (
    <Card className={cn("h-full border border-border/20 dark:border-blue-700/30 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden shadow-none", className)}>
      <CardHeader className="border-b border-border/20 dark:border-blue-700/30 pb-4">
        <CardTitle className="text-base font-black uppercase tracking-widest text-muted-foreground/80">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {items.map((item, idx) => {
            const criticalPct = (item.critical || 0) / item.total * 100;
            const highPct = (item.high || 0) / item.total * 100;
            const optimalPct = (item.optimal || (item.total - (item.critical || 0) - (item.high || 0))) / item.total * 100;

            return (
              <motion.div 
                key={item.label} 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-foreground/80 uppercase text-[11px] tracking-tight">{item.label}</span>
                  <span className="text-[10px] font-black uppercase text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/10">
                    {item.total} schools
                  </span>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-3 overflow-hidden flex border border-border/5">
                  {criticalPct > 0 && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${criticalPct}%` }}
                      transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                      className="bg-destructive h-full" 
                      title={`Critical: ${item.critical}`}
                    />
                  )}
                  {highPct > 0 && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${highPct}%` }}
                      transition={{ duration: 1, delay: 0.6 + idx * 0.1 }}
                      className="bg-amber-500 h-full border-l border-white/10" 
                      title={`High: ${item.high}`}
                    />
                  )}
                  {optimalPct > 0 && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${optimalPct}%` }}
                      transition={{ duration: 1, delay: 0.7 + idx * 0.1 }}
                      className="bg-emerald-500 h-full border-l border-white/10" 
                      title={`Optimal: ${item.total - (item.critical || 0) - (item.high || 0)}`}
                    />
                  )}
                </div>
                {/* Legend for individual item if needed */}
                <div className="flex gap-4 text-[9px] font-black uppercase tracking-tighter opacity-70">
                   <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      <span>{item.critical || 0} Critical</span>
                   </div>
                   <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{item.high || 0} High</span>
                   </div>
                   <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{item.total - (item.critical || 0) - (item.high || 0)} Optimal</span>
                   </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
