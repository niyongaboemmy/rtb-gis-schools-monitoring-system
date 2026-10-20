import { useMemo } from "react";
import { History } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { hasPermission, Permission } from "../../lib/permissions";
import { ActivityFeed } from "./ActivityFeed";

/**
 * "Activity" section for a school page (WS11.8): changes to the school and to
 * records linked to it (buildings, uploads, annotations). Renders nothing for
 * users without VIEW_AUDIT_LOGS.
 */
export function SchoolActivitySection({ schoolId }: { schoolId: string }) {
  const user = useAuthStore((s) => s.user);
  const filters = useMemo(() => ({ schoolId }), [schoolId]);
  if (!schoolId || !hasPermission(user, Permission.VIEW_AUDIT_LOGS)) return null;
  return (
    <section
      aria-labelledby="school-activity-title"
      className="rounded-3xl border border-border/50 bg-card/60 p-4 sm:p-6 space-y-4"
    >
      <h2 id="school-activity-title" className="text-base font-semibold flex items-center gap-2">
        <History className="w-4 h-4 text-primary" aria-hidden="true" /> Activity
      </h2>
      <ActivityFeed
        filters={filters}
        emptyText="Edits to this school, its buildings and its map files will appear here."
      />
    </section>
  );
}
