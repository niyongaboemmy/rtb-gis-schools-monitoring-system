import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Shorter label for phones (below `sm`). */
  short?: string;
  icon?: LucideIcon;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** Prefix for tab / panel ids: tabs get `${idPrefix}-tab-${id}`, panels `${idPrefix}-panel-${id}`. */
  idPrefix: string;
  label: string;
  className?: string;
}

/**
 * Underline tabs: plain text + small icons, the selected tab in foreground
 * with a thin primary indicator that slides between tabs. Scrolls sideways on
 * narrow screens. WAI-ARIA tabs pattern (←/→/Home/End).
 */
export function TabsBar<T extends string>({ tabs, active, onSelect, idPrefix, label, className }: Props<T>) {
  const reduce = useReducedMotion();
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  const select = (id: T, focus = false) => {
    onSelect(id);
    const el = refs.current[id];
    if (focus) el?.focus();
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    select(tabs[next].id, true);
  };

  return (
    <div className={cn("overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex min-w-max gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={cn(
                "group relative flex h-11 items-center gap-1.5 rounded-md px-2.5 text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon && (
                <tab.icon
                  aria-hidden
                  className={cn("h-3.5 w-3.5 shrink-0 transition-colors", selected ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")}
                />
              )}
              <span className="whitespace-nowrap">
                {tab.short ? (
                  <>
                    <span className="sm:hidden">{tab.short}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </>
                ) : (
                  tab.label
                )}
              </span>
              {selected && (
                <motion.span
                  layoutId={`${idPrefix}-tab-indicator`}
                  aria-hidden
                  className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
