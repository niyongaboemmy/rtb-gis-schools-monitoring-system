import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

/**
 * Opens an authenticated Socket.IO connection to the API.
 *
 * The server rejects connections without a valid access token. `auth` is a
 * callback so every reconnect sends the *current* token, which the axios
 * interceptor may have refreshed since the socket first connected.
 *
 * Same origin: Vite proxies /socket.io → :3001 in dev, nginx does in prod.
 */
export function connectSocket(): Socket {
  return io(window.location.origin, {
    withCredentials: true,
    auth: (cb) => cb({ token: useAuthStore.getState().token ?? "" }),
  });
}
