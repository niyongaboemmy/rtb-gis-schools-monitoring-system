import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Images, Link2, Loader2, Play, Trash2, Upload } from "lucide-react";
import { fileApi, apiErrorMessage } from "../../lib/api";
import { useToast } from "../ui/toast";
import { cn } from "../../lib/utils";
import { EASE } from "../school-dashboard/tokens";
import type { BuildingData } from "../school-form-steps/BuildingsStep";
import { isVideoMedia, mediaTypeOf, titleFromFile, type MediaEntry } from "./media/media-utils";

interface BuildingMediaTabProps {
  building: BuildingData;
  schoolId: string;
  /** Add and remove files (EDIT_SCHOOL_BUILDINGS / MANAGE_SCHOOLS). */
  canEdit: boolean;
  onUpdateBuilding: (update: BuildingData) => Promise<void>;
  /** Open a file of this building in the fullscreen viewer. */
  onOpen: (index: number) => void;
  /** Open the school-wide gallery. */
  onGallery?: () => void;
}

/** What the file server accepts in `buildings` (file-server/file-types.js). */
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif,video/mp4,video/webm";
const ALLOWED = /^(image\/(jpeg|png|webp|gif|heic|heif)|video\/(mp4|webm))$/;
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|heic|heif|mp4|webm)$/i;
const MAX_MB = 10;
const MAX_FILES = 10;

/**
 * A building's photos and videos: drop or pick files to upload (several at
 * once), tap one to view it fullscreen, remove with a second tap to confirm.
 */
export function BuildingMediaTab({ building, schoolId, canEdit, onUpdateBuilding, onOpen, onGallery }: BuildingMediaTabProps) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const inputId = useId();
  const media = ((building.media ?? []) as MediaEntry[]).filter((m) => m?.path);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const confirmTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const save = (next: MediaEntry[]) => onUpdateBuilding({ ...building, media: next } as BuildingData);

  const upload = async (list: FileList | File[]) => {
    const all = Array.from(list);
    const wrongType = all.filter((f) => !(ALLOWED.test(f.type) || ALLOWED_EXT.test(f.name)));
    const tooBig = all.filter((f) => !wrongType.includes(f) && f.size > MAX_MB * 1024 * 1024);
    const files = all.filter((f) => !wrongType.includes(f) && !tooBig.includes(f)).slice(0, MAX_FILES);
    if (wrongType.length) toast.error(`${wrongType.map((f) => f.name).join(", ")}: use JPG, PNG, WebP, HEIC, MP4 or WebM.`);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(", ")}: larger than ${MAX_MB} MB.`);
    if (all.length - wrongType.length - tooBig.length > MAX_FILES) toast.error(`Up to ${MAX_FILES} files at a time; the first ${MAX_FILES} were added.`);
    if (files.length === 0) return;
    setProgress(0);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const { data } = await fileApi.post(`/upload?folder=buildings&schoolId=${schoolId}`, form, {
        onUploadProgress: (e) => setProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null),
      });
      const urls: string[] = data?.urls ?? [];
      if (!data?.success || urls.length === 0) throw new Error("Upload failed");
      const now = new Date().toISOString();
      const added: MediaEntry[] = urls.map((path, i) => ({
        path,
        title: titleFromFile(files[i]?.name ?? "Photo"),
        type: files[i]?.type.startsWith("video/") ? "video" : mediaTypeOf(path),
        createdAt: now,
      }));
      await save([...media, ...added]);
      toast.success(added.length === 1 ? "Photo added" : `${added.length} files added`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload. Please try again."));
    } finally {
      setProgress(null);
    }
  };

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Enter a link that starts with https://");
      return;
    }
    try {
      await save([...media, { path: url, title: titleFromFile(url.split("/").pop() || "Link"), type: mediaTypeOf(url), createdAt: new Date().toISOString() }]);
      setLink("");
      setLinkOpen(false);
      toast.success("Link added");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add the link."));
    }
  };

  const remove = async (i: number) => {
    if (confirm !== i) {
      setConfirm(i);
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirm(null), 3000);
      return;
    }
    setConfirm(null);
    setRemoving(i);
    try {
      await save(media.filter((_, x) => x !== i));
      toast.success("Removed");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove it."));
    } finally {
      setRemoving(null);
    }
  };

  const busy = progress !== null;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragging) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy && e.dataTransfer.files.length) void upload(e.dataTransfer.files);
            }}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-dashed px-4 py-3.5 transition-colors",
              dragging
                ? "border-primary bg-primary/[0.06]"
                : "border-slate-300 hover:border-primary/60 hover:bg-primary/[0.03] dark:border-white/15 dark:hover:border-primary/60",
              busy && "pointer-events-none",
            )}
          >
            <input
              id={inputId}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <motion.span
              animate={dragging && !reduce ? { y: -2, scale: 1.08 } : { y: 0, scale: 1 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </motion.span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-slate-800 dark:text-white/85">
                {busy ? `Uploading${progress ? ` · ${progress}%` : "…"}` : dragging ? "Drop to upload" : "Add photos or videos"}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-white/45">Drop here or tap · up to {MAX_MB} MB each</span>
            </span>
            {busy && (
              <motion.span
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: (progress ?? 10) / 100 }}
                transition={{ ease: "easeOut" }}
                aria-hidden
              />
            )}
          </label>

          <AnimatePresence initial={false}>
            {linkOpen ? (
              <motion.form
                key="link"
                onSubmit={addLink}
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex gap-2 overflow-hidden"
              >
                <input
                  autoFocus
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                  aria-label="Link to a photo or video"
                  className="h-9 min-w-0 flex-1 rounded-xl bg-white px-3 text-[13px] text-slate-900 ring-1 ring-slate-900/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-white/[0.06] dark:text-white dark:ring-white/15"
                />
                <button type="submit" className="h-9 rounded-xl bg-primary px-3.5 text-[13px] text-white transition-colors hover:bg-primary/90">
                  Add
                </button>
                <button type="button" onClick={() => setLinkOpen(false)} className="h-9 rounded-xl px-2.5 text-[13px] text-slate-500 hover:bg-slate-900/5 dark:text-white/55 dark:hover:bg-white/8">
                  Cancel
                </button>
              </motion.form>
            ) : (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="inline-flex items-center gap-1.5 px-1 text-xs text-slate-500 transition-colors hover:text-primary dark:text-white/50"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden /> Add a link instead
              </button>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs text-slate-500 dark:text-white/50">
          {media.length === 0 ? "No files yet" : `${media.length} file${media.length === 1 ? "" : "s"}`}
        </p>
        {onGallery && (
          <button type="button" onClick={onGallery} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Images className="h-3.5 w-3.5" aria-hidden /> All buildings
          </button>
        )}
      </div>

      {media.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900/[0.03] px-4 py-8 text-center dark:bg-white/[0.03]">
          <Images className="h-6 w-6 text-slate-300 dark:text-white/25" aria-hidden />
          <p className="text-xs text-slate-500 dark:text-white/50">{canEdit ? "Photos help others see the building." : "No photos for this building yet."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          <AnimatePresence initial={false}>
            {media.map((m, i) => {
              const video = isVideoMedia(m);
              const asking = confirm === i;
              return (
                <motion.li
                  key={`${m.path}:${i}`}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: removing === i ? 0.4 : 1, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(i)}
                    aria-label={`Open ${m.title || (video ? "video" : "photo")}`}
                    className="relative block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:bg-white/5"
                  >
                    {video ? (
                      <span className="flex h-full w-full items-center justify-center">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/60 text-white">
                          <Play className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </span>
                    ) : (
                      <img src={m.path} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                    {m.title && (
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/65 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {m.title}
                      </span>
                    )}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void remove(i)}
                      disabled={removing !== null}
                      aria-label={asking ? `Confirm removing ${m.title || "this file"}` : `Remove ${m.title || "this file"}`}
                      className={cn(
                        "absolute right-1 top-1 flex h-7 items-center justify-center gap-1 rounded-full text-white backdrop-blur transition-all focus-visible:opacity-100",
                        asking ? "bg-destructive px-2.5 text-[11px] opacity-100" : "w-7 bg-slate-900/55 opacity-0 hover:bg-destructive group-hover:opacity-100 [@media(hover:none)]:opacity-100",
                      )}
                    >
                      {removing === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                      {asking && "Remove?"}
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
