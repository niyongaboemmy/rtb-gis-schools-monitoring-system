import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/toast";
import { stepStatus, visibleSteps, type ModelJob } from "../../lib/viewer3d/model-job";

const get = vi.fn();
const post = vi.fn();
vi.mock("../../lib/api", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  apiErrorMessage: (_e: unknown, f: string) => f,
}));

import { ModelReprocessPanel } from "./ModelReprocessPanel";

const job = (over: Partial<ModelJob> = {}): ModelJob => ({
  jobId: "7",
  state: "running",
  stage: "simplifying",
  percent: 18,
  stageStartedAt: new Date(Date.now() - 65_000).toISOString(),
  fileName: "site.glb",
  source: "restore",
  attempt: 1,
  maxAttempts: 3,
  queuedAt: new Date(Date.now() - 120_000).toISOString(),
  startedAt: new Date(Date.now() - 100_000).toISOString(),
  finishedAt: null,
  error: null,
  result: null,
  ...over,
});

const renderPanel = () =>
  render(
    <ToastProvider>
      <ModelReprocessPanel schoolId="s1" />
    </ToastProvider>,
  );

describe("model job steps", () => {
  it("marks steps before the current one done", () => {
    const j = job();
    expect(stepStatus(j, "reading")).toBe("done");
    expect(stepStatus(j, "simplifying")).toBe("current");
    expect(stepStatus(j, "writing")).toBe("todo");
    expect(stepStatus(job({ state: "done", stage: "done" }), "writing")).toBe("done");
  });

  it("lists the phone copy only when it is part of the run", () => {
    expect(visibleSteps(job()).some((s) => s.stage === "gpu-copy")).toBe(false);
    expect(visibleSteps(job({ stage: "gpu-copy" })).some((s) => s.stage === "gpu-copy")).toBe(true);
  });
});

describe("ModelReprocessPanel", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("shows a running job's step and elapsed time, and disables starting", async () => {
    get.mockResolvedValue({ data: { job: job() } });
    renderPanel();
    expect(await screen.findByText("Simplify the mesh")).toBeTruthy();
    expect(screen.getByText(/1 min 05 s/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /running/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("counts elapsed time from now, not from when the page opened", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      get.mockResolvedValueOnce({ data: { job: null } });
      renderPanel();
      await screen.findByText("No processing run recorded yet.");
      vi.setSystemTime(Date.now() + 10 * 60_000); // the page has been open 10 min
      post.mockResolvedValue({
        data: { started: true, reason: "started", job: job({ startedAt: new Date(Date.now() - 2000).toISOString(), stageStartedAt: new Date(Date.now() - 2000).toISOString() }) },
      });
      get.mockResolvedValue({ data: { job: job({ startedAt: new Date(Date.now() - 2000).toISOString(), stageStartedAt: new Date(Date.now() - 2000).toISOString() }) } });
      fireEvent.click(screen.getByRole("button", { name: /reprocess/i }));
      expect(await screen.findByText(/^\d+ s so far$/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts a run and follows it", async () => {
    get.mockResolvedValue({ data: { job: null } });
    post.mockResolvedValue({ data: { started: true, reason: "started", job: job({ stage: "reading", percent: 3 }) } });
    renderPanel();
    expect(await screen.findByText("No processing run recorded yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reprocess/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/schools/s1/kmz/reoptimize"));
    expect(await screen.findByText(/Reprocessing started/)).toBeTruthy();
    expect(screen.getByText("Read the original")).toBeTruthy();
  });

  it("shows the result of a finished run and the reason of a failed one", async () => {
    get.mockResolvedValueOnce({
      data: {
        job: job({
          state: "done",
          stage: "done",
          percent: 100,
          finishedAt: new Date().toISOString(),
          result: { optimized: true, bytesIn: 977016488, bytesOut: 18869744, trisIn: 38993013, trisOut: 1497415, detailCm: 8.23, ktx2: false, error: null },
        }),
      },
    });
    const { unmount } = renderPanel();
    expect(await screen.findByText("931.8 MB")).toBeTruthy();
    expect(screen.getByText("18.0 MB")).toBeTruthy();
    expect(screen.getByText("8.2 cm per pixel")).toBeTruthy();
    unmount();

    get.mockResolvedValueOnce({ data: { job: job({ state: "failed", attempt: 3, error: "optimize.mjs exited 137 — likely OOM-killed" }) } });
    renderPanel();
    expect(await screen.findByText(/likely OOM-killed/)).toBeTruthy();
    expect(screen.getByText(/attempt 3 of 3/)).toBeTruthy();
  });
});
