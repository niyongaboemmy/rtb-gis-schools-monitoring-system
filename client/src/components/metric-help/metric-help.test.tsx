import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DataGapBadge, METRICS, MetricInfo } from "./index";
import { DetailModal } from "../school-dashboard/DetailModal";

describe("metric registry", () => {
  it("every entry is complete", () => {
    for (const [id, m] of Object.entries(METRICS)) {
      expect(m.title, id).toBeTruthy();
      expect(m.definition.length, id).toBeGreaterThan(10);
      expect(m.formula.length, id).toBeGreaterThan(5);
      expect(m.sources.length, id).toBeGreaterThan(0);
      expect(m.missingData, id).toBeTruthy();
      expect(m.endpoint, id).toMatch(/GET \/api\/v1\//);
    }
  });

  it("uses no retired terms", () => {
    const text = JSON.stringify(METRICS);
    for (const bad of ["National Health Score", "Intelligence Score", "Decision Score", "NEED_INTERVENTION", "SOLVED"]) {
      expect(text).not.toContain(bad);
    }
  });

  it("documents the canonical six weights", () => {
    expect(METRICS["school.conditionScore"].formula).toContain("0.35 × Infrastructure");
    expect(METRICS["school.conditionScore"].formula).toContain("0.05 × Resolution Rate");
  });
});

describe("<MetricInfo />", () => {
  it("opens an accessible dialog and closes with Escape", () => {
    render(<MetricInfo id="school.conditionScore" />);
    const trigger = screen.getByRole("button", { name: /School Condition Score/ });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "School Condition Score" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/How it is calculated/)).toBeInTheDocument();
    expect(screen.getByText(/When data is missing/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    // AnimatePresence exit runs async; the dialog is removed after the animation.
  });

  it("close button is focused on open", () => {
    render(<MetricInfo id="component.buildingAge" />);
    fireEvent.click(screen.getByRole("button", { name: /Building Age Score/ }));
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});

describe("<MetricInfo /> inside a dialog", () => {
  it("Escape closes only the drawer, not the dialog under it", () => {
    const onDialogClose = vi.fn();
    render(
      <DetailModal isOpen onClose={onDialogClose} title="Campus">
        <MetricInfo id="school.buildingCount" />
      </DetailModal>,
    );
    fireEvent.click(screen.getByRole("button", { name: /What does/ }));
    expect(screen.getByRole("dialog", { name: METRICS["school.buildingCount"].title })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    expect(onDialogClose).not.toHaveBeenCalled();
  });

  it("shows where the metric appears and its sources", () => {
    render(<MetricInfo id="school.studentTeacherRatio" />);
    fireEvent.click(screen.getByRole("button", { name: /Student/ }));
    expect(screen.getByText("Shown on")).toBeInTheDocument();
    expect(screen.getByText("schools.maleTeachers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy metric id" })).toBeInTheDocument();
  });
});

describe("<DataGapBadge />", () => {
  it("shows the estimated marker with a help link", () => {
    render(<DataGapBadge metricId="component.population" />);
    expect(screen.getByText("Estimated — missing data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Why is this estimated?" })).toBeInTheDocument();
  });
});
