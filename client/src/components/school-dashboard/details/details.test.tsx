import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "../../ui/tooltip";
import type { FacilityBuilding, ReportingData, RiskAssessmentData, SchoolMetrics } from "../../dashboard/types";
import { DetailModal } from "../DetailModal";
import { ProfileDetail, ProfileSummary } from "./ProfileDetail";
import { RiskDetail, RiskSummary } from "./RiskDetail";
import { ReportsDetail, ReportsSummary } from "./ReportsDetail";
import { BuildingsDetail, BuildingsSummary } from "./BuildingsDetail";
import { ActionsSummary } from "./ActionsSummary";

vi.mock("../../../lib/api", () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("<DetailModal />", () => {
  it("is a labelled dialog with its header figures, and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <DetailModal isOpen onClose={onClose} title="Buildings" eyebrow="Kigali TSS" description="Every building." summary={<p>3 buildings</p>}>
        <p>body</p>
      </DetailModal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Buildings" });
    expect(dialog).toHaveAccessibleDescription("Every building.");
    expect(within(dialog).getByText("Kigali TSS")).toBeInTheDocument();
    expect(within(dialog).getByText("3 buildings")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(
      <DetailModal isOpen={false} onClose={() => {}} title="Hidden">
        x
      </DetailModal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("<ProfileDetail />", () => {
  const metrics = {
    totalStudents: 380,
    totalCapacity: 400,
    capacityUtilisation: 95,
    totalStaff: 24,
    totalTeachers: 16,
    studentToTeacherRatio: 23.8,
    buildingCount: 3,
    assessedBuildingCount: 1,
    avgBuildingAge: 25,
    usedLandArea: 2.5,
    totalLandArea: 4,
    usedLandPct: 62.5,
    educationProgramsCount: 2,
    roadStatusPercentage: 60,
  };

  it("renders server figures with units from format.ts", () => {
    wrap(<ProfileDetail metrics={metrics} />);
    expect(screen.getByText("2.50 ha")).toBeInTheDocument();
    expect(screen.getByText("of 4.00 ha")).toBeInTheDocument();
    expect(screen.getByText("95.0% of capacity")).toBeInTheDocument();
    expect(screen.getByText("23.8 : 1")).toBeInTheDocument();
    expect(screen.getByText("1 assessed")).toBeInTheDocument();
    expect(screen.getByText("60% · moderate")).toBeInTheDocument();
  });

  it("says what is missing instead of showing 0", () => {
    wrap(<ProfileDetail metrics={{ totalStudents: 10, capacityUtilisation: null }} />);
    expect(screen.getByText("No capacity data yet")).toBeInTheDocument();
    wrap(<ProfileSummary metrics={null} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});

const risk: RiskAssessmentData = {
  indicative: true,
  impactScore: 46,
  probabilityScore: 29,
  overall: { score: 12, level: "low", rule: "Overall rule text" },
  factors: [
    {
      id: "infrastructure",
      title: "Infrastructure deterioration",
      level: "medium",
      impact: 33,
      probability: 29,
      riskScore: 10,
      mitigation: "Fix things",
      timeline: "3–6 months",
      owner: "Facilities management",
      rule: "Infra rule",
    },
    {
      id: "population",
      title: "Demographic pressure on capacity",
      level: "unknown",
      impact: 0,
      probability: 0,
      riskScore: 0,
      applies: false,
      mitigation: "Run a population sync",
      timeline: "6–12 months",
      owner: "School administration",
      rule: "rule",
    },
  ],
  strategies: [
    { id: "s1", title: "Preventive maintenance", priority: "long-term", cost: "low", effectiveness: 70, description: "Plan it.", rule: "s rule" },
  ],
  rules: { impact: "i", probability: "p" },
};

describe("<RiskDetail />", () => {
  it("renders server values, labelled indicative, with a rule for each", () => {
    wrap(
      <>
        <RiskSummary risk={risk} />
        <RiskDetail risk={risk} />
      </>,
    );
    expect(screen.getByText(/^Indicative —/)).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument(); // drivers counted
    expect(screen.getByRole("button", { name: /Infrastructure deterioration: how is this worked out/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Risk map: 1 Infrastructure deterioration, impact 33, probability 29$/ })).toBeInTheDocument();
    expect(screen.getByText("Low cost")).toBeInTheDocument();
  });

  it("labels a factor without data as unknown and not counted", () => {
    wrap(<RiskDetail risk={risk} />);
    expect(screen.getByText("Unknown — no data")).toBeInTheDocument();
    expect(screen.getByText("Not counted in the overall risk")).toBeInTheDocument();
  });

  it("explains when risk is not available", () => {
    wrap(<RiskDetail risk={null} />);
    expect(screen.getByText(/not available yet/)).toBeInTheDocument();
  });
});

const months = Array.from({ length: 12 }, (_, i) => ({
  key: `2026-${String(i + 1).padStart(2, "0")}`,
  label: `M${i + 1}`,
  created: i === 11 ? 4 : i === 10 ? 2 : 0,
  resolved: i === 11 ? 1 : 0,
}));

const reporting: ReportingData = {
  summary: { total: 6, critical: 1, pending: 3, resolved: 2, failed: 0, active: 4, resolutionRate: 33, avgResolutionDays: null, oldestOpenDays: 45 },
  months,
  comparison: {
    current: { key: "2026-12", created: 4, resolved: 1 },
    previous: { key: "2026-11", created: 2, resolved: 0 },
    createdChangePct: 100,
    resolvedChangePct: null,
  },
  categoryTags: {},
  statusCounts: { pending: 3, needIntervention: 1, solved: 2, failed: 0 },
  lastReportDate: null,
  buildingsAttention: [],
};

describe("<ReportsDetail />", () => {
  it("header figures come from the payload (no local recount)", () => {
    wrap(<ReportsSummary data={reporting} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("2 of 6")).toBeInTheDocument();
    expect(screen.getByText("1 need intervention")).toBeInTheDocument();
    // No resolved report with a valid date → a dash, never "0.0"
    expect(screen.queryByText(/0\.0/)).toBeNull();
    expect(screen.getByText("Oldest open: 45 days")).toBeInTheDocument();
  });

  it("overview shows the status mix and the real monthly series", () => {
    wrap(<ReportsDetail schoolId="s" data={reporting} />);
    expect(screen.getByRole("img", { name: "Issue Reports by status" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /M12 4 filed, 1 resolved/ })).toBeInTheDocument();
    expect(screen.getByText("M12", { selector: "b" })).toBeInTheDocument(); // busiest month
    expect(screen.getByText("100% vs last month")).toBeInTheDocument();
  });

  it("the reports tab offers status filters with server counts", async () => {
    wrap(<ReportsDetail schoolId="s" data={reporting} />);
    fireEvent.click(screen.getByRole("tab", { name: /Reports/ }));
    const group = screen.getByRole("group", { name: "Filter by status" });
    expect(within(group).getByRole("button", { name: /Pending\s*3/ })).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByText("No Issue Reports for this school yet")).toBeInTheDocument();
  });
});

describe("<BuildingsDetail />", () => {
  const buildings: FacilityBuilding[] = [
    { id: "a", name: "Alpha", condition: "good", yearBuilt: 2010 },
    { id: "b", name: "Bravo", condition: "critical" },
    { id: "c", name: "Charlie", condition: null },
  ];

  it("lists worst first and filters by condition", () => {
    const onClick = vi.fn();
    wrap(<BuildingsDetail buildings={buildings} onBuildingClick={onClick} />);
    const names = screen.getAllByRole("button", { name: /show on map/ }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Bravo, Critical: show on map", "Alpha, Good: show on map", "Charlie, Not assessed: show on map"]);
    fireEvent.click(screen.getByRole("button", { name: /^Good/ }));
    expect(screen.getAllByRole("button", { name: /show on map/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Alpha, Good/ }));
    expect(onClick).toHaveBeenCalledWith(buildings[0]);
  });

  it("summary uses server counts and flags buildings that need work", () => {
    wrap(<BuildingsSummary buildings={buildings} metrics={{ buildingCount: 3, assessedBuildingCount: 2, avgBuildingAge: null, avgBuildingYear: null } as unknown as SchoolMetrics} />);
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByText("poor or critical").previousSibling).toHaveTextContent("1");
  });

  it("explains how to add buildings when there are none", () => {
    wrap(<BuildingsDetail buildings={[]} />);
    expect(screen.getByText("No buildings recorded yet")).toBeInTheDocument();
  });
});

describe("<ActionsSummary />", () => {
  it("counts done / in progress / open from the action rows", () => {
    wrap(
      <ActionsSummary
        items={["a", "b", "c", "d"]}
        actions={[
          { recommendation: "a", status: "done" },
          { recommendation: "b", status: "in_progress" },
        ] as never}
      />,
    );
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(screen.getByText("25% complete")).toBeInTheDocument();
    expect(screen.getByText("not started").previousSibling).toHaveTextContent("2");
  });
});
