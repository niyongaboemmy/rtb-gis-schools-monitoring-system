import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { REPORTS_CHANGED_EVENT, usePendingReviewCount } from "./usePendingReviewCount";

let total = 4;
const get = vi.fn<(url: string, opts?: unknown) => Promise<{ data: { data: unknown[]; total: number } }>>(() => Promise.resolve({ data: { data: [], total } }));
vi.mock("../lib/api", () => ({ api: { get: (url: string, opts: unknown) => get(url, opts) } }));

function Probe({ enabled }: { enabled: boolean }) {
  const n = usePendingReviewCount(enabled);
  return <p>count:{n === null ? "none" : n}</p>;
}

describe("usePendingReviewCount", () => {
  it("reads the server's Pending total and refreshes after a decision", async () => {
    render(<Probe enabled />);
    expect(await screen.findByText("count:4")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/reports", { params: { status: "PENDING", limit: 1 } });
    total = 3;
    act(() => {
      window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT));
    });
    await waitFor(() => expect(screen.getByText("count:3")).toBeInTheDocument());
  });

  it("does nothing without access to the review page", () => {
    get.mockClear();
    render(<Probe enabled={false} />);
    expect(screen.getByText("count:none")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
