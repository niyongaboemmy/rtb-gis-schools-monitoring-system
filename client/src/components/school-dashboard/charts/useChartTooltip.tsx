import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from "react";

/**
 * Hover tooltip for the small SVG charts: follows the pointer inside the chart
 * box, shows on hover and keyboard focus, never covers the mark under it.
 */
export function useChartTooltip() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);

  const place = useCallback((clientX: number, clientY: number, content: ReactNode) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    // Keep the centred bubble inside the box (cards clip their overflow).
    const edge = Math.min(90, r.width / 2);
    const x = Math.min(r.width - edge, Math.max(edge, clientX - r.left));
    setTip({ x, y: clientY - r.top, content });
  }, []);

  /** Spread onto a mark (or its larger hit area). */
  const bind = useCallback(
    (content: ReactNode) => ({
      onPointerMove: (e: PointerEvent) => place(e.clientX, e.clientY, content),
      onPointerLeave: () => setTip(null),
      onFocus: (e: React.FocusEvent<Element>) => {
        const b = e.currentTarget.getBoundingClientRect();
        place(b.left + b.width / 2, b.top, content);
      },
      onBlur: () => setTip(null),
    }),
    [place],
  );

  const tooltip = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[13px] font-medium text-white shadow-lg dark:bg-white dark:text-slate-900"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  ) : null;

  return { boxRef, bind, tooltip, hovered: tip != null };
}
