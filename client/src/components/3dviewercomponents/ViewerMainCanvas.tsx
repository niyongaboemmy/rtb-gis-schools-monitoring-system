import React, { forwardRef } from 'react';

interface ViewerMainCanvasProps {
  progress: number;
  progressLabel: string;
  measureMode: any;
  isPinMode?: boolean;
  handleOverlayMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleOverlayClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleOverlayDoubleClick: () => void;
  handleOverlayContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const ViewerMainCanvas = forwardRef<HTMLDivElement, ViewerMainCanvasProps & { overlayRef: React.RefObject<HTMLCanvasElement | null> }>(({
  progress,
  progressLabel,
  measureMode,
  isPinMode,
  handleOverlayMouseMove,
  handleOverlayClick,
  handleOverlayDoubleClick,
  handleOverlayContextMenu,
  overlayRef,
}, ref) => {
  return (
    <>
      {progress < 100 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(6,11,26,0.78)", backdropFilter: "blur(6px)" }}>
          <div className="spinner-ring" />
          <div className="loading-pct">{progress}%</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="progress-label">{progressLabel}</div>
        </div>
      )}

      <div ref={ref} className="viewer-canvas" />

      <canvas ref={overlayRef} className={`overlay-canvas${(measureMode || isPinMode) ? "  interactive" : ""}`}
        style={isPinMode ? { cursor: "crosshair" } : undefined}
        onMouseMove={handleOverlayMouseMove}
        onClick={handleOverlayClick}
        onDoubleClick={handleOverlayDoubleClick}
        onContextMenu={handleOverlayContextMenu} />
    </>
  );
});

ViewerMainCanvas.displayName = 'ViewerMainCanvas';
export default React.memo(ViewerMainCanvas);
