import React from 'react';

type RenderMode = "unlit" | "lit" | "wireframe";

interface ViewerRenderModePanelProps {
  renderMode: RenderMode;
  setRenderMode: (mode: RenderMode) => void;
  modeLabels: Record<RenderMode, string>;
}

export const ViewerRenderModePanel: React.FC<ViewerRenderModePanelProps> = ({
  renderMode,
  setRenderMode,
  modeLabels,
}) => {
  return (
    <div className="mode-panel">
      <div className="mode-label-hdr">Render mode</div>
      {(["unlit", "lit", "wireframe"] as RenderMode[]).map(m => (
        <button key={m} className={`mode-btn${renderMode === m ? " active" : ""}`} onClick={() => setRenderMode(m)}>
          <span className="mode-dot" />{modeLabels[m]}{m === "unlit" && <span className="mode-tag">recommended</span>}
        </button>
      ))}
    </div>
  );
};

export default React.memo(ViewerRenderModePanel);
