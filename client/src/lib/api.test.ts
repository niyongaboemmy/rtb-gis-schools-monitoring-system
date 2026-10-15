import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { refreshSession } from "./api";
import { LEGACY_REFRESH_KEY, useAuthStore } from "../store/authStore";

const user = { id: "u1", firstName: "A", lastName: "B", email: "a@rtb.gov.rw", role: "viewer" };

describe("refreshSession", () => {
  beforeEach(() => {
    useAuthStore.setState({ user, token: null, isAuthenticated: true, status: "ready" });
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("de-duplicates concurrent refreshes into one request", async () => {
    let resolve!: (v: unknown) => void;
    const post = vi.spyOn(axios, "post").mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );

    const calls = [refreshSession(), refreshSession(), refreshSession()];
    resolve({ data: { accessToken: "new-token", user } });

    await expect(Promise.all(calls)).resolves.toEqual(["new-token", "new-token", "new-token"]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBe("new-token");
  });

  it("sends the CSRF header and relies on the cookie (no token in the body)", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { accessToken: "t", user } } as never);

    await refreshSession();

    const [url, body, config] = post.mock.calls[0];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(body).toEqual({});
    expect(config).toMatchObject({
      withCredentials: true,
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
  });

  it("migrates a legacy localStorage refresh token once, then removes it", async () => {
    localStorage.setItem(LEGACY_REFRESH_KEY, "legacy-token");
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { accessToken: "t", user } } as never);

    await refreshSession();

    expect(post.mock.calls[0][1]).toEqual({ userId: "u1", refreshToken: "legacy-token" });
    expect(localStorage.getItem(LEGACY_REFRESH_KEY)).toBeNull();
  });

  it("starts a new request after the previous one settled", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { accessToken: "t", user } } as never);
    await refreshSession();
    await refreshSession();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("never persists the access token", () => {
    useAuthStore.getState().setSession("secret-access", user);
    expect(localStorage.getItem("rtb-auth-storage") ?? "").not.toContain("secret-access");
  });
});
