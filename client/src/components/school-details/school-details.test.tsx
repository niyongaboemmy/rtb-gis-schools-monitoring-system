import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { TooltipProvider } from "../ui/tooltip";
import { SurveyCard, type Facility, type SurveyItem } from "./SurveyCard";
import { SchoolDetailsSkeleton } from "./SchoolDetailsSkeleton";
import { LandAccessCard, ContactCard } from "./cards";
import { SchoolDetailsPanel } from "../2dviewercomponents/SchoolDetailsPanel";

const get = vi.fn((url: string) => {
  if (url === "/schools/facilities") return Promise.resolve({ data: facilities });
  if (url.endsWith("/survey")) return Promise.resolve({ data: survey });
  return Promise.resolve({ data: { totalLandArea: 4, usedLandArea: 2.5, unusedLandArea: 1.5, usedLandPct: 62.5, facilityComplianceScore: 75 } });
});
vi.mock("../../lib/api", () => ({ api: { get: (url: string) => get(url) } }));

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

const facilities: Facility[] = [
  { facilityId: "wash", title: "Washrooms", items: [{ id: "w1", label: "Running water" }, { id: "w2", label: "Separate rooms" }] },
  { facilityId: "lib", title: "Library", items: [{ id: "l1", label: "Shelves" }] },
];
const survey: SurveyItem[] = [
  { id: "a", facilityId: "wash", itemId: "w1", compliance: "partial", notes: "Tap leaks" },
  { id: "b", facilityId: "wash", itemId: "gone", compliance: "compliant" }, // not on the checklist
];

describe("<SurveyCard />", () => {
  it("matches records to checklist items and opens groups that need attention", () => {
    wrap(<SurveyCard facilities={facilities} survey={survey} complianceScore={75} />);
    expect(screen.getByText("1 of 3 items surveyed")).toBeInTheDocument();
    const wash = screen.getByText("Washrooms").closest("details")!;
    const lib = screen.getByText("Library").closest("details")!;
    expect(wash).toHaveAttribute("open");
    expect(lib).not.toHaveAttribute("open");
    expect(within(wash).getByText("“Tap leaks”")).toBeInTheDocument();
    expect(within(wash).getAllByText("Not surveyed")).toHaveLength(1);
  });
});

describe("Details cards", () => {
  it("land is in hectares from the server, never m²", () => {
    wrap(<LandAccessCard school={{ usedLandArea: 2.5 }} metrics={{ totalLandArea: 4, usedLandArea: 2.5, unusedLandArea: 1.5 } as never} />);
    expect(screen.getByText("4.00 ha")).toBeInTheDocument();
    expect(screen.queryByText(/m²/)).toBeNull();
  });

  it("missing contacts read as not recorded, without dead links", () => {
    wrap(<ContactCard school={{ phone: "", email: null }} />);
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("<SchoolDetailsPanel />", () => {
  it("shows its skeleton, then the record", async () => {
    wrap(<SchoolDetailsPanel school={{ id: "s1", name: "Byumba TSS", code: "TSS-NOR-001", status: "active", buildings: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading school details…");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Byumba TSS" })).toBeInTheDocument());
    expect(screen.getByText("1 of 3 checked")).toBeInTheDocument();
  });

  it("the skeleton is announced once and hides its shapes", () => {
    render(<SchoolDetailsSkeleton />);
    expect(screen.getByRole("status").querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
