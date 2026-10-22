import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../ui/tooltip";
import { ToastProvider } from "../ui/toast";
import { actionsFor, type ReviewReport } from "./review-utils";
import { ReportAssessment } from "./ReportAssessment";
import Reports from "../../pages/Reports";
import ReportValidation from "../../pages/ReportValidation";
import { Pagination } from "./Pagination";

const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

const reports: ReviewReport[] = [
  { id: "r-new", schoolId: "s1", facilityId: "wash", itemId: "w1", status: "PENDING", type: "issue", description: "Tap broken", createdAt: iso(2), school: { name: "Alpha TSS", province: "North" }, reporter: { firstName: "Ana", lastName: "K" } },
  { id: "r-old", schoolId: "s2", facilityId: "wash", itemId: "w1", status: "PENDING", type: "issue", description: "Roof leaking", createdAt: iso(40), attachments: ["https://x/a.jpg"], school: { name: "Bravo VTC", province: "South" } },
  { id: "r-esc", schoolId: "s1", status: "NEED_INTERVENTION", type: "issue", description: "Wall crack", createdAt: iso(10), school: { name: "Alpha TSS", province: "North" }, reviewNote: "Engineer to visit", reviewedAt: iso(1), reviewer: { firstName: "Rita", lastName: "M" } },
  { id: "r-cr", schoolId: "s2", status: "PENDING", type: "data_change_request", createdAt: iso(3), school: { name: "Bravo VTC" }, changeRequest: { fields: [{ field: "roadStatusPercentage", currentValue: 40, proposedValue: 80 }], reason: "New road" } },
];

const patch = vi.fn((_url: string, body: { status: string; note?: string }) => Promise.resolve({ data: { status: body.status, reviewedAt: new Date().toISOString() } }));
vi.mock("../../lib/api", () => ({
  api: {
    get: (url: string) => Promise.resolve({ data: url === "/reports" ? { data: reports, total: reports.length } : [] }),
    patch: (url: string, body: { status: string; note?: string }) => patch(url, body),
  },
  apiErrorMessage: (_e: unknown, f: string) => f,
}));
vi.mock("../../hooks/useAuthorization", () => ({ useAuthorization: () => ({ isAuthorized: () => true }) }));
vi.mock("../../store/schoolsStore", () => ({
  useSchoolsStore: () => ({
    allSchools: [],
    fetchAllSchools: () => Promise.resolve(),
    facilities: [{ facilityId: "wash", title: "Washrooms", items: [{ id: "w1", label: "Running water" }] }],
    fetchFacilities: () => Promise.resolve(),
  }),
}));

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

describe("review actions", () => {
  it("offers the decisions that fit the report's state", () => {
    expect(actionsFor({ status: "PENDING", type: "issue" }).map((a) => a.key)).toEqual(["escalate", "resolve", "invalid"]);
    expect(actionsFor({ status: "NEED_INTERVENTION", type: "issue" }).map((a) => a.key)).toEqual(["resolve", "invalid", "reopen"]);
    expect(actionsFor({ status: "SOLVED", type: "issue" }).map((a) => a.key)).toEqual(["reopen"]);
    expect(actionsFor({ status: "PENDING", type: "data_change_request" }).map((a) => a.key)).toEqual(["approve", "reject"]);
  });
});

describe("<ReportAssessment />", () => {
  it("requires a note to mark a report invalid, and shows the last review", async () => {
    const onDecide = vi.fn(() => Promise.resolve());
    wrap(<ReportAssessment report={reports[0]} facilityTitle="Washrooms" itemLabel="Running water" onDecide={onDecide} />);
    expect(screen.getByRole("heading", { name: "Washrooms — Running water" })).toBeInTheDocument();
    expect(screen.getByText("Ana K")).toBeInTheDocument();
    // The reported problem is labelled, and the cursor waits in the note.
    expect(screen.getByRole("region", { name: "Reported problem" })).toHaveTextContent("Tap broken");
    expect(screen.getByRole("textbox", { name: /Note for the school/ })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /Not valid/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Add a short note/);
    expect(onDecide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Duplicate of last week" } });
    fireEvent.click(screen.getByRole("button", { name: /Not valid/ }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }), "Duplicate of last week"));
  });

  it("is read-only without permission", () => {
    wrap(<ReportAssessment report={reports[2]} facilityTitle={null} itemLabel={null} onDecide={null} />);
    expect(screen.getByText(/Only report managers can change it/)).toBeInTheDocument();
    expect(screen.getByText("“Engineer to visit”")).toBeInTheDocument();
  });
});

describe("<ReportValidation /> (two steps)", () => {
  it("step 1 shows only the list; opening a report shows only that report", async () => {
    wrap(<ReportValidation />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading reports to review…");
    const list = await screen.findByRole("list", { name: "Reports to review" });
    const rows = within(list).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Bravo VTC"); // 40 days old → first
    expect(screen.queryByRole("button", { name: "Needs action" })).toBeNull(); // no decision buttons yet

    fireEvent.click(rows[0]);
    expect(await screen.findByRole("region", { name: "Selected report" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Reports to review" })).toBeNull(); // the list is gone
    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/What did you find/), { target: { value: "District engineer assigned" } });
    fireEvent.click(screen.getByRole("button", { name: "Needs action" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/reports/r-old/status", { status: "NEED_INTERVENTION", note: "District engineer assigned" }));
    // A short confirmation, then the next report in the list.
    expect(await screen.findByText("Opening the next report…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("region", { name: "Selected report" })).toHaveTextContent("Change request"), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /Back to new reports/ }));
    expect(await screen.findByRole("list", { name: "Reports to review" })).toBeInTheDocument();
  });

  it("the Needs action list shows who sent it and why", async () => {
    wrap(<ReportValidation />);
    await screen.findByRole("list", { name: "Reports to review" });
    fireEvent.click(screen.getByRole("tab", { name: /^Needs action/ }));
    expect(screen.getByText(/Sent for action by Rita M/)).toBeInTheDocument();
  });
});

describe("<Pagination />", () => {
  it("shows the range and moves between pages", () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageSize={10} total={34} onChange={onChange} />);
    expect(screen.getByText("11–20 of 34")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe("<Reports /> dashboard", () => {
  it("summarises validation and links to the Validation page", async () => {
    wrap(<Reports />);
    expect(await screen.findByText("Where reports stand")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review reports/ })).toHaveAttribute("href", "/reports/validate");
    expect(screen.getByText("Waiting the longest")).toBeInTheDocument();
    expect(screen.getByText("Recent decisions")).toBeInTheDocument();
  });
});
