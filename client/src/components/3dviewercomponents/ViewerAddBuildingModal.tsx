import React, { useState } from "react";

interface AddBuildingForm {
  name: string;
  code: string;
  function: string;
  floors: string;
  area: string;
  yearBuilt: string;
  condition: string;
  notes: string;
}

const EMPTY_FORM: AddBuildingForm = {
  name: "",
  code: "",
  function: "",
  floors: "",
  area: "",
  yearBuilt: "",
  condition: "",
  notes: "",
};

const FUNCTIONS = [
  "Classroom",
  "Laboratory",
  "Workshop",
  "Office",
  "Library",
  "Dormitory",
  "Cafeteria",
  "Storage",
  "Gym",
  "Other",
];
const CONDITIONS = ["good", "fair", "poor", "critical"];

interface ViewerAddBuildingModalProps {
  onAdd: (
    data: Omit<AddBuildingForm, "floors" | "area" | "yearBuilt"> & {
      floors?: number;
      area?: number;
      yearBuilt?: number;
    },
  ) => Promise<void>;
  onCancel: () => void;
}

export const ViewerAddBuildingModal: React.FC<ViewerAddBuildingModalProps> = ({
  onAdd,
  onCancel,
}) => {
  const [form, setForm] = useState<AddBuildingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof AddBuildingForm, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Building name is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onAdd({
        name: form.name.trim(),
        code: form.code.trim() || undefined!,
        function: form.function || undefined!,
        condition: form.condition || undefined!,
        notes: form.notes.trim() || undefined!,
        floors: form.floors ? Number(form.floors) : undefined,
        area: form.area ? Number(form.area) : undefined,
        yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : undefined,
      });
    } catch {
      setError("Failed to add building. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "rgba(6,11,26,0.98)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          width: 360,
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          animation: "panelInLeft .22s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background:
              "linear-gradient(to bottom, rgba(59,130,246,0.08), transparent)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg,#3b82f6,#2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            🏗
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.2px",
              }}
            >
              New Building
            </div>
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'JetBrains Mono',monospace",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginTop: 1,
              }}
            >
              Add to 3D viewer
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "none",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(232,232,240,0.45)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {error && (
            <div
              style={{
                fontSize: 10,
                color: "#ff7070",
                background: "rgba(255,70,70,0.1)",
                border: "1px solid rgba(255,70,70,0.2)",
                borderRadius: 7,
                padding: "7px 10px",
              }}
            >
              {error}
            </div>
          )}

          <Field label="Building Name *">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Block A"
              autoFocus
              required
            />
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Field label="Code">
              <input
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                placeholder="e.g. BLK-A"
              />
            </Field>
            <Field label="Year Built">
              <input
                type="number"
                value={form.yearBuilt}
                onChange={(e) => set("yearBuilt", e.target.value)}
                placeholder="e.g. 2010"
                min={1900}
                max={2100}
              />
            </Field>
          </div>

          <Field label="Function">
            <select
              value={form.function}
              onChange={(e) => set("function", e.target.value)}
            >
              <option value="">Select function…</option>
              {FUNCTIONS.map((f) => (
                <option key={f} value={f.toLowerCase()}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Field label="Floors">
              <input
                type="number"
                value={form.floors}
                onChange={(e) => set("floors", e.target.value)}
                placeholder="e.g. 2"
                min={1}
                max={50}
              />
            </Field>
            <Field label="Area (m²)">
              <input
                type="number"
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="e.g. 400"
                min={0}
              />
            </Field>
          </div>

          <Field label="Condition">
            <select
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
            >
              <option value="">Select condition…</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              style={{ resize: "vertical", minHeight: 48 }}
            />
          </Field>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(232,232,240,0.55)",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2,
                height: 34,
                borderRadius: 9,
                border: "1px solid rgba(59,130,246,0.5)",
                background: saving
                  ? "rgba(59,130,246,0.1)"
                  : "rgba(59,130,246,0.22)",
                color: saving ? "rgba(147,197,253,0.5)" : "#93c5fd",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10,
                fontWeight: 700,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Adding…" : "+ Add Building"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#e8e8f0",
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: 10,
  outline: "none",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ style?: React.CSSProperties }>;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 9,
          fontWeight: 600,
          color: "rgba(232,232,240,0.3)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {React.cloneElement(children, {
        style: {
          ...fieldInputStyle,
          ...(children.type === "textarea"
            ? { height: "auto", paddingTop: 8, paddingBottom: 8 }
            : {}),
          ...(children.props?.style || {}),
        },
      })}
    </div>
  );
}

export default ViewerAddBuildingModal;
