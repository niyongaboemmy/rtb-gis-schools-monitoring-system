import React from 'react';

interface ViewerHelpModalProps {
  setShowHelp: (val: boolean) => void;
}

export const ViewerHelpModal: React.FC<ViewerHelpModalProps> = ({ setShowHelp }) => {
  return (
    <div className="help-backdrop" onClick={() => setShowHelp(false)}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <div className="help-header">
          <div className="help-title"><div className="help-title-icon">?</div>Controls &amp; Shortcuts</div>
          <button className="help-close" onClick={() => setShowHelp(false)}>✕</button>
        </div>
        <div className="help-body">
          <div className="callout">
            ✅  <strong>Unlit mode = Metashape-accurate colours</strong><br />
            Photogrammetry textures have real-world lighting baked in. Unlit mode skips PBR shading → raw captured colour.
          </div>
          <div className="help-section">
            <div className="help-section-label">🖱 Mouse</div>
            <div className="help-grid">
              {[{ keys: ["Left drag"], desc: "Orbit" }, { keys: ["Right drag"], desc: "Pan" }, { keys: ["Scroll"], desc: "Zoom" }, { keys: ["Middle drag"], desc: "Pan (alt)" }].map(r => (
                <div className="help-row" key={r.desc}><div className="help-keys">{r.keys.map(k => <span className="kbd" key={k}>{k}</span>)}</div><div className="help-desc">{r.desc}</div></div>
              ))}
            </div>
          </div>
          <div className="help-divider" />
          <div className="help-section">
            <div className="help-section-label">⌨️ Fly navigation</div>
            <div className="help-grid">
              {[{ keys: ["W", "↑"], desc: "Walk Forward" }, { keys: ["S", "↓"], desc: "Walk Backward" }, { keys: ["A", "←"], desc: "Strafe left" }, { keys: ["D", "→"], desc: "Strafe right" }, { keys: ["E", "Space"], desc: "Fly up" }, { keys: ["Q", "F"], desc: "Fly down" }].map(r => (
                <div className="help-row" key={r.desc}><div className="help-keys">{r.keys.map(k => <span className="kbd" key={k}>{k}</span>)}</div><div className="help-desc">{r.desc}</div></div>
              ))}
            </div>
          </div>
          <div className="help-divider" />
          <div className="help-section">
            <div className="help-section-label">📐 Measuring</div>
            <div className="help-grid">
              {[{ keys: ["Click"], desc: "Place measurement point" }, { keys: ["Right-click"], desc: "Finish/Complete measurement" }, { keys: ["Esc"], desc: "Cancel current measurement" }, { keys: ["👁️ btn"], desc: "Cycle UI view visibility" }, { keys: ["📷 btn"], desc: "Screenshot + download PNG" }, { keys: ["📐 btn"], desc: "Open measurements panel" }].map(r => (
                <div className="help-row" key={r.desc}><div className="help-keys">{r.keys.map(k => <span className="kbd" key={k}>{k}</span>)}</div><div className="help-desc">{r.desc}</div></div>
              ))}
            </div>
          </div>
          <div className="help-tip">
            🔍 All measurements persist in your browser across sessions.<br />
            📍 <strong>Smart Auto-Home:</strong> When you save your home view, it's bound to that specific file name. Dropping the same map later instantly snaps to your saved angle.<br />
            📷 Screenshot composites the 3D view + all overlays into one High-Res PNG.
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ViewerHelpModal);
