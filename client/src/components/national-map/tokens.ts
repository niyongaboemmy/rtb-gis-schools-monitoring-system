import { useEffect, useState } from "react";
import { PRIORITY_META, scoreBand } from "../maps/schoolMap";
import type { Breakpoint } from "./types";

/** Borderless frosted surface shared by every floating map element. */
export const GLASS =
  "bg-white/60 shadow-float backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_6%)]/65 dark:backdrop-saturate-75";
/** Slightly more opaque, for content-dense cards (lists, details). */
export const GLASS_STRONG =
  "bg-white/75 shadow-float backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_6%)]/80 dark:backdrop-saturate-75";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const MUTED = "text-slate-500 dark:text-white/50";
export const STRONG = "text-slate-900 dark:text-white";

/** Colour for a score (or slate when unassessed). */
export const scoreColor = (score: number | null) =>
  score === null ? "#64748b" : PRIORITY_META[scoreBand(score)].color;

/** phone < 768 ≤ tablet < 1280 ≤ desktop. */
export function useBreakpoint(): Breakpoint {
  const read = (): Breakpoint =>
    typeof window === "undefined"
      ? "desktop"
      : window.innerWidth < 768
        ? "phone"
        : window.innerWidth < 1280
          ? "tablet"
          : "desktop";
  const [bp, setBp] = useState<Breakpoint>(read);
  useEffect(() => {
    const on = () => setBp(read());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return bp;
}

/** True when a key event comes from a text field (shortcuts must not fire). */
export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
};
