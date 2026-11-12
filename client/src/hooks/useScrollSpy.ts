import { useEffect, useRef, useState } from "react";

/**
 * Which of `ids` the reader is on: the last element whose top has scrolled
 * past `offset` (the sticky header height; a function is read on every
 * update). With `snapToEnd`, reaching the bottom of the page selects the last
 * id, so short final sections still light up. Uses scroll events (rAF-throttled), not IntersectionObserver, so it
 * behaves the same for tall and short sections.
 */
export function useScrollSpy(ids: string[], { offset = 120, snapToEnd = false }: { offset?: number | (() => number); snapToEnd?: boolean } = {}): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  const line = useRef(offset);
  useEffect(() => {
    line.current = offset;
  });

  useEffect(() => {
    const list = key ? key.split("|") : [];
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      const o = line.current;
      const y = typeof o === "function" ? o() : o;
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - y <= 0) current = id;
      }
      const doc = document.documentElement;
      if (snapToEnd && list.length && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = list[list.length - 1];
      setActive(current ?? list[0] ?? null);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [key, snapToEnd]);

  return active;
}
