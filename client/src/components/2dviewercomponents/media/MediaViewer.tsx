import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Building2, ChevronLeft, ChevronRight, ExternalLink, FileWarning, Images, MessageSquareWarning, Play, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatDate } from "../../../lib/format";
import { EASE } from "../../school-dashboard/tokens";
import { isVideoMedia, type GalleryItem } from "./media-utils";

interface Props {
  items: GalleryItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Open reports on a building (for the Reports shortcut). */
  openReports?: (buildingId: string) => number;
  onBuildings?: (buildingId: string) => void;
  onGallery?: (buildingId: string) => void;
  /** Open the building's reports — on this report when the photo came from one. */
  onReports?: (buildingId: string, reportId?: string) => void;
}

/**
 * Fullscreen photo / video viewer across every building of the school. Shows
 * which building a file belongs to, with shortcuts to that building, the
 * gallery and its reports. Arrows, swipe and ← / → move; Esc closes.
 */
export function MediaViewer({ items, index, onIndexChange, onClose, openReports, onBuildings, onGallery, onReports }: Props) {
  const reduce = useReducedMotion();
  const [dir, setDir] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const closeRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const item = items[index];
  const count = items.length;
  const reports = item && openReports ? openReports(item.buildingId) : 0;

  const go = (step: number) => {
    if (count < 2) return;
    setDir(step);
    onIndexChange((index + step + count) % count);
  };

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // Keep the active thumbnail in view.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`);
    el?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
  }, [index, reduce]);

  if (!item) return null;
  const m = item.media;
  const video = isVideoMedia(m);
  const isBroken = broken[item.key];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  const shortcut =
    "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[15px] text-white/85 backdrop-blur transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      data-viewer
      aria-label={`${item.buildingName}: ${m.title || "photo"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex flex-col bg-[hsl(224_30%_4%)]/95 text-white backdrop-blur-xl"
    >
      {/* ── Top: which building, which file ─────────────────────── */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10" aria-hidden>
          <Building2 className="h-4 w-4 text-white/80" />
        </span>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={item.buildingId}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="truncate text-[15px] font-medium"
            >
              {item.buildingName}
            </motion.p>
          </AnimatePresence>
          <p className="truncate text-xs text-white/50">
            {item.source === "report" && "Report · "}
            {m.title || (video ? "Video" : "Photo")}
            {m.createdAt && ` · ${formatDate(m.createdAt)}`}
          </p>
        </div>
        <span className="hidden text-xs tabular-nums text-white/50 sm:block">
          {index + 1} / {count}
        </span>
        <a
          href={m.path}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the original file"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="h-4.5 w-4.5" aria-hidden />
        </button>
      </div>

      {/* ── The file ─────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-16">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={item.key}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            drag={count > 1 && !video ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={onDragEnd}
            className="flex h-full w-full items-center justify-center"
          >
            {isBroken ? (
              <div className="flex flex-col items-center gap-2 text-white/60">
                <FileWarning className="h-8 w-8" aria-hidden />
                <p className="text-sm">This file could not be shown.</p>
              </div>
            ) : video ? (
              <video src={m.path} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" onError={() => setBroken((b) => ({ ...b, [item.key]: true }))} />
            ) : (
              <img
                src={m.path}
                alt={m.title || item.buildingName}
                draggable={false}
                onError={() => setBroken((b) => ({ ...b, [item.key]: true }))}
                className="max-h-full max-w-full select-none rounded-xl object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
          </>
        )}
      </div>

      {/* ── Shortcuts + thumbnails ───────────────────────────────── */}
      <div className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)] pt-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onBuildings && item.buildingId && (
            <button type="button" className={shortcut} onClick={() => onBuildings(item.buildingId)}>
              <Building2 className="h-4 w-4" aria-hidden /> Buildings
            </button>
          )}
          {onGallery && (
            <button type="button" className={shortcut} onClick={() => onGallery(item.buildingId)}>
              <Images className="h-4 w-4" aria-hidden /> Gallery
            </button>
          )}
          {onReports && item.buildingId && (
            <button
              type="button"
              className={cn(shortcut, reports > 0 && "bg-primary/25 text-white hover:bg-primary/35")}
              onClick={() => onReports(item.buildingId, item.reportId)}
              aria-label={`Reports for ${item.buildingName}${reports ? `, ${reports} open` : ""}`}
            >
              <MessageSquareWarning className="h-4 w-4" aria-hidden /> Reports
              {reports > 0 && (
                <motion.span
                  key={reports}
                  initial={reduce ? false : { scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[13px] leading-5 tabular-nums text-white"
                >
                  {reports}
                </motion.span>
              )}
            </button>
          )}
          <span className="text-xs tabular-nums text-white/45 sm:hidden">
            {index + 1} / {count}
          </span>
        </div>

        {count > 1 && (
          <div ref={stripRef} className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="All photos and videos">
            {items.map((it, i) => (
              <button
                key={it.key}
                type="button"
                data-i={i}
                onClick={() => {
                  setDir(i > index ? 1 : -1);
                  onIndexChange(i);
                }}
                aria-label={`${it.buildingName}: ${it.media.title || "photo"}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg transition-[opacity,transform,box-shadow] duration-200",
                  i === index ? "opacity-100 ring-2 ring-white" : "opacity-45 hover:opacity-80",
                )}
              >
                {isVideoMedia(it.media) ? (
                  <span className="flex h-full w-full items-center justify-center bg-white/10">
                    <Play className="h-4 w-4 text-white/80" aria-hidden />
                  </span>
                ) : (
                  <img src={it.media.path} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-[background-color,transform] hover:scale-105 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:flex",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
