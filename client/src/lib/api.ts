import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const FILE_SERVER_URL = import.meta.env.VITE_FILE_SERVER_URL || "/files";

// Dedicated instance for the file-server. It has no auth and its CORS policy
// forbids credentials, so this instance must NOT send cookies. Base URL is the
// file-server origin without the `/files` suffix (same-origin `/` in prod).
export const FILE_SERVER_ORIGIN = (
  import.meta.env.VITE_FILE_SERVER_URL || "/files"
).replace(/\/files\/?$/, "");

export const fileApi = axios.create({
  baseURL: FILE_SERVER_ORIGIN || undefined,
  withCredentials: false,
  timeout: 3600000, // 1 hour timeout for massive multi-GB uploads
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh attempt on login/refresh routes to prevent redirect loops and page reloads during failed auth
    if (originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized and attempts to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { user } = useAuthStore.getState();
        if (!user) throw new Error("No user to refresh");

        // This relies on the backend HTTP-only cookie for refresh token,
        // or passing explicitly. Since backend returns refreshToken in response body:
        const refreshToken = localStorage.getItem("rtb_refresh_token");
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {
            userId: user.id,
            refreshToken,
          },
        );

        useAuthStore
          .getState()
          .setAuth(data.accessToken, data.refreshToken, user);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
