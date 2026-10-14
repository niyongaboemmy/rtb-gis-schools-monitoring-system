import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MeasurementListPanel, { type MeasurementRow } from "./MeasurementListPanel";

const rows: MeasurementRow[] = [
  {
    id: "a", name: "Court", kind: "measure_area", value: "450.5 m² plan", secondary: "Surface (sloped): 460.00 m²",
    source: "3d", createdByName: "Ana", createdAt: new Date().toISOString(), saved: true, canEdit: true, canDelete: true,
  },
  {
    id: "b", name: "Fence", kind: "measure_distance", value: "12.3 m", source: "2d", saved: false, canEdit: true, canDelete: true,
  },
  {
    id: "c", name: "Someone else's", kind: "note", value: "", source: "2d", createdByName: "Bo", saved: true, canEdit: false, canDelete: false,
  },
];

const base = { unit: "m" as const, onUnitChange: vi.fn(), onFlyTo: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };

describe("MeasurementListPanel (WS4.4)", () => {
  it("shows value, source badge, author and a Not saved badge", () => {
    render(<MeasurementListPanel {...base} rows={rows} />);
    expect(screen.getByText("450.5 m² plan")).toBeInTheDocument();
    expect(screen.getByText("Surface (sloped): 460.00 m²")).toBeInTheDocument();
    expect(screen.getByText("3D")).toBeInTheDocument();
    expect(screen.getAllByText("2D")).toHaveLength(2);
    expect(screen.getByText("Not saved")).toBeInTheDocument();
    expect(screen.getByText(/^Ana/)).toBeInTheDocument();
  });

  it("hides edit/delete without permission and flies on click", () => {
    render(<MeasurementListPanel {...base} rows={rows} onRename={vi.fn()} />);
    expect(screen.queryByLabelText("Delete Someone else's")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Delete Court")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Fence"));
    expect(base.onFlyTo).toHaveBeenCalledWith("b");
  });

  it("asks before clearing all, and hides export without the callback", async () => {
    const onClearAll = vi.fn();
    render(<MeasurementListPanel {...base} rows={rows} onClearAll={onClearAll} />);
    expect(screen.queryByText("Export CSV")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear all"));
    expect(onClearAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Yes, clear"));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("renames via the inline field", () => {
    const onRename = vi.fn();
    render(<MeasurementListPanel {...base} rows={rows} onRename={onRename} />);
    fireEvent.click(screen.getByLabelText("Rename Court"));
    const input = screen.getByLabelText("Measurement name");
    fireEvent.change(input, { target: { value: "Basketball court" } });
    fireEvent.submit(input.closest("form")!);
    expect(onRename).toHaveBeenCalledWith("a", "Basketball court");
  });
});
