function fmtLen(m: number, unit: "m" | "cm") {
  if (unit === "cm") return `${(m * 100).toFixed(1)} cm`;
  return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m.toFixed(2)} m`;
}
function fmtArea(m2: number, unit: "m" | "cm") {
  if (unit === "cm") return `${(m2 * 10000).toFixed(0)} cm²`;
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(4)} ha` : `${m2.toFixed(2)} m²`;
}

interface Props {
  distance: number | null;
  area: number | null;
  perimeter: number | null;
  unit: "m" | "cm";
  onSetUnit: (u: "m" | "cm") => void;
  onClear: () => void;
}

export function MeasurementHUD({ distance, area, perimeter, unit, onSetUnit, onClear }: Props) {
  if (distance === null && area === null) return null;

  return (
    <div
      className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-3 rounded-2xl"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(12px)", border: "1px solid rgba(59,130,246,0.3)" }}
    >
      {distance !== null && (
        <div className="text-center">
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Distance</p>
          <p style={{ color: "#60a5fa", fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>{fmtLen(distance, unit)}</p>
        </div>
      )}
      {area !== null && (
        <>
          <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.1)" }} />
          <div className="text-center">
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Area</p>
            <p style={{ color: "#34d399", fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>{fmtArea(area, unit)}</p>
          </div>
          {perimeter !== null && (
            <>
              <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.1)" }} />
              <div className="text-center">
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Perimeter</p>
                <p style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>{fmtLen(perimeter, unit)}</p>
              </div>
            </>
          )}
        </>
      )}
      <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.1)" }} />
      <div className="flex flex-col gap-1">
        {(["m", "cm"] as const).map(u => (
          <button key={u} onClick={() => onSetUnit(u)} style={{
            padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer",
            background: unit === u ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.05)",
            color: unit === u ? "#60a5fa" : "rgba(255,255,255,0.35)",
            border: `1px solid ${unit === u ? "rgba(59,130,246,0.5)" : "transparent"}`,
          }}>{u}</button>
        ))}
      </div>
      <button onClick={onClear}
        style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}>
        Clear
      </button>
    </div>
  );
}
