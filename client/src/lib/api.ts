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

// Dedicated instance for the file-server to avoid /api/v1 prefix and 404 errors
export const fileApi = axios.create({
  withCredentials: true,
  timeout: 3600000, // 1 hour timeout for massive 5GB+ uploads
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
