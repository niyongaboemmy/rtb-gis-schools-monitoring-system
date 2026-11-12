import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, ImagePlus, File as FileIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
}

type Item = { file: File; url: string | null };

/** Does `file` match an `accept` list like "image/*,application/pdf"? */
function accepts(accept: string, file: File) {
  return accept.split(',').some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1));
    return file.type === rule;
  });
}

/** Drop zone + "browse" + camera shortcut, with thumbnails below. */
export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  maxFiles = 5,
  accept = 'image/*,application/pdf',
}) => {
  // Each file keeps one preview URL, made when picked and revoked on removal.
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Latest list for the unmount cleanup; written only from event handlers.
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => () => itemsRef.current.forEach((i) => i.url && URL.revokeObjectURL(i.url)), []);

  const update = (next: Item[]) => {
    itemsRef.current = next;
    setItems(next);
    onFilesSelected(next.map((i) => i.file));
  };

  const addFiles = (list: File[]) => {
    const files = list.filter((f) => accepts(accept, f)).slice(0, Math.max(0, maxFiles - items.length));
    if (files.length === 0) return;
    update([
      ...items,
      ...files.map((file) => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })),
    ]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = ''; // let the same file be picked again
  };

  const removeFile = (index: number) => {
    const gone = items[index];
    if (gone?.url) URL.revokeObjectURL(gone.url);
    update(items.filter((_, i) => i !== index));
  };

  const full = items.length >= maxFiles;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          if (full) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full) addFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-6 text-center transition-colors duration-200',
          dragging
            ? 'border-primary bg-primary/6 dark:bg-primary/10'
            : 'border-slate-900/15 bg-slate-900/2 dark:border-white/15 dark:bg-white/2',
          full && 'opacity-60',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset transition-colors duration-200',
            dragging ? 'bg-primary text-primary-foreground ring-primary' : 'bg-primary/10 text-primary ring-primary/20',
          )}
        >
          <ImagePlus className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm text-slate-700 dark:text-white/75">
          {full ? (
            `Maximum of ${maxFiles} files added`
          ) : dragging ? (
            'Drop to add'
          ) : (
            <>
              Drag photos here or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                browse
              </button>
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-white/45">
          Images or PDF · {items.length} of {maxFiles}
        </p>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={full}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium text-slate-700 ring-1 ring-slate-900/10 transition-colors hover:bg-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-50 dark:text-white/75 dark:ring-white/12 dark:hover:bg-white/8"
        >
          <Camera className="h-3.5 w-3.5" aria-hidden /> Take a photo
        </button>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={accept} multiple className="hidden" />
      <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          <AnimatePresence initial={false}>
            {items.map(({ file, url }, index) => (
              <motion.li
                key={`${file.name}-${file.lastModified}-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="group relative aspect-square overflow-hidden rounded-xl bg-slate-900/4 ring-1 ring-slate-900/8 dark:bg-white/4 dark:ring-white/8"
              >
                {url ? (
                  <img src={url} alt={file.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                    <FileIcon className="mb-1 h-6 w-6 text-primary" aria-hidden />
                    <span className="w-full truncate px-1 text-[11px] text-slate-600 dark:text-white/60">{file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  className="absolute right-1 top-1 rounded-full bg-slate-950/60 p-1 text-white backdrop-blur-sm transition-opacity hover:bg-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};
