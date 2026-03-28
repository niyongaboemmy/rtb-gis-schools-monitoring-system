interface Props {
  school: any;
  loading: boolean;
  loadProgress: number;
  error: string | null;
}

export function LoadingOverlay({ school, loading, loadProgress, error }: Props) {
  if (!loading && !error) return null;

  if (error) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "#0f1117" }}>
        <p style={{ color: "#f87171", fontSize: 32, marginBottom: 12 }}>⚠</p>
        <p style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{error}</p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Upload a GLB file from the Upload Maps page.</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "#0f1117" }}>
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(59,130,246,0.15)" }} />
        <div className="absolute inset-0 rounded-full" style={{ border: "2px solid transparent", borderTopColor: "#3b82f6", animation: "spin 1s linear infinite" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" style={{ width: 30, height: 30 }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
      <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{school?.name || "Loading 3D Model"}</p>
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 24 }}>Preparing GLB geometry…</p>
      {loadProgress > 0 && (
        <div style={{ width: 240 }}>
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${loadProgress}%`, background: "linear-gradient(90deg,#3b82f6,#60a5fa)", borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textAlign: "center", marginTop: 8 }}>{loadProgress}%</p>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
