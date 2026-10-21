import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatScore } from "../../lib/format";
import { label } from "../../lib/labels";

type Band = "critical" | "high" | "medium" | "low";
const bandOf = (s: number): Band => (s < 35 ? "critical" : s < 55 ? "high" : s < 75 ? "medium" : "low");
const BAND_HEX: Record<Band, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#10b981" };

interface School {
  id: string;
  name: string;
  calculatedScore: number;
}

/** Quick ranking summary: overall score + band, best and lowest school. */
export function RankingQuickInfo({ score, top, bottom }: { score: number | null; top?: School; bottom?: School }) {
  const band = score != null ? bandOf(score) : null;
  const rows = [
    { tag: "Top", school: top, Icon: ArrowUpRight, tone: "#10b981" },
    { tag: "Lowest", school: bottom, Icon: ArrowDownRight, tone: "#ef4444" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-slate-500 dark:text-white/50">Overall score</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{formatScore(score)}</span>
          {band && (
            <span className="text-[11px] font-medium" style={{ color: BAND_HEX[band] }}>
              {label("priority", band)}
            </span>
          )}
        </span>
      </div>
      {rows.map(({ tag, school, Icon, tone }) =>
        school ? (
          <Link
            key={tag}
            to={`/schools/${school.id}/decision`}
            className="group -mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-900/4 dark:hover:bg-white/5"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: tone }} aria-hidden />
            <span className="w-11 shrink-0 text-[11px] text-slate-500 dark:text-white/45">{tag}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 group-hover:text-primary dark:text-white/85">
              {school.name}
            </span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: BAND_HEX[bandOf(school.calculatedScore)] }}>
              {formatScore(school.calculatedScore)}
            </span>
          </Link>
        ) : null,
      )}
    </div>
  );
}
