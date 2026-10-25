import { Loader2 } from "lucide-react";

/** Shown in the content area while a page's code downloads; the app shell stays. */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
