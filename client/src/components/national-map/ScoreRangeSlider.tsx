import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { PRIORITY_META } from "../maps/schoolMap";
import type { ScoreRange } from "./geo";
import { MUTED, STRONG } from "./tokens";

/** Band-coloured track: critical <35, high <55, medium <75, low ≥75. */
const TRACK = `linear-gradient(90deg, ${PRIORITY_META.critical.color} 0 35%, ${PRIORITY_META.high.color} 35% 55%, ${PRIORITY_META.medium.color} 55% 75%, ${PRIORITY_META.low.color} 75% 100%)`;

/**
 * Two-thumb School Condition Score filter. Moves are local while dragging
 * and committed (debounced) so the URL isn't rewritten on every pixel.
 */
export function ScoreRangeSlider({ value, onCommit }: { value: ScoreRange; onCommit: (r: ScoreRange) => void }) {
  const [local, setLocal] = useState<ScoreRange>(value);
  const [synced, setSynced] = useState<ScoreRange>(value);
  const timer = useRef<number | undefined>(undefined);

  // Adopt external changes (reset, back/forward) — derived-state pattern.
  if (synced[0] !== value[0] || synced[1] !== value[1]) {
    setSynced(value);
    setLocal(value);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const set = (next: ScoreRange) => {
    setLocal(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onCommit(next), 250);
  };

  const [lo, hi] = local;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={cn("text-xs", MUTED)}>Condition score</span>
        <span className={cn("text-xs tabular-nums", STRONG)}>
          {lo === 0 && hi === 100 ? "Any" : `${lo} – ${hi}`}
        </span>
      </div>
      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-[9px] top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-20" style={{ background: TRACK }} />
        <div
          className="absolute inset-x-[9px] top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ background: TRACK, clipPath: `inset(0 ${100 - hi}% 0 ${lo}% round 9999px)` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={lo}
          aria-label="Minimum condition score"
          onChange={(e) => set([Math.min(Number(e.target.value), hi), hi])}
          className="nm-range"
          style={{ zIndex: lo > 90 ? 2 : 1 }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={hi}
          aria-label="Maximum condition score"
          onChange={(e) => set([lo, Math.max(Number(e.target.value), lo)])}
          className="nm-range"
          style={{ zIndex: 1 }}
        />
      </div>
      <div className={cn("relative mx-[9px] mt-1 h-3 text-[10px] tabular-nums", MUTED)} aria-hidden>
        {[0, 35, 55, 75, 100].map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t}%` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
