import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "../ui/tooltip";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { Recommendations } from "./Recommendations";
import { parseRecommendation } from "./recommendation-utils";
import { RiskCard } from "./RiskCard";
import { DataQualityCard } from "./DataQualityCard";
import { DetailModal } from "./DetailModal";
import { IssueReportsCard } from "./IssueReportsCard";
import { SchoolDashboardSkeleton } from "./SchoolDashboardSkeleton";
import type { SchoolMetrics } from "../dashboard/types";
import type { RiskAssessmentData } from "../dashboard/types";

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

const metrics = {
  overallScore: 70,
  infrastructureScore: 100,
  buildingAgeScore: 30,
  facilityComplianceScore: 100,
  accessibilityScore: 50,
  populationPressureScore: 50,
  resolutionRateScore: 50,
  priorityLevel: "medium",
  dataCoverage: 0.75,
  dataCompletenessScore: 80,
  dataGaps: {
    infrastructure: false,
    buildingAge: false,
    facilityCompliance: false,
    accessibility: true,
    population: true,
    resolution: true,
  },
  scoreDeltaFromDistrict: null,
  districtPeerCount: 0,
} as unknown as SchoolMetrics;

describe("<ScoreBreakdown />", () => {
  it("shows score × weight = points, adding up to the score", () => {
    wrap(<ScoreBreakdown metrics={metrics} />);
    const infra = screen.getByRole("rowheader", { name: /Building condition/ }).closest("tr")!;
    expect(within(infra).getByText("35")).toBeInTheDocument(); // 100 × 35 %
    expect(screen.getByText("Σ 70 → rounded")).toBeInTheDocument();
    expect(screen.getAllByText("No data")).toHaveLength(3);
    expect(screen.getAllByText("Recorded")).toHaveLength(3);
  });
});

describe("<Recommendations />", () => {
  const items = ["[URGENT] Fix block A", "[DATA] Record road access", "[PLAN] Renew roofs", "[OK] Fine"];

  it("parses the server tag", () => {
    expect(parseRecommendation("[DATA] Record x")).toMatchObject({ text: "Record x", tag: { label: "Data" } });
  });

  it("summary mode shows the first n and offers the full list", () => {
    const onViewAll = vi.fn();
    wrap(<Recommendations items={items} actions={[]} onToggle={() => {}} limit={3} onViewAll={onViewAll} />);
    expect(screen.queryByText("Fine")).toBeNull();
    fireEvent.click(screen.getByText("View all 4 recommendations"));
    expect(onViewAll).toHaveBeenCalled();
  });

  it("is read-only without MANAGE_DECISIONS (no 403 on click)", () => {
    const onToggle = vi.fn();
    wrap(<Recommendations items={items} actions={[]} onToggle={onToggle} canEdit={false} />);
    const box = screen.getAllByRole("button", { name: /Status Open/ })[0];
    expect(box).toBeDisabled();
    fireEvent.click(box);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("<RiskCard />", () => {
  it("lists only the factors that count as drivers", () => {
    const risk = {
      indicative: true,
      impactScore: 40,
      probabilityScore: 30,
      overall: { score: 50, level: "medium", rule: "" },
      factors: [
        { id: "resolutionTime", title: "Slow resolution times", level: "high", impact: 100, probability: 100, riskScore: 100, applies: true, mitigation: "", timeline: "", owner: "", rule: "" },
        { id: "b", title: "Failed repairs", level: "low", impact: 0, probability: 0, riskScore: 0, applies: false, mitigation: "", timeline: "", owner: "", rule: "" },
        { id: "c", title: "Demographic pressure", level: "unknown", impact: 0, probability: 0, riskScore: 0, applies: false, mitigation: "", timeline: "", owner: "", rule: "" },
      ],
      strategies: [],
      rules: { impact: "", probability: "" },
    } as RiskAssessmentData;
    wrap(<RiskCard risk={risk} onOpen={() => {}} />);
    const bars = screen.getByRole("list", { name: "Risk by factor" });
    expect(within(bars).getByText("Slow fixes")).toBeInTheDocument();
    expect(within(bars).queryByText(/Failed repairs/)).toBeNull(); // does not apply
    expect(screen.getByText(/1 without data/)).toBeInTheDocument();
  });
});

describe("<DataQualityCard />", () => {
  it("marks estimated components and says how to fix them", () => {
    wrap(<DataQualityCard metrics={metrics} />);
    const missing = screen.getByRole("list", { name: "Missing data to collect" });
    expect(missing).toHaveTextContent(/Population.*Load the population data/);
    expect(missing).not.toHaveTextContent("Building condition"); // measured → not listed
    expect(screen.getByText("80%")).toBeInTheDocument();
  });
});

describe("<IssueReportsCard />", () => {
  it("renders a dash, not 0, when nothing is loaded", () => {
    wrap(<IssueReportsCard summary={null} reporting={null} onOpen={() => {}} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("<DetailModal />", () => {
  it("renders into document.body (escapes the viewer's blurred overlay)", () => {
    const { container } = render(
      <div style={{ backdropFilter: "blur(4px)" }}>
        <DetailModal isOpen onClose={() => {}} title="Details">
          <p>inside</p>
        </DetailModal>
      </div>,
    );
    expect(container.textContent).not.toContain("inside");
    expect(document.body.textContent).toContain("inside");
  });
});

describe("SchoolDashboardSkeleton", () => {
  it("announces loading once and hides the shapes from assistive tech", () => {
    render(<SchoolDashboardSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading school dashboard…");
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("mirrors the page layout: 6 key-figure tiles, 6 cards, viewer chrome only on the page variant", () => {
    const { container, rerender } = render(<SchoolDashboardSkeleton />);
    const grids = container.querySelectorAll(".grid.grid-cols-2.xl\\:grid-cols-6, .grid.grid-cols-1.xl\\:grid-cols-3");
    expect(grids[0].children).toHaveLength(6);
    expect(grids[1].children).toHaveLength(6);
    expect(container.querySelector(".-translate-x-1\\/2")).toBeNull();
    rerender(<SchoolDashboardSkeleton variant="page" />);
    expect(container.querySelector(".-translate-x-1\\/2")).not.toBeNull();
  });
});
