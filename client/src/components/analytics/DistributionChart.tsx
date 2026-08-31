import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

interface DistributionItem {
  label: string;
  total: number;
  critical?: number;
  high?: number;
  optimal?: number;
  avgScore?: number;
}

interface DistributionChartProps {
  title: string;
  items: DistributionItem[];
  className?: string;
  /** If provided, each row becomes a clickable drill-down trigger */
  onItemClick?: (label: string) => void;
  /** Label of the currently active/selected item (renders with a highlight ring) */
  selectedLabel?: string | null;
}

export function DistributionChart({
  title,
  items,
  className,
  onItemClick,
  selectedLabel,
}: DistributionChartProps) {
  return (
    <Card
      className={cn(
        'h-full border border-border/20 dark:border-blue-700/20 bg-card/60 backdrop-blur-sm rounded-3xl overflow-hidden shadow-none',
        className,
      )}
    >
      <CardHeader className="border-b border-border/20 dark:border-blue-700/20 pb-4">
        <CardTitle className="text-base font-black uppercase tracking-widest text-muted-foreground/80">
          {title}
        </CardTitle>
        {onItemClick && (
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mt-0.5">
            Click a row to drill down
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {items.map((item, idx) => {
            const safetotal  = Math.max(item.total, 1);
            const critical   = item.critical  ?? 0;
            const high       = item.high       ?? 0;
            const remaining  = Math.max(0, item.total - critical - high);
            const critPct    = (critical  / safetotal) * 100;
            const highPct    = (high      / safetotal) * 100;
            const optPct     = (remaining / safetotal) * 100;
            const isSelected = selectedLabel === item.label;
            const isClickable = !!onItemClick;

            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * idx }}
                onClick={isClickable ? () => onItemClick(item.label) : undefined}
                className={cn(
                  'space-y-3 rounded-2xl p-2 -mx-2 transition-all duration-200',
                  isClickable && 'cursor-pointer hover:bg-muted/30',
                  isSelected && 'ring-2 ring-primary/30 bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-foreground/80 uppercase text-[11px] tracking-tight flex items-center gap-2">
                    {item.label}
                    {isClickable && (
                      <span className="text-[8px] text-muted-foreground/40 normal-case font-normal tracking-normal">
                        {isSelected ? '▾ selected' : '›'}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.avgScore != null && (
                      <span className="text-[9px] font-black text-primary/70 tabular-nums">
                        avg {item.avgScore.toFixed(0)}
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/10">
                      {item.total} schools
                    </span>
                  </div>
                </div>

                <div className="w-full bg-muted/30 rounded-full h-3 overflow-hidden flex border border-border/5">
                  {critPct > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${critPct}%` }}
                      transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                      className="bg-destructive h-full"
                      title={`Critical: ${critical}`}
                    />
                  )}
                  {highPct > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${highPct}%` }}
                      transition={{ duration: 1, delay: 0.6 + idx * 0.1 }}
                      className="bg-amber-500 h-full border-l border-white/6"
                      title={`High: ${high}`}
                    />
                  )}
                  {optPct > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${optPct}%` }}
                      transition={{ duration: 1, delay: 0.7 + idx * 0.1 }}
                      className="bg-emerald-500 h-full border-l border-white/6"
                      title={`Optimal: ${remaining}`}
                    />
                  )}
                </div>

                <div className="flex gap-4 text-[9px] font-black uppercase tracking-tighter opacity-70">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    <span>{critical} Critical</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{high} High</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{remaining} Optimal</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {items.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4">
              No data available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
