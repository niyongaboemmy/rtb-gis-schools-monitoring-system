import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DecisionIntelligenceScore } from "./DecisionIntelligenceScore";
import { DashboardEmpty, DashboardError } from "./DashboardStates";

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
