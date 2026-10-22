import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber } from "../../lib/format";

/** Page numbers with ellipses: 1 … 4 5 6 … 12. */
function pages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}

/** "1–10 of 34" and page buttons. Hidden when everything fits on one page. */
export function Pagination({ page, pageSize, total, onChange, label = "Pages" }: Props) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return total > 0 ? <p className="px-1 text-[11px] text-slate-500 dark:text-white/45">{formatNumber(total)} {total === 1 ? "report" : "reports"}</p> : null;
  }
  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40";
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2">
      <p className="px-1 text-[11px] tabular-nums text-slate-500 dark:text-white/45">
        {formatNumber((page - 1) * pageSize + 1)}–{formatNumber(Math.min(page * pageSize, total))} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={cn(btn, "text-slate-600 hover:bg-slate-900/5 dark:text-white/65 dark:hover:bg-white/8")} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        {pages(page, count).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-slate-400" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              aria-label={`Page ${p}`}
              onClick={() => onChange(p)}
              className={cn(btn, p === page ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-900/5 dark:text-white/65 dark:hover:bg-white/8")}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={cn(btn, "text-slate-600 hover:bg-slate-900/5 dark:text-white/65 dark:hover:bg-white/8")} disabled={page >= count} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
