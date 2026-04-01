import React from 'react';

interface ViewerLoadingScreensProps {
  phase: "idle" | "loading" | "viewing";
  progress: number;
  progressLabel: string;
  isDragging: boolean;
  schoolName: string;
  setIsDragging: (val: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ViewerLoadingScreens: React.FC<ViewerLoadingScreensProps> = ({
  phase,
  progress,
  progressLabel,
  isDragging,
  schoolName,
  setIsDragging,
  handleDrop,
  handleInputChange,
}) => {
  if (phase === "idle") {
    return (
      <div className="drop-zone">
        <label className={`drop-target${isDragging ? " dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} htmlFor="glb-input">
          <input id="glb-input" type="file" accept=".glb" style={{ display: "none" }} onChange={handleInputChange} />
          <div className="drop-icon">⬡</div>
          <div className="drop-title">{schoolName ? `No 3D model found for ${schoolName}` : "Drop your .glb model here"}</div>
          <div className="drop-sub">{schoolName ? "Upload a GLB file to view the 3D model for this school" : "Measure distances · Areas · Perimeters"}<br />{schoolName ? "" : "Annotations · Screenshot · Unlit photogrammetry"}</div>
          <button className="upload-btn" type="button" onClick={e => { e.preventDefault(); document.getElementById("glb-input")?.click() }}>Choose File</button>
        </label>
        <div className="info-row">
          {[{ value: "2 GB+", label: "Max File Size" }, { value: "GLB", label: "Format" }, { value: "WebGL 2", label: "Renderer" }, { value: "Measure", label: "Tools" }].map(c => (
            <div className="info-card" key={c.label}><div className="info-card-value">{c.value}</div><div className="info-card-label">{c.label}</div></div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="loading-overlay">
        <div className="spinner-ring" />
        <div className="loading-pct">{progress}%</div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <div className="progress-label">{progressLabel}</div>
      </div>
    );
  }

  return null;
};

export default React.memo(ViewerLoadingScreens);
