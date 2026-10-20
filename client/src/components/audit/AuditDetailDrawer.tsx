import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { formatDateTime, formatRelative } from "../../lib/format";
import { actionLabel, targetTypeLabel } from "./auditLabels";
import { OutcomeBadge } from "./AuditBits";
import { DiffViewer } from "./DiffViewer";
import type { AuditLogRow } from "./auditApi";

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "text-sm break-words"}>{children || "—"}</dd>
    </div>
  );
}

export interface AuditDetailDrawerProps {
  row: AuditLogRow | null;
  onClose: () => void;
}

/**
 * Full details of one audit row: who / what / when / to whom, the field diff,
 * and the request correlation data. Right-hand drawer on desktop, bottom sheet
 * on phones.
 */
export function AuditDetailDrawer({ row, onClose }: AuditDetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Latest onClose without re-running the focus effect on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const isOpen = !!row;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!row) return null;

  const metaEntries = Object.entries(row.meta ?? {}).filter(
    ([k]) => !["method", "route", "status", "params"].includes(k),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-drawer-title"
        className="relative w-full sm:max-w-xl max-h-[90dvh] sm:max-h-none sm:h-full overflow-y-auto bg-background border-t sm:border-t-0 sm:border-l border-border rounded-t-3xl sm:rounded-none shadow-xl"
      >
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 id="audit-drawer-title" className="text-base font-semibold leading-tight">
              {actionLabel(row.action)}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <OutcomeBadge outcome={row.outcome} />
              <code className="font-mono">{row.action}</code>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-6">
          <section aria-label="Summary">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="By who">
                {row.actorEmail ?? "System / anonymous"}
                {row.actorRole ? (
                  <span className="block text-xs text-muted-foreground">{row.actorRole.replace(/_/g, " ")}</span>
                ) : null}
              </Field>
              <Field label="When">
                {formatDateTime(row.createdAt)}
                <span className="block text-xs text-muted-foreground">{formatRelative(row.createdAt)} · Kigali time</span>
              </Field>
              <Field label="To whom / what">
                {row.targetLabel ?? targetTypeLabel(row.targetType)}
                <span className="block text-xs text-muted-foreground">
                  {targetTypeLabel(row.targetType)}
                  {row.targetId ? <span className="font-mono"> · {row.targetId}</span> : null}
                </span>
              </Field>
              <Field label="Person affected" mono>
                {row.subjectUserId}
              </Field>
            </dl>
          </section>

          <section aria-labelledby="audit-changes-title" className="space-y-2">
            <h3 id="audit-changes-title" className="text-sm font-semibold">
              Changes
            </h3>
            <DiffViewer changes={row.changes} />
          </section>

          {metaEntries.length > 0 && (
            <section aria-labelledby="audit-meta-title" className="space-y-2">
              <h3 id="audit-meta-title" className="text-sm font-semibold">
                Details
              </h3>
              <dl className="grid grid-cols-1 gap-3">
                {metaEntries.map(([k, v]) => (
                  <Field key={k} label={k} mono={typeof v !== "string"}>
                    {typeof v === "string" ? v : JSON.stringify(v)}
                  </Field>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="audit-request-title" className="space-y-2">
            <h3 id="audit-request-title" className="text-sm font-semibold">
              Request
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="IP address" mono>
                {row.ip}
              </Field>
              <Field label="Request id" mono>
                {row.requestId}
              </Field>
              <Field label="Session id" mono>
                {row.sessionId}
              </Field>
              <Field label="Endpoint" mono>
                {row.meta?.method ? `${String(row.meta.method)} ${String(row.meta.route ?? "")}` : null}
                {row.meta?.status ? ` → ${String(row.meta.status)}` : null}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Browser / device" mono>
                  {row.userAgent}
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Record hash (tamper evidence)" mono>
                  {row.hash}
                </Field>
              </div>
            </dl>
          </section>
        </div>
      </aside>
    </div>
  );
}
