import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { AlertTriangle, Calculator, Check, Copy, Database, Filter, Info, LayoutDashboard, Ruler, X } from "lucide-react";
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
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 dark:text-white/50">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-slate-700 dark:text-white/80">{children}</div>
    </section>
  );
}

export function MetricDrawer({ id, open, onClose }: { id: MetricId; open: boolean; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{open && <DrawerPanel id={id} onClose={onClose} />}</AnimatePresence>, document.body);
}

function DrawerPanel({ id, onClose }: { id: MetricId; onClose: () => void }) {
  const metric = METRICS[id];
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useDragControls();
  const [copied, setCopied] = useState(false);
  // Phones: a bottom sheet you can drag away. Wider: a floating side panel.
  const [sheet] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches);

  useEffect(() => {
    closeRef.current?.focus();
    // Capture phase + stopPropagation: this drawer often opens on top of a
    // dialog, whose own Escape / Tab handling must not see these keys.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      e.stopPropagation();
      const nodes = panelRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
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
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const enter = reduce ? { opacity: 0 } : sheet ? { y: "100%" } : { x: "calc(100% + 1.5rem)" };

  return (
    <div className="fixed inset-0 z-[10050]" onClick={(e) => e.stopPropagation()}>
      <motion.div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm dark:bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        initial={enter}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={enter}
        transition={{ duration: reduce ? 0.15 : 0.38, ease: [0.22, 1, 0.36, 1] }}
        drag={sheet ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
        className={cn(
          "absolute flex flex-col overflow-hidden bg-white text-slate-900 ring-1 ring-slate-900/8 dark:bg-[hsl(224_40%_7%)] dark:text-white dark:ring-white/10",
          "shadow-[0_40px_120px_-30px_rgba(15,23,42,0.5)] dark:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]",
          // Phones: bottom sheet. sm+: a floating panel inset from the right edge.
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[1.75rem]",
          "sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[440px] sm:rounded-[1.75rem]",
        )}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="relative shrink-0 overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,rgb(37_99_235/0.10),transparent_60%)] dark:bg-[radial-gradient(120%_140%_at_0%_0%,rgb(59_130_246/0.18),transparent_60%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 mask-[radial-gradient(ellipse_60%_100%_at_100%_0%,black,transparent)] dark:opacity-40"
            style={{ backgroundImage: "radial-gradient(circle, rgb(100 116 139 / 0.3) 1px, transparent 1.3px)", backgroundSize: "18px 18px" }}
          />
          {sheet && (
            <div className="relative flex cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing" onPointerDown={(e) => drag.start(e)} aria-hidden>
              <span className="h-1.5 w-11 rounded-full bg-slate-900/15 dark:bg-white/20" />
            </div>
          )}
          <div className={cn("relative flex items-start gap-3.5 px-5 pb-5 sm:px-6", sheet ? "pt-2" : "pt-6")}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/15 dark:text-blue-300">
              <Info className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-white/45">What does this mean?</p>
              <h2 id={titleId} className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                {metric.title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900/5 text-slate-500 transition-colors hover:bg-slate-900/10 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/6 dark:text-white/60 dark:hover:bg-white/12 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div aria-hidden className="h-px bg-slate-900/6 dark:bg-white/8" />
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <p id={descId} className="text-[15px] leading-relaxed text-slate-800 dark:text-white/90">
            {metric.definition}
          </p>

          {/* The formula is the answer most people came for — give it a card */}
          <div className="rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-primary/15 dark:bg-primary/10 dark:ring-primary/20">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-primary dark:text-blue-300">
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              How it is calculated
            </h3>
            <p className="text-sm leading-relaxed text-slate-800 dark:text-white/85">{metric.formula}</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="rounded-2xl bg-slate-900/[0.035] p-3.5 ring-1 ring-slate-900/5 dark:bg-white/[0.045] dark:ring-white/8">
              <Section icon={Filter} title="Which schools count">
                {metric.filters}
              </Section>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-slate-900/[0.035] p-3.5 ring-1 ring-slate-900/5 dark:bg-white/[0.045] dark:ring-white/8">
                <Section icon={Ruler} title="Units">
                  <span className="font-medium text-slate-900 dark:text-white">{metric.units}</span>
                </Section>
              </div>
              <div className="rounded-2xl bg-slate-900/[0.035] p-3.5 ring-1 ring-slate-900/5 dark:bg-white/[0.045] dark:ring-white/8">
                <Section icon={LayoutDashboard} title="Shown on">
                  <ul className="space-y-0.5 text-[15px]">
                    {metric.shownOn.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Section>
              </div>
            </div>
          </div>

          <Section icon={Database} title="Data sources">
            <ul className="flex flex-wrap gap-1.5">
              {metric.sources.map((s) => (
                <li
                  key={s}
                  className="break-all rounded-lg bg-slate-900/5 px-2 py-1 font-mono text-[12px] text-slate-700 ring-1 ring-slate-900/5 dark:bg-white/6 dark:text-white/75 dark:ring-white/8"
                >
                  {s}
                </li>
              ))}
            </ul>
          </Section>

          <div className="relative overflow-hidden rounded-2xl bg-amber-500/[0.08] py-3.5 pl-4 pr-3.5 ring-1 ring-amber-500/20">
            <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-amber-500" aria-hidden />
            <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> When data is missing
            </h3>
            <p className="text-sm leading-relaxed text-slate-800 dark:text-white/85">{metric.missingData}</p>
          </div>

          {"notes" in metric && metric.notes && <p className="text-[15px] leading-relaxed text-slate-500 dark:text-white/55">{metric.notes}</p>}
        </div>

        {/* ── Footer: where the number comes from ─────────────────── */}
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-900/6 bg-slate-50/80 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-white/8 dark:bg-white/[0.02]">
          <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-500 dark:text-white/45" title={`${metric.endpoint} · ${id}`}>
            {metric.endpoint} · <span className="select-all">{id}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(id).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            aria-label={copied ? "Metric id copied" : "Copy metric id"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-900/6 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/50 dark:hover:bg-white/8"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
