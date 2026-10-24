/**
 * Help for both viewers (WS4.6), generated from the shared tool vocabulary so
 * names, icons, shortcuts and steps always match the toolbars.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Keyboard, Move, Sparkles, Wrench, X } from "lucide-react";
import { useAuthorization } from "../../hooks/useAuthorization";
import { cn } from "../../lib/utils";
import { EASE } from "../school-dashboard/tokens";
import { COMMON_SHORTCUTS, MEASUREMENT_ACCURACY, accuracyLabel, toolsFor, type ViewerKind } from "../../lib/viewer-tools";

interface ViewerHelpModalProps {
  setShowHelp: (val: boolean) => void;
  viewer?: ViewerKind;
}

type Row = { keys: string[]; desc: string };

const NAV_3D: Row[] = [
  { keys: ["Left drag"], desc: "Orbit" },
  { keys: ["Right drag"], desc: "Pan" },
  { keys: ["Scroll", "Pinch"], desc: "Zoom" },
  { keys: ["Double-click"], desc: "Focus on that spot" },
  { keys: ["W", "↑"], desc: "Fly forward" },
  { keys: ["S", "↓"], desc: "Fly backward" },
  { keys: ["A", "←"], desc: "Move left" },
  { keys: ["D", "→"], desc: "Move right" },
  { keys: ["E", "Space"], desc: "Fly up" },
  { keys: ["Q", "F"], desc: "Fly down" },
  { keys: ["Shift"], desc: "Move faster" },
];
const NAV_2D: Row[] = [
  { keys: ["Drag"], desc: "Move the map" },
  { keys: ["Scroll", "Pinch"], desc: "Zoom" },
  { keys: ["Click"], desc: "Open a building or feature" },
  { keys: ["?"], desc: "Open this help" },
];

type Tab = "move" | "tools" | "keys";

const Kbd = ({ k }: { k: string }) => (
  <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-white/70 px-2 font-sans text-[13px] text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/10 dark:text-white/80 dark:ring-white/12">{k}</kbd>
);

function Rows({ rows }: { rows: Row[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {rows.map((r, i) => (
        <motion.li
          key={r.desc}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-3.5 py-2.5 ring-1 ring-white/50 dark:bg-white/4 dark:ring-white/8"
        >
          <span className="text-[15px] text-slate-800 dark:text-white/85">{r.desc}</span>
          <span className="flex shrink-0 gap-1">{r.keys.map((k) => <Kbd key={k} k={k} />)}</span>
        </motion.li>
      ))}
    </ul>
  );
}

export const ViewerHelpModal: React.FC<ViewerHelpModalProps> = ({ setShowHelp, viewer = "3d" }) => {
  const reduce = useReducedMotion();
  const ids = useId();
  const { hasPermission } = useAuthorization();
  const tools = toolsFor(viewer, hasPermission).filter((t) => t.id !== "navigate");
  const [tab, setTab] = useState<Tab>("tools");
  const [toolId, setToolId] = useState<string | null>(null);
  const [accuracyOpen, setAccuracyOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tool = tools.find((t) => t.id === toolId) ?? tools[0];
  const close = () => setShowHelp(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowHelp(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setShowHelp]);

  const tabs: { key: Tab; label: string; icon: typeof Move }[] = [
    { key: "tools", label: "Tools", icon: Wrench },
    { key: "move", label: "Move", icon: Move },
    { key: "keys", label: "While measuring", icon: Keyboard },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={close} aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className={cn(
          "relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] sm:rounded-[1.75rem]",
          "bg-white/60 ring-1 ring-white/40 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10",
          "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] text-slate-900 dark:text-white",
        )}
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-slate-400/50 dark:bg-white/20" />
        </div>

        {/* Header */}
        <header className="flex items-center gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-blue-300" aria-hidden>
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${ids}-title`} className="text-lg font-medium">
              {viewer === "3d" ? "3D view" : "Map"} help
            </h2>
            <p className="text-xs text-slate-600 dark:text-white/55">Press ? any time to open this.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close help"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {/* Tabs */}
        <LayoutGroup id={`${ids}-tabs`}>
          <div role="tablist" aria-label="Help topics" className="mx-5 mb-4 flex rounded-full bg-white/50 p-1 ring-1 ring-white/60 sm:mx-6 dark:bg-white/6 dark:ring-white/10">
            {tabs.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    on ? "text-white" : "text-slate-700 hover:text-slate-900 dark:text-white/65 dark:hover:text-white",
                  )}
                >
                  {on && <motion.span layoutId="help-tab-thumb" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <t.icon className="relative h-4 w-4" aria-hidden />
                  <span className="relative truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar sm:px-6 sm:pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {tab === "tools" &&
                (tools.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-600 dark:text-white/55">No tools for your role here.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[13rem_1fr]">
                    {/* Tool list */}
                    <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0">
                      {tools.map((t) => {
                        const on = t.id === tool?.id;
                        return (
                          <li key={t.id} className="shrink-0">
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => setToolId(t.id)}
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                on ? "bg-primary text-white" : "text-slate-800 hover:bg-white/60 dark:text-white/80 dark:hover:bg-white/8",
                              )}
                            >
                              <t.icon className="h-4 w-4 shrink-0" aria-hidden />
                              <span className="flex-1 truncate">{t.label}</span>
                              {t.shortcut && <span className={cn("hidden text-[13px] sm:inline", on ? "text-white/70" : "text-slate-500 dark:text-white/40")}>{t.shortcut.toUpperCase()}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Steps for the chosen tool */}
                    {tool && (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={tool.id}
                          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.1 } }}
                          transition={{ duration: 0.25, ease: EASE }}
                          className="rounded-[1.5rem] bg-white/50 p-5 ring-1 ring-white/60 dark:bg-white/5 dark:ring-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-blue-300" aria-hidden>
                              <tool.icon className="h-5 w-5" />
                            </span>
                            <h3 className="flex-1 text-base font-medium">{tool.label}</h3>
                            {tool.shortcut && <Kbd k={tool.shortcut.toUpperCase()} />}
                          </div>
                          <ol className="mt-4 space-y-2.5">
                            {tool.steps.map((st, i) => (
                              <motion.li
                                key={st}
                                initial={reduce ? false : { opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25, delay: 0.05 + i * 0.06, ease: EASE }}
                                className="flex gap-3 text-[15px] leading-relaxed text-slate-800 dark:text-white/85"
                              >
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] text-white">{i + 1}</span>
                                {st}
                              </motion.li>
                            ))}
                          </ol>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                ))}

              {tab === "move" && <Rows rows={viewer === "3d" ? NAV_3D : NAV_2D} />}

              {tab === "keys" && (
                <div className="space-y-4">
                  <Rows rows={COMMON_SHORTCUTS} />
                  {/* Accuracy, folded away */}
                  <div className="rounded-2xl bg-white/40 ring-1 ring-white/50 dark:bg-white/4 dark:ring-white/8">
                    <button
                      type="button"
                      aria-expanded={accuracyOpen}
                      onClick={() => setAccuracyOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] text-slate-800 dark:text-white/85"
                    >
                      <span>
                        How exact are measurements? <span className="text-slate-500 dark:text-white/45">· map {accuracyLabel("2d")} · 3D {accuracyLabel("3d")}</span>
                      </span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", accuracyOpen && "rotate-180")} aria-hidden />
                    </button>
                    <AnimatePresence initial={false}>
                      {accuracyOpen && (
                        <motion.p
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: EASE }}
                          className="overflow-hidden px-4 pb-3 text-xs leading-relaxed text-slate-600 dark:text-white/60"
                        >
                          {MEASUREMENT_ACCURACY["3d"].provisional && `${MEASUREMENT_ACCURACY["3d"].note}. `}
                          Values show to 0.1 m on the map and 0.01 m in 3D. In 3D, areas show the flat plan area (same as the map) and the sloped surface area. Measurements are shared only if you can save site features; otherwise they show as “Not saved”.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default React.memo(ViewerHelpModal);
