import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const get = vi.fn();
vi.mock("../../lib/api", () => ({
  api: { get: (...args: unknown[]) => get(...args) },
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
// The brand panel (globe, drone) is irrelevant here.
vi.mock("../ui/AuthShell", () => ({
  AuthShell: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
  AuthAlert: ({ children }: { children: React.ReactNode }) => <div role="status">{children}</div>,
}));

import { AuthGate } from "./AuthGate";
import { useAuthStore, type User } from "../../store/authStore";

const pending: User = {
  id: "u1",
  firstName: "Aline",
  lastName: "Mukamana",
  email: "aline@rtb.gov.rw",
  role: "",
  authSource: "tdmp",
  accessPending: true,
  privacyAcceptedAt: "2026-11-01T00:00:00.000Z",
  privacyVersion: "2026-10-draft",
  privacyNoticeVersion: "2026-10-draft",
};

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGate>
              <p>The app</p>
            </AuthGate>
          }
        />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Waiting for access", () => {
  beforeEach(() => {
    get.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    useAuthStore.setState({ user: pending, token: "t", isAuthenticated: true, status: "ready" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("replaces the app for an account waiting for access", () => {
    renderGate();
    expect(screen.getByRole("heading", { name: "Your account is waiting for access" })).toBeInTheDocument();
    expect(screen.getByText("aline@rtb.gov.rw")).toBeInTheDocument();
    expect(screen.getByText("Aline Mukamana")).toBeInTheDocument();
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("stays put while access is still pending", async () => {
    get.mockResolvedValue({ data: { ...pending } });
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    expect(await screen.findByText("No access yet. Please check again later.")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/auth/me");
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
  });

  it("lets the person in once an administrator gave access", async () => {
    get.mockResolvedValue({ data: { ...pending, accessPending: false, role: { id: "r", name: "viewer", permissions: [] } } });
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    expect(await screen.findByText("The app")).toBeInTheDocument();
    expect(useAuthStore.getState().user?.accessPending).toBe(false);
  });

  it("signs out to the login page", async () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
  });
});
