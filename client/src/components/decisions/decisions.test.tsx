import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../ui/tooltip";
import { ToastProvider } from "../ui/toast";
import { weakestFactor, type DecisionRow } from "./decision-utils";
import { QueueRow } from "./QueueRow";
import AnalyticsDecisions from "../../pages/AnalyticsDecisions";

const rows: DecisionRow[] = [
  {
    id: "a",
    schoolId: "s-a",
    priorityLevel: "high",
    overallScore: "45.00",
    infrastructureScore: "50.00",
    buildingAgeScore: "30.00",
    facilityComplianceScore: 50,
    accessibilityScore: "50.00",
    populationPressureScore: "50.00",
    resolutionRateScore: 50,
    dataGaps: { infrastructure: true, buildingAge: false, facilityCompliance: true, accessibility: true, population: true, resolution: true },
    dataCoverage: "0.25",
    urgencyMonths: 6,
    estimatedBudgetRwf: "3500000.00",
    recommendations: ["[DATA] Record building conditions"],
    school: { name: "Byumba TSS", code: "TSS-NOR-001", district: "Gicumbi", province: "Northern Province" },
  },
  {
    id: "b",
    schoolId: "s-b",
    priorityLevel: "medium",
    overallScore: 62,
    urgencyMonths: 12,
    estimatedBudgetRwf: 1000000,
    school: { name: "Huye TSS", district: "Huye", province: "Southern Province" },
  },
];

const user = { current: { role: "super_admin" } as unknown };
vi.mock("../../store/authStore", () => ({ useAuthStore: () => ({ user: user.current }) }));
vi.mock("../../lib/api", () => ({
  api: {
    get: (url: string) =>
      Promise.resolve({
        data:
          url === "/analytics/decisions"
            ? rows
            : { scoredSchoolCount: 2, totalSchools: 3, nationalAvgScore: "53.5", avgDataCoverage: 0.4, totalEstimatedBudgetRwf: "4500000", byPriority: { high: 1, medium: 1 } },
      }),
    post: vi.fn(),
  },
  apiErrorMessage: (_e: unknown, f: string) => f,
}));

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

describe("decision utils", () => {
  it("the weakest factor ignores estimated ones (they are a neutral 50)", () => {
    expect(weakestFactor(rows[0])).toEqual({ key: "buildingAge", score: 30 });
    expect(weakestFactor(rows[1])).toBeNull();
  });
});

describe("<QueueRow />", () => {
  it("reads as one decision: rank, band, score, weakest factor, deadline, cost", () => {
    wrap(
      <ol>
        <QueueRow d={rows[0]} rank={1} index={0} onOpen={() => {}} />
      </ol>,
    );
    const row = screen.getByRole("button", { name: "1. Byumba TSS, High priority, score 45: open details" });
    expect(within(row).getByText("Building age")).toBeInTheDocument();
    expect(within(row).getByText("25% real data")).toBeInTheDocument();
    expect(within(row).getAllByText("Within 6 mo").length).toBeGreaterThan(0);
  });
});

describe("<AnalyticsDecisions />", () => {
  it("shows the skeleton, then the queue most urgent first, with details in a dialog", async () => {
    wrap(<AnalyticsDecisions />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading priorities…");
    const first = await screen.findByRole("button", { name: /^1\. Byumba TSS/ });
    expect(screen.getByRole("button", { name: /^2\. Huye TSS/ })).toBeInTheDocument();
    fireEvent.click(first);
    const dialog = screen.getByRole("dialog", { name: "Byumba TSS" });
    expect(within(dialog).getByText("Record building conditions")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Open school dashboard/ })).toHaveAttribute("href", "/schools/s-a/decision");
  });

  it("filters by priority and search", async () => {
    wrap(<AnalyticsDecisions />);
    await screen.findByRole("button", { name: /^1\. Byumba TSS/ });
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by priority" })).getByRole("button", { name: /Medium/ }));
    expect(screen.queryByRole("button", { name: /Byumba TSS/ })).toBeNull();
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by priority" })).getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schools" }), { target: { value: "gicumbi" } });
    expect(screen.getByRole("button", { name: /Byumba TSS/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Huye TSS/ })).toBeNull();
  });

  it("hides Recalculate without MANAGE_DECISIONS (the API would 403)", async () => {
    user.current = { role: { name: "viewer", permissions: [] } };
    wrap(<AnalyticsDecisions />);
    await screen.findByRole("button", { name: /Byumba TSS/ });
    expect(screen.queryByRole("button", { name: /Recalculate/ })).toBeNull();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Export/ })).toBeNull());
    user.current = { role: "super_admin" };
  });
});
