import React from "react";
import { MapPin, Loader2, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface Props {
  draft: [number, number] | null;
  original: [number, number] | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const fmt = (n: number) => n.toFixed(7);

const moved = (
  a: [number, number] | null,
  b: [number, number] | null,
): boolean => {
  if (!a || !b) return !!a;
  return Math.abs(a[0] - b[0]) > 1e-7 || Math.abs(a[1] - b[1]) > 1e-7;
};

export const SchoolLocationEditorPanel: React.FC<Props> = ({
  draft,
  original,
  saving,
  onSave,
  onCancel,
}) => {
  const hasChange = moved(draft, original);

  return (
    <div className="fixed inset-x-4 bottom-24 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-8 z-40 flex justify-center pointer-events-none">
      <Card className="pointer-events-auto w-full max-w-md bg-white/95 dark:bg-card/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-xl bg-rose-500/15 p-2 text-rose-500">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Set school location
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click the map or drag the pin, then save.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="rounded-lg bg-slate-100 dark:bg-white/5 px-2 py-1.5">
                <span className="block text-[9px] font-sans font-black uppercase tracking-wider text-slate-400">
                  Latitude
                </span>
                {draft ? fmt(draft[1]) : "—"}
              </div>
              <div className="rounded-lg bg-slate-100 dark:bg-white/5 px-2 py-1.5">
                <span className="block text-[9px] font-sans font-black uppercase tracking-wider text-slate-400">
                  Longitude
                </span>
                {draft ? fmt(draft[0]) : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || !hasChange || !draft}
            className="gap-1.5 min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Save location
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
