import { forwardRef } from "react";
import type { Annotation } from "./types";

interface Props {
  ann: Annotation;
  onEdit: () => void;
  onDelete: () => void;
}

export const AnnotationLabel = forwardRef<HTMLDivElement, Props>(
  ({ ann, onEdit, onDelete }, ref) => (
    <div
      ref={ref}
      className="absolute pointer-events-auto z-10"
      style={{ transform: "translate(-50%, -100%)" }}
    >
      <div
        className="flex items-center gap-1 mb-1"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", padding: "3px 8px", borderRadius: 6, border: `1px solid ${ann.color}55`, whiteSpace: "nowrap" }}
      >
        <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{ann.label}</span>
        <button onClick={onEdit} style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer", background: "none", border: "none", padding: 0 }}>✏️</button>
        <button onClick={onDelete} style={{ color: "#f87171", fontSize: 10, cursor: "pointer", background: "none", border: "none", padding: 0 }}>✕</button>
      </div>
      {/* Pin dot is drawn on the canvas overlay — spacer preserves layout */}
      <div style={{ width: 10, height: 10, margin: "0 auto" }} />
    </div>
  ),
);
AnnotationLabel.displayName = "AnnotationLabel";
