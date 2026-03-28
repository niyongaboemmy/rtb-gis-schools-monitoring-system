import type { ToolMode, HomePosition } from "./types";
import { ANNOTATION_COLORS } from "./types";

interface Props {
  school: any;
  toolMode: ToolMode;
  onSetTool: (t: ToolMode) => void;
  annotationColor: string;
  onSetAnnotationColor: (c: string) => void;
  homePosition: HomePosition | null;
  onGoHome: () => void;
  savingHome: boolean;
  homeSaved: boolean;
  onSaveHome: () => void;
  onScreenshot: () => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  showHelp: boolean;
  onToggleHelp: () => void;
  movementPaused: boolean;
  annotationCount: number;
}

const TOOLS: { id: ToolMode; label: string; icon: string }[] = [
  { id: "none", label: "Orbit", icon: "↺" },
  { id: "distance", label: "Distance", icon: "📏" },
  { id: "area", label: "Area", icon: "⬡" },
  { id: "annotate", label: "Annotate", icon: "📌" },
];

const btn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s", border: "1px solid transparent",
  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
};
const btnOn: React.CSSProperties = {
  background: "rgba(59,130,246,0.3)", color: "#60a5fa",
  border: "1px solid rgba(59,130,246,0.5)",
};
const sep: React.CSSProperties = {
  width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 2px",
};

export function ViewerToolbar({
  school, toolMode, onSetTool, annotationColor, onSetAnnotationColor,
  homePosition, onGoHome, savingHome, homeSaved, onSaveHome, onScreenshot,
  showSettings, onToggleSettings, showHelp, onToggleHelp, movementPaused, annotationCount,
}: Props) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* School identity */}
      <div className="flex items-center gap-3">
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <p style={{ color: "white", fontWeight: 700, fontSize: 13, lineHeight: 1 }}>{school?.name || "Loading…"}</p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>
            {school?.code} · 3D Viewer{annotationCount > 0 ? ` · ${annotationCount} pin${annotationCount > 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => onSetTool(t.id)}
            style={{ ...btn, ...(toolMode === t.id ? btnOn : {}) }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}

        {toolMode === "annotate" && (
          <div className="flex items-center gap-1 px-2">
            {ANNOTATION_COLORS.map(c => (
              <button key={c} onClick={() => onSetAnnotationColor(c)}
                style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: annotationColor === c ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
            ))}
          </div>
        )}

        <div style={sep} />

        {homePosition && (
          <button onClick={onGoHome} style={btn} title="Go to saved home">🏠 Home</button>
        )}
        <button onClick={onSaveHome} disabled={savingHome}
          style={{ ...btn, ...(homeSaved ? { background: "rgba(16,185,129,0.3)", color: "#34d399", border: "1px solid rgba(16,185,129,0.4)" } : {}) }}>
          {homeSaved ? "✓ Saved" : savingHome ? "…" : "📍 Set Home"}
        </button>

        <div style={sep} />

        <button onClick={onScreenshot} style={btn} title="Screenshot">📸</button>
        <button onClick={onToggleSettings}
          style={{ ...btn, ...(showSettings ? { background: "rgba(251,191,36,0.25)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" } : {}) }}>
          ⚙ Settings
        </button>
        <button onClick={onToggleHelp}
          style={{ ...btn, ...(showHelp ? { background: "rgba(168,85,247,0.3)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.4)" } : {}) }}>
          ? Help
        </button>

        {movementPaused && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", fontSize: 11, fontWeight: 700 }}>
            ⏸ Paused
          </div>
        )}
      </div>
    </div>
  );
}
