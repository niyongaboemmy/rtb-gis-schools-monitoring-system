import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { LEGACY_REFRESH_KEY, useAuthStore, type User } from "../store/authStore";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const FILE_SERVER_URL = import.meta.env.VITE_FILE_SERVER_URL || "/files";

// Dedicated instance for the file-server. Its CORS policy forbids credentials,
// so this instance must NOT send cookies; uploads authenticate with the access
// token instead (see the interceptor below). Base URL is the file-server origin
// without the `/files` suffix (same-origin `/` in prod).
export const FILE_SERVER_ORIGIN = (
  import.meta.env.VITE_FILE_SERVER_URL || "/files"
).replace(/\/files\/?$/, "");

export const fileApi = axios.create({
  baseURL: FILE_SERVER_ORIGIN || undefined,
  withCredentials: false,
  timeout: 3600000, // 1 hour timeout for massive multi-GB uploads
});

/**
 * Header the server requires on the cookie-authenticated routes (refresh,
 * logout) as CSRF protection; a cross-site page cannot add it.
 */
export const CSRF_HEADERS = { "X-Requested-With": "XMLHttpRequest" } as const;

// ── Session refresh (WS9.15) ────────────────────────────────────────────────
//
// The refresh token is an httpOnly cookie scoped to /api/v1/auth; the access
// token lives only in memory. Every refresh goes through one in-flight
// promise, so a burst of 401s (or several components restoring at once)
// triggers a single /auth/refresh call.

let refreshInFlight: Promise<string> | null = null;

/** Reads (once) a refresh token left in localStorage by pre-cookie builds. */
function takeLegacyRefreshBody(): { userId: string; refreshToken: string } | null {
  try {
    const refreshToken = localStorage.getItem(LEGACY_REFRESH_KEY);
    const userId = useAuthStore.getState().user?.id;
    if (refreshToken && userId) return { userId, refreshToken };
  } catch {
    /* storage unavailable */
  }
  return null;
}

async function performRefresh(): Promise<string> {
  const legacy = takeLegacyRefreshBody();
  // Plain axios (not `api`) so this request never re-enters the interceptors.
  const { data } = await axios.post<{ accessToken: string; user: User }>(
    `${API_BASE}/auth/refresh`,
    legacy ?? {},
    { withCredentials: true, headers: CSRF_HEADERS },
  );
  try {
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  } catch {
    /* storage unavailable */
  }
  useAuthStore.getState().setSession(data.accessToken, data.user);
  return data.accessToken;
}

/** Rotates the refresh cookie and returns a new access token (single-flight). */
export function refreshSession(): Promise<string> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

let restoreInFlight: Promise<void> | null = null;

/**
 * Called on page load when a user is remembered but no access token exists:
 * re-issues the token from the cookie, or signs out quietly if it is gone.
 */
export function restoreSession(): Promise<void> {
  restoreInFlight ??= refreshSession()
    .then(() => undefined)
    .catch(() => useAuthStore.getState().clearSession())
    .finally(() => {
      useAuthStore.getState().setStatus("ready");
      restoreInFlight = null;
    });
  return restoreInFlight;
}

/** Routes that must never trigger the refresh-and-retry logic. */
const NO_REFRESH = /\/auth\/(login|refresh|logout|google$|2fa\/(verify|email|enroll)|forgot-password|verify-otp|reset-password)/;

api.interceptors.request.use(
  async (config) => {
    // While the session is being restored, hold requests until the token is
    // back instead of letting each one fail with 401.
    const state = useAuthStore.getState();
    if (state.status === "restoring" && !NO_REFRESH.test(config.url ?? "")) {
      await restoreSession();
    }
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (/\/auth\/(refresh|logout)/.test(config.url ?? "")) {
      Object.assign(config.headers, CSRF_HEADERS);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// The file-server verifies the same access token the API issues.
fileApi.interceptors.request.use(async (config) => {
  if (useAuthStore.getState().status === "restoring") await restoreSession();
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string }>) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    if (!originalRequest) return Promise.reject(error);

    // An account flagged for a forced password change gets 403 everywhere
    // except auth and users/me; let the app show the change screen.
    if (
      error.response?.status === 403 &&
      error.response.data?.code === "PASSWORD_CHANGE_REQUIRED"
    ) {
      useAuthStore.getState().updateUser({ mustChangePassword: true });
      return Promise.reject(error);
    }

    // Skip refresh on auth routes to prevent loops during failed sign-in.
    if (NO_REFRESH.test(originalRequest.url ?? "")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const accessToken = await refreshSession();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearSession();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// Page load with a remembered user: restore the access token from the cookie.
if (useAuthStore.getState().status === "restoring") void restoreSession();

/** Extracts the server's message from an axios error. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(" ");
  return msg || fallback;
}
