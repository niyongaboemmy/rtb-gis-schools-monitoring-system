import { Fragment, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import { useScope } from "../../hooks/useScope";
import { SchoolSwitcher } from "./SchoolSwitcher";
import { crumbsFor } from "./layout-utils";

const nameCache = new Map<string, string>();

function useSchoolName(id: string | null) {
  const [fetched, setFetched] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!id || nameCache.has(id)) return;
    let cancelled = false;
    api
      .get(`/schools/${id}`)
      .then((res) => (res.data?.name as string) || "School")
      .catch(() => "School")
      .then((n) => {
        nameCache.set(id, n);
        if (!cancelled) setFetched((f) => ({ ...f, [id]: n }));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (!id) return null;
  return nameCache.get(id) ?? fetched[id] ?? null;
}

/**
 * Route-driven breadcrumb trail (WS3.9). On /schools/:id/* the school crumb
 * is a switcher that keeps the current sub-page; school-level users (who only
 * have one school) see the name without the switcher.
 */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const scope = useScope();
  const { crumbs, schoolId, schoolSub } = crumbsFor(pathname);
  const schoolName = useSchoolName(schoolId);
  const canSwitch = scope.tier !== "school";

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1 && !schoolId;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <li className={last ? "min-w-0" : "hidden shrink-0 sm:block"}>
                {c.to && !last ? (
                  <Link
                    to={c.to}
                    className="rounded px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="block truncate px-1 font-semibold capitalize text-foreground">
                    {c.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
        {schoolId && (
          <>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
            <li className="min-w-0">
              {schoolName && canSwitch ? (
                <SchoolSwitcher schoolId={schoolId} schoolName={schoolName} />
              ) : (
                <span className="block truncate px-1 font-semibold text-foreground">{schoolName ?? "…"}</span>
              )}
            </li>
            {schoolSub && (
              <>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground md:block" aria-hidden="true" />
                <li className="hidden min-w-0 md:block">
                  <span aria-current="page" className="block truncate px-1 text-muted-foreground">
                    {schoolSub}
                  </span>
                </li>
              </>
            )}
          </>
        )}
      </ol>
    </nav>
  );
}
