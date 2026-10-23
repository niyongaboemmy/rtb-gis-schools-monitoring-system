import { StatusPill } from "../ui/status-pill";
import type { Tone } from "../ui/surfaces";
import { titleCase } from "../../lib/labels";
import { outcomeLabel } from "./auditLabels";
import type { AuditLogRow } from "./auditApi";

const OUTCOME_TONE: Record<string, Tone> = {
  success: "good",
  failure: "danger",
  // Amber, not red: a refused permission reads differently from a failed action.
  denied: "warn",
};

/** Success / Failed / Denied status pill (theme status tokens only). */
export function OutcomeBadge({ outcome, className }: { outcome: string | null | undefined; className?: string }) {
  const o = outcome ?? "success";
  return (
    <StatusPill tone={OUTCOME_TONE[o] ?? "neutral"} className={className}>
      {outcomeLabel(o)}
    </StatusPill>
  );
}

/** Display name for whoever performed the action. */
function actorName(row: Pick<AuditLogRow, "actorEmail" | "actorId">): string {
  return row.actorEmail ?? (row.actorId ? `User ${row.actorId.slice(0, 8)}` : "System / anonymous");
}

/** Human role name ("gis_analyst" → "GIS Analyst"). */
function roleName(role: string | null | undefined): string {
  return role ? titleCase(role) : "No role";
}

/** "jane@rtb.gov.rw" over "GIS Analyst · 41.186.1.2", with the IP in a native tooltip. */
export function ActorSummary({ row }: { row: AuditLogRow }) {
  return (
    <div className="min-w-0" title={row.ip ? `IP address: ${row.ip}` : undefined}>
      <div className="truncate text-sm font-normal text-foreground">{actorName(row)}</div>
      <div className="truncate text-xs text-muted-foreground">
        {roleName(row.actorRole)}
        {row.ip ? <span className="font-mono"> · {row.ip}</span> : null}
      </div>
    </div>
  );
}
