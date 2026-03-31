import React from 'react';
import { X } from 'lucide-react';

interface ViewerUIHeaderProps {
  schoolName: string;
  stats: any;
  progress: number;
  isProcessingMarkers: boolean;
  onClose?: () => void;
}

export const ViewerUIHeader: React.FC<ViewerUIHeaderProps> = ({
  schoolName,
  stats,
  progress,
  isProcessingMarkers,
  onClose,
}) => {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-icon">⬡</div>
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.4px" }}>
            {schoolName || "RTB GIS · 3D Viewer"}
          </span>
          {schoolName && (
            <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.4, letterSpacing: "1.2px", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              Rwanda TVET Board · 3D Photogrammetry Viewer
            </span>
          )}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {stats && progress === 100 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(232,232,240,0.3)", letterSpacing: "0.3px" }}>
              {stats.triangles.toLocaleString()}▲ · {stats.meshes}⬡ · {stats.textures}◈
            </span>
            {isProcessingMarkers && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span className="spinner-ring" style={{ width: 8, height: 8, borderWidth: 1 }} /> Mapping Annotations...
              </span>
            )}
          </span>
        )}
        <span className="badge">Measure · Annotate · Screenshot</span>
        <button 
          onClick={() => {
            if (onClose) onClose();
            else window.close();
          }}
          style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,100,100,0.3)", background: "rgba(255,70,70,0.1)", color: "#ff6060", fontSize: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <X size={12} /> EXIT EXPLORER
        </button>
      </div>
    </header>
  );
};

export default React.memo(ViewerUIHeader);
