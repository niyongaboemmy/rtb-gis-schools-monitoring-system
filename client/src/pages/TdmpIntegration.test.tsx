import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "../components/ui/toast";
import type { ConnectionReport, SyncRun, TdmpStatus, UnlinkedSchool } from "../lib/tdmp";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

let national = true;
vi.mock("../hooks/useScope", () => ({ useScope: () => ({ isNational: national }) }));

import TdmpIntegration from "./TdmpIntegration";

const totals = { fetched: 391, created: 373, linked: 2, updated: 0, unchanged: 0, skippedNoGps: 16, skipped: 0, failed: 0, missing: 0, deactivated: 0, details: 391 };

const SYNC: SyncRun = {
  id: "11111111-1111-4111-8111-111111111111",
  trigger: "manual",
  status: "completed",
  dryRun: false,
  startedAt: "2026-11-12T08:11:26.000Z",
  finishedAt: "2026-11-12T08:11:58.000Z",
  totals,
  errors: [],
  progress: null,
  triggeredBy: "admin@rtb.gov.rw",
  report: {
    tdmpMaterialisedAt: "2026-11-12T04:00:34.000Z",
    changes: [],
    newLinks: [{ code: "270501", name: "ACEJ KARAMA", district: "Muhanga", localName: "ACEJ Karama TSS", fields: ["name"] }],
    created: [],
    needsLocation: [{ code: "270601", name: "ACODES MUSHISHIRO", district: "Muhanga", reason: "TDMP has no GPS inside Rwanda" }],
    missing: [],
    gisOnly: [],
    skipped: [],
  },
};

const settings = {
  autoSync: false,
  probeIntervalMinutes: 60,
  dailyRunAt: "07:15",
  lastProbeAt: "2026-11-12T07:30:00.000Z",
  tdmpMaterialisedAt: "2026-11-12T04:00:34.000Z",
  updatedAt: null,
  updatedBy: null,
  probeIntervals: [15, 30, 60, 180, 360],
  nextDailyRunAt: null,
};

const status = (over: Partial<TdmpStatus> = {}): TdmpStatus => ({
  enabled: { login: false, sync: true },
  authMode: "local",
  running: false,
  currentRun: null,
  lastRun: SYNC,
  lastSuccessAt: new Date().toISOString(),
  linkedSchools: 374,
  unlinkedSchools: 1,
  settings,
  ...over,
});

const UNLINKED: UnlinkedSchool[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "TSS-SOU-001",
    name: "FR RAMON TSS KABUGA",
    district: "Kamonyi",
    hasGisData: true,
    suggestion: { schoolCode: "280705", schoolName: "Fr Ramon KABUGA TSS" },
  },
];

const CONNECTION: ConnectionReport = {
  checkedAt: new Date().toISOString(),
  configured: { apiKey: true, oauthClient: false, baseUrl: "https://tdmp.rtb.gov.rw/api/v1" },
  reachable: true,
  authorised: true,
  latencyMs: 180,
  tdmpMaterialisedAt: "2026-11-12T04:00:34.000Z",
  tvetSchools: 391,
  endpoints: [
    { key: "schools", label: "School list", path: "/schools", status: 200, ms: 180, ok: true },
    { key: "trades", label: "Programme names", path: "/trades", status: 403, ms: 90, ok: false, request: "R1" },
  ],
  requests: [
    { id: "R1", title: "Aggregate reports", priority: "P2", state: "waiting", evidence: "0 of 3 endpoints readable" },
    { id: "R7", title: "TDMP role catalogue", priority: "P1", state: "done", evidence: "1 role mapped" },
  ],
};

function mockApi(statuses: TdmpStatus[], unlinked: UnlinkedSchool[] = UNLINKED, runs: SyncRun[] = [SYNC]) {
  let i = 0;
  get.mockImplementation((url: string) => {
    if (url === "/tdmp/status") return Promise.resolve({ data: statuses[Math.min(i++, statuses.length - 1)] });
    if (url === "/tdmp/sync/runs") return Promise.resolve({ data: runs });
    if (url === "/tdmp/schools/unlinked") return Promise.resolve({ data: unlinked });
    if (url === "/tdmp/connection") return Promise.resolve({ data: CONNECTION });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

const renderPage = () =>
  render(
    <ToastProvider>
      <TdmpIntegration />
    </ToastProvider>,
  );

const hero = () => screen.getByRole("region", { name: "TDMP integration" });

beforeEach(() => {
  national = true;
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});

describe("TDMP integration dashboard", () => {
  it("summarises setup, coverage, schools, last sync and schedule", async () => {
    mockApi([status()]);
    renderPage();
    const h = await screen.findByRole("region", { name: "TDMP integration" });
    // connect, preview, first sync done · link, locate, automate open
    expect(await within(h).findByRole("button", { name: /Setup: 3\/6/ })).toBeInTheDocument();
    expect(within(h).getByRole("button", { name: /Data coverage: \d+%/ })).toBeInTheDocument();
    expect(within(h).getByText("374 / 375")).toBeInTheDocument();
    expect(within(h).getByText("Paused")).toBeInTheDocument();

    const attention = screen.getByRole("region", { name: "Needs attention" });
    expect(within(attention).getByText("Schools without a map location")).toBeInTheDocument();
    expect(within(attention).getByText("Schools not linked to TDMP")).toBeInTheDocument();
  });

  it("starts a sync from the header and follows its progress", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const runningRun: SyncRun = { ...SYNC, id: "33333333-3333-4333-8333-333333333333", status: "running", finishedAt: null, report: null, progress: { phase: "schools", done: 120, total: 391 } };
      const finished: SyncRun = { ...runningRun, status: "completed", progress: null, finishedAt: "2026-11-12T08:13:00.000Z", report: SYNC.report };
      mockApi([status(), status({ running: true, currentRun: runningRun }), status({ lastRun: finished })]);
      post.mockResolvedValue({ data: { started: true } });
      renderPage();

      await screen.findByRole("button", { name: /Setup:/ });
      fireEvent.click(within(hero()).getByRole("button", { name: "Sync now" }));
      await waitFor(() => expect(post).toHaveBeenCalledWith("/tdmp/sync", { dryRun: false }));
      expect(await screen.findByText("Updating schools · 120 of 391")).toBeInTheDocument();
      expect(within(hero()).getByRole("button", { name: /Syncing/ })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(await screen.findByText(/TDMP sync finished/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs a dry run from the header", async () => {
    mockApi([status()]);
    post.mockResolvedValue({ data: {} });
    renderPage();
    await screen.findByRole("button", { name: /Setup:/ });
    fireEvent.click(within(hero()).getByRole("button", { name: "Dry run" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/tdmp/sync", { dryRun: true }));
  });

  it("each setup step opens its explanation and action", async () => {
    mockApi([status()], []);
    patch.mockResolvedValue({ data: {} });
    renderPage();
    const stepper = await screen.findByRole("region", { name: "Setup progress" });
    fireEvent.click(within(stepper).getByRole("button", { name: /Step 6: Turn on automatic sync/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Checks TDMP every hour/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/tdmp/settings", { autoSync: true }));
  });

  it("a data area opens which fields are live and which wait on TDMP", async () => {
    mockApi([status()]);
    renderPage();
    const data = await screen.findByRole("region", { name: "Data from TDMP" });
    fireEvent.click(await within(data).findByRole("button", { name: /Enrolment: 2 of 6 live/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText("Live")).toHaveLength(2);
    expect(within(dialog).getAllByText(/Waiting · R1/)).toHaveLength(3);
    expect(within(dialog).getByText(/Waiting · R2/)).toBeInTheDocument();
  });

  it("changes the schedule in its modal", async () => {
    mockApi([status()]);
    patch.mockResolvedValue({ data: {} });
    renderPage();
    await screen.findByRole("button", { name: /Setup:/ });
    fireEvent.click(within(hero()).getByRole("button", { name: /Automatic sync/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("switch"));
    fireEvent.change(within(dialog).getByLabelText(/Check TDMP for changes/), { target: { value: "30" } });
    fireEvent.change(within(dialog).getByLabelText(/Daily full run at/), { target: { value: "06:45" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/tdmp/settings", { autoSync: true, probeIntervalMinutes: 30, dailyRunAt: "06:45" }));
  });

  it("opens a run's report from recent activity", async () => {
    mockApi([status()]);
    renderPage();
    const activity = await screen.findByRole("region", { name: "Recent activity" });
    fireEvent.click(await within(activity).findByRole("button", { name: /Manual/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Schools linked/ }));
    expect(within(dialog).getByText("In RTB GIS: ACEJ Karama TSS")).toBeInTheDocument();
  });

  it("links an unlinked school with the suggested code", async () => {
    mockApi([status()]);
    post.mockResolvedValue({ data: {} });
    renderPage();
    const attention = await screen.findByRole("region", { name: "Needs attention" });
    fireEvent.click(await within(attention).findByRole("button", { name: /Schools not linked to TDMP/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Link to 280705/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/tdmp/schools/${UNLINKED[0].id}/link`, { schoolCode: "280705" }));
  });

  it("adds a school TDMP has no GPS for", async () => {
    mockApi([status()]);
    post.mockResolvedValue({ data: {} });
    renderPage();
    const attention = await screen.findByRole("region", { name: "Needs attention" });
    fireEvent.click(await within(attention).findByRole("button", { name: /Schools without a map location/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Add with location/ }));
    fireEvent.change(within(dialog).getByLabelText("Latitude"), { target: { value: "-2.05" } });
    fireEvent.change(within(dialog).getByLabelText("Longitude"), { target: { value: "29.75" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add school/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/tdmp/schools/import", { schoolCode: "270601", latitude: -2.05, longitude: 29.75 }));
    expect(await within(dialog).findByText(/Every TDMP school has a place on the map/)).toBeInTheDocument();
  });

  it("explains how it works, interactively", async () => {
    mockApi([status()]);
    renderPage();
    await screen.findByRole("button", { name: /Setup:/ });
    fireEvent.click(within(hero()).getByRole("button", { name: /How it works/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("tab", { name: /Compare/ }));
    expect(await within(dialog).findByText(/official SDMS code/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Map location" }));
    expect(within(dialog).getByText(/TDMP's point is only used for a school new to RTB GIS/)).toBeInTheDocument();
  });

  it("guides every header action and summary tile with a tooltip", async () => {
    mockApi([status()]);
    renderPage();
    await screen.findByRole("button", { name: /Setup:/ });
    const tipOf = (name: RegExp | string) => within(hero()).getByRole("button", { name }).getAttribute("data-tooltip") ?? "";
    expect(tipOf("Dry run")).toMatch(/Nothing is saved/);
    expect(tipOf("Sync now")).toMatch(/without waiting for the schedule/);
    expect(tipOf(/How it works/)).not.toBe("");
    for (const name of [/Setup:/, /Data coverage:/, /Linked schools/, /Last sync/, /Automatic sync/]) expect(tipOf(name)).not.toBe("");
    const stepper = screen.getByRole("region", { name: "Setup progress" });
    for (const step of within(stepper).getAllByRole("button")) expect(step.getAttribute("data-tooltip")).toBeTruthy();
  });

  it("explains when the API key is missing", async () => {
    mockApi([status({ enabled: { login: false, sync: false } })]);
    renderPage();
    expect(await screen.findByText(/TDMP sync is not configured/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
  });

  it("is for national accounts only", async () => {
    national = false;
    renderPage();
    expect(await screen.findByText("National access needed")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
