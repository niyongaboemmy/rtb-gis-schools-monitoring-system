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

  it("detects the key's access level and applies it to the national views", async () => {
    const ping = {
      partner: "TDMP", keyName: "Southern", scopes: ["embed:create"],
      access: { tier: "province", province: "Southern Province", views: ["school-dashboard", "national-map"], summary: "Southern Province province" },
    };
    const fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith("/partner/ping")
        ? { ok: true, status: 200, json: async () => ping }
        : { ok: true, status: 201, json: async () => ({ url: "https://x/embed/map#token=t", scope: { tier: "district", province: "Southern Province", district: "Muhanga" }, expiresAt: new Date().toISOString() }) },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<Developers />);
    fireEvent.change(screen.getByLabelText("Partner key for trying requests"), { target: { value: "rtbgis_pk_south" } });
    expect(await screen.findByText(/Your key: Southern Province province/)).toBeInTheDocument();

    const viewSelect = screen.getByLabelText("View") as HTMLSelectElement;
    const option = (v: string) => within(viewSelect).getByRole("option", { name: new RegExp(v) }) as HTMLOptionElement;
    expect(option("National dashboard").disabled).toBe(true);
    expect(option("National map").disabled).toBe(false);

    fireEvent.change(viewSelect, { target: { value: "national-map" } });
    expect(screen.getByText(/Only Southern Province\. You may narrow it/)).toBeInTheDocument();
    const province = screen.getByLabelText("Province") as HTMLSelectElement;
    expect(province).toBeDisabled();
    expect(province.value).toBe("Southern Province");
    fireEvent.change(screen.getByLabelText("District"), { target: { value: "Muhanga" } });

    fireEvent.click(screen.getByRole("button", { name: /Preview/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/partner/embed-links"))).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/partner/embed-links"))! as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ view: "national-map", province: "Southern Province", district: "Muhanga" });
    expect(await screen.findByText("Muhanga district")).toBeInTheDocument();
  });
});
