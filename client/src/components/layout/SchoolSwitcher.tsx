import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { switchSchoolPath } from "./layout-utils";

interface SchoolOption {
  id: string;
  name: string;
  code?: string;
  district?: string;
}

/**
 * Searchable school picker used in the breadcrumb on every school-scoped
 * page (WS3.9). The list comes from GET /schools, which the server already
 * filters to the caller's geographic scope.
 */
export function SchoolSwitcher({
  schoolId,
  schoolName,
}: {
  schoolId: string;
  schoolName: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get("/schools", { params: { search: query || undefined, page: 1, limit: 20 } })
        .then((res) => {
          if (cancelled) return;
          const data = (res.data?.data ?? []) as SchoolOption[];
          setOptions(data);
          setActive(0);
        })
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (s: SchoolOption) => {
    setOpen(false);
    setQuery("");
    if (s.id !== schoolId) navigate(switchSchoolPath(location.pathname, s.id));
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && options[active]) {
      e.preventDefault();
      choose(options[active]);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current school: ${schoolName}. Switch school`}
        data-tour="school-switcher"
        className="inline-flex max-w-[11rem] sm:max-w-[16rem] items-center gap-1 rounded-lg px-1.5 py-0.5 font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{schoolName}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-60 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background shadow-xl"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools…"
              aria-label="Search schools"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          </div>
          <ul id={listId} role="listbox" aria-label="Schools" className="max-h-72 overflow-y-auto p-1">
            {!loading && options.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No schools match.</li>
            )}
            {options.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${s.id}`}
                role="option"
                aria-selected={s.id === schoolId}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  i === active ? "bg-accent text-foreground" : "text-foreground",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.code, s.district].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {s.id === schoolId && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
