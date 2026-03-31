import React from 'react';

interface ViewerControlToolbarProps {
  saveFlash: boolean;
  homeSaved: boolean;
  screenshotFlash: boolean;
  showMeasurePanel: boolean;
  showHelp: boolean;
  speedIdx: number;
  speedSteps: number[];
  handleResetCamera: () => void;
  handleSaveHome: () => void;
  toggleOrientation: () => void;
  setView: (dir: "top" | "front" | "back" | "left" | "right") => void;
  speedUp: () => void;
  speedDown: () => void;
  setShowMeasurePanel: (val: boolean | ((p: boolean) => boolean)) => void;
  handleScreenshot: () => void;
  setShowHelp: (val: boolean | ((p: boolean) => boolean)) => void;
}

export const ViewerControlToolbar: React.FC<ViewerControlToolbarProps> = ({
  saveFlash,
  homeSaved,
  screenshotFlash,
  showMeasurePanel,
  showHelp,
  speedIdx,
  speedSteps,
  handleResetCamera,
  handleSaveHome,
  toggleOrientation,
  setView,
  speedUp,
  speedDown,
  setShowMeasurePanel,
  handleScreenshot,
  setShowHelp,
}) => {
  const fmtSpeed = (s: number) => s >= 1000 ? `${(s / 1000).toFixed(1)}k` : s.toFixed(1);

  return (
    <div className="toolbar">
      <div className="tb-group">
        <button className="tb-btn" data-tip="Reset to current home" onClick={handleResetCamera}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
        </button>
        <button className={`tb-btn${saveFlash ? " flash" : ""}`}
          data-tip={homeSaved ? "Update auto-home position" : "Save view as auto-home"} onClick={handleSaveHome}>
          {saveFlash ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : homeSaved ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          )}
        </button>
        <button className="tb-btn" data-tip="Rotate axis (Flip)" onClick={toggleOrientation}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21l-4-4 4-4" /><path d="M3 17h18a2 2 0 0 0 2-2v-2" /><path d="M17 3l4 4-4 4" /><path d="M21 7H3a2 2 0 0 0-2 2v2" /></svg>
        </button>
        <div className="tb-divider" />
        <button className="tb-btn" data-tip="Top View" onClick={() => setView("top")} style={{ fontSize: 9, fontWeight: 800 }}>TOP</button>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="tb-btn" data-tip="Front" onClick={() => setView("front")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>FRT</button>
          <button className="tb-btn" data-tip="Back" onClick={() => setView("back")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>BCK</button>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="tb-btn" data-tip="Left" onClick={() => setView("left")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>LFT</button>
          <button className="tb-btn" data-tip="Right" onClick={() => setView("right")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>RGT</button>
        </div>
      </div>

      <div className="speed-group">
        <div className="speed-label">speed</div>
        <button className="tb-btn" data-tip="Speed up" onClick={speedUp} disabled={speedIdx >= speedSteps.length - 1} style={{ fontSize: 18, fontWeight: 700 }}>＋</button>
        <div className="speed-val">{fmtSpeed(speedSteps[speedIdx])}</div>
        <div className="speed-track"><div className="speed-fill" style={{ width: `${(speedIdx / (speedSteps.length - 1)) * 100}%` }} /></div>
        <button className="tb-btn" data-tip="Speed down" onClick={speedDown} disabled={speedIdx <= 0} style={{ fontSize: 18, fontWeight: 700 }}>−</button>
      </div>

      <div className="tb-group">
        <button className={`tb-btn${showMeasurePanel ? " active" : ""}`} data-tip="Measurements panel"
          onClick={() => setShowMeasurePanel(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19.07 4.93-1.41 1.41" /><path d="m15.53 8.47-1.41 1.41" /><path d="M12 12 5 19" /><path d="m11.3 7.8 1.4-1.4" /><path d="m14.8 11.3 1.4-1.4" /><path d="m7.8 11.3 1.4-1.4" /><path d="m11.3 14.8 1.4-1.4" /><path d="m8.5 7.1 7.1 7.1" /><rect width="20" height="20" x="2" y="2" rx="2" /></svg>
        </button>
        <button className={`tb-btn${screenshotFlash ? " flash" : ""}`} data-tip="Screenshot & download"
          onClick={handleScreenshot}>
          {screenshotFlash ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
          )}
        </button>
        <div className="tb-divider" />
        <button className={`tb-btn${showHelp ? " active" : ""}`} data-tip="Keyboard shortcuts"
          onClick={() => setShowHelp(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        </button>
      </div>
    </div>
  );
};

export default React.memo(ViewerControlToolbar);
