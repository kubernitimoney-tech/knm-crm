import { create } from 'zustand';
import axios from 'axios';
import { apiPost, apiGet, apiPatch, getStoredTokens, setStoredTokens } from '@/lib/api';
import { clearLegacyRbacStorage } from '@/lib/legacyStorage';
import { clearLastActivity, getLastActivity, isSessionExpired, touchSession } from '@/lib/session';
import type { AuthAccess, AuthRole, AuthSession, AuthTokens, AuthUser } from '@/types/auth';

const SESSION_KEY = 'lms_session';

interface StoredSession {
  user: AuthUser;
  roles: AuthRole[];
  permissions: string[];
  access: AuthAccess;
}

interface AuthState {
  user: AuthUser | null;
  roles: AuthRole[];
  permissions: string[];
  access: AuthAccess | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

let hydratePromise: Promise<void> | null = null;

function loadStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

type LoginResponse = Omit<AuthSession, 'tokens'> & { tokens: AuthTokens };

function applySession(
  set: (partial: Partial<AuthState>) => void,
  data: Omit<AuthSession, 'tokens'>,
): void {
  const session: StoredSession = {
    user: data.user,
    roles: data.roles,
    permissions: data.permissions,
    access: data.access,
  };
  saveSession(session);
  set({ ...session, isAuthenticated: true });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  roles: [],
  permissions: [],
  access: null,
  isAuthenticated: false,
  hasHydrated: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      clearLegacyRbacStorage();
      const data = await apiPost<LoginResponse>('/auth/login/', { email, password });
      setStoredTokens(data.tokens);
      const session: StoredSession = {
        user: data.user,
        roles: data.roles,
        permissions: data.permissions,
        access: data.access,
      };
      saveSession(session);
      touchSession();
      set({
        user: data.user,
        roles: data.roles,
        permissions: data.permissions,
        access: data.access,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Check your credentials.';
      set({ error: message, isLoading: false, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    const tokens = getStoredTokens();
    try {
      if (tokens?.refresh) {
        await apiPost('/auth/logout/', { refresh: tokens.refresh });
      }
    } catch {
      // clear local session even if API fails
    }
    setStoredTokens(null);
    saveSession(null);
    clearLastActivity();
    set({
      user: null,
      roles: [],
      permissions: [],
      access: null,
      isAuthenticated: false,
    });
  },

  fetchMe: async () => {
    applySession(set, await apiGet<Omit<AuthSession, 'tokens'>>('/auth/me/'));
  },

  updateDisplayName: async (displayName) => {
    applySession(
      set,
      await apiPatch<Omit<AuthSession, 'tokens'>>('/auth/me/', { display_name: displayName }),
    );
  },

  hydrate: async () => {
    if (hydratePromise) {
      return hydratePromise;
    }

    hydratePromise = (async () => {
      clearLegacyRbacStorage();
      set({ isLoading: true });

      const tokens = getStoredTokens();
      const stored = loadStoredSession();
      if (!tokens?.access || !stored) {
        set({
          isAuthenticated: false,
          isLoading: false,
          hasHydrated: true,
          user: null,
          roles: [],
          permissions: [],
          access: null,
        });
        return;
      }

      set({
        user: stored.user,
        roles: stored.roles,
        permissions: stored.permissions,
        access: stored.access,
        isAuthenticated: true,
      });

      if (!getLastActivity()) {
        touchSession();
      } else if (isSessionExpired()) {
        setStoredTokens(null);
        saveSession(null);
        clearLastActivity();
        set({
          isAuthenticated: false,
          isLoading: false,
          hasHydrated: true,
          user: null,
          roles: [],
          permissions: [],
          access: null,
        });
        return;
      }

      try {
        await get().fetchMe();
        touchSession();
      } catch (error) {
        const unauthorized = axios.isAxiosError(error) && error.response?.status === 401;

        if (unauthorized) {
          setStoredTokens(null);
          saveSession(null);
          clearLastActivity();
          set({
            isAuthenticated: false,
            user: null,
            roles: [],
            permissions: [],
            access: null,
          });
        }
      }

      set({ isLoading: false, hasHydrated: true });
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  },
}));
