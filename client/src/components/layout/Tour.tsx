import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { useFocusTrap } from "./useFocusTrap";
import type { TourStep } from "./layout-utils";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const POPOVER_W = 320;

function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  // First one that is actually visible (e.g. the desktop vs mobile copy).
  return all.find((el) => el.getClientRects().length > 0 && el.offsetParent !== null) ?? null;
}

/**
 * Lightweight guided tour (WS3.7) — no dependency. Highlights the element
 * carrying `data-tour="<target>"` with a spotlight and shows a popover with
 * Back / Next / Skip. Keyboard: Esc closes, Tab stays inside the popover,
 * ←/→ move between steps. Steps whose target is not on screen are centred.
 */
export function Tour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const close = useCallback(() => {
    setIndex(0);
    onClose();
  }, [onClose]);
  useFocusTrap(popRef, open, close);

  const measure = useCallback(() => {
    const el = findTarget(step?.target);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step?.target]);

  useLayoutEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, steps.length]);

  if (!open || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POPOVER_W, vw - 24);
  let style: React.CSSProperties;
  if (rect) {
    const below = rect.top + rect.height + 12;
    const placeBelow = below + 200 < vh || rect.top < 220;
    const left = Math.min(Math.max(12, rect.left), vw - width - 12);
    style = placeBelow
      ? { top: Math.min(below, vh - 220), left, width }
      : { bottom: vh - rect.top + 12, left, width };
  } else {
    style = { top: "50%", left: "50%", width, transform: "translate(-50%, -50%)" };
  }

  const last = index === steps.length - 1;
  const titleId = "tour-step-title";
  const bodyId = "tour-step-body";

  return createPortal(
    <div className="fixed inset-0 z-[300]">
      {/* Spotlight: a transparent box with a huge shadow dims everything else. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
          style={{ ...rect, boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.55)" }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-slate-950/55" />
      )}
      <div className="fixed inset-0" aria-hidden="true" onClick={close} />
      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="fixed rounded-2xl border border-border bg-background p-4 shadow-2xl"
        style={style}
      >
        <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="mt-1 text-base font-semibold text-foreground">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? close() : setIndex((i) => i + 1))}
              className={cn(
                "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              {last ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

