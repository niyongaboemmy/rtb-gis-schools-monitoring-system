import { motion } from "framer-motion";
import { AlertTriangle, Wrench, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "../ui/badge";
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
  title = "Intelligence Suggestions",
}: RecommendationListProps) {
  const parseRecommendation = (
    rec: string | Recommendation,
  ): Recommendation => {
    if (typeof rec !== "string") return rec;

    const isUrgent = rec.includes("[URGENT]");
    const isCritical = rec.includes("[CRITICAL]");
    const isStrategic = rec.includes("[STRATEGIC]");
    const cleanRec = rec
      .replace("[URGENT]", "")
      .replace("[CRITICAL]", "")
      .replace("[STRATEGIC]", "")
      .trim();

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
          bg: "bg-red-500/5 border-red-500/20 shadow-red-500/5",
          iconBg: "bg-red-500 text-white shadow-lg shadow-red-500/30",
          icon: AlertTriangle,
          label: "Urgent Refactor",
          labelColor: "text-red-500",
          dot: "bg-red-500",
        };
      case "critical":
        return {
          bg: "bg-amber-500/5 border-amber-500/20 shadow-amber-500/5",
          iconBg: "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
          icon: Wrench,
          label: "Critical Need",
          labelColor: "text-amber-600",
          dot: "bg-amber-500",
        };
      case "strategic":
        return {
          bg: "bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5",
          iconBg: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
          icon: Sparkles,
          label: "Strategic Goal",
          labelColor: "text-emerald-600",
          dot: "bg-emerald-500",
        };
      default:
        return {
          bg: "bg-primary/5 border-primary/20 shadow-primary/5",
          iconBg: "bg-primary text-white shadow-lg shadow-primary/30",
          icon: CheckCircle2,
          label: "System Note",
          labelColor: "text-primary",
          dot: "bg-primary",
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className={cn("p-5 bg-card/40 rounded-3xl backdrop-blur-md", className)}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black text-primary flex items-center gap-2 uppercase tracking-[0.2em]">
          <Sparkles className="w-3.5 h-3.5" />
          {title}
        </h4>
        <Badge
          variant="outline"
          className="rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20"
        >
          Live Analysis
        </Badge>
      </div>
      <div className="space-y-3">
        {recommendations.map((item, i) => {
          const rec = parseRecommendation(item);
          const style = getTypeStyles(rec.type);
          const Icon = style.icon;

          return (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              key={i}
              className={cn(
                "flex items-start gap-4 p-3.5 rounded-2xl border transition-all hover:scale-[1.01]",
                style.bg,
              )}
            >
              <div className={cn("p-2 rounded-xl shrink-0", style.iconBg)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "text-[9px] font-black uppercase tracking-wider",
                      style.labelColor,
                    )}
                  >
                    {style.label}
                  </span>
                  <div className={cn("h-1 w-1 rounded-full", style.dot)} />
                </div>
                <p className="text-xs font-bold leading-relaxed text-foreground/90">
                  {rec.text}
                </p>
              </div>
            </motion.div>
          );
        })}
        {recommendations.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/20" />
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
              Calculations optimal
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
