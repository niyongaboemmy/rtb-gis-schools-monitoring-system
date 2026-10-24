import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Clock, Map as MapIcon, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber, formatScore } from "../../lib/format";
import { priorityMeta } from "../maps/schoolMap";
import { normProvince } from "./geo";
import type { PlottedSchool } from "./types";
import { EASE, GLASS, GLASS_STRONG, MUTED, STRONG } from "./tokens";

export type SearchHit =
  | { kind: "school"; id: string; point: PlottedSchool }
  | { kind: "district"; id: string; name: string; province: string; count: number }
  | { kind: "province"; id: string; name: string; count: number };

interface Props {
  points: PlottedSchool[];
  provinceNames: string[];
  recent: PlottedSchool[];
  total: number;
  inView: number;
  compact: boolean;
  panelOpen: boolean;
  activeFilters: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onPick: (hit: SearchHit) => void;
  /** The highlighted result (arrows / pointer) — the map previews it. */
  onPreview?: (hit: SearchHit | null) => void;
  onTogglePanel: () => void;
}

/** Bold the matched part of a label. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/15 text-inherit dark:bg-primary/25">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * Floating glass command bar: identity, one search box across schools,
 * districts and provinces (grouped, keyboard-navigable, Enter flies there),
 * and the filters-panel toggle.
 */
export function CommandBar({
  points,
  provinceNames,
  recent,
  total,
  inView,
  compact,
  panelOpen,
  activeFilters,
  inputRef,
  onPick,
  onPreview,
  onTogglePanel,
}: Props) {
  const reduce = useReducedMotion();
  const listId = useId();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      return recent.length
        ? [{ title: "Recently viewed", hits: recent.map((p) => ({ kind: "school", id: p.school.id, point: p }) as SearchHit) }]
        : [];
    }
    const has = (v?: string | null) => !!v && v.toLowerCase().includes(query);
    const schools = points
      .filter((p) => has(p.school.name) || has(p.school.code) || has(p.school.sector) || has(p.school.district))
      // Name matches first, then prefix matches.
      .sort((a, b) => {
        const an = a.school.name.toLowerCase();
        const bn = b.school.name.toLowerCase();
        const rank = (n: string) => (n.startsWith(query) ? 0 : n.includes(query) ? 1 : 2);
        return rank(an) - rank(bn) || an.localeCompare(bn);
      })
      .slice(0, 6)
      .map((p) => ({ kind: "school", id: p.school.id, point: p }) as SearchHit);

    const districtMap = new Map<string, { province: string; count: number }>();
    for (const p of points) {
      const d = p.school.district;
      if (!d) continue;
      const cur = districtMap.get(d) ?? { province: p.school.province, count: 0 };
      cur.count++;
      districtMap.set(d, cur);
    }
    const districts = [...districtMap.entries()]
      .filter(([name]) => name.toLowerCase().includes(query))
      .slice(0, 4)
      .map(([name, v]) => ({ kind: "district", id: `d:${name}`, name, province: v.province, count: v.count }) as SearchHit);

    const provinces = provinceNames
      .filter((n) => n.toLowerCase().includes(query))
      .map((name) => ({
        kind: "province",
        id: `p:${name}`,
        name,
        count: points.filter((p) => normProvince(p.school.province) === normProvince(name)).length,
      }) as SearchHit);

    return [
      { title: "Schools", hits: schools },
      { title: "Districts", hits: districts },
      { title: "Provinces", hits: provinces },
    ].filter((g) => g.hits.length);
  }, [q, points, provinceNames, recent]);

  const flat = groups.flatMap((g) => g.hits);
  const open = focused && (flat.length > 0 || q.trim().length > 0);
  const cur = Math.min(active, Math.max(0, flat.length - 1));

  // Preview follows the highlighted row; keyed by id so re-renders don't spam.
  const previewHit = open ? (flat[cur] ?? null) : null;
  const previewKey = previewHit?.id ?? null;
  const previewRef = useRef(onPreview);
  const hitRef = useRef(previewHit);
  useEffect(() => {
    previewRef.current = onPreview;
    hitRef.current = previewHit;
  });
  useEffect(() => {
    previewRef.current?.(previewKey ? hitRef.current : null);
  }, [previewKey]);

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQ("");
    setActive(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (flat.length ? (Math.min(a, flat.length - 1) + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (flat.length ? (Math.min(a, flat.length - 1) - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter" && flat[cur]) {
      e.preventDefault();
      pick(flat[cur]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (q) setQ("");
      else inputRef.current?.blur();
    }
  };

  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.hits.length, 0));
  const row = (hit: SearchHit, i: number): ReactNode => {
    const isActive = i === cur;
    const common = {
      id: `${listId}-${i}`,
      role: "option" as const,
      "aria-selected": isActive,
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onMouseEnter: () => setActive(i),
      onClick: () => pick(hit),
      className: cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors",
        isActive ? "bg-slate-900/[0.06] dark:bg-white/[0.08]" : "hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]",
      ),
    };
    if (hit.kind === "school") {
      const m = priorityMeta(hit.point.priority);
      return (
        <li key={hit.id} {...common}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${m.color}1f` }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-[15px]", STRONG)}>
              <Highlight text={hit.point.school.name} q={q.trim()} />
            </span>
            <span className={cn("block truncate text-xs", MUTED)}>
              {hit.point.school.code} · {hit.point.school.district}, {hit.point.school.province}
            </span>
          </span>
          <span className={cn("shrink-0 text-xs tabular-nums", MUTED)}>{formatScore(hit.point.score)}</span>
        </li>
      );
    }
    const Icon = hit.kind === "district" ? MapPin : MapIcon;
    return (
      <li key={hit.id} {...common}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[15px]", STRONG)}>
            <Highlight text={hit.name} q={q.trim()} />
          </span>
          <span className={cn("block truncate text-xs", MUTED)}>
            {hit.kind === "district" ? `District · ${hit.province}` : "Province"}
          </span>
        </span>
        <span className={cn("shrink-0 text-xs tabular-nums", MUTED)}>
          {formatNumber(hit.count)} {hit.count === 1 ? "school" : "schools"}
        </span>
      </li>
    );
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="pointer-events-auto relative w-full max-w-[640px]"
    >
      <div className={cn("flex items-center gap-1.5 rounded-full p-1.5", GLASS)}>
        {!compact && (
          <div className="flex shrink-0 items-center gap-2.5 pl-1 pr-2">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.7)]">
              <MapIcon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="hidden min-w-0 flex-col leading-tight lg:flex">
              <h1 className={cn("text-[15px] font-semibold tracking-tight", STRONG)}>National map</h1>
              <span className={cn("whitespace-nowrap text-[13px]", MUTED)}>
                {formatNumber(total)} {total === 1 ? "school" : "schools"} · {formatNumber(inView)} in view
              </span>
            </span>
          </div>
        )}
        {compact && <h1 className="sr-only">National map</h1>}

        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search schools, districts and provinces</span>
          <Search className={cn("pointer-events-none absolute left-3 h-4 w-4", MUTED)} aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && flat[cur] ? `${listId}-${cur}` : undefined}
            placeholder={compact ? "Search the map" : "Search schools, districts, provinces"}
            className={cn(
              "h-10 w-full min-w-0 rounded-full bg-slate-900/[0.04] pl-9 pr-16 text-[15px] outline-none transition-colors placeholder:text-slate-500 focus:bg-white/80 dark:bg-white/[0.06] dark:placeholder:text-white/40 dark:focus:bg-white/[0.1]",
              STRONG,
            )}
          />
          {q ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQ("")}
              aria-label="Clear search"
              className={cn("absolute right-2 rounded-full p-1.5 hover:bg-slate-900/5 dark:hover:bg-white/10", MUTED)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <kbd className={cn("pointer-events-none absolute right-3 hidden rounded-md bg-slate-900/5 px-1.5 py-0.5 font-sans text-[12px] sm:block dark:bg-white/10", MUTED)}>
              /
            </kbd>
          )}
        </label>

        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={panelOpen}
          aria-controls="national-map-panel"
          aria-label={panelOpen ? "Hide filters and list" : "Show filters and list"}
          className={cn(
            "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            panelOpen
              ? "bg-primary text-primary-foreground"
              : "text-slate-700 hover:bg-slate-900/5 dark:text-white/80 dark:hover:bg-white/10",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {activeFilters > 0 && (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[13px] tabular-nums",
                panelOpen ? "bg-white/25" : "bg-primary text-primary-foreground",
              )}
            >
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={cn("absolute inset-x-0 top-full mt-2 overflow-hidden rounded-3xl", GLASS_STRONG)}
          >
            <ul id={listId} role="listbox" aria-label="Search results" className="custom-scrollbar max-h-[min(60dvh,440px)] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <li className={cn("px-3 py-6 text-center text-[15px]", MUTED)}>
                  No schools, districts or provinces match “{q.trim()}”.
                </li>
              ) : (
                groups.map((g, gi) => (
                  <li key={g.title} role="presentation" className="pb-1">
                    <p className={cn("flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs", MUTED)}>
                      {g.title === "Recently viewed" ? <Clock className="h-3 w-3" aria-hidden /> : g.title === "Schools" ? <Building2 className="h-3 w-3" aria-hidden /> : null}
                      {g.title}
                    </p>
                    <ul role="group" aria-label={g.title}>{g.hits.map((h, j) => row(h, starts[gi] + j))}</ul>
                  </li>
                ))
              )}
            </ul>
            <p className={cn("hidden items-center gap-3 bg-slate-900/[0.03] px-4 py-2 text-[13px] sm:flex dark:bg-white/[0.03]", MUTED)}>
              <span>↑ ↓ to move</span>
              <span>Enter to fly there</span>
              <span>Esc to close</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
