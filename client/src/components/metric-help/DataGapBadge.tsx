import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { MetricInfo } from "./MetricInfo";
import type { MetricId } from "./metrics";

/**
 * "Estimated — missing data" marker (WS1.7). Shown next to any value where
 * the server substituted the neutral 50, so it is never read as measured.
 */
export function DataGapBadge({
  metricId,
  className,
  compact = false,
  text = "Estimated — missing data",
}: {
  metricId?: MetricId;
  className?: string;
  /** Icon-only on very tight layouts; the text stays available to screen readers. */
  compact?: boolean;
  text?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className={compact ? "sr-only" : undefined}>{text}</span>
      {metricId && <MetricInfo id={metricId} size="xs" className="-my-1 -mr-1 text-amber-700/80 dark:text-amber-300/80" label={`Why is this estimated?`} />}
    </span>
  );
}
