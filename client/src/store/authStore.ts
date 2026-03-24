import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
  department?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  updateUser: (userUpdates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setAuth: (token, refreshToken, user) => {
        localStorage.setItem('rtb_refresh_token', refreshToken);
        set({ token, user, isAuthenticated: true });
      },
      
      updateUser: (userUpdates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdates } : null
        }));
      },
      
      logout: () => {
        localStorage.removeItem('rtb_refresh_token');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'rtb-auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
