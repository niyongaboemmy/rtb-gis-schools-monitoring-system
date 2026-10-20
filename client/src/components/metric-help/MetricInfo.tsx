import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Calculator, Database, Info, Filter, Ruler, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { METRICS, type MetricId } from "./metrics";

/**
 * "What does this mean?" button (WS3.5). Opens a side drawer (bottom sheet on
 * small screens) with the metric's definition, formula, sources and
 * missing-data behaviour from the shared registry.
 */
export function MetricInfo({
  id,
  className,
  size = "sm",
  label,
}: {
  id: MetricId;
  className?: string;
  size?: "xs" | "sm";
  /** Override the accessible label (defaults to "What does <title> mean?"). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const metric = METRICS[id];
  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger once the drawer has gone.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={label ?? `What does “${metric.title}” mean?`}
        aria-haspopup="dialog"
        title="What does this mean?"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors",
          "hover:text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          size === "xs" ? "h-5 w-5" : "h-6 w-6",
          className,
        )}
      >
        <Info className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      </button>
      <MetricDrawer id={id} open={open} onClose={close} />
    </>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

export function MetricDrawer({ id, open, onClose }: { id: MetricId; open: boolean; onClose: () => void }) {
  const metric = METRICS[id];
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep focus inside the drawer.
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10050]" onClick={(e) => e.stopPropagation()}>
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute flex flex-col bg-background text-foreground shadow-2xl border-border/40",
              // Mobile: bottom sheet. sm+: right-hand drawer.
              "inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl border-t",
              "sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-3xl sm:border-l sm:border-t-0",
            )}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted sm:hidden" aria-hidden="true" />
            <header className="flex items-start justify-between gap-3 border-b border-border/30 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">What does this mean?</p>
                <h2 id={titleId} className="mt-0.5 text-lg font-semibold leading-tight">
                  {metric.title}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <p className="text-[15px] leading-relaxed">{metric.definition}</p>
              <Section icon={Calculator} title="How it is calculated">
                {metric.formula}
              </Section>
              <Section icon={Filter} title="Which schools count">
                {metric.filters}
              </Section>
              <Section icon={Ruler} title="Units">
                {metric.units}
              </Section>
              <Section icon={Database} title="Data sources">
                <ul className="list-disc space-y-0.5 pl-5">
                  {metric.sources.map((s) => (
                    <li key={s} className="break-words font-mono text-[12px]">
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <h3 className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> When data is missing
                </h3>
                <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100/90">{metric.missingData}</p>
              </div>
              {"notes" in metric && metric.notes && (
                <p className="text-[13px] leading-relaxed text-muted-foreground">{metric.notes}</p>
              )}
              <p className="break-words border-t border-border/30 pt-3 font-mono text-[11px] text-muted-foreground">
                Source: {metric.endpoint} · id <span className="select-all">{id}</span>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
