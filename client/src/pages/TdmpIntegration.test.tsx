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

const totals = { fetched: 391, created: 0, linked: 12, updated: 3, unchanged: 370, skippedNoGps: 2, skipped: 4, failed: 0, missing: 0, deactivated: 0, details: 20 };

const RUN: SyncRun = {
  id: "11111111-1111-4111-8111-111111111111",
  trigger: "manual",
  status: "completed",
  dryRun: true,
  startedAt: "2026-11-12T07:00:00.000Z",
  finishedAt: "2026-11-12T07:00:40.000Z",
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
  autoSync: true,
  probeIntervalMinutes: 60,
  dailyRunAt: "07:15",
  lastProbeAt: "2026-11-12T07:30:00.000Z",
  tdmpMaterialisedAt: "2026-11-12T04:00:34.000Z",
  updatedAt: null,
  updatedBy: null,
  probeIntervals: [15, 30, 60, 180, 360],
  nextDailyRunAt: "2026-11-13T05:15:00.000Z",
};

const status = (over: Partial<TdmpStatus> = {}): TdmpStatus => ({
  enabled: { login: false, sync: true },
  authMode: "local",
  running: false,
  currentRun: null,
  lastRun: RUN,
  lastSuccessAt: new Date().toISOString(),
  linkedSchools: 300,
  unlinkedSchools: 12,
  settings,
  ...over,
});

const UNLINKED: UnlinkedSchool[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "TSS-SOU-002",
    name: "ACODES Mushishiro",
    district: "Muhanga",
    hasGisData: true,
    suggestion: { schoolCode: "270601", schoolName: "ACODES MUSHISHIRO" },
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
    { id: "R1", title: "Aggregate reports", priority: "P2", state: "waiting", evidence: "0 of 5 endpoints readable with our key" },
    { id: "R7", title: "TDMP role catalogue and mapping", priority: "P1", state: "done", evidence: "1 role(s) mapped" },
  ],
};

function mockApi(statuses: TdmpStatus[]) {
  let i = 0;
  get.mockImplementation((url: string) => {
    if (url === "/tdmp/status") return Promise.resolve({ data: statuses[Math.min(i++, statuses.length - 1)] });
    if (url === "/tdmp/sync/runs") return Promise.resolve({ data: [RUN] });
    if (url === "/tdmp/schools/unlinked") return Promise.resolve({ data: UNLINKED });
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

beforeEach(() => {
  national = true;
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});

describe("TDMP integration page", () => {
  it("shows the schedule, the last run report and the requests to TDMP", async () => {
    mockApi([status()]);
    renderPage();

    expect(await screen.findByText("Automatic sync on")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Checks TDMP every hour/)).toBeInTheDocument();

    // Report of the selected (dry) run
    const report = screen.getByRole("region", { name: "Run report" });
    fireEvent.click(within(report).getByRole("button", { name: /Need a location first/ }));
    expect(within(report).getByText("ACODES MUSHISHIRO")).toBeInTheDocument();
    fireEvent.click(within(report).getByRole("button", { name: /Schools to link/ }));
    expect(within(report).getByText("In RTB GIS: ACEJ Karama TSS")).toBeInTheDocument();

    // Connection + requests
    const conn = screen.getByRole("region", { name: "Connection and TDMP requests" });
    expect(await within(conn).findByText("Connected")).toBeInTheDocument();
    expect(within(conn).getByText("Not granted")).toBeInTheDocument();
    expect(within(conn).getByText(/1 of 2 done/)).toBeInTheDocument();
    expect(within(conn).getByText("Waiting for TDMP")).toBeInTheDocument();
  });

  it("starts a sync without waiting for the schedule and follows its progress", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const runningRun: SyncRun = {
        ...RUN,
        id: "33333333-3333-4333-8333-333333333333",
        status: "running",
        dryRun: false,
        finishedAt: null,
        report: null,
        progress: { phase: "schools", done: 120, total: 391 },
      };
      const finished: SyncRun = { ...runningRun, status: "completed", progress: null, finishedAt: "2026-11-12T08:01:00.000Z", report: RUN.report };
      mockApi([status(), status({ running: true, currentRun: runningRun }), status({ running: false, lastRun: finished })]);
      post.mockResolvedValue({ data: { started: true, runId: runningRun.id } });
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));
      await waitFor(() => expect(post).toHaveBeenCalledWith("/tdmp/sync", { dryRun: false }));
      expect(await screen.findByText("Updating schools · 120 of 391")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Syncing/ })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(await screen.findByText(/TDMP sync finished/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs a dry run", async () => {
    mockApi([status()]);
    post.mockResolvedValue({ data: { started: true, dryRun: true } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Dry run" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/tdmp/sync", { dryRun: true }));
  });

  it("pauses the automatic sync with one switch", async () => {
    mockApi([status()]);
    patch.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.click(await screen.findByRole("switch"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/tdmp/settings", { autoSync: false }));
  });

  it("saves a new probe interval and daily time", async () => {
    mockApi([status()]);
    patch.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.change(await screen.findByLabelText(/Check TDMP for changes/), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/Daily full run at/), { target: { value: "06:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/tdmp/settings", { autoSync: true, probeIntervalMinutes: 30, dailyRunAt: "06:45" }),
    );
  });

  it("links an unlinked school with the suggested TDMP code", async () => {
    mockApi([status()]);
    post.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Link to 270601/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/tdmp/schools/${UNLINKED[0].id}/link`, { schoolCode: "270601" }),
    );
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
