import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "../../lib/utils";

export interface PaletteItem {
  id: string;
  label: string;
  group: string;
  hint?: string;
}

/** ⌘K / Ctrl+K or "/" search across sections, endpoints, recipes and errors. */
export function CommandPalette({ items, open, onClose, onPick }: { items: PaletteItem[]; open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => words.every((w) => `${i.label} ${i.group} ${i.hint ?? ""}`.toLowerCase().includes(w))).slice(0, 12);
  }, [items, q]);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const pick = (id: string) => {
    onPick(id);
    onClose();
    setQ("");
    setIndex(0);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-label="Search the developer guide"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, scale: 0.98 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border"
          >
            <label className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && results[index]) pick(results[index].id);
                }}
                placeholder="Search endpoints, recipes, errors…"
                aria-label="Search"
                className="h-12 w-full bg-transparent text-sm outline-none"
              />
              <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
            </label>
            <ul className="max-h-80 overflow-auto p-2" role="listbox">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
              {results.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => pick(r.id)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm", i === index ? "bg-primary/10 text-foreground" : "text-muted-foreground")}
                  >
                    <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{r.group}</span>
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {r.hint && <code className="hidden truncate font-mono text-[11px] text-muted-foreground sm:block">{r.hint}</code>}
                    {i === index && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
