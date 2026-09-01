import React from 'react';

interface ViewerMeasurePanelProps {
  measures: any[];
  annotations: any[];
  setMeasures: (val: any | ((p: any[]) => any[])) => void;
  setAnnotations: (val: any | ((p: any[]) => any[])) => void;
  clearAllMeasurements: () => void;
  onClose: () => void;
}

export const ViewerMeasurePanel: React.FC<ViewerMeasurePanelProps> = ({
  measures,
  annotations,
  setMeasures,
  setAnnotations,
  clearAllMeasurements,
  onClose,
}) => {
  return (
    <div className="meas-panel">
      <div className="mp-header">
        <div className="mp-title">
          📐 Measurements
          <span className="mp-count">{measures.length + annotations.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="mp-clear" onClick={clearAllMeasurements}>Delete all</button>
          <button className="mp-item-del static! m-0! w-6! h-6!" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="mp-list">
        {measures.length === 0 && annotations.length === 0 && (
          <div className="mp-empty">
            <div className="mp-empty-icon">📐</div>
            <div>No measurements yet.<br />Use the toolbar below to start.</div>
          </div>
        )}
        {measures.map(m => (
          <div className="mp-item" key={m.id}>
            <div className="mp-item-head">
              <span className="mp-item-type" style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}>
                {m.mode}
              </span>
              <button className="mp-item-del" onClick={() => setMeasures((prev: any[]) => prev.filter((x: any) => x.id !== m.id))}>✕</button>
            </div>
            <div className="mp-item-val">{m.label}</div>
            <div className="mp-item-pts">{m.points.length} point{m.points.length !== 1 ? "s" : ""}</div>
          </div>
        ))}
        {annotations.map(a => (
          <div className="mp-item" key={a.id}>
            <div className="mp-item-head">
              <span className="mp-item-type" style={{ background: "rgba(0,212,170,0.1)", color: "#00d4aa", border: "1px solid rgba(0,212,170,0.3)" }}>
                note
              </span>
              <button className="mp-item-del" onClick={() => setAnnotations((prev: any[]) => prev.filter((x: any) => x.id !== a.id))}>✕</button>
            </div>
            <div className="mp-item-val" style={{ fontSize: 11, color: a.color }}>
              {a.text.slice(0, 40)}{a.text.length > 40 ? "…" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(ViewerMeasurePanel);
