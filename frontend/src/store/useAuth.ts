import { create } from "zustand";

import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { Accent, Theme, User } from "../api/types";
import { applyTheme, storedAccent, storedTheme } from "../theme";

interface AuthState {
  user: User | null;
  /** True until the stored token has been checked against /auth/me on boot. */
  booting: boolean;
  busy: boolean;
  error: string | null;

  theme: Theme;
  accent: Accent;

  boot: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, name: string, password: string) => Promise<boolean>;
  logout: () => void;
  setAppearance: (patch: { theme?: Theme; accent?: Accent }) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  clearError: () => void;
}

function message(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  booting: true,
  busy: false,
  error: null,
  theme: storedTheme(),
  accent: storedAccent(),

  async boot() {
    // A 401 anywhere in the app drops us back to signed-out.
    setUnauthorizedHandler(() => set({ user: null }));

    if (!getToken()) {
      set({ booting: false });
      return;
    }
    try {
      const user = await api.me();
      // The account's saved preference wins over whatever this device cached.
      applyTheme(user.theme, user.accent);
      set({ user, theme: user.theme, accent: user.accent, booting: false });
    } catch {
      setToken(null);
      set({ user: null, booting: false });
    }
  },

  async login(email, password) {
    set({ busy: true, error: null });
    try {
      const { access_token, user } = await api.login(email, password);
      setToken(access_token);
      applyTheme(user.theme, user.accent);
      set({ user, theme: user.theme, accent: user.accent, busy: false });
      return true;
    } catch (err) {
      set({ error: message(err, "Could not sign in."), busy: false });
      return false;
    }
  },

  async register(email, name, password) {
    set({ busy: true, error: null });
    try {
      // Carry whatever theme they were already looking at into the new account.
      const { theme, accent } = get();
      const { access_token, user } = await api.register(email, name, password);
      setToken(access_token);
      set({ user, busy: false });
      if (theme !== user.theme || accent !== user.accent) {
        await get().setAppearance({ theme, accent });
      }
      return true;
    } catch (err) {
      set({ error: message(err, "Could not create the account."), busy: false });
      return false;
    }
  },

  logout() {
    setToken(null);
    set({ user: null, error: null });
  },

  async setAppearance(patch) {
    const theme = patch.theme ?? get().theme;
    const accent = patch.accent ?? get().accent;

    // Paint first: the toggle should feel instant even if the request is slow.
    applyTheme(theme, accent);
    set({ theme, accent });

    if (!get().user) return; // signed out — the local preference is enough
    try {
      const user = await api.updateSettings(patch);
      set({ user });
    } catch (err) {
      set({ error: message(err, "Saved on this device, but not to your account.") });
    }
  },

  async updateName(name) {
    set({ busy: true, error: null });
    try {
      set({ user: await api.updateSettings({ name }), busy: false });
    } catch (err) {
      set({ error: message(err, "Could not save your name."), busy: false });
    }
  },

  async changePassword(current, next) {
    set({ busy: true, error: null });
    try {
      await api.changePassword(current, next);
      set({ busy: false });
    } catch (err) {
      set({ busy: false });
      throw new Error(message(err, "Could not change your password."));
    }
  },

  clearError: () => set({ error: null }),
}));
