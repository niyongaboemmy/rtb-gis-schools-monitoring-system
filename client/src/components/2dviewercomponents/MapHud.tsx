import { Info, Globe, Ruler, Square, X } from "lucide-react";
import { Button } from "../ui/button";

interface MapHudProps {
  school: any;
  setShowBasicInfo: (v: boolean) => void;
  isTileLoading: boolean;
  decodingCount: number;
  isLoading: boolean;
  currentLat: number;
  currentLng: number;
  measurementMode: "none" | "distance" | "area";
  measureResult: string | null;
  infoFeature: { name: string; description?: string } | null;
  onCloseInfo: () => void;
  onSaveMeasurement?: () => void;
}

export const MapHud: React.FC<MapHudProps> = ({
  school,
  setShowBasicInfo,
  isTileLoading,
  decodingCount,
  isLoading,
  currentLat,
  currentLng,
  measurementMode,
  measureResult,
  infoFeature,
  onCloseInfo,
  onSaveMeasurement,
}) => {
  return (
    <>
      {/* ── Floating Title & Info Button ──────────────────────────────────── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pr-2 pl-6 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-4">
        <h1 className="text-xl font-bold text-white tracking-wide truncate max-w-[250px] md:max-w-md">
          {school.name}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/5 font-semibold"
          onClick={() => setShowBasicInfo(true)}
        >
          <Info className="h-4 w-4 mr-1.5" />
          Info
        </Button>
      </div>

      {/* ── Background tile-loading indicator ───────────────────────────────── */}
      {(isTileLoading || decodingCount > 0) && !isLoading && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-sm px-3 py-1.5 border border-white/10 pointer-events-none">
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 w-1 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            {decodingCount > 0 ? `Optimizing ${decodingCount} tiles…` : "Loading imagery…"}
          </span>
        </div>
      )}

      {/* ── Measurement mode banner ───────────────────────────────────────── */}
      {measurementMode !== "none" && (
        <div className="absolute top-20 left-1/2 z-30 -translate-x-1/2 mt-2">
          <div className="flex items-center gap-2 rounded-2xl bg-amber-500/15 backdrop-blur-xl border border-amber-400/30 px-4 py-2 shadow-xl">
            {measurementMode === "distance" ? (
              <Ruler className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : (
              <Square className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-bold text-amber-300">
              {measurementMode === "distance"
                ? "Click to draw line — double-click to finish"
                : "Click to draw polygon — double-click to finish"}
            </span>
            {measureResult && (
              <>
                <span className="mx-1 text-amber-400/50">·</span>
                <span className="text-xs font-black text-amber-200">
                  {measureResult}
                </span>
                {onSaveMeasurement && (
                  <Button
                    variant="ghost" 
                    size="sm"
                    className="ml-2 h-7 px-3 rounded-xl bg-amber-400/20 text-amber-200 font-bold hover:bg-amber-400/30 border border-amber-400/30 transition-all text-[10px] uppercase tracking-widest"
                    onClick={onSaveMeasurement}
                  >
                    Save to Map
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Feature info popup ────────────────────────────────────────────── */}
      {infoFeature && (
        <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 max-w-sm w-full px-4">
          <div className="rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-3 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 overflow-auto max-h-[40vh] custom-scrollbar text-left">
                  <p className="text-xs font-bold text-white">
                    {infoFeature.name}
                  </p>
                  {infoFeature.description && (
                    <div
                      className="text-[10px] text-white/80 mt-1 space-y-2 [&_table]:w-full [&_td]:py-1 [&_td:first-child]:font-semibold [&_td:first-child]:text-white/60"
                      dangerouslySetInnerHTML={{
                        __html: infoFeature.description,
                      }}
                    />
                  )}
                </div>
              </div>
              <button
                onClick={onCloseInfo}
                className="text-muted-foreground hover:text-white transition-colors shrink-0 bg-white/5 rounded-full p-1 border border-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coordinates HUD ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[10px] font-mono text-white/60 space-x-3">
          <span>
            {currentLat >= 0 ? "N" : "S"} {Math.abs(currentLat).toFixed(6)}°
          </span>
          <span>
            {currentLng >= 0 ? "E" : "W"} {Math.abs(currentLng).toFixed(6)}°
          </span>
        </div>
      </div>

      {/* ── 2D badge ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="flex items-center gap-1.5 rounded-xl bg-blue-500/15 border border-blue-400/20 px-3 py-1.5">
          <Globe className="h-3 w-3 text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
            2D · OpenLayers
          </span>
        </div>
      </div>
    </>
  );
};
