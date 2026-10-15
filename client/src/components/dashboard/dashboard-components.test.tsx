import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../ui/tooltip";
import { SchoolStatsCards } from "./SchoolStatsCards";
import { DecisionIntelligenceScore } from "./DecisionIntelligenceScore";
import { RiskAssessment, type RiskAssessmentData } from "./RiskAssessment";
import { DashboardEmpty, DashboardError } from "./DashboardStates";

describe("<SchoolStatsCards />", () => {
  it("renders server figures with units from format.ts", () => {
    render(
      <SchoolStatsCards
        metrics={{
          totalStudents: 380,
          totalCapacity: 400,
          capacityUtilisation: 95,
          totalStaff: 24,
          studentToTeacherRatio: 23.8,
          buildingCount: 3,
          avgBuildingAge: 25,
          usedLandArea: 2.5,
          totalLandArea: 4,
          usedLandPct: 62.5,
          educationProgramsCount: 2,
          roadStatusPercentage: 60,
        }}
      />,
    );
    expect(screen.getByText("2.50 ha")).toBeInTheDocument();
    expect(screen.getByText("4.00 ha total")).toBeInTheDocument();
    expect(screen.getByText("95.0% of capacity")).toBeInTheDocument();
    expect(screen.getByText("23.8:1 students per teacher")).toBeInTheDocument();
  });

  it("says when capacity is missing instead of showing a blank", () => {
    render(<SchoolStatsCards metrics={{ totalStudents: 10, capacityUtilisation: null }} />);
    expect(screen.getByText("No capacity data yet")).toBeInTheDocument();
    expect(screen.queryByText(/\dh\b/)).toBeNull();
  });
});

describe("<DecisionIntelligenceScore />", () => {
  it("uses the glossary name and flags estimated components", () => {
    render(
      <DecisionIntelligenceScore
        assessment={{
          overallScore: 50,
          infrastructureScore: 50,
          buildingAgeScore: 50,
          accessibilityScore: 50,
          populationPressureScore: 50,
          facilityComplianceScore: 50,
          resolutionRateScore: 50,
          urgencyMonths: 6,
          dataGaps: {
            infrastructure: true,
            buildingAge: false,
            accessibility: false,
            population: true,
            facilityCompliance: false,
            resolution: false,
          },
        }}
      />,
    );
    expect(screen.getAllByText("School Condition Score").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estimated — missing data")).toHaveLength(2);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0); // 50 → High priority
    expect(screen.queryByText(/Decision intelligence/i)).toBeNull();
  });
});

describe("<RiskAssessment />", () => {
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
    ],
    strategies: [],
    rules: { impact: "i", probability: "p" },
  };

  it("renders server values labelled Indicative", () => {
    render(
      <TooltipProvider>
        <RiskAssessment risk={risk} />
      </TooltipProvider>,
    );
    expect(screen.getByText("Indicative")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure deterioration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Infrastructure deterioration: how is this worked out/ })).toBeInTheDocument();
  });

  it("explains when risk is not available", () => {
    render(<RiskAssessment risk={null} />);
    expect(screen.getByText(/not available yet/)).toBeInTheDocument();
  });
});

describe("Dashboard states", () => {
  it("error state offers a retry", () => {
    render(<DashboardError onRetry={() => undefined} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
  });

  it("empty state links to where data is added", () => {
    render(
      <MemoryRouter>
        <DashboardEmpty description="Add a school." actionLabel="Go to schools" actionTo="/schools" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Go to schools" })).toHaveAttribute("href", "/schools");
  });
});
