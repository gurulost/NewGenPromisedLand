import { create } from "zustand";
import { identify, reset } from "../../utils/telemetry/posthog";

interface User {
  id: number;
  username: string;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const syncTelemetryIdentity = (user: User | null) => {
  if (user) {
    identify(String(user.id), {
      user_id: user.id,
      username: user.username,
      is_authenticated: true,
    });
    return;
  }

  reset();
};

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  checkAuth: async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const user = await res.json();
        syncTelemetryIdentity(user);
        set({ user, loading: false });
      } else {
        syncTelemetryIdentity(null);
        set({ user: null, loading: false });
      }
    } catch {
      syncTelemetryIdentity(null);
      set({ user: null, loading: false });
    }
  },

  login: async (username, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      if (res.ok) {
        const user = await res.json();
        syncTelemetryIdentity(user);
        set({ user });
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || "Login failed" };
      }
    } catch {
      return { success: false, error: "Network error" };
    }
  },

  signup: async (username, password) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      if (res.ok) {
        const user = await res.json();
        syncTelemetryIdentity(user);
        set({ user });
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || "Signup failed" };
      }
    } catch {
      return { success: false, error: "Network error" };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      syncTelemetryIdentity(null);
      set({ user: null });
    }
  },
}));
