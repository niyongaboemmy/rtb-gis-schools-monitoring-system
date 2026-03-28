import { ANNOTATION_COLORS } from "./types";

interface NewProps {
  screen: { x: number; y: number };
  label: string;
  color: string;
  onLabelChange: (v: string) => void;
  onColorChange: (c: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface EditProps {
  label: string;
  onLabelChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NewAnnotationDialog({ screen, label, color, onLabelChange, onColorChange, onConfirm, onCancel }: NewProps) {
  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ left: Math.min(screen.x + 16, window.innerWidth - 260), top: screen.y + 44 }}
    >
      <div style={{ background: "rgba(10,12,20,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12, width: 240, backdropFilter: "blur(16px)" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>New Annotation</p>
        <div className="flex gap-1 mb-2">
          {ANNOTATION_COLORS.map(c => (
            <button key={c} onClick={() => onColorChange(c)}
              style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: color === c ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
        <input
          autoFocus value={label} onChange={e => onLabelChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
          placeholder="Label text…"
          style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 13, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
        />
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={!label.trim()}
            style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: label.trim() ? "#3b82f6" : "rgba(255,255,255,0.05)", color: label.trim() ? "white" : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600, border: "none", cursor: label.trim() ? "pointer" : "default" }}>
            Save
          </button>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditAnnotationDialog({ label, onLabelChange, onConfirm, onCancel }: EditProps) {
  return (
    <div className="absolute z-30 pointer-events-auto" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
      <div style={{ background: "rgba(10,12,20,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 16, width: 260, backdropFilter: "blur(20px)" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Edit Annotation</p>
        <input
          autoFocus value={label} onChange={e => onLabelChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
          style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 13, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
        />
        <div className="flex gap-2">
          <button onClick={onConfirm}
            style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#3b82f6", color: "white", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Save
          </button>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
