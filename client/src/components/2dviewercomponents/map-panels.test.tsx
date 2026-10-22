import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BuildingsListPanel } from "./BuildingsListPanel";
import { BlockInspector } from "../BlockInspector";
import { MediaViewer } from "./media/MediaViewer";
import { MapToolbar } from "./MapToolbar";
import { BuildingMediaTab } from "./BuildingMediaTab";
import { fileApi } from "../../lib/api";
import { collectMedia } from "./media/media-utils";
import { buildingCondition } from "./building-utils";
import type { BuildingData } from "../school-form-steps/BuildingsStep";
import type { ReviewReport } from "../report-review/review-utils";

vi.mock("../../pages/SchoolReporting", () => ({ default: () => null }));
vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), patch: vi.fn() }, fileApi: { post: vi.fn() }, apiErrorMessage: (_e: unknown, m: string) => m }));
const toastError = vi.fn();
vi.mock("../ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: toastError }) }));

const building = (id: string, name: string, extra: Partial<BuildingData> = {}): BuildingData =>
  ({
    id,
    buildingName: name,
    buildingCode: "",
    buildingFunction: "classroom",
    buildingFloors: "",
    buildingArea: "120",
    buildingYearBuilt: "",
    buildingCondition: "",
    buildingRoofCondition: "",
    buildingStructuralScore: "",
    buildingNotes: "",
    facilities: [],
    geolocation: { latitude: -1.9, longitude: 30 },
    media: [],
    ...extra,
  }) as BuildingData;

const report = (id: string, status: ReviewReport["status"], buildingId = "b1"): ReviewReport => ({
  id,
  schoolId: "s1",
  buildingId,
  status,
  description: `Problem ${id}`,
  createdAt: new Date().toISOString(),
});

describe("building condition", () => {
  it("treats a building nobody checked as not checked, not fair", () => {
    expect(buildingCondition(building("b", "A")).overall).toMatchObject({ key: "none", pct: null });
    expect(buildingCondition(building("b", "A", { buildingCondition: "good", buildingRoofCondition: "poor" })).overall.key).toBe("fair");
  });
});

describe("BuildingsListPanel", () => {
  const counts = new Map([["b2", { waiting: 1, action: 1, open: 2 }]]);
  const list = [building("b1", "Block A"), building("b2", "Block B")];

  it("shows open report counts and filters to buildings with reports", async () => {
    render(<BuildingsListPanel buildings={list} counts={counts} onClose={vi.fn()} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText("2 open reports")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /With reports/ }));
    await waitFor(() => expect(screen.queryByText("Block A")).not.toBeInTheDocument());
    expect(screen.getByText("Block B")).toBeInTheDocument();
  });

  it("hides add and delete without permission", () => {
    render(<BuildingsListPanel buildings={list} canEdit={false} onAdd={vi.fn()} onClose={vi.fn()} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Add building" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete Block/ })).not.toBeInTheDocument();
  });
});

describe("BlockInspector", () => {
  const base = {
    building: building("b1", "Block A", { media: [{ path: "https://x/a.jpg", type: "image", title: "Front", createdAt: "" }] as BuildingData["media"] }),
    schoolId: "s1",
    onClose: vi.fn(),
    onUpdateBuilding: vi.fn(),
    reportsLoaded: true,
    canEditMedia: false,
    canCreateReport: false,
    canOpenReview: true,
    onReportPatched: vi.fn(),
    onReportSubmitted: vi.fn(),
    onOpenMedia: vi.fn(),
  };

  it("flags open reports and jumps to them", async () => {
    render(
      <MemoryRouter>
        <BlockInspector {...base} reports={[report("r1", "PENDING"), report("r2", "SOLVED")]} canDecide={() => true} />
      </MemoryRouter>,
    );
    const alert = screen.getByRole("button", { name: /1 open report/ });
    expect(alert).toHaveTextContent("Review");
    fireEvent.click(alert);
    expect(screen.getByRole("tab", { name: /Reports/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Problem r1")).toBeInTheDocument();
  });

  it("opens a deep-linked report with the decision panel only for deciders", () => {
    const { unmount } = render(
      <MemoryRouter>
        <BlockInspector {...base} initialTab="reporting" initialReportId="r1" reports={[report("r1", "PENDING")]} canDecide={() => true} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Your decision")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Review reports" })).toHaveAttribute("href", "/reports/validate?report=r1");
    unmount();
    render(
      <MemoryRouter>
        <BlockInspector {...base} initialTab="reporting" initialReportId="r1" reports={[report("r1", "PENDING")]} canDecide={() => false} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Your decision")).not.toBeInTheDocument();
  });

  it("gates edit and report actions", () => {
    render(
      <MemoryRouter>
        <BlockInspector {...base} reports={[]} canDecide={() => false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report a problem/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Front" }));
    expect(base.onOpenMedia).toHaveBeenCalledWith(0);
  });
});

describe("MediaViewer", () => {
  const items = collectMedia([
    building("b1", "Block A", { media: [{ path: "https://x/a.jpg", type: "image", title: "Front", createdAt: "" }] as BuildingData["media"] }),
    building("b2", "Block B", { media: [{ path: "https://x/b.jpg", type: "image", title: "Roof", createdAt: "" }] as BuildingData["media"] }),
  ]);

  it("names the building and moves across buildings", () => {
    const onIndexChange = vi.fn();
    const onReports = vi.fn();
    render(<MediaViewer items={items} index={0} onIndexChange={onIndexChange} onClose={vi.fn()} openReports={(id) => (id === "b1" ? 3 : 0)} onReports={onReports} onGallery={vi.fn()} onBuildings={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Block A")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reports for Block A, 3 open" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Gallery/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenCalledWith(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Reports for Block A, 3 open" }));
    expect(onReports).toHaveBeenCalledWith("b1", undefined);
  });
});

describe("BlockInspector default tab", () => {
  it("opens on Media", () => {
    render(
      <MemoryRouter>
        <BlockInspector
          building={building("b1", "Block A")}
          schoolId="s1"
          onClose={vi.fn()}
          onUpdateBuilding={vi.fn()}
          reports={[]}
          reportsLoaded
          canEditMedia={false}
          canCreateReport={false}
          canOpenReview={false}
          canDecide={() => false}
          onReportPatched={vi.fn()}
          onReportSubmitted={vi.fn()}
          onOpenMedia={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("tab", { name: /Media/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("BuildingMediaTab upload checks", () => {
  it("rejects types and sizes the file server refuses, before uploading", async () => {
    const { container } = render(
      <BuildingMediaTab building={building("b1", "Block A")} schoolId="s1" canEdit onUpdateBuilding={vi.fn()} onOpen={vi.fn()} />,
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const mov = new File(["x"], "clip.mov", { type: "video/quicktime" });
    const big = new File(["x"], "huge.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [mov, big] } });
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(toastError.mock.calls[0][0]).toMatch(/clip\.mov/);
    expect(toastError.mock.calls[1][0]).toMatch(/huge\.jpg.*10 MB/);
    expect(fileApi.post).not.toHaveBeenCalled();
  });
});

describe("MapToolbar", () => {
  const props = {
    showNavigator: false,
    setShowNavigator: vi.fn(),
    showOpacitySlider: false,
    setShowOpacitySlider: vi.fn(),
    basemapStyle: "google",
    switchBasemap: vi.fn(),
    measurementMode: "none" as const,
    setMeasurementMode: vi.fn(),
    clearMeasurements: vi.fn(),
    activeTool: "none",
    setActiveTool: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onHome: vi.fn(),
    onExportPng: vi.fn(),
    showBasicInfo: false,
    setShowBasicInfo: vi.fn(),
    kmzOpacity: 1,
    setKmzOpacity: vi.fn(),
    visuals: { brightness: 1, contrast: 1, saturation: 1 },
    setVisuals: vi.fn(),
    showPlacesOverlay: false,
    setShowPlacesOverlay: vi.fn(),
    showBuildingsList: false,
    setShowBuildingsList: vi.fn(),
  };

  it("groups measuring tools in a flyout and picks one", async () => {
    render(<MapToolbar {...props} />);
    const group = screen.getByRole("button", { name: "Measure" });
    expect(group).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(group);
    const flyout = await screen.findByRole("dialog", { name: "Measure" });
    fireEvent.click(within(flyout).getByRole("button", { name: /Area/ }));
    expect(props.setMeasurementMode).toHaveBeenCalledWith("area");
  });

  it("shows tool names by default, and remembers when they are hidden", () => {
    const { unmount } = render(<MapToolbar {...props} />);
    expect(screen.getByText("Reset view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide names" }));
    expect(screen.queryByText("Reset view")).not.toBeInTheDocument();
    unmount();
    render(<MapToolbar {...props} />);
    expect(screen.queryByText("Reset view")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show names" }));
  });
});
