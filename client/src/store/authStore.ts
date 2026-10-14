import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string | {
    id: string;
    name: string;
    permissions: string[];
    accessLevel?: {
      id: string;
      name: string;
      slug?: string | null;
      rank?: number | null;
    } | null;
  };
  location?: {
    province?: string;
    district?: string;
    sector?: string;
    schoolId?: string;
    schoolName?: string;
  } | null;
  avatarUrl?: string;
  phone?: string;
  department?: string;
  /** Admin-created / imported accounts must pick their own password (WS10.3). */
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
  /** 2FA is mandatory for this user's role (WS10.7). */
  mfaRequired?: boolean;
  googleLinked?: boolean;
  passwordChangedAt?: string | null;
  privacyAcceptedAt?: string | null;
  privacyVersion?: string | null;
  /** Current privacy-notice version, as reported by the server. */
  privacyNoticeVersion?: string;
}

/**
 * - `restoring`: page just loaded with a remembered user; the access token is
 *   being re-issued from the httpOnly refresh cookie (show a splash).
 * - `ready`: the in-memory state is authoritative.
 */
export type AuthStatus = 'restoring' | 'ready';

interface AuthState {
  user: User | null;
  /**
   * Access token — memory only, never persisted (WS9.15). The refresh token
   * lives in an httpOnly cookie the page cannot read. `token` keeps its name
   * because lib/socket.ts and the file-server client read it.
   */
  token: string | null;
  isAuthenticated: boolean;
  status: AuthStatus;
  /** Starts a session after sign-in or a refresh. */
  setSession: (token: string, user: User) => void;
  /** Swaps the access token, keeping the user (silent refresh). */
  setToken: (token: string) => void;
  /** @deprecated use setSession; kept for older callers. */
  setAuth: (token: string, refreshToken: string | null | undefined, user: User) => void;
  updateUser: (userUpdates: Partial<User>) => void;
  setStatus: (status: AuthStatus) => void;
  /** Clears local state and tells the server to revoke this device's session. */
  logout: () => void;
  /** Clears local state only (the session is already gone server-side). */
  clearSession: () => void;
}

/** Pre-cookie builds kept the refresh token here; read once by lib/api.ts. */
export const LEGACY_REFRESH_KEY = 'rtb_refresh_token';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      status: 'ready',

      setSession: (token, user) => {
        set({ token, user, isAuthenticated: true, status: 'ready' });
      },

      setToken: (token) => set({ token }),

      setAuth: (token, _refreshToken, user) => get().setSession(token, user),

      updateUser: (userUpdates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdates } : null
        }));
      },

      setStatus: (status) => set({ status }),

      logout: () => {
        const token = get().token;
        // Fire-and-forget: revokes the session and clears the cookie. Plain
        // fetch (not the axios instance) avoids a circular import.
        void fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }).catch(() => undefined);
        get().clearSession();
      },

      clearSession: () => {
        try {
          localStorage.removeItem(LEGACY_REFRESH_KEY);
        } catch {
          /* storage unavailable */
        }
        set({ token: null, user: null, isAuthenticated: false, status: 'ready' });
      },
    }),
    {
      name: 'rtb-auth-storage',
      // Only non-secret profile data survives a reload; the token does not.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      // Anything persisted by older builds (incl. a stored token) is dropped.
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { user?: User | null; isAuthenticated?: boolean };
        return { user: p.user ?? null, isAuthenticated: !!p.isAuthenticated } as AuthState;
      },
      onRehydrateStorage: () => (state) => {
        // A remembered user without a token must be restored from the cookie.
        if (state?.isAuthenticated && !state.token) state.setStatus('restoring');
      },
    }
  )
);
