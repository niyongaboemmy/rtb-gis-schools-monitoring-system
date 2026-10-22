import { describe, expect, it, beforeEach } from "vitest";
import {
  VIEWER_TOOLS,
  accuracyLabel,
  formatMeasureArea,
  formatMeasureLength,
  loadDisplayUnit,
  readViewerDeepLink,
  saveDisplayUnit,
  toolsFor,
  viewerLink,
} from "./viewer-tools";
import { Permission } from "./permissions";

describe("viewer tool vocabulary (WS4.1)", () => {
  it("hides tools the user lacks permission for", () => {
    const none = toolsFor("3d", () => false).map((t) => t.id);
    expect(none).toEqual(["navigate"]);
    const measureOnly = toolsFor("2d", (p) => p === Permission.USE_MEASURE_TOOLS).map((t) => t.id);
    expect(measureOnly).toContain("measure_distance");
    expect(measureOnly).not.toContain("measure_height"); // 3D only
    expect(measureOnly).not.toContain("annotate");
  });

  it("gives each tool the documented permission", () => {
    expect(VIEWER_TOOLS.navigate.permission).toBeNull();
    expect(VIEWER_TOOLS.measure_area.permission).toBe(Permission.USE_MEASURE_TOOLS);
    expect(VIEWER_TOOLS.annotate.permission).toBe(Permission.SAVE_SITE_FEATURES);
    expect(VIEWER_TOOLS.export.permission).toBe(Permission.EXPORT_VIEWER_DATA);
    expect(VIEWER_TOOLS.set_location.permission).toBe(Permission.EDIT_SCHOOL_LOCATION);
    expect(VIEWER_TOOLS.overlays.permission).toBe(Permission.EDIT_SITE_ANNOTATIONS);
  });

  it("has unique shortcuts", () => {
    const keys = Object.values(VIEWER_TOOLS).map((t) => t.shortcut).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("honest precision (WS6.5)", () => {
  it("2D to 0.1 m, 3D to 0.01 m, never millimetres", () => {
    expect(formatMeasureLength(12.3456, "2d")).toBe("12.3 m");
    expect(formatMeasureLength(12.3456, "3d")).toBe("12.35 m");
    expect(formatMeasureLength(12.3456, "3d", "ft")).toBe("40.5 ft");
    expect(formatMeasureLength(12.3456, "2d", "ft")).toBe("41 ft");
  });

  it("shows hectares from 10,000 m²", () => {
    expect(formatMeasureArea(12_500, "2d")).toContain("1.25 ha");
    expect(formatMeasureArea(450.55, "2d")).toBe("450.6 m²");
  });

  it("labels accuracy as provisional", () => {
    expect(accuracyLabel("2d")).toBe("±0.5 m (provisional)");
    expect(accuracyLabel("3d")).toBe("±0.10 m (provisional)");
  });
});

describe("unit preference per user", () => {
  beforeEach(() => localStorage.clear());
  it("is stored under a key that includes the user id", () => {
    saveDisplayUnit("u1", "ft");
    expect(loadDisplayUnit("u1")).toBe("ft");
    expect(loadDisplayUnit("u2")).toBe("m");
  });
});

describe("deep links (WS5.6)", () => {
  it("round-trips building + coordinates", () => {
    const url = viewerLink("2d", "s1", { buildingId: "b1", lat: -1.9, lng: 30.1 });
    expect(url.startsWith("/schools/s1/3dview?")).toBe(true);
    const d = readViewerDeepLink(url.split("?")[1]);
    expect(d).toEqual({ buildingId: "b1", lat: -1.9, lng: 30.1, view: "map", tab: null, reportId: null });
    expect(readViewerDeepLink("buildingId=x").buildingId).toBe("x");
    expect(viewerLink("3d", "s1", { buildingId: "b1" })).toBe("/schools/s1/3dview?building=b1&view=3d");
  });

  it("opens a building's report on the map", () => {
    const url = viewerLink("2d", "s1", { buildingId: "b1", reportId: "r1" });
    const d = readViewerDeepLink(url.split("?")[1]);
    expect(d).toMatchObject({ buildingId: "b1", reportId: "r1", tab: "reporting" });
    expect(readViewerDeepLink("building=b1&tab=media").tab).toBe("media");
    expect(readViewerDeepLink("building=b1&tab=nope").tab).toBeNull();
  });
});
