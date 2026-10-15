/**
 * Help for both viewers (WS4.6), generated from the shared tool vocabulary so
 * names, icons, shortcuts and steps always match the toolbars.
 */
import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useAuthorization } from "../../hooks/useAuthorization";
import {
  COMMON_SHORTCUTS,
  MEASUREMENT_ACCURACY,
  accuracyLabel,
  toolsFor,
  type ViewerKind,
} from "../../lib/viewer-tools";

interface ViewerHelpModalProps {
  setShowHelp: (val: boolean) => void;
  viewer?: ViewerKind;
}

const NAV_3D = [
  { keys: ["Left drag"], desc: "Orbit" },
  { keys: ["Right drag"], desc: "Pan" },
  { keys: ["Scroll", "Pinch"], desc: "Zoom" },
  { keys: ["Double-click"], desc: "Focus on that spot" },
  { keys: ["W", "↑"], desc: "Fly forward" },
  { keys: ["S", "↓"], desc: "Fly backward" },
  { keys: ["A", "←"], desc: "Strafe left" },
  { keys: ["D", "→"], desc: "Strafe right" },
  { keys: ["E", "Space"], desc: "Fly up" },
  { keys: ["Q", "F"], desc: "Fly down" },
  { keys: ["Shift"], desc: "Move faster" },
];
const NAV_2D = [
  { keys: ["Drag"], desc: "Move the map" },
  { keys: ["Scroll", "Pinch"], desc: "Zoom" },
  { keys: ["Click"], desc: "Select a building or feature" },
];

const Kbd: React.FC<{ k: string }> = ({ k }) => (
  <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:border-white/20 dark:bg-white/10">
    {k}
  </kbd>
);

export const ViewerHelpModal: React.FC<ViewerHelpModalProps> = ({ setShowHelp, viewer = "3d" }) => {
  const { hasPermission } = useAuthorization();
  const tools = toolsFor(viewer, hasPermission).filter((t) => t.id !== "navigate");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowHelp(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setShowHelp]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-2" onClick={() => setShowHelp(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-help-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#0f1117] dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 id="viewer-help-title" className="text-base font-bold">
            {viewer === "3d" ? "3D viewer" : "2D map"} — tools &amp; shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setShowHelp(false)}
            aria-label="Close help"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-white/60">Moving around</h3>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(viewer === "3d" ? NAV_3D : NAV_2D).map((r) => (
              <div key={r.desc} className="flex items-center gap-2 text-sm">
                <dt className="flex shrink-0 gap-1">{r.keys.map((k) => <Kbd key={k} k={k} />)}</dt>
                <dd className="text-slate-600 dark:text-white/70">{r.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        {tools.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-white/60">Tools</h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tools.map((t) => {
                const Icon = t.icon;
                return (
                  <li key={t.id} className="rounded-xl border border-slate-200 p-2 dark:border-white/10">
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 text-amber-500" aria-hidden />
                      {t.label}
                      {t.shortcut && <span className="ml-auto"><Kbd k={t.shortcut.toUpperCase()} /></span>}
                    </div>
                    <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-600 dark:text-white/70">
                      {t.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-white/60">While measuring</h3>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {COMMON_SHORTCUTS.map((r) => (
              <div key={r.desc} className="flex items-center gap-2 text-sm">
                <dt className="flex shrink-0 gap-1">{r.keys.map((k) => <Kbd key={k} k={k} />)}</dt>
                <dd className="text-slate-600 dark:text-white/70">{r.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="rounded-xl bg-slate-50 p-2 text-xs text-slate-600 dark:bg-white/5 dark:text-white/70">
          Accuracy: 2D map {accuracyLabel("2d")}, 3D model {accuracyLabel("3d")}.{" "}
          {MEASUREMENT_ACCURACY["3d"].provisional && `${MEASUREMENT_ACCURACY["3d"].note}. `}
          Values are shown to 0.1 m on the map and 0.01 m in 3D — no finer than the data supports.
          In 3D, areas show the <strong>plan area</strong> (flat, comparable with the map) and the sloped <strong>surface area</strong>.
          Measurements are saved for everyone only if you can save site features; otherwise they are marked “Not saved”.
        </p>
      </div>
    </div>
  );
};

export default React.memo(ViewerHelpModal);
