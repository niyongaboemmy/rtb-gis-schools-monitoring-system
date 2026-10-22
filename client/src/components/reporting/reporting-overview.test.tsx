import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../ui/tooltip";
import { ReportingOverview } from "./ReportingOverview";
import type { ReportingOverviewData } from "./types";

const data = (period: string): ReportingOverviewData => ({
  period: period as ReportingOverviewData["period"],
  from: null,
  to: "2026-10-22T10:00:00Z",
  bucket: "day",
  summary: { total: 4, critical: 1, pending: 1, resolved: 1, failed: 1, active: 3, resolutionRate: 25, avgResolutionDays: 4, oldestOpenDays: 12 },
  statusCounts: { pending: 1, needIntervention: 1, solved: 1, failed: 1 },
  schoolsAffected: 2,
  schoolCount: 7,
  previous: { total: 1, resolved: 0, resolutionRate: 0 },
  totalChangePct: 300,
  trend: [{ key: "2026-10-20", label: "20 Oct", created: 2, resolved: 1 }],
  schools: [
    { schoolId: "b", name: "Bravo VTC", code: null, district: "Huye", province: "Southern", total: 1, open: 1, needIntervention: 1, resolved: 0, resolutionRate: 0, oldestOpenDays: 2 },
  ],
  urgent: [{ id: "r1", schoolId: "b", schoolName: "Bravo VTC", description: "Roof leak", facilityId: null, createdAt: "2026-10-20T08:00:00Z" }],
});

const get = vi.fn((_url: string, opts?: { params?: { period?: string } }) => Promise.resolve({ data: { data: data(opts?.params?.period ?? "90d") } }));
vi.mock("../../lib/api", () => ({ api: { get: (url: string, opts?: { params?: { period?: string } }) => get(url, opts) } }));

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <TooltipProvider>{ui}</TooltipProvider>
    </MemoryRouter>,
  );

describe("<ReportingOverview />", () => {
  it("shows its skeleton, then the server figures for the last 90 days", async () => {
    wrap(<ReportingOverview onOpenReport={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading reporting overview…");
    expect(await screen.findByText("+300% vs previous")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/schools/dashboard/reporting/overview", expect.objectContaining({ params: { period: "90d" } }));
    expect(screen.getByText("of 7 active schools")).toBeInTheDocument();
    expect(screen.getByText("1 needs action")).toBeInTheDocument();
  });

  it("switching the period refetches; urgent reports open the report dialog", async () => {
    const onOpen = vi.fn();
    wrap(<ReportingOverview onOpenReport={onOpen} />);
    await screen.findByText("Roof leak");
    fireEvent.click(screen.getByRole("tab", { name: "12 months" }));
    expect(get).toHaveBeenLastCalledWith("/schools/dashboard/reporting/overview", expect.objectContaining({ params: { period: "12m" } }));
    fireEvent.click(screen.getByRole("button", { name: /Roof leak/ }));
    expect(onOpen).toHaveBeenCalledWith("r1");
    const row = screen.getByRole("rowheader", { name: /Bravo VTC/ }).closest("tr")!;
    expect(within(row).getByRole("link", { name: "Open Bravo VTC dashboard" })).toHaveAttribute("href", "/schools/b/decision");
  });
});
