import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, Fingerprint, Target, User, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDateTime, formatRelative } from "../../lib/format";
import { titleCase } from "../../lib/labels";
import { EASE_OUT, INSET } from "../ui/surfaces";
import { FactRow, IconTile } from "../settings/settings-ui";
import { actionLabel, targetTypeLabel } from "./auditLabels";
import { OutcomeBadge } from "./AuditBits";
import { DiffViewer } from "./DiffViewer";
import type { AuditLogRow } from "./auditApi";

/** Stacked label / value for long technical values (ids, hashes, user agents). */
function TechFact({ label, children, mono = true, className }: { label: string; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl px-3 py-2.5", INSET, className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-foreground", mono ? "break-all font-mono text-xs" : "break-words text-sm")}>
        {children || "—"}
      </dd>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-sm font-semibold text-foreground">
      {children}
    </h3>
  );
}

export interface AuditDetailDrawerProps {
  row: AuditLogRow | null;
  onClose: () => void;
}

/**
 * Full details of one audit row: who / what / when / to whom, the field diff,
 * and the request correlation data. Right-hand floating sheet on desktop,
 * bottom sheet on phones.
 */
export function AuditDetailDrawer({ row, onClose }: AuditDetailDrawerProps) {
  const reduce = useReducedMotion();
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
  const endpoint = row.meta?.method
    ? `${String(row.meta.method)} ${String(row.meta.route ?? "")}${row.meta?.status ? ` → ${String(row.meta.status)}` : ""}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-drawer-title"
        initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-popover text-popover-foreground shadow-float ring-1 ring-border/50",
          "sm:m-3 sm:max-h-none sm:max-w-xl sm:rounded-[1.75rem]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/40 px-4 py-4 min-[400px]:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={Fingerprint} tone="primary" />
            <div className="min-w-0 space-y-1">
              <h2 id="audit-drawer-title" className="text-base font-semibold leading-tight tracking-tight">
                {actionLabel(row.action)}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
                <OutcomeBadge outcome={row.outcome} />
                <span>{formatRelative(row.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 min-[400px]:px-5">
          <section aria-label="Summary" className="space-y-2">
            <FactRow label="By who" icon={User}>
              <span className="block break-words">{row.actorEmail ?? "System / anonymous"}</span>
              {row.actorRole ? (
                <span className="block text-xs font-normal text-muted-foreground">{titleCase(row.actorRole)}</span>
              ) : null}
            </FactRow>
            <FactRow label="When" icon={Clock}>
              <span className="block">{formatDateTime(row.createdAt)}</span>
              <span className="block text-xs font-normal text-muted-foreground">Kigali time</span>
            </FactRow>
            <FactRow label="To whom / what" icon={Target}>
              <span className="block break-words">{row.targetLabel ?? targetTypeLabel(row.targetType)}</span>
              <span className="block text-xs font-normal text-muted-foreground">{targetTypeLabel(row.targetType)}</span>
            </FactRow>
            {(row.targetId || row.subjectUserId) && (
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {row.targetId && <TechFact label="Target id">{row.targetId}</TechFact>}
                {row.subjectUserId && <TechFact label="Person affected">{row.subjectUserId}</TechFact>}
              </dl>
            )}
          </section>

          <section aria-labelledby="audit-changes-title" className="space-y-2">
            <SectionTitle id="audit-changes-title">Changes</SectionTitle>
            <DiffViewer changes={row.changes} />
          </section>

          {metaEntries.length > 0 && (
            <section aria-labelledby="audit-meta-title" className="space-y-2">
              <SectionTitle id="audit-meta-title">Details</SectionTitle>
              <dl className="grid grid-cols-1 gap-2">
                {metaEntries.map(([k, v]) => (
                  <TechFact key={k} label={titleCase(k)} mono={typeof v !== "string"}>
                    {typeof v === "string" ? v : JSON.stringify(v)}
                  </TechFact>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="audit-request-title" className="space-y-2">
            <SectionTitle id="audit-request-title">Request</SectionTitle>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <TechFact label="IP address">{row.ip}</TechFact>
              <TechFact label="Request id">{row.requestId}</TechFact>
              <TechFact label="Session id">{row.sessionId}</TechFact>
              <TechFact label="Endpoint">{endpoint}</TechFact>
              <TechFact label="Action code" className="sm:col-span-2">
                {row.action}
              </TechFact>
              <TechFact label="Browser / device" className="sm:col-span-2">
                {row.userAgent}
              </TechFact>
              <TechFact label="Record hash (tamper evidence)" className="sm:col-span-2">
                {row.hash}
              </TechFact>
            </dl>
          </section>
        </div>
      </motion.aside>
    </div>
  );
}
