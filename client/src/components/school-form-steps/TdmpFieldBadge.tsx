import { Lock } from "lucide-react";
import { TDMP_LOCK_HINT } from "../../lib/tdmp";

/** Marks a field whose value comes from TDMP (read-only here). */
export function TdmpFieldBadge() {
  return (
    <span
      title={TDMP_LOCK_HINT}
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary"
    >
      <Lock className="h-3 w-3" aria-hidden />
      From TDMP
      <span className="sr-only">. {TDMP_LOCK_HINT}</span>
    </span>
  );
}
