import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Building2, Camera, Images, MessageSquareWarning, Play, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatDate } from "../../../lib/format";
import { EASE } from "../../school-dashboard/tokens";
import { isVideoMedia, type GalleryItem } from "./media-utils";

interface Props {
  items: GalleryItem[];
  /** Start filtered to one building (null = all). */
  initialBuildingId?: string | null;
  openReports?: (buildingId: string) => number;
  onOpen: (items: GalleryItem[], index: number) => void;
  onClose: () => void;
  /** Jump to a building on the map (its panel opens on Media). */
  onOpenBuilding?: (buildingId: string) => void;
}

type Source = "all" | "building" | "report";

const time = (it: GalleryItem) => new Date(it.media.createdAt ?? 0).getTime() || 0;

/**
 * Every photo and video of the school — building photos and photos attached
 * to problem reports — newest first, grouped by building in a masonry grid,
 * with a featured latest photo. Filter by source and by building.
 */
export function MediaGallery({ items, initialBuildingId = null, openReports, onOpen, onClose, onOpenBuilding }: Props) {
  const reduce = useReducedMotion();
  const [building, setBuilding] = useState<string | null>(initialBuildingId);
  const [source, setSource] = useState<Source>("all");
  const closeRef = useRef<HTMLButtonElement>(null);

  const sorted = useMemo(() => [...items].sort((a, b) => time(b) - time(a)), [items]);

  const buildings = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number; cover: GalleryItem | null }>();
    for (const it of sorted) {
      const b = m.get(it.buildingId) ?? { id: it.buildingId, name: it.buildingName, n: 0, cover: null };
      b.n++;
      if (!b.cover && !isVideoMedia(it.media)) b.cover = it;
      m.set(it.buildingId, b);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [sorted]);

  const counts = useMemo(
    () => ({ all: sorted.length, building: sorted.filter((i) => i.source === "building").length, report: sorted.filter((i) => i.source === "report").length }),
    [sorted],
  );

  // A filter that no longer matches anything falls back to "All".
  const activeBuilding = building && buildings.some((b) => b.id === building) ? building : null;
  const shown = useMemo(
    () => sorted.filter((it) => (source === "all" || it.source === source) && (activeBuilding == null || it.buildingId === activeBuilding)),
    [sorted, source, activeBuilding],
  );

  // Sections: one per building (newest first inside), the featured photo pulled out on top.
  const featured = !activeBuilding && source === "all" ? (shown.find((i) => !isVideoMedia(i.media)) ?? null) : null;
  const sections = useMemo(() => {
    const m = new Map<string, { id: string; name: string; items: GalleryItem[] }>();
    for (const it of shown) {
      if (featured && it.key === featured.key) continue;
      const s = m.get(it.buildingId) ?? { id: it.buildingId, name: it.buildingName, items: [] };
      s.items.push(it);
      m.set(it.buildingId, s);
    }
    return [...m.values()];
  }, [shown, featured]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // The fullscreen viewer above handles its own Esc.
      if (e.key === "Escape" && !document.querySelector("[data-viewer]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (it: GalleryItem) => onOpen(shown, Math.max(0, shown.findIndex((x) => x.key === it.key)));

  const pill = (on: boolean) =>
    cn(
      "relative inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
      on ? "text-white" : "text-slate-700 hover:bg-white/50 dark:text-white/70 dark:hover:bg-white/8",
    );

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Gallery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[150] flex flex-col bg-slate-100/60 backdrop-blur-2xl backdrop-saturate-150 dark:bg-[hsl(224_40%_5%)]/70"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="mx-auto w-full max-w-7xl px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8 sm:pt-6"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-medium tracking-tight text-slate-900 sm:text-3xl dark:text-white">Gallery</h2>
            <p className="mt-0.5 text-[13px] text-slate-600 dark:text-white/55">
              {counts.all} {counts.all === 1 ? "file" : "files"} · {buildings.length} {buildings.length === 1 ? "place" : "places"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/60 text-slate-700 ring-1 ring-white/50 backdrop-blur transition-[background-color,transform] hover:scale-105 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {counts.all > 0 && (
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Source */}
            <LayoutGroup id="gallery-source">
              <div role="group" aria-label="Show" className="inline-flex w-fit shrink-0 rounded-full bg-white/50 p-1 ring-1 ring-white/60 dark:bg-white/6 dark:ring-white/10">
                {(
                  [
                    ["all", "All", counts.all, Images],
                    ["building", "Buildings", counts.building, Building2],
                    ["report", "Reports", counts.report, MessageSquareWarning],
                  ] as const
                ).map(([k, l, n, Icon]) => (
                  <button key={k} type="button" aria-pressed={source === k} onClick={() => setSource(k)} disabled={n === 0 && k !== "all"} className={cn(pill(source === k), "disabled:opacity-40")}>
                    {source === k && (
                      <motion.span layoutId="gallery-source-thumb" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                    <Icon className="relative h-4 w-4" aria-hidden />
                    <span className="relative">{l}</span>
                    <span className={cn("relative tabular-nums", source === k ? "text-white/75" : "text-slate-500 dark:text-white/40")}>{n}</span>
                  </button>
                ))}
              </div>
            </LayoutGroup>

            {/* Buildings, with a cover thumbnail */}
            {buildings.length > 1 && (
              <div role="group" aria-label="Filter by building" className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
                <button type="button" aria-pressed={!activeBuilding} onClick={() => setBuilding(null)} className={cn(chip(!activeBuilding), "pl-3.5")}>
                  Everywhere
                </button>
                {buildings.map((b) => {
                  const n = b.id ? (openReports?.(b.id) ?? 0) : 0;
                  return (
                    <button key={b.id || "campus"} type="button" aria-pressed={activeBuilding === b.id} onClick={() => setBuilding(activeBuilding === b.id ? null : b.id)} className={chip(activeBuilding === b.id)}>
                      <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden>
                        {b.cover ? <img src={b.cover.media.path} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Building2 className="m-1.5 h-4 w-4 text-slate-500" />}
                      </span>
                      <span className="max-w-[10rem] truncate">{b.name}</span>
                      <span className="tabular-nums opacity-60">{b.n}</span>
                      {n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-white/70" aria-label={`${n} open reports`} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.header>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-7xl px-4 pb-[max(env(safe-area-inset-bottom),2rem)] sm:px-8">
          {counts.all === 0 ? (
            <EmptyGallery onClose={onClose} />
          ) : shown.length === 0 ? (
            <p className="py-24 text-center text-sm text-slate-600 dark:text-white/55">Nothing here for this filter.</p>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={`${source}:${activeBuilding ?? "all"}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className="space-y-10 pt-2">
                {featured && <Featured item={featured} reports={featured.buildingId ? (openReports?.(featured.buildingId) ?? 0) : 0} onOpen={() => open(featured)} />}

                {sections.map((sec, si) => (
                  <section key={sec.id || "campus"} aria-label={sec.name}>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-medium text-slate-900 dark:text-white">{sec.name}</h3>
                        <p className="text-xs text-slate-600 dark:text-white/50">
                          {sec.items.length} {sec.items.length === 1 ? "file" : "files"}
                          {sec.items.some((i) => i.source === "report") && ` · ${sec.items.filter((i) => i.source === "report").length} from reports`}
                        </p>
                      </div>
                      {onOpenBuilding && sec.id && (
                        <button
                          type="button"
                          onClick={() => onOpenBuilding(sec.id)}
                          className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 dark:text-blue-300"
                        >
                          On the map <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                        </button>
                      )}
                    </div>
                    {/* Bento grid: a rhythm of large and tall tiles, densely packed so rows line up */}
                    <ul className="grid auto-rows-[9.5rem] grid-flow-dense grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {sec.items.map((it, i) => (
                        <Tile key={it.key} item={it} span={spanFor(i, sec.items.length)} delay={reduce ? 0 : Math.min(si * 0.06 + i * 0.035, 0.6)} onOpen={() => open(it)} />
                      ))}
                    </ul>
                  </section>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

/** Tile size by position: a big tile first, then a tall one every so often. */
function spanFor(i: number, n: number): string {
  if (n >= 3 && i % 7 === 0) return "col-span-2 row-span-2";
  if (i % 7 === 4) return "row-span-2";
  return "";
}

function chip(on: boolean) {
  return cn(
    "inline-flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[13px] ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
    on ? "bg-primary text-white ring-primary" : "bg-white/50 text-slate-700 ring-white/60 hover:bg-white/80 dark:bg-white/6 dark:text-white/75 dark:ring-white/10 dark:hover:bg-white/10",
  );
}

/** Image with a soft shimmer until it loads, and a quiet fallback if it fails. */
function Thumb({ item, className }: { item: GalleryItem; className?: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  if (isVideoMedia(item.media)) {
    return (
      <span className={cn("relative flex h-full w-full items-center justify-center bg-slate-900/80", className)}>
        <video src={item.media.path} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/25 text-white ring-1 ring-white/40 backdrop-blur-md transition-transform group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5" aria-hidden />
        </span>
      </span>
    );
  }
  return (
    <span className={cn("relative block h-full w-full overflow-hidden", className)}>
      {state === "loading" && <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 to-slate-100 motion-reduce:animate-none dark:from-white/8 dark:to-white/4" aria-hidden />}
      {state === "error" ? (
        <span className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-white/30">
          <Camera className="h-6 w-6" aria-hidden />
        </span>
      ) : (
        <img
          src={item.media.path}
          alt=""
          loading="lazy"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn("block h-full w-full object-cover transition-[transform,opacity,filter] duration-700 ease-out group-hover:scale-[1.06]", state === "ok" ? "opacity-100 blur-0" : "opacity-0 blur-md")}
        />
      )}
    </span>
  );
}

function SourceBadge({ item }: { item: GalleryItem }) {
  if (item.source !== "report") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[11px] text-slate-800 backdrop-blur dark:bg-slate-900/70 dark:text-white/90">
      <MessageSquareWarning className="h-3 w-3 text-primary dark:text-blue-300" aria-hidden /> Report
    </span>
  );
}

function Tile({ item, span, delay, onOpen }: { item: GalleryItem; span: string; delay: number; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={span}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${item.buildingName}: ${item.media.title || (isVideoMedia(item.media) ? "video" : "photo")}`}
        className="group relative block h-full w-full overflow-hidden rounded-2xl bg-white/40 text-left ring-1 ring-white/50 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-white/5 dark:ring-white/10"
      >
        <Thumb item={item} />
        <span className="pointer-events-none absolute left-2 top-2">
          <SourceBadge item={item} />
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-2.5 pt-10 opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
          <span className="block truncate text-[13px] text-white">{item.media.title || item.buildingName}</span>
          {item.media.createdAt && <span className="block text-[11px] text-white/70">{formatDate(item.media.createdAt)}</span>}
        </span>
      </button>
    </motion.li>
  );
}

function Featured({ item, reports, onOpen }: { item: GalleryItem; reports: number; onOpen: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      aria-label={`Latest: ${item.buildingName}`}
      className="group relative block h-[42vh] min-h-56 w-full overflow-hidden rounded-[1.75rem] bg-slate-900 text-left ring-1 ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[46vh] dark:ring-white/10"
    >
      <img src={item.media.path} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.04]" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs text-white ring-1 ring-white/30 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden /> Latest
      </span>
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-7">
        <span className="min-w-0">
          <span className="block truncate text-2xl font-medium tracking-tight text-white sm:text-4xl">{item.buildingName}</span>
          <span className="mt-1 block truncate text-sm text-white/75">
            {item.media.title}
            {item.media.createdAt && ` · ${formatDate(item.media.createdAt)}`}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          {item.source === "report" && <SourceBadge item={item} />}
          {reports > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-white">
              {reports} open report{reports === 1 ? "" : "s"}
            </span>
          )}
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 transition-transform group-hover:scale-110">
            <ArrowUpRight className="h-5 w-5" aria-hidden />
          </span>
        </span>
      </span>
    </motion.button>
  );
}

function EmptyGallery({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {/* Three floating cards */}
      <div className="relative mb-8 h-32 w-44" aria-hidden>
        {[
          { r: -10, x: -34, d: 0 },
          { r: 8, x: 34, d: 0.1 },
          { r: 0, x: 0, d: 0.2 },
        ].map((c, i) => (
          <motion.span
            key={i}
            initial={reduce ? false : { opacity: 0, y: 20, rotate: 0 }}
            animate={reduce ? { opacity: 1, rotate: c.r, x: c.x } : { opacity: 1, y: [0, -6, 0], rotate: c.r, x: c.x }}
            transition={reduce ? { duration: 0 } : { opacity: { duration: 0.5, delay: c.d }, rotate: { duration: 0.6, delay: c.d, ease: EASE }, x: { duration: 0.6, delay: c.d, ease: EASE }, y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: c.d * 3 } }}
            className={cn(
              "absolute left-1/2 top-1/2 -ml-14 -mt-12 flex h-24 w-28 items-center justify-center rounded-2xl ring-1 backdrop-blur",
              i === 2 ? "bg-white/80 text-primary ring-white/70 dark:bg-white/10 dark:text-blue-300 dark:ring-white/15" : "bg-white/40 text-slate-400 ring-white/50 dark:bg-white/5 dark:text-white/30 dark:ring-white/10",
            )}
          >
            <Camera className="h-6 w-6" />
          </motion.span>
        ))}
      </div>
      <h3 className="text-xl font-medium text-slate-900 dark:text-white">No photos yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-600 dark:text-white/55">Photos added to a building, or attached to a report, show up here.</p>
      <button type="button" onClick={onClose} className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm text-white transition-colors hover:bg-primary/90">
        Pick a building
      </button>
    </div>
  );
}
