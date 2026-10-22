import { Info, Map as MapIcon, X, Box } from "lucide-react";
import DOMPurify from "dompurify";

interface MapHudProps {
  school: any;
  setShowBasicInfo: (v: boolean) => void;
  isTileLoading: boolean;
  decodingCount: number;
  isLoading: boolean;
  currentLat: number;
  currentLng: number;
  /** @deprecated The shared ActiveToolBanner shows the measuring state now. */
  measurementMode?: "none" | "distance" | "area" | "perimeter";
  measureResult?: string | null;
  /** Selected building, carried into the 3D viewer (WS5.6). */
  selectedBuilding?: { id: string; geolocation?: { latitude?: unknown; longitude?: unknown } } | null;
  infoFeature: { name: string; description?: string } | null;
  onCloseInfo: () => void;
  onSaveMeasurement?: () => void;
  /** Switch the viewer to its 3D tab (same browser tab). */
  onOpen3D?: () => void;
}

export const MapHud: React.FC<MapHudProps> = ({
  isTileLoading,
  decodingCount,
  isLoading,
  currentLat,
  currentLng,
  infoFeature,
  onCloseInfo,
  onOpen3D,
}) => {
  return (
    <>
      {/* ── Background tile-loading indicator ───────────────────────────────── */}
      {(isTileLoading || decodingCount > 0) && !isLoading && (
        <div role="status" className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150 px-3.5 py-1.5 ring-1 ring-white/40 dark:ring-white/10 pointer-events-none animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-600 dark:text-white/65">
            {decodingCount > 0 ? "Preparing" : "Loading map"}
          </span>
        </div>
      )}

      {/* ── Feature info popup ────────────────────────────────────────────── moved to TOP */}
      {infoFeature && (
        <div className="absolute top-32 md:top-40 left-1/2 z-40 -translate-x-1/2 max-w-[90vw] md:max-w-sm w-full px-4">
          <div className="rounded-3xl bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/40 dark:ring-white/10 px-5 py-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary dark:text-blue-300 shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 overflow-auto max-h-[30vh] md:max-h-[40vh] custom-scrollbar text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {infoFeature.name}
                  </p>
                  {infoFeature.description && (
                    <div
                      className="text-xs text-slate-600 dark:text-white/75 mt-1 space-y-2 [&_table]:w-full [&_td]:py-1 [&_td:first-child]:text-slate-400 dark:[&_td:first-child]:text-white/50"
                      dangerouslySetInnerHTML={{
                        // KMZ descriptions are untrusted HTML from uploaded files.
                        __html: DOMPurify.sanitize(infoFeature.description, {
                          USE_PROFILES: { html: true },
                          FORBID_TAGS: ["style", "form", "input", "iframe"],
                          FORBID_ATTR: ["style"],
                        }),
                      }}
                    />
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseInfo}
                aria-label="Close feature info"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coordinates HUD ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-20 right-4 md:bottom-4 md:right-[calc(var(--map-rail-w,3.5rem)+1.5rem)] z-20">
        <div className="rounded-full bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/40 dark:ring-white/10 px-3 py-1.5 text-[10px] md:text-[11px] tabular-nums text-slate-500 dark:text-white/50 space-x-2 md:space-x-3">
          <span>
            {currentLat >= 0 ? "N" : "S"} {Math.abs(currentLat).toFixed(6)}°
          </span>
          <span>
            {currentLng >= 0 ? "E" : "W"} {Math.abs(currentLng).toFixed(6)}°
          </span>
        </div>
      </div>

      {/* ── Map / 3D switch ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-20 md:bottom-4 left-4 z-20">
        <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-full bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/40 dark:ring-white/10 p-1">
          <span aria-current="true" className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-white">
            <MapIcon className="h-3.5 w-3.5" aria-hidden />
            Map
          </span>
          <button
            type="button"
            onClick={onOpen3D}
            className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/8 dark:hover:text-white"
            title="Open the 3D model"
          >
            <Box className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" aria-hidden />
            3D
          </button>
        </div>
      </div>
    </>
  );
};
