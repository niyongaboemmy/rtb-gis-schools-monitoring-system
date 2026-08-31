import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useCountUp } from "../../lib/dashboard-utils";

export function Sparkline({
  data,
  color,
  className,
}: {
  data: number[];
  color: string;
  className?: string;
}) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => `${i * step},${h - (d / max) * (h - 3) - 1.5}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${w},${h} L 0,${h} Z`;
  const id = `spk-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("w-full h-7", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  decimals?: number;
  suffix?: string;
  hint?: string;
  delta?: number | null;
  spark?: number[];
  sparkColor?: string;
  tone?: string;
  toneBg?: string;
  active?: boolean;
  onClick?: () => void;
  delay?: number;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix = "",
  hint,
  delta,
  spark,
  sparkColor = "#3b82f6",
  tone = "text-primary",
  toneBg = "bg-primary/10",
  active,
  onClick,
  delay = 0,
}: MetricCardProps) {
  const numeric = typeof value === "number";
  const animated = useCountUp(numeric ? (value as number) : 0);
  const display = numeric ? animated.toFixed(decimals) : (value as string);

  const deltaUp = delta != null && delta > 0;
  const deltaDown = delta != null && delta < 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={onClick ? { y: -3 } : undefined}
      className={cn(
        "group relative text-left rounded-3xl border bg-card/60 backdrop-blur-xl p-4 overflow-hidden transition-colors",
        onClick && "cursor-pointer hover:border-primary/40",
        active ? "border-primary/50 ring-2 ring-primary/20" : "border-border/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
          {label}
        </span>
        <span
          className={cn(
            "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
            toneBg,
            tone,
          )}
        >
          <Icon className="w-4 h-4" />
        </span>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <span className="text-[26px] leading-none font-black tabular-nums tracking-tight">
          {display}
          {suffix && (
            <span className="text-base font-bold text-muted-foreground ml-0.5">
              {suffix}
            </span>
          )}
        </span>
        {delta != null && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-black tabular-nums",
              deltaUp && "bg-emerald-500/12 text-emerald-500",
              deltaDown && "bg-rose-500/12 text-rose-500",
              !deltaUp && !deltaDown && "bg-muted text-muted-foreground",
            )}
          >
            {deltaUp ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : deltaDown ? (
              <TrendingDown className="w-2.5 h-2.5" />
            ) : (
              <Minus className="w-2.5 h-2.5" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      {hint && (
        <p className="mt-1 text-[10px] font-semibold text-muted-foreground/70">
          {hint}
        </p>
      )}

      {spark && spark.length > 1 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={spark} color={sparkColor} />
        </div>
      )}
    </motion.button>
  );
}
