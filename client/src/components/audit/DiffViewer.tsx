import { ArrowRight } from "lucide-react";
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

export interface DiffViewerProps {
  changes: Record<string, [unknown, unknown]> | null | undefined;
}

/** Field-level "before → after" list for an audit row (WS11.4 / WS11.8). */
export function DiffViewer({ changes }: DiffViewerProps) {
  const entries = Object.entries(changes ?? {});
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No field-level changes were recorded for this action.
      </p>
    );
  }
  return (
    <dl className="divide-y divide-border/40 rounded-2xl border border-border/50 overflow-hidden">
      {entries.map(([field, pair]) => {
        const [before, after] = Array.isArray(pair) ? pair : [null, pair];
        const masked = before === "[REDACTED]" || after === "[REDACTED]";
        return (
          <div key={field} className="p-3 sm:p-4 space-y-2" data-testid="diff-row">
            <dt className="text-xs font-semibold text-foreground">{fieldLabel(field)}</dt>
            {masked ? (
              <dd className="text-xs text-muted-foreground italic">
                Changed (value hidden for security)
              </dd>
            ) : (
              <dd className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-start text-xs">
                <span className="sr-only">Before:</span>
                <pre className="whitespace-pre-wrap break-all rounded-lg bg-red-500/10 text-red-800 dark:text-red-300 px-2 py-1.5 font-mono max-h-48 overflow-auto">
                  {renderValue(before)}
                </pre>
                <ArrowRight
                  className="hidden sm:block w-4 h-4 mt-1.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="sr-only">After:</span>
                <pre className="whitespace-pre-wrap break-all rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2 py-1.5 font-mono max-h-48 overflow-auto">
                  {renderValue(after)}
                </pre>
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
