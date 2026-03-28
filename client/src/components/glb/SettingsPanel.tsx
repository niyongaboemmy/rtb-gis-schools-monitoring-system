interface Props {
  gridVisible: boolean;
  onToggleGrid: (v: boolean) => void;
  fogEnabled: boolean;
  onToggleFog: (v: boolean) => void;
  unit: "m" | "cm";
  onSetUnit: (u: "m" | "cm") => void;
  onClose: () => void;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", position: "relative", background: value ? "#3b82f6" : "rgba(255,255,255,0.12)", transition: "background 0.2s" }}
      >
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", display: "block" }} />
      </button>
    </div>
  );
}

export function SettingsPanel({ gridVisible, onToggleGrid, fogEnabled, onToggleFog, unit, onSetUnit, onClose }: Props) {
  return (
    <div className="absolute top-14 right-4 z-30 w-56 rounded-2xl p-4"
      style={{ background: "rgba(10,12,20,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ color: "white", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Map Settings</p>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <Toggle label="Grid" value={gridVisible} onChange={onToggleGrid} />
      <Toggle label="Atmosphere fog" value={fogEnabled} onChange={onToggleFog} />
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 0" }} />
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Measurement Unit</p>
      <div className="flex gap-2">
        {(["m", "cm"] as const).map(u => (
          <button key={u} onClick={() => onSetUnit(u)} style={{
            flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: unit === u ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.05)",
            color: unit === u ? "#60a5fa" : "rgba(255,255,255,0.35)",
            border: `1px solid ${unit === u ? "rgba(59,130,246,0.5)" : "transparent"}`,
          }}>{u}</button>
        ))}
      </div>
    </div>
  );
}
