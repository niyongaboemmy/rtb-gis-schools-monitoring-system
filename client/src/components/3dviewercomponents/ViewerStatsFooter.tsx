import React from 'react';
import { detailCm, detailExplanation, drapedCm, DETAIL_LABEL, type ModelQuality } from '../../lib/viewer3d/model-quality';

interface ViewerStatsFooterProps {
  stats: any;
  showMeasurePanel: boolean;
  formatBytes: (bytes: number) => string;
  formatTime: (ms: number) => string;
  /** Detail measurement (cm of surface per texture pixel). */
  quality?: ModelQuality | null;
  /** GPU-compressed build shown, and whether textures were scaled down for this device. */
  textureMode?: { ktx2: boolean; reduced: boolean } | null;
}

export const ViewerStatsFooter: React.FC<ViewerStatsFooterProps> = ({
  stats,
  showMeasurePanel,
  formatBytes,
  formatTime,
  quality,
  textureMode,
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
        { val: stats.textures.toString(), lbl: textureMode?.ktx2 ? "Textures (compressed)" : "Textures" },
        ...(drapedCm(quality) != null
          ? [{ val: `${drapedCm(quality)} cm/px`, lbl: 'Roofs (photos)', title: detailExplanation(quality) }]
          : detailCm(quality) != null
            ? [{ val: `${detailCm(quality)!.toFixed(1)} cm/px`, lbl: DETAIL_LABEL[quality?.served?.score ?? 'unknown'] ?? 'Detail', title: detailExplanation(quality) }]
            : []),
        ...(textureMode?.reduced
          ? [{ val: "Reduced", lbl: "On this device", title: "Textures were scaled down to fit this device's graphics memory." }]
          : []),
      ].map((s: { val: string; lbl: string; title?: string }, i, arr) => (
        <span key={s.lbl} style={{ display: "contents" }}>
          <div className="stat-item" title={s.title} aria-label={s.title ? `${s.lbl}: ${s.val}. ${s.title}` : undefined}><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div></div>
          {i < arr.length - 1 && <div className="stat-div" />}
        </span>
      ))}
    </div>
  );
};

export default React.memo(ViewerStatsFooter);
