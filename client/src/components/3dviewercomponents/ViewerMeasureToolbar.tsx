import React from 'react';

type MeasureMode = "distance" | "area" | "perimeter" | "annotate" | null;
type Unit = "m" | "ft" | "in" | "cm" | "mm" | "km";
type VisibilityMode = "all" | "annotations" | "measures" | "clear";

interface ViewerMeasureToolbarProps {
  measureMode: MeasureMode;
  unit: Unit;
  showUnitDropdown: boolean;
  visibility: VisibilityMode;
  measuresCount: number;
  annotationsCount: number;
  pendingPtsCount: number;
  unitLabels: Record<Unit, string>;
  unitSuffix: Record<Unit, string>;
  toggleMode: (mode: MeasureMode) => void;
  setShowUnitDropdown: (val: boolean | ((p: boolean) => boolean)) => void;
  setUnit: (u: Unit) => void;
  cycleVisibility: () => void;
  finalizeMeasure: () => void;
  setMeasureMode: (m: MeasureMode) => void;
  setPendingPts: (pts: any[]) => void;
}

export const ViewerMeasureToolbar: React.FC<ViewerMeasureToolbarProps> = ({
  measureMode,
  unit,
  showUnitDropdown,
  visibility,
  measuresCount,
  annotationsCount,
  pendingPtsCount,
  unitLabels,
  unitSuffix,
  toggleMode,
  setShowUnitDropdown,
  setUnit,
  cycleVisibility,
  finalizeMeasure,
  setMeasureMode,
  setPendingPts,
}) => {
  return (
    <div className={`meas-toolbar${measureMode ? " active-mode" : ""}`}>
      <div className="unit-wrap">
        <button className="unit-btn" onClick={() => setShowUnitDropdown(v => !v)}>
          📏 {unitSuffix[unit]} ▾
        </button>
        {showUnitDropdown && (
          <div className="unit-dropdown">
            {(Object.keys(unitLabels) as Unit[]).map(u => (
              <button key={u} className={`unit-opt${unit === u ? " selected" : ""}`}
                onClick={() => { setUnit(u); setShowUnitDropdown(false); }}>
                <span>{unitLabels[u]}</span>
                {unit === u && <span className="check">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="meas-divider" />

      <button className={`meas-btn${measureMode === "distance" ? " active" : ""}`}
        onClick={() => toggleMode("distance")}>
        📏 Distance
      </button>
      <button className={`meas-btn${measureMode === "area" ? " active" : ""}`}
        onClick={() => toggleMode("area")}>
        ⬛ Area
      </button>
      <button className={`meas-btn${measureMode === "perimeter" ? " active" : ""}`}
        onClick={() => toggleMode("perimeter")}>
        🔲 Perimeter
      </button>
      <button className={`meas-btn annotate-btn${measureMode === "annotate" ? " active" : ""}`}
        onClick={() => toggleMode("annotate")}>
        🏷 Annotate
      </button>

      {(measuresCount > 0 || annotationsCount > 0) && (
        <>
          <div className="meas-divider" />
          <button className="meas-btn" style={{ fontWeight: 600, color: visibility === "clear" ? "#ff7070" : "rgba(232,232,240,0.65)" }}
            onClick={cycleVisibility}>
            {visibility === "all" && "👁️ View All"}
            {visibility === "annotations" && "🏷️ Annots Only"}
            {visibility === "measures" && "📏 Meas Only"}
            {visibility === "clear" && "🚫 Clear View"}
          </button>
        </>
      )}

      {measureMode && pendingPtsCount >= 2 && measureMode !== "annotate" && (
        <>
          <div className="meas-divider" />
          <button className="meas-btn active" style={{ background: "rgba(50,200,100,0.15)", borderColor: "rgba(50,200,100,0.4)", color: "#60e8a0" }}
            onClick={finalizeMeasure}>✓ Done ({pendingPtsCount} pts)</button>
        </>
      )}
      {measureMode && (
        <>
          <div className="meas-divider" />
          <span className="meas-hint">
            {measureMode === "distance" && `Click points → Right-click to finish`}
            {measureMode === "area" && `Click points → Right-click to finish`}
            {measureMode === "perimeter" && `Click points → Right-click to finish`}
            {measureMode === "annotate" && "Click on model to place note"}
          </span>
          <div className="meas-divider" />
          <button className="meas-btn" style={{ color: "rgba(255,112,112,0.7)" }}
            onClick={() => { setMeasureMode(null); setPendingPts([]); }}>✕ Cancel</button>
        </>
      )}
    </div>
  );
};

export default React.memo(ViewerMeasureToolbar);
