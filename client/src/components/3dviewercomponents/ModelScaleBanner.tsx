/** Non-blocking warning when the 3D model's scale disagrees with the KMZ (WS6.4). */
import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export const ModelScaleBanner: React.FC<{ warning: string; factor: number | null }> = ({ warning, factor }) => {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      role="status"
      className="pointer-events-auto absolute bottom-16 left-1/2 z-30 flex w-[calc(100vw-16px)] max-w-xl -translate-x-1/2 items-start gap-2 rounded-xl border border-primary/25 bg-white/95 px-3 py-2 text-xs text-slate-900 shadow-lg dark:bg-[hsl(224_40%_8%)]/95 dark:text-white"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">
        <strong>Model scale check: </strong>
        {warning}
        {factor != null && factor !== 1 && <> Measurements shown here already include the correction.</>}
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss scale warning"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ModelScaleBanner;
