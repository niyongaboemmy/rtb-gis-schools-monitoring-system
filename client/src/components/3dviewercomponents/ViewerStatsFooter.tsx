import React from 'react';

interface ViewerStatsFooterProps {
  stats: any;
  showMeasurePanel: boolean;
  formatBytes: (bytes: number) => string;
  formatTime: (ms: number) => string;
}

export const ViewerStatsFooter: React.FC<ViewerStatsFooterProps> = ({
  stats,
  showMeasurePanel,
  formatBytes,
  formatTime,
}) => {
  if (!stats || showMeasurePanel) return null;

  return (
    <div className="stats-panel">
      {[
        { val: stats.fileName.length > 16 ? stats.fileName.slice(0, 14) + "…" : stats.fileName, lbl: "File" },
        { val: formatBytes(stats.fileSize), lbl: "Size" },
        { val: formatTime(stats.loadTime), lbl: "Load time" },
        { val: stats.triangles.toLocaleString(), lbl: "Triangles" },
        { val: stats.meshes.toString(), lbl: "Meshes" },
        { val: stats.textures.toString(), lbl: "Textures" },
      ].map((s, i, arr) => (
        <span key={s.lbl} style={{ display: "contents" }}>
          <div className="stat-item"><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div></div>
          {i < arr.length - 1 && <div className="stat-div" />}
        </span>
      ))}
    </div>
  );
};

export default React.memo(ViewerStatsFooter);
