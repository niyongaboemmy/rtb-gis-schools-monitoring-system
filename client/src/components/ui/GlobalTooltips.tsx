import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * App-wide tooltips for icon-only controls.
 *
 * Any button / link / role="button" whose visible content is just an icon
 * gets a styled tooltip from its `aria-label` (or `title`, which is moved to
 * `aria-label` so the native tooltip doesn't double up and the accessible name
 * is kept). `data-tooltip="…"` forces one on any element, with or without
 * text; `data-tooltip="off"` opts out. Radix tooltip triggers are skipped.
 *
 * Shows after a short delay on mouse hover and instantly on keyboard focus;
 * moving between controls skips the delay. Touch input is ignored.
 */
const SHOW_DELAY = 350;
const SKIP_DELAY_WINDOW = 400;
const SELECTOR = 'button, a[href], [role="button"], [data-tooltip], summary';
const RADIX_TOOLTIP_STATES = new Set(["closed", "delayed-open", "instant-open"]);

interface Tip {
  text: string;
  rect: DOMRect;
}

function labelFor(el: HTMLElement): string | null {
  const forced = el.dataset.tooltip;
  if (forced === "off") return null;
  if (forced) return forced;
  if (RADIX_TOOLTIP_STATES.has(el.getAttribute("data-state") ?? "")) return null;

  // Icon-only: no visible text of its own.
  const text = (el.innerText ?? el.textContent ?? "").replace(/\s+/g, "");
  if (text.length > 0) return null;

  const title = el.getAttribute("title");
  if (title) {
    // Keep the accessible name, drop the native (unstyled, duplicate) tooltip.
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", title);
    el.removeAttribute("title");
  }
  return el.getAttribute("aria-label");
}

export function GlobalTooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const reduce = useReducedMotion();
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastHiddenAt = 0;

    const hide = () => {
      clearTimeout(timer);
      if (current) lastHiddenAt = Date.now();
      current = null;
      setTip(null);
    };

    const open = (el: HTMLElement, immediate: boolean) => {
      const text = labelFor(el);
      if (!text) return;
      clearTimeout(timer);
      current = el;
      const go = () => {
        if (current !== el || !el.isConnected) return;
        setTip({ text, rect: el.getBoundingClientRect() });
      };
      if (immediate || Date.now() - lastHiddenAt < SKIP_DELAY_WINDOW) go();
      else timer = setTimeout(go, SHOW_DELAY);
    };

    const target = (e: Event) => (e.target as HTMLElement | null)?.closest?.(SELECTOR) as HTMLElement | null;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = target(e);
      if (el === current) return;
      if (!el) return current && hide();
      if (current) hide();
      open(el, false);
    };
    const onOut = (e: PointerEvent) => {
      if (!current) return;
      const to = e.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = target(e);
      if (!el) return;
      // Only for keyboard focus, not focus caused by a click.
      if (!el.matches(":focus-visible")) return;
      open(el, true);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  // Place above the control (below if there's no room), clamped to the
  // viewport. Written straight to the node before paint — no extra render.
  useLayoutEffect(() => {
    const node = tipRef.current;
    if (!tip || !node) return;
    const { width, height } = node.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    const below = tip.rect.top - height - gap < margin;
    const y = below ? tip.rect.bottom + gap : tip.rect.top - height - gap;
    const x = Math.min(
      Math.max(tip.rect.left + tip.rect.width / 2 - width / 2, margin),
      window.innerWidth - width - margin,
    );
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.transformOrigin = below ? "top center" : "bottom center";
  }, [tip]);

  return createPortal(
    <AnimatePresence>
      {tip && (
        <motion.div
          key={tip.text + tip.rect.left + tip.rect.top}
          ref={tipRef}
          role="tooltip"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          style={{ left: -9999, top: -9999 }}
          className="pointer-events-none fixed z-10001 w-max max-w-64 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg shadow-black/20 dark:bg-slate-700 dark:ring-1 dark:ring-white/10"
        >
          {tip.text}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
