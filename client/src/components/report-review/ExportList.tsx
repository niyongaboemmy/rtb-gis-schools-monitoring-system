import { Check, Download, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ExportItem {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  format: string;
  run: () => Promise<void>;
}

/** The data downloads, one row each (inside the Export dialog). */
export function ExportList({ items, busy, done, onRun }: { items: ExportItem[]; busy: string | null; done: string | null; onRun: (item: ExportItem) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-3.5 rounded-2xl p-3.5 ring-1 ring-slate-900/6 dark:ring-white/8">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-blue-300" aria-hidden>
            <it.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{it.title}</p>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-white/55">{it.description}</p>
          </div>
          <button
            type="button"
            onClick={() => onRun(it)}
            disabled={busy != null}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60",
              done === it.key
                ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300"
                : "bg-slate-900/5 text-slate-800 hover:bg-slate-900/10 dark:bg-white/8 dark:text-white/85 dark:hover:bg-white/12",
            )}
          >
            {busy === it.key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : done === it.key ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            {busy === it.key ? "Preparing…" : done === it.key ? "Downloaded" : it.format}
          </button>
        </li>
      ))}
    </ul>
  );
}
