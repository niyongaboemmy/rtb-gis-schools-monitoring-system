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
      {/* ── Floating Title & Info Button ──────────────────────────────────── */}
      <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-40 pr-1.5 md:pr-2 pl-4 md:pl-6 py-1.5 md:py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-3 md:gap-4 max-w-[90vw] md:max-w-none overflow-hidden group">
        {/* Glass shimmer effect */}
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
        
        <h1 className="text-sm md:text-xl font-bold text-white tracking-wide truncate max-w-[150px] sm:max-w-[250px] md:max-w-md relative z-10">
          {school.name}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 md:h-8 px-2 md:px-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/5 font-semibold text-[10px] md:text-xs"
          onClick={() => setShowBasicInfo(true)}
        >
          <Info className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-1.5" />
          <span className="hidden sm:inline">Info</span>
        </Button>
      </div>

      {/* ── Background tile-loading indicator ───────────────────────────────── */}
      {(isTileLoading || decodingCount > 0) && !isLoading && (
        <div className="absolute bottom-24 md:bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-xl px-4 py-2 border border-white/10 pointer-events-none shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-blue-400">
            {decodingCount > 0 ? `Optimizing Assets` : "Streaming Map"}
          </span>
        </div>
      )}

      {/* ── Measurement mode banner ───────────────────────────────────────── stack it above the title */}
      {measurementMode !== "none" && (
        <div className="absolute top-16 md:top-24 left-1/2 z-40 -translate-x-1/2 w-full px-4 sm:w-auto">
          <div className="flex items-center gap-2 rounded-2xl bg-[#0f1117]/80 backdrop-blur-2xl border border-amber-400/30 px-4 md:px-5 py-2 md:py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            {measurementMode === "distance" ? (
              <Ruler className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : (
              <Square className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            )}
            <span className="text-[10px] md:text-xs font-bold text-amber-300">
              {measurementMode === "distance"
                ? "Measure Path"
                : "Measure Area"}
            </span>
            {measureResult && (
              <>
                <span className="mx-1 text-amber-400/50">·</span>
                <span className="text-[10px] md:text-xs font-black text-amber-200">
                  {measureResult}
                </span>
                {onSaveMeasurement && (
                  <Button
                    variant="ghost" 
                    size="sm"
                    className="ml-2 h-6 md:h-7 px-2 md:px-3 rounded-lg md:rounded-xl bg-amber-400/20 text-amber-200 font-bold hover:bg-amber-400/30 border border-amber-400/30 transition-all text-[9px] md:text-[10px] uppercase tracking-widest"
                    onClick={onSaveMeasurement}
                  >
                    Save
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Feature info popup ────────────────────────────────────────────── moved to TOP */}
      {infoFeature && (
        <div className="absolute top-32 md:top-40 left-1/2 z-30 -translate-x-1/2 max-w-[90vw] md:max-w-sm w-full px-4">
          <div className="rounded-[24px] bg-[#0f1117]/90 backdrop-blur-3xl border border-white/10 px-5 py-4 shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 overflow-auto max-h-[30vh] md:max-h-[40vh] custom-scrollbar text-left">
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
      <div className="absolute bottom-20 md:bottom-4 right-4 z-20">
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-2.5 md:px-3 py-1.5 text-[9px] md:text-[10px] font-mono text-white/60 space-x-2 md:space-x-3">
          <span>
            {currentLat >= 0 ? "N" : "S"} {Math.abs(currentLat).toFixed(6)}°
          </span>
          <span>
            {currentLng >= 0 ? "E" : "W"} {Math.abs(currentLng).toFixed(6)}°
          </span>
        </div>
      </div>

      {/* ── 2D badge ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-20 md:bottom-4 left-4 z-20">
        <div className="flex items-center gap-1.5 rounded-xl bg-blue-500/15 border border-blue-400/20 px-2.5 md:px-3 py-1.5">
          <Globe className="h-3 w-3 text-blue-400" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-300">
            2D · Map
          </span>
        </div>
      </div>
    </>
  );
};
