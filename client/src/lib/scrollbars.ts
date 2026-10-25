/**
 * Overlay-style scrollbars: animates the `--sb-a` visibility the scrollbar
 * styles read (styles/scrollbars.css).
 *
 *   pointer over a scroll area → faint (HOVER)
 *   scrolling                  → full  (ACTIVE), fades out after IDLE_MS
 *
 * One capture-phase `scroll` listener and one delegated `pointerover` cover
 * every scroll container in the app — no per-component wiring. Elements with
 * their own scrollbar config are skipped (same list as the CSS).
 */

const ACTIVE = 1;
const HOVER = 0.45;
const IDLE_MS = 900;
const FADE_IN_MS = 160;
const FADE_OUT_MS = 520;
const EASE_IN = "cubic-bezier(0.2, 0, 0, 1)";
const EASE_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";

const SKIP = ".no-scrollbar, .custom-scrollbar, .mp-list, [class*='scrollbar-width:none'], [class*='::-webkit-scrollbar']";

/** Per-scroller fade state. Tracked here rather than read back from the
 *  computed style: an animation created this frame is still pending and
 *  contributes nothing yet, so reading it back mid-burst returned the resting
 *  value and made the thumb flicker. */
interface Fade { anim: Animation; from: number; to: number; start: number; duration: number }
const fades = new WeakMap<Element, Fade>();
const restLevel = new WeakMap<Element, number>();
const idleTimers = new WeakMap<Element, number>();
let hovered: Element | null = null;
let reduceMotion = false;

/** The element's CSS value (0, or e.g. 0.38 for .sb-visible), read once before we animate it. */
function rest(el: Element): number {
  let v = restLevel.get(el);
  if (v === undefined) {
    v = Number.parseFloat(getComputedStyle(el).getPropertyValue("--sb-a")) || 0;
    restLevel.set(el, v);
  }
  return v;
}

/** Where the current fade is now (linear estimate of the eased curve — only used as a start point). */
function levelNow(el: Element): number {
  const f = fades.get(el);
  if (!f) return rest(el);
  const t = f.duration ? Math.min(1, Math.max(0, (performance.now() - f.start) / f.duration)) : 1;
  return f.from + (f.to - f.from) * t;
}

/** Animate --sb-a on `el` to `to`; `to === null` fades back to its resting value. */
function fade(el: Element, to: number | null) {
  const base = rest(el);
  const target = to ?? base;
  const prev = fades.get(el);
  if (prev && Math.abs(prev.to - target) < 0.01) return; // already heading there
  const from = levelNow(el);
  prev?.anim.cancel();
  if (Math.abs(from - target) < 0.01 && target === base) {
    fades.delete(el); // at rest: let the stylesheet value apply again
    return;
  }
  const falling = target < from;
  const duration = reduceMotion ? 0 : falling ? FADE_OUT_MS : FADE_IN_MS;
  const anim = el.animate([{ "--sb-a": String(from) }, { "--sb-a": String(target) }], {
    duration,
    easing: falling ? EASE_OUT : EASE_IN,
    fill: "forwards",
  });
  const state: Fade = { anim, from, to: target, start: performance.now(), duration };
  fades.set(el, state);
  if (target === base) {
    // Back at rest: drop the animation so the cascade owns the value again.
    anim.onfinish = () => {
      if (fades.get(el) === state) {
        anim.cancel();
        fades.delete(el);
      }
    };
  }
}

const overflowScrolls = (v: string) => v === "auto" || v === "scroll" || v === "overlay";

/** Nearest ancestor (or self) that actually scrolls and is ours to style. */
function scrollHost(start: Element | null): Element | null {
  for (let el = start, depth = 0; el && depth < 30; el = el.parentElement, depth++) {
    if (el === document.body || el === document.documentElement) break;
    const cs = getComputedStyle(el);
    const y = overflowScrolls(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const x = overflowScrolls(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (y || x) return el.matches(SKIP) ? null : el;
  }
  const root = document.scrollingElement;
  return root && root.scrollHeight > root.clientHeight + 1 ? root : null;
}

function onScroll(e: Event) {
  const target = e.target === document ? document.scrollingElement : (e.target as Element | null);
  if (!(target instanceof Element) || target.matches(SKIP)) return;
  fade(target, ACTIVE);
  window.clearTimeout(idleTimers.get(target));
  idleTimers.set(
    target,
    window.setTimeout(() => {
      idleTimers.delete(target);
      fade(target, target === hovered ? HOVER : null);
    }, IDLE_MS),
  );
}

function onPointerOver(e: PointerEvent) {
  if (e.pointerType === "touch") return; // touch devices draw their own overlay bars
  const host = scrollHost(e.target as Element | null);
  if (host === hovered) return;
  const left = hovered;
  hovered = host;
  // Leaving: fade out — unless it is mid-scroll; its idle timer will.
  if (left && !idleTimers.has(left)) fade(left, null);
  // Entering: faint, unless it is mid-scroll and already fully shown.
  if (host && !idleTimers.has(host)) fade(host, HOVER);
}

// `pointerleave` on the root fires only when the pointer leaves the page. (A
// `pointerout` with no relatedTarget also fires when content scrolls under a
// still pointer, which made the bar drop to 0 mid-scroll.)
function onPointerLeaveWindow() {
  if (!hovered) return;
  const left = hovered;
  hovered = null;
  fade(left, null);
}

let installed = false;

/** Call once at start-up. Safe to call again (no-op). */
export function installScrollbars() {
  if (installed || typeof window === "undefined" || typeof Element.prototype.animate !== "function") return;
  installed = true;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotion = mq.matches;
  mq.addEventListener?.("change", (ev) => { reduceMotion = ev.matches; });
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  document.addEventListener("pointerover", onPointerOver, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeaveWindow, { passive: true });
}
