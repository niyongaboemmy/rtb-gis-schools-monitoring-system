import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Developers from "./Developers";

// jsdom has no IntersectionObserver (scroll-reveal animations use it).
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
beforeEach(() => vi.stubGlobal("IntersectionObserver", NoopObserver));
afterEach(() => vi.unstubAllGlobals());

describe("Developers guide", () => {
  it("documents every partner endpoint, embedding and the coordinates guide", () => {
    render(<Developers />);
    for (const p of ["/partner/ping", "/partner/schools/coordinates", "/partner/schools", "/partner/schools/{schoolCode}", "/partner/embed-links"])
      expect(screen.getAllByText(p).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Coordinates guide/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Embedding views/ })).toBeInTheDocument();
    expect(screen.getAllByText(/updatedSince/).length).toBeGreaterThan(0);
  });

  it("'Send' stays off until a key is entered, then calls the API with it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, text: async () => '{"partner":"TDMP"}' });
    vi.stubGlobal("fetch", fetchMock);
    render(<Developers />);
    const ping = document.getElementById("ep-ping")!;
    const send = within(ping).getByRole("button", { name: /Send/ });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Partner key for trying requests"), { target: { value: "rtbgis_pk_test" } });
    fireEvent.click(send);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/partner\/ping$/);
    expect(init.headers.Authorization).toBe("ApiKey rtbgis_pk_test");
    expect(await within(ping).findByText(/HTTP 200/)).toBeInTheDocument();
  });
});
