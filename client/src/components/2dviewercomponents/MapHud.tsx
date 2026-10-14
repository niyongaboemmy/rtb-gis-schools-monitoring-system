import { Info, Globe, X, Box } from "lucide-react";
import DOMPurify from "dompurify";
import { viewerLink } from "../../lib/viewer-tools";

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
}

export const MapHud: React.FC<MapHudProps> = ({
  school,
  isTileLoading,
  decodingCount,
  isLoading,
  currentLat,
  currentLng,
  infoFeature,
  onCloseInfo,
  selectedBuilding,
}) => {
  return (
    <>
      {/* ── Floating Title & Info Button ──────────────────────────────────── */}
      {/* ── Floating Title & Info Button ──────────────────────────────────── */}

      {/* ── Background tile-loading indicator ───────────────────────────────── */}
      {(isTileLoading || decodingCount > 0) && !isLoading && (
        <div className="absolute bottom-24 md:bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white/90 dark:bg-card/95 backdrop-blur-2xl px-4 py-2 border border-blue-500/12 dark:border-blue-500/12 pointer-events-none animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            {decodingCount > 0 ? `Optimizing Assets` : "Streaming Map"}
          </span>
        </div>
      )}

      {/* ── Feature info popup ────────────────────────────────────────────── moved to TOP */}
      {infoFeature && (
        <div className="absolute top-32 md:top-40 left-1/2 z-30 -translate-x-1/2 max-w-[90vw] md:max-w-sm w-full px-4">
          <div className="rounded-[24px] bg-white/95 dark:bg-card/95 backdrop-blur-3xl border border-slate-200 dark:border-white/6 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 overflow-auto max-h-[30vh] md:max-h-[40vh] custom-scrollbar text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {infoFeature.name}
                  </p>
                  {infoFeature.description && (
                    <div
                      className="text-[10px] text-slate-600 dark:text-white/80 mt-1 space-y-2 [&_table]:w-full [&_td]:py-1 [&_td:first-child]:font-semibold [&_td:first-child]:text-slate-400 dark:[&_td:first-child]:text-white/60"
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
                onClick={onCloseInfo}
                className="text-slate-400 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 bg-slate-100 dark:bg-white/5 rounded-full p-1 border border-slate-200 dark:border-white/6"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coordinates HUD ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-20 md:bottom-4 right-4 z-20">
        <div className="rounded-xl bg-white/90 dark:bg-card/95 backdrop-blur-md border border-slate-200 dark:border-white/6 px-2.5 md:px-3 py-1.5 text-[9px] md:text-[10px] font-mono text-slate-500 dark:text-white/50 space-x-2 md:space-x-3">
          <span>
            {currentLat >= 0 ? "N" : "S"} {Math.abs(currentLat).toFixed(6)}°
          </span>
          <span>
            {currentLng >= 0 ? "E" : "W"} {Math.abs(currentLng).toFixed(6)}°
          </span>
        </div>
      </div>

      {/* ── 2D/3D Navigation ────────────────────────────────────────────────── */}
      <div className="absolute bottom-20 md:bottom-4 left-4 z-20 flex gap-2">
        <div className="flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-primary/20 border border-blue-200 dark:border-primary/20 px-2.5 md:px-3 py-1.5">
          <Globe className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
            2D · Map
          </span>
        </div>

        <button
          onClick={() => {
            if (!school?.id) return;
            const lat = Number(selectedBuilding?.geolocation?.latitude);
            const lng = Number(selectedBuilding?.geolocation?.longitude);
            window.open(
              viewerLink("3d", school.id, {
                schoolName: school?.name,
                buildingId: selectedBuilding?.id ?? null,
                lat: Number.isFinite(lat) && lat ? lat : null,
                lng: Number.isFinite(lng) && lng ? lng : null,
              }),
              "_blank",
            );
          }}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/20 px-2.5 md:px-3 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-all text-emerald-700 dark:text-emerald-300 group"
          title="Switch to 3D Digital Twin"
        >
          <Box className="h-3 w-3 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">
            Explore 3D
          </span>
        </button>
      </div>
    </>
  );
};
