import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "../ui/toast";

const get = vi.fn();
vi.mock("../../lib/api", () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

import { AuditTrailTab } from "./AuditTrailTab";

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-10-14T08:00:00.000Z",
  action: "school.update",
  outcome: "success",
  actorId: "u1",
  actorEmail: "jane@rtb.gov.rw",
  actorRole: "gis_analyst",
  targetType: "school",
  targetId: "22222222-2222-4222-8222-222222222222",
  targetLabel: "IPRC Kigali",
  subjectUserId: null,
  changes: { name: ["IPRC Kgl", "IPRC Kigali"], password: ["[REDACTED]", "[REDACTED]"] },
  meta: { method: "PATCH", route: "/schools/:id", status: 200 },
  ip: "41.186.1.2",
  userAgent: "Mozilla/5.0",
  sessionId: "sess-1",
  requestId: "req-abc",
  hash: "f".repeat(64),
};

const DENIED = {
  ...ROW,
  id: "33333333-3333-4333-8333-333333333333",
  action: "role.delete",
  outcome: "denied",
  actorEmail: "viewer@rtb.gov.rw",
  targetType: "role",
  targetLabel: null,
  changes: null,
};

function mockApi(pages: Array<{ data: unknown[]; nextCursor: string | null; total?: number }>) {
  let call = 0;
  get.mockImplementation((url: string) => {
    if (url === "/audit-logs/actions") return Promise.resolve({ data: ["role.delete", "school.update"] });
    if (url === "/audit-logs/verify")
      return Promise.resolve({ data: { ok: true, checked: 2, firstBrokenId: null } });
    if (url === "/audit-logs") return Promise.resolve({ data: pages[Math.min(call++, pages.length - 1)] });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

const renderTab = () =>
  render(
    <ToastProvider>
      <AuditTrailTab />
    </ToastProvider>,
  );

describe("AuditTrailTab", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("renders rows with plain-English actions, actor, and outcome", async () => {
    mockApi([{ data: [ROW, DENIED], nextCursor: null, total: 2 }]);
    renderTab();
    expect((await screen.findAllByText("Updated school")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deleted role").length).toBeGreaterThan(0);
    expect(screen.getAllByText("jane@rtb.gov.rw").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Denied").length).toBeGreaterThan(0);
    expect(screen.getByText("2 records")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/audit-logs", { params: { limit: 50 } });
  });

  it("opens the detail drawer with the diff and masks secrets", async () => {
    mockApi([{ data: [ROW], nextCursor: null, total: 1 }]);
    renderTab();
    const row = (await screen.findAllByRole("button", { name: /Updated school by jane@rtb.gov.rw/ }))[0];
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("IPRC Kgl")).toBeInTheDocument();
    expect(within(dialog).getAllByText("IPRC Kigali").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Changed (value hidden for security)")).toBeInTheDocument();
    expect(within(dialog).getByText("req-abc")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("loads more with the cursor", async () => {
    mockApi([
      { data: [ROW], nextCursor: "CURSOR1", total: 2 },
      { data: [DENIED], nextCursor: null },
    ]);
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/audit-logs", { params: { limit: 50, cursor: "CURSOR1" } }),
    );
    expect((await screen.findAllByText("Deleted role")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("filters by outcome chip", async () => {
    mockApi([{ data: [ROW], nextCursor: null, total: 1 }]);
    renderTab();
    await screen.findAllByText("Updated school");
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/audit-logs", { params: { limit: 50, outcome: "failure" } }),
    );
  });

  it("shows the empty state", async () => {
    mockApi([{ data: [], nextCursor: null, total: 0 }]);
    renderTab();
    expect(await screen.findByText("No activity recorded yet")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    get.mockImplementation((url: string) =>
      url === "/audit-logs"
        ? Promise.reject({ response: { status: 403 } })
        : Promise.resolve({ data: [] }),
    );
    renderTab();
    expect(
      await screen.findByText("You do not have permission to view the audit trail."),
    ).toBeInTheDocument();
  });

  it("verifies the chain", async () => {
    mockApi([{ data: [ROW], nextCursor: null, total: 1 }]);
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /Verify chain/ }));
    expect(await screen.findByText(/Chain intact/)).toBeInTheDocument();
  });
});
