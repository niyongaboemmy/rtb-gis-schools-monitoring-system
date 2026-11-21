import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const post = vi.fn();
const get = vi.fn();
vi.mock("../lib/api", () => ({
  API_BASE: "/api/v1",
  CSRF_HEADERS: { "X-Requested-With": "XMLHttpRequest" },
  api: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
  },
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));
// The brand panel (globe, drone) is irrelevant here.
vi.mock("../components/ui/AuthShell", () => ({
  AuthShell: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
  AuthAlert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
}));

import Login from "./Login";
import { SSO_MFA_EXPIRED } from "../lib/tdmp";
import { useAuthStore } from "../store/authStore";

const PROVIDERS = { authMode: "tdmp", password: false, google: false, tdmp: true, breakGlass: true, tdmpAccess: "local" };

function renderLogin(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/schools/:id" element={<p>School page</p>} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Login after a TDMP sign-in that needs our second factor", () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset().mockResolvedValue({ data: PROVIDERS });
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, status: "ready" });
  });

  it("continues the pending sign-in with the 2FA challenge, never the password form", async () => {
    post.mockResolvedValue({ data: { mfaRequired: true, mfaToken: "mfa-1", methods: ["totp", "recovery", "email"] } });
    renderLogin("/login?sso_mfa=1&next=%2Fschools%2F7");

    expect(await screen.findByRole("heading", { name: "Verify it's you" })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/auth/tdmp/mfa", {}, { headers: { "X-Requested-With": "XMLHttpRequest" } });
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("enters the app at `next` when no second factor is due after all", async () => {
    post.mockResolvedValue({
      data: {
        accessToken: "at",
        user: {
          id: "u1",
          firstName: "A",
          lastName: "B",
          email: "a@rtb.gov.rw",
          role: { id: "r", name: "admin", permissions: [] },
          authSource: "tdmp",
          privacyAcceptedAt: "2026-11-01T00:00:00.000Z",
          privacyVersion: "2026-10-draft",
          privacyNoticeVersion: "2026-10-draft",
        },
      },
    });
    renderLogin("/login?sso_mfa=1&next=%2Fschools%2F7");
    expect(await screen.findByText("School page")).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("at");
  });

  it("offers TDMP again when the pending sign-in expired", async () => {
    post.mockRejectedValue({ response: { status: 401 } });
    renderLogin("/login?sso_mfa=1&next=%2Fschools%2F7");

    expect(await screen.findByText(SSO_MFA_EXPIRED)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in with TDMP" })).toBeInTheDocument());
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText(/administrator sign-in/i)).not.toBeInTheDocument();
  });

  it("leaves the normal sign-in alone", async () => {
    renderLogin("/login");
    expect(await screen.findByRole("button", { name: "Sign in with TDMP" })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
