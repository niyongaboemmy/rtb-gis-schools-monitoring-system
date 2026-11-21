import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

let tdmpSignIn = false;
vi.mock("../lib/api", () => ({
  API_BASE: "/api/v1",
  api: { get: vi.fn() },
  refreshSession: () => Promise.reject(new Error("no cookie")),
}));
vi.mock("../lib/tdmp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/tdmp")>()),
  fetchAuthProviders: () => Promise.resolve({ tdmp: tdmpSignIn }),
}));
vi.mock("../components/ui/toast", () => ({ useToast: () => ({ warning: vi.fn(), error: vi.fn() }) }));
vi.mock("../components/auth/AuthGate", () => ({ SessionSplash: () => <div>splash</div> }));

import { TdmpSsoEntry } from "./TdmpSso";
import { useAuthStore } from "../store/authStore";

function Where() {
  const { pathname, search } = useLocation();
  return <div>at {pathname + search}</div>;
}

const open = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sso/tdmp" element={<TdmpSsoEntry />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("/sso/tdmp without a session (a school opened in a new tab from an embed)", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false, status: "ready" });
  });

  it("TDMP sign-in off: the normal sign-in page, then back to open the school", async () => {
    tdmpSignIn = false;
    open("/sso/tdmp?school=TSS-SOU-001");
    const next = encodeURIComponent("/sso/tdmp?school=TSS-SOU-001");
    expect(await screen.findByText(`at /login?next=${next}`)).toBeInTheDocument();
  });

  it("TDMP sign-in on: through TDMP, carrying the school", async () => {
    tdmpSignIn = true;
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      open("/sso/tdmp?school=TSS-SOU-001");
      await vi.waitFor(() => expect(assign).toHaveBeenCalled());
      expect(assign.mock.calls[0][0]).toContain("/auth/tdmp/start?school=TSS-SOU-001");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});
