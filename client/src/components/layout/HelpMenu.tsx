import { useRef, useState } from "react";
import { CircleHelp, Compass, Keyboard } from "lucide-react";
import { useFocusTrap } from "./useFocusTrap";

/** Header Help (?) menu: reopen the guided tour, keyboard tips (WS3.7). */
export function HelpMenu({ onStartTour }: { onStartTour: () => void }) {
  const [open, setOpen] = useState(false);
  const [tips, setTips] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, () => setOpen(false));

  return (
    <div className="relative" data-tour="help">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open help menu"
        className="flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            ref={ref}
            role="menu"
            aria-label="Help"
            className="absolute right-0 top-11 z-50 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-background p-1.5 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onStartTour();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:bg-accent"
            >
              <Compass className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Take the guided tour
            </button>
            <button
              type="button"
              role="menuitem"
              aria-expanded={tips}
              onClick={() => setTips((t) => !t)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:bg-accent"
            >
              <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Keyboard tips
            </button>
            {tips && (
              <ul className="mx-3 mb-2 mt-1 space-y-1 text-xs text-muted-foreground">
                <li><kbd className="font-mono">Tab</kbd> moves between controls; the first Tab offers "Skip to content".</li>
                <li><kbd className="font-mono">Esc</kbd> closes menus, dialogs and the mobile menu.</li>
                <li><kbd className="font-mono">↑ ↓ Enter</kbd> pick a school in the school switcher.</li>
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
