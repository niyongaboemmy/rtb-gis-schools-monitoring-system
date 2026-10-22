/**
 * Regression tests for the dashboard calculation fixes
 * (docs/DASHBOARD_FIX_PLAN.md, phase 6): the client renders server figures
 * and never recounts them.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "../ui/tooltip";
import { PriorityDonut } from "./PriorityDonut";
import { wholePercentages } from "../../lib/percentages";
import { DecisionIntelligenceScore } from "./DecisionIntelligenceScore";

vi.mock("../../lib/api", () => ({
  api: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

describe("<PriorityDonut />", () => {
  it("percentages always add up to 100", () => {
    expect(wholePercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercentages([2, 1, 0, 4])).toEqual([29, 14, 0, 57]);
    expect(wholePercentages([0, 0])).toEqual([0, 0]);
  });

  it("shows the unassessed slice in the legend", () => {
    render(
      <PriorityDonut
        segments={[
          { key: "high", label: "High", value: 3, color: "#f00" },
          { key: "unassessed", label: "Not assessed", value: 1, color: "#999" },
        ]}
      />,
    );
    const item = screen.getByText("Not assessed").closest("li")!;
    expect(within(item).getByText("25%")).toBeInTheDocument();
  });
});

describe("<DecisionIntelligenceScore /> served model", () => {
  const base = {
    overallScore: 45,
    infrastructureScore: 50,
    buildingAgeScore: 30,
    accessibilityScore: 50,
    populationPressureScore: 50,
    facilityComplianceScore: 50,
    resolutionRateScore: 50,
    urgencyMonths: 3,
    priorityLevel: "high" as const,
    recommendations: [],
  };

  it("shows weights from the scoring model and the data coverage", () => {
    render(
      <TooltipProvider>
        <DecisionIntelligenceScore
          assessment={{
            ...base,
            dataCoverage: 0.25,
            scoringModel: {
              version: 2,
              weights: {
                infrastructure: 0.4,
                buildingAge: 0.2,
                accessibility: 0.1,
                population: 0.1,
                facilityCompliance: 0.15,
                resolution: 0.05,
              },
              bands: {
                critical: { min: 0, max: 34 },
                high: { min: 35, max: 54 },
                medium: { min: 55, max: 74 },
                low: { min: 75, max: 100 },
              },
              neutral: 50,
            },
          }}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText("weight 40%")).toBeInTheDocument();
    expect(screen.getByText(/25% of this score is from measured data/)).toBeInTheDocument();
    expect(screen.getByText(/treat the priority as provisional/)).toBeInTheDocument();
  });
});
