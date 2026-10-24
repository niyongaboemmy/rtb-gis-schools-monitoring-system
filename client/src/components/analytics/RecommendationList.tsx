import { motion } from "framer-motion";
import { AlertTriangle, Wrench, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface Recommendation {
  text: string;
  type?: "urgent" | "critical" | "strategic" | "info";
}

interface RecommendationListProps {
  recommendations: (string | Recommendation)[];
  className?: string;
  title?: string;
}

export function RecommendationList({
  recommendations,
  className,
  title = "Recommendations",
}: RecommendationListProps) {
  const parseRecommendation = (
    rec: string | Recommendation,
  ): Recommendation => {
    if (typeof rec !== "string") return rec;

    const isUrgent = rec.includes("[URGENT]");
    const isCritical = rec.includes("[CRITICAL]");
    const isStrategic = rec.includes("[STRATEGIC]");
    // Strip any leading server tag such as [URGENT] or [INFO].
    const cleanRec = rec.replace(/^\s*\[[A-Z]+\]\s*/, "").trim();

    return {
      text: cleanRec,
      type: isUrgent
        ? "urgent"
        : isCritical
          ? "critical"
          : isStrategic
            ? "strategic"
            : "info",
    };
  };

  const getTypeStyles = (type: Recommendation["type"]) => {
    switch (type) {
      case "urgent":
        return {
          bg: "bg-red-500/5 border-red-500/20",
          iconBg: "bg-red-500/12 text-red-600 dark:text-red-400",
          chip: "bg-red-500/10 text-red-600 dark:text-red-400",
          icon: AlertTriangle,
          label: "Urgent",
          labelColor: "text-red-500",
          dot: "bg-red-500",
        };
      case "critical":
        return {
          bg: "bg-amber-500/5 border-amber-500/20",
          iconBg: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
          chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
          icon: Wrench,
          label: "Critical",
          labelColor: "text-amber-600",
          dot: "bg-amber-500",
        };
      case "strategic":
        return {
          bg: "bg-emerald-500/5 border-emerald-500/20",
          iconBg: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
          chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          icon: Sparkles,
          label: "Strategic",
          labelColor: "text-emerald-600",
          dot: "bg-emerald-500",
        };
      default:
        return {
          bg: "bg-primary/5 border-primary/20",
          iconBg: "bg-primary/12 text-primary",
          chip: "bg-primary/10 text-primary",
          icon: CheckCircle2,
          label: "Note",
          labelColor: "text-primary",
          dot: "bg-primary",
        };
    }
  };

  /** "Context — action" → headline = the action, meta = the context. */
  const split = (text: string) => {
    const [ctx, ...rest] = text.split(/\s+[—–-]\s+/);
    if (!rest.length) return { headline: text, meta: null as string | null };
    const action = rest.join(" — ").replace(/\.$/, "").replace(/ and /g, " & ");
    // Compact the context, e.g. "Northern Province has the lowest average score (54)" → "Northern Province · lowest avg 54".
    const meta = ctx
      .replace(/\s+has the (lowest|highest) average score\s*\((\d+)\)/i, " · $1 avg $2")
      .replace(/\s+Province\b/, "");
    return { headline: action.charAt(0).toUpperCase() + action.slice(1), meta };
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        {title}
        <span className="rounded-full bg-slate-900/5 px-1.5 text-[13px] font-medium tabular-nums text-slate-500 dark:bg-white/8 dark:text-white/55">
          {recommendations.length}
        </span>
      </h3>
      <ul className="grid gap-2">
        {recommendations.map((item, i) => {
          const rec = parseRecommendation(item);
          const style = getTypeStyles(rec.type);
          const Icon = style.icon;
          const { headline, meta } = split(rec.text);
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex items-center gap-3 rounded-2xl bg-slate-900/3 p-3 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-slate-900/5 dark:bg-white/4 dark:hover:bg-white/6"
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110", style.iconBg)}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={rec.text}>{headline}</p>
                <p className="truncate text-xs text-slate-500 dark:text-white/50">
                  <span className={cn("font-medium", style.labelColor)}>{style.label}</span>
                  {meta ? ` · ${meta}` : ""}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ul>
      {recommendations.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-white/50">Nothing flagged right now.</p>
      )}
    </div>
  );
}
