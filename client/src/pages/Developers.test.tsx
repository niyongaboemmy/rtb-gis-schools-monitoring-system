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
    expect(screen.getByRole("heading", { name: /Coordinates feed/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Recipes/ })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/partner/embed-links"))).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/partner/embed-links"))! as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ view: "national-map", province: "Southern Province", district: "Muhanga" });
    expect(await screen.findByText("Muhanga district")).toBeInTheDocument();
  });

  it("ticks the quickstart off as the reader uses the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{}", json: async () => ({}) }));
    render(<Developers />);
    expect(screen.getByText("0 of 3 done")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Partner key for trying requests"), { target: { value: "k" } });
    fireEvent.click(within(document.getElementById("ep-ping")!).getByRole("button", { name: /Send/ }));
    expect(await screen.findByText(/of 3 done/)).not.toHaveTextContent("0 of 3");
  });

  it("one language choice drives every example, and is remembered", () => {
    localStorage.clear();
    render(<Developers />);
    const tabs = () => screen.getAllByRole("tab", { name: "Python" });
    fireEvent.click(tabs()[0]);
    for (const t of tabs()) expect(t).toHaveAttribute("aria-selected", "true");
    expect(localStorage.getItem("rtbgis.developers.lang")).toBe("Python");
  });

  it("parameter chips fill the request and the examples follow it", () => {
    render(<Developers />);
    const card = document.getElementById("ep-schools")!;
    fireEvent.click(within(card).getByRole("button", { name: /\+ district=Muhanga/ }));
    expect((within(card).getByLabelText("Query string") as HTMLInputElement).value).toBe("limit=3&district=Muhanga");
    fireEvent.click(within(card).getAllByRole("tab", { name: "curl" })[0]);
    expect(card.textContent).toContain("/partner/schools?limit=3&district=Muhanga");
  });

  it("⌘K opens search and jumps to the picked endpoint", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<Developers />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const box = await screen.findByRole("dialog", { name: /Search the developer guide/ });
    fireEvent.change(within(box).getByLabelText("Search"), { target: { value: "embed link" } });
    expect(within(box).getByText("Signed embed link")).toBeInTheDocument();
    fireEvent.keyDown(within(box).getByLabelText("Search"), { key: "Enter" });
    expect(scrolled).toHaveBeenCalled();
    expect(window.location.hash).toBe("#ep-embed-links");
  });
});
