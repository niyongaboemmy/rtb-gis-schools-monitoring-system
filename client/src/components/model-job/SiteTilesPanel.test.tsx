import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/toast";

const get = vi.fn();
const post = vi.fn();
vi.mock("../../lib/api", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  apiErrorMessage: (_e: unknown, f: string) => f,
}));

import { SiteTilesPanel } from "./SiteTilesPanel";

const renderPanel = () =>
  render(
    <ToastProvider>
      <SiteTilesPanel schoolId="s1" />
    </ToastProvider>,
  );

describe("SiteTilesPanel", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("shows what ready tiles give", async () => {
    get.mockResolvedValue({
      data: {
        photos: 4049,
        tiles: { status: "ready", maxZoom: 24, groundCmPerPx: 0.93, tiles: 10012, bytes: 209715200, builtAt: "2026-10-23T09:00:00Z" },
        job: null,
      },
    });
    renderPanel();
    expect(await screen.findByText("0.93 cm per pixel")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText(/10,012 · 200\.0 MB/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /rebuild/i })).toBeTruthy();
  });

  it("starts a build and shows its progress", async () => {
    get.mockResolvedValueOnce({ data: { photos: 4049, tiles: null, job: null } });
    get.mockResolvedValue({
      data: {
        photos: 4049,
        tiles: { status: "building" },
        job: { jobId: "9", state: "running", percent: 42, attempt: 1, maxAttempts: 2, queuedAt: null, startedAt: new Date().toISOString(), finishedAt: null, error: null },
      },
    });
    post.mockResolvedValue({ data: { queued: true } });
    renderPanel();
    expect(await screen.findByText(/Not built yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^build$/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/schools/s1/kmz/2d/tiles"));
    expect(await screen.findByText(/42%/)).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.getByRole("button", { name: /building/i })).toHaveProperty("disabled", true);
  });

  it("stays hidden for a site map without drone photos", async () => {
    get.mockResolvedValue({ data: { photos: 0, tiles: null, job: null } });
    const { container } = renderPanel();
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
  });
});
