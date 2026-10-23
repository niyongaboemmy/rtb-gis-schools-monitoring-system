import { ArrowRight, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { INSET } from "../ui/surfaces";
import { fieldLabel } from "./auditLabels";

function renderValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const VALUE =
  "max-h-48 min-w-0 overflow-auto whitespace-pre-wrap break-all rounded-xl px-2.5 py-1.5 font-mono text-xs ring-1 ring-inset";

export interface DiffViewerProps {
  changes: Record<string, [unknown, unknown]> | null | undefined;
}

/** Field-level "before → after" list for an audit row (WS11.4 / WS11.8). */
export function DiffViewer({ changes }: DiffViewerProps) {
  const entries = Object.entries(changes ?? {});
  if (entries.length === 0) {
    return (
      <p className={cn("rounded-2xl px-3 py-3 text-sm text-muted-foreground", INSET)}>
        No field-level changes were recorded for this action.
      </p>
    );
  }
  return (
    <dl className={cn("divide-y divide-border/40 overflow-hidden rounded-2xl", INSET)}>
      {entries.map(([field, pair]) => {
        const [before, after] = Array.isArray(pair) ? pair : [null, pair];
        const masked = before === "[REDACTED]" || after === "[REDACTED]";
        return (
          <div key={field} className="space-y-2 p-3 sm:p-3.5" data-testid="diff-row">
            <dt className="text-xs font-normal text-foreground">{fieldLabel(field)}</dt>
            {masked ? (
              <dd className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Changed (value hidden for security)</span>
              </dd>
            ) : (
              <dd className="grid grid-cols-1 items-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
                <span className="sr-only">Before:</span>
                <pre className={cn(VALUE, "bg-destructive/[0.08] text-destructive ring-destructive/15")}>
                  {renderValue(before)}
                </pre>
                <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-muted-foreground sm:mt-1.5 sm:rotate-0" aria-hidden="true" />
                <span className="sr-only">After:</span>
                <pre className={cn(VALUE, "bg-success/[0.08] text-success ring-success/15")}>{renderValue(after)}</pre>
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
