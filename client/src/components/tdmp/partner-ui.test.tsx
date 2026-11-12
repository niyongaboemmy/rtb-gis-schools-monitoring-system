import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "../ui/toast";
import type { ConnectionReport } from "../../lib/tdmp";

const get = vi.fn();
const post = vi.fn();
vi.mock("../../lib/api", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  apiErrorMessage: (_e: unknown, f: string) => f,
}));

import { RequestsGuide } from "./RequestsGuide";
import { PartnerAccess } from "./PartnerAccess";

const REPORT: ConnectionReport = {
  checkedAt: new Date().toISOString(),
  configured: { apiKey: true, oauthClient: false, baseUrl: "https://tdmp.rtb.gov.rw/api/v1" },
  reachable: true,
  authorised: true,
  latencyMs: 200,
  tdmpMaterialisedAt: null,
  tvetSchools: 391,
  endpoints: [
    { key: "schools", label: "School list", path: "/schools", status: 200, ms: 1, ok: true },
    { key: "trades", label: "Programme names", path: "/trades", status: 403, ms: 1, ok: false, request: "R1" },
  ],
  requests: [
    { id: "R1", title: "Aggregate reports", priority: "P2", state: "waiting", evidence: "0 of 5 endpoints readable" },
    { id: "R6", title: "OAuth client for RTB 3D GIS", priority: "P1", state: "partial", evidence: "Client id configured" },
    { id: "R7", title: "TDMP role catalogue", priority: "P1", state: "done", evidence: "1 role mapped" },
  ],
};

describe("RequestsGuide", () => {
  it("opens on the first open request with why, steps, an example and live status", () => {
    render(<RequestsGuide report={REPORT} checking={false} onCheck={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Aggregate reports" })).toBeInTheDocument();
    expect(screen.getByLabelText("Why it matters")).toHaveTextContent(/gender splits/);
    expect(within(screen.getByLabelText("What we ask TDMP")).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Example")).toHaveTextContent(/reports\/trades\/students/);
    expect(screen.getByLabelText("How we check it")).toHaveTextContent("0 of 5 endpoints readable");
    expect(screen.getByLabelText("Related endpoints")).toHaveTextContent("/trades");
    expect(screen.getByText(/1 of 3 requests done/)).toBeInTheDocument();
  });

  it("switches request and filters the list", async () => {
    render(<RequestsGuide report={REPORT} checking={false} onCheck={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /OAuth client for RTB 3D GIS/ }));
    expect(await screen.findByRole("heading", { name: "OAuth client for RTB 3D GIS" })).toBeInTheDocument();
    // The previous panel may still be animating out.
    expect(screen.getAllByLabelText("Example").some((el) => /redirectUris/.test(el.textContent ?? ""))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const list = screen.getByRole("list", { name: "Requests" });
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(list).getByText("TDMP role catalogue")).toBeInTheDocument();
  });

  it("shows what the key can read on the endpoints tab, and re-tests on demand", () => {
    const onCheck = vi.fn();
    render(<RequestsGuide report={REPORT} checking={false} onCheck={onCheck} />);
    fireEvent.click(screen.getByRole("tab", { name: /What our key can read/ }));
    const eps = screen.getByRole("list", { name: "TDMP endpoints" });
    expect(within(eps).getByText("Readable")).toBeInTheDocument();
    expect(within(eps).getByText("Waiting R1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Test again/ }));
    expect(onCheck).toHaveBeenCalled();
  });
});

describe("PartnerAccess", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });
  const KEY = {
    id: "k1", name: "TDMP production", partner: "TDMP", keyPrefix: "rtbgis_pk_3f9a1c",
    scopes: ["schools:read", "coordinates:read", "embed:create"], allowedOrigins: ["https://tdmp.rtb.gov.rw"],
    createdBy: "admin@rtb.gov.rw", createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null,
  };
  const wrap = () => render(<ToastProvider><PartnerAccess /></ToastProvider>);

  it("creates a key and shows it once", async () => {
    get.mockResolvedValue({ data: [] });
    post.mockResolvedValue({ data: { ...KEY, apiKey: "rtbgis_pk_" + "a".repeat(64) } });
    wrap();
    expect(await screen.findByText(/No partner keys yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New key/ }));
    fireEvent.click(screen.getByRole("button", { name: /Create key/ }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/partner-keys", {
        name: "TDMP production", partner: "TDMP",
        scopes: ["coordinates:read", "schools:read", "embed:create"], allowedOrigins: ["https://tdmp.rtb.gov.rw"],
      }),
    );
    expect(await screen.findByText(/it will not be shown again/)).toBeInTheDocument();
    expect(screen.getByText("rtbgis_pk_" + "a".repeat(64))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I have stored it" }));
    await waitFor(() => expect(screen.queryByText("rtbgis_pk_" + "a".repeat(64))).not.toBeInTheDocument());
  });

  it("revokes only after confirmation", async () => {
    get.mockResolvedValue({ data: [KEY] });
    post.mockResolvedValue({ data: {} });
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: /Revoke/ }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText(/Ends all its views now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/partner-keys/k1/revoke"));
  });
});
