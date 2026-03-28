interface Props { onClose: () => void; }

const GROUPS = [
  { group: "Navigation", items: [
    { key: "W/↑  S/↓  A/←  D/→", desc: "Move camera" },
    { key: "Q / PgUp  |  E / PgDn", desc: "Up / Down" },
    { key: "Space", desc: "Pause / Resume movement" },
    { key: "Drag", desc: "Orbit" }, { key: "Right-drag", desc: "Pan" }, { key: "Scroll", desc: "Zoom" },
  ]},
  { group: "Camera", items: [
    { key: "📍 Set Home", desc: "Save current view" },
    { key: "🏠 Home", desc: "Return to saved view" },
  ]},
  { group: "Measurement", items: [
    { key: "📏 Distance", desc: "Click 2 points" },
    { key: "⬡ Area", desc: "Click 3+ points" },
    { key: "m / cm toggle", desc: "Switch unit" },
    { key: "Clear", desc: "Reset points" },
  ]},
  { group: "Annotations", items: [
    { key: "📌 Annotate", desc: "Click model to place pin" },
    { key: "✏️ / ✕", desc: "Edit / Delete label" },
  ]},
  { group: "Other", items: [
    { key: "📸", desc: "Screenshot" },
  ]},
];

export function HelpPanel({ onClose }: Props) {
  return (
    <div className="absolute top-14 right-4 z-30 w-72 rounded-2xl p-5"
      style={{ background: "rgba(10,12,20,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between mb-4">
        <p style={{ color: "white", fontWeight: 800, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>Controls & Help</p>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      {GROUPS.map(({ group, items }) => (
        <div key={group} className="mb-3">
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{group}</p>
          {items.map(({ key, desc }) => (
            <div key={key} className="flex justify-between items-center mb-1.5">
              <span style={{ background: "rgba(255,255,255,0.07)", padding: "2px 7px", borderRadius: 5, fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>{key}</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{desc}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
