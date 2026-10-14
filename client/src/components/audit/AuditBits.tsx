import { CheckCircle2, Ban, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { outcomeLabel } from "./auditLabels";
import type { AuditLogRow } from "./auditApi";

/** Success / Failed / Denied pill. */
export function OutcomeBadge({ outcome, className }: { outcome: string | null | undefined; className?: string }) {
  const o = outcome ?? "success";
  const Icon = o === "success" ? CheckCircle2 : o === "denied" ? Ban : XCircle;
  return (
    <Badge
      variant={o === "success" ? "success" : o === "denied" ? "warning" : "destructive"}
      className={cn("gap-1 whitespace-nowrap text-[10px] px-2 py-0", className)}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {outcomeLabel(o)}
    </Badge>
  );
}

/** "jane@rtb.gov.rw · admin" with the IP in a native tooltip. */
export function ActorSummary({ row }: { row: AuditLogRow }) {
  const who = row.actorEmail ?? (row.actorId ? `User ${row.actorId.slice(0, 8)}` : "System / anonymous");
  return (
    <div className="min-w-0" title={row.ip ? `IP address: ${row.ip}` : undefined}>
      <div className="text-sm font-medium truncate">{who}</div>
      <div className="text-xs text-muted-foreground truncate">
        {row.actorRole ? row.actorRole.replace(/_/g, " ") : "—"}
        {row.ip ? <span className="ml-1 font-mono">· {row.ip}</span> : null}
      </div>
    </div>
  );
}
