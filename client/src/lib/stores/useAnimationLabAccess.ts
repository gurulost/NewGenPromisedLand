import { create } from "zustand";

interface AnimationLabAccessPayload {
  allowed: boolean;
  unlocked: boolean;
  requiresUnlock: boolean;
  configured: boolean;
  question: string;
  expiresAt: string | null;
}

interface AnimationLabAccessStore extends AnimationLabAccessPayload {
  loading: boolean;
  initialized: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  unlock: (answer: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => Promise<void>;
}

const devBypass = import.meta.env.DEV;

let refreshPromise: Promise<void> | null = null;
let expiryTimer: number | null = null;

const clearExpiryTimer = () => {
  if (typeof window === "undefined" || expiryTimer == null) return;
  window.clearTimeout(expiryTimer);
  expiryTimer = null;
};

const scheduleExpiry = (expiresAt: string | null) => {
  clearExpiryTimer();
  if (typeof window === "undefined" || !expiresAt) return;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return;
  const delay = expiryMs - Date.now();
  if (delay <= 0) {
    useAnimationLabAccess.setState({
      allowed: false,
      unlocked: false,
      expiresAt: null,
    });
    return;
  }
  expiryTimer = window.setTimeout(() => {
    useAnimationLabAccess.setState({
      allowed: false,
      unlocked: false,
      expiresAt: null,
    });
    expiryTimer = null;
  }, delay);
};

const applyPayload = (
  set: (state: Partial<AnimationLabAccessStore>) => void,
  payload: AnimationLabAccessPayload,
) => {
  scheduleExpiry(payload.expiresAt);
  set({
    ...payload,
    loading: false,
    initialized: true,
    error: null,
  });
};

const defaultState: Pick<
  AnimationLabAccessStore,
  "allowed" | "unlocked" | "requiresUnlock" | "configured" | "question" | "expiresAt"
> = devBypass
  ? {
      allowed: true,
      unlocked: true,
      requiresUnlock: false,
      configured: true,
      question: "",
      expiresAt: null,
    }
  : {
      allowed: false,
      unlocked: false,
      requiresUnlock: true,
      configured: true,
      question: "",
      expiresAt: null,
    };

async function fetchAnimationLabAccess(): Promise<AnimationLabAccessPayload> {
  const response = await fetch("/api/animation-lab/access", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to check Animation Lab access.");
  }

  return response.json() as Promise<AnimationLabAccessPayload>;
}

export const useAnimationLabAccess = create<AnimationLabAccessStore>((set) => ({
  ...defaultState,
  loading: false,
  initialized: devBypass,
  error: null,

  refresh: async () => {
    if (devBypass) {
      set({ ...defaultState, initialized: true, loading: false, error: null });
      return;
    }

    if (refreshPromise) return refreshPromise;

    set({ loading: true, error: null });
    refreshPromise = (async () => {
      try {
        const payload = await fetchAnimationLabAccess();
        applyPayload(set, payload);
      } catch (error) {
        clearExpiryTimer();
        set({
          loading: false,
          initialized: true,
          allowed: false,
          unlocked: false,
          error: error instanceof Error ? error.message : "Failed to check Animation Lab access.",
        });
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  unlock: async (answer) => {
    if (devBypass) {
      set({ ...defaultState, initialized: true, loading: false, error: null });
      return { success: true };
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/animation-lab/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error ? String(payload.error) : "Access denied.";
        clearExpiryTimer();
        set({
          loading: false,
          initialized: true,
          allowed: false,
          unlocked: false,
          error: message,
        });
        return { success: false, error: message };
      }

      applyPayload(set, payload as AnimationLabAccessPayload);
      return { success: true };
    } catch {
      clearExpiryTimer();
      const message = "Network error while unlocking Animation Lab.";
      set({
        loading: false,
        initialized: true,
        allowed: false,
        unlocked: false,
        error: message,
      });
      return { success: false, error: message };
    }
  },

  lock: async () => {
    clearExpiryTimer();
    if (devBypass) {
      set({ ...defaultState, initialized: true, loading: false, error: null });
      return;
    }

    try {
      const response = await fetch("/api/animation-lab/lock", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        const payload = await response.json();
        applyPayload(set, payload as AnimationLabAccessPayload);
        return;
      }
    } catch {
      // Fall back to local reset below.
    }

    set({
      ...defaultState,
      initialized: true,
      loading: false,
      error: null,
    });
  },
}));
