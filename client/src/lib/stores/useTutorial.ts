import { create } from 'zustand';
import type { TutorialCardId } from '../tutorial/tutorialCards';

const STORAGE_KEY = 'cpl-tutorial-profiles-v2';

type TutorialSeenState = Partial<Record<TutorialCardId, boolean>>;

type TutorialSessionState = Partial<Record<TutorialCardId, boolean>>;

type TutorialBlockingSuppressionReason = 'public-multiplayer';

interface TutorialProfileState {
  seen: TutorialSeenState;
}

type TutorialProfilesState = Record<string, TutorialProfileState>;

interface TutorialStore {
  activeProfileKey: string | null;
  activeGameId: string | null;
  activeCardId: TutorialCardId | null;
  queuedCardIds: TutorialCardId[];
  isLibraryOpen: boolean;
  blockingSuppressionReason: TutorialBlockingSuppressionReason | null;
  profiles: TutorialProfilesState;
  dismissedByProfile: Record<string, TutorialSessionState>;
  skippedByProfile: Record<string, boolean>;
  setActiveProfile: (profileKey: string | null, gameId: string | null, isHuman: boolean) => void;
  setBlockingSuppression: (reason: TutorialBlockingSuppressionReason | null) => void;
  openCard: (id: TutorialCardId) => void;
  closeCard: () => void;
  openLibrary: () => void;
  closeLibrary: () => void;
  clearQueue: () => void;
  skipTutorialForGame: () => void;
  markSeen: (id: TutorialCardId) => void;
  dismissForGame: (id: TutorialCardId) => void;
  openIfNeeded: (id: TutorialCardId) => boolean;
}

const loadProfiles = (): TutorialProfilesState => {
  if (typeof window === 'undefined') {
    return {};
  }

  let profiles: TutorialProfilesState = {};

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TutorialProfilesState | null;
      if (parsed && typeof parsed === 'object') {
        profiles = parsed;
      }
    }
  } catch {
    profiles = {};
  }

  return profiles;
};

const saveProfiles = (profiles: TutorialProfilesState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore storage failures (private mode, quotas, etc.)
  }
};

const getProfileSeen = (profiles: TutorialProfilesState, profileKey: string): TutorialSeenState =>
  profiles[profileKey]?.seen ?? {};

const getProfileDismissed = (
  dismissedByProfile: Record<string, TutorialSessionState>,
  profileKey: string
): TutorialSessionState => dismissedByProfile[profileKey] ?? {};

const initialProfiles = loadProfiles();

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  activeProfileKey: null,
  activeGameId: null,
  activeCardId: null,
  queuedCardIds: [],
  isLibraryOpen: false,
  blockingSuppressionReason: null,
  profiles: initialProfiles,
  dismissedByProfile: {},
  skippedByProfile: {},
  setActiveProfile: (profileKey, gameId, isHuman) =>
    set((state) => {
      const next: Partial<TutorialStore> = {};
      const resolvedProfileKey = isHuman ? profileKey : null;
      const gameChanged = gameId !== state.activeGameId;

      if (gameChanged) {
        next.activeGameId = gameId;
        next.dismissedByProfile = {};
        next.skippedByProfile = {};
        next.activeCardId = null;
        next.queuedCardIds = [];
        next.isLibraryOpen = false;
      }

      if (resolvedProfileKey !== state.activeProfileKey) {
        next.activeProfileKey = resolvedProfileKey;
        next.activeCardId = null;
        next.queuedCardIds = [];
        next.isLibraryOpen = false;
      }

      if (!resolvedProfileKey && state.activeProfileKey) {
        next.activeProfileKey = null;
      }

      return next;
    }),
  setBlockingSuppression: (reason) =>
    set((state) => {
      if (state.blockingSuppressionReason === reason) return {};
      if (!reason) return { blockingSuppressionReason: null };
      return {
        blockingSuppressionReason: reason,
        activeCardId: null,
        queuedCardIds: [],
        isLibraryOpen: false,
      };
    }),
  openCard: (id) =>
    set((state) => (
      state.blockingSuppressionReason
        ? {}
        : { activeCardId: id, isLibraryOpen: false }
    )),
  closeCard: () => {
    const {
      queuedCardIds,
      activeCardId,
      profiles,
      dismissedByProfile,
      skippedByProfile,
      activeProfileKey,
      isLibraryOpen,
    } = get();

    if (activeProfileKey && skippedByProfile[activeProfileKey]) {
      set({ activeCardId: null, queuedCardIds: [] });
      return;
    }

    if (isLibraryOpen) {
      if (!activeCardId) return;
      const nextQueue = queuedCardIds.filter((id) => id !== activeCardId);
      set({ activeCardId: null, queuedCardIds: nextQueue });
      return;
    }

    if (queuedCardIds.length > 0) {
      const seen = activeProfileKey ? getProfileSeen(profiles, activeProfileKey) : {};
      const dismissed = activeProfileKey ? getProfileDismissed(dismissedByProfile, activeProfileKey) : {};
      const nextQueue = queuedCardIds.filter(
        (id) => id !== activeCardId && !seen[id] && !dismissed[id]
      );
      if (nextQueue.length > 0) {
        const [next, ...rest] = nextQueue;
        set({ activeCardId: next, queuedCardIds: rest });
        return;
      }
    }

    set({ activeCardId: null, queuedCardIds: [] });
  },
  openLibrary: () =>
    set((state) => (
      state.blockingSuppressionReason
        ? {}
        : { isLibraryOpen: true }
    )),
  closeLibrary: () => {
    const {
      queuedCardIds,
      activeCardId,
      profiles,
      dismissedByProfile,
      skippedByProfile,
      activeProfileKey,
    } = get();

    if (activeProfileKey && skippedByProfile[activeProfileKey]) {
      set({ isLibraryOpen: false });
      return;
    }

    if (!activeCardId && queuedCardIds.length > 0) {
      const seen = activeProfileKey ? getProfileSeen(profiles, activeProfileKey) : {};
      const dismissed = activeProfileKey ? getProfileDismissed(dismissedByProfile, activeProfileKey) : {};
      const nextQueue = queuedCardIds.filter((id) => !seen[id] && !dismissed[id]);
      if (nextQueue.length > 0) {
        const [next, ...rest] = nextQueue;
        set({ isLibraryOpen: false, activeCardId: next, queuedCardIds: rest });
        return;
      }
    }

    set({ isLibraryOpen: false });
  },
  clearQueue: () => set({ queuedCardIds: [] }),
  skipTutorialForGame: () => {
    const { activeProfileKey, skippedByProfile } = get();
    if (!activeProfileKey) {
      set({ activeCardId: null, queuedCardIds: [], isLibraryOpen: false });
      return;
    }
    set({
      skippedByProfile: { ...skippedByProfile, [activeProfileKey]: true },
      activeCardId: null,
      queuedCardIds: [],
      isLibraryOpen: false,
    });
  },
  markSeen: (id) => {
    const { activeProfileKey, profiles } = get();
    if (!activeProfileKey) return;
    const current = profiles[activeProfileKey]?.seen ?? {};
    const nextProfiles = {
      ...profiles,
      [activeProfileKey]: {
        seen: { ...current, [id]: true },
      },
    };
    saveProfiles(nextProfiles);
    set({ profiles: nextProfiles });
  },
  dismissForGame: (id) => {
    const { activeProfileKey, dismissedByProfile } = get();
    if (!activeProfileKey) return;
    const current = dismissedByProfile[activeProfileKey] ?? {};
    set({
      dismissedByProfile: {
        ...dismissedByProfile,
        [activeProfileKey]: { ...current, [id]: true },
      },
    });
  },
  openIfNeeded: (id) => {
    const {
      activeCardId,
      profiles,
      dismissedByProfile,
      queuedCardIds,
      skippedByProfile,
      activeProfileKey,
      isLibraryOpen,
      blockingSuppressionReason,
    } = get();

    if (blockingSuppressionReason) return false;
    if (!activeProfileKey) return false;
    if (skippedByProfile[activeProfileKey]) return false;

    const seen = getProfileSeen(profiles, activeProfileKey);
    const dismissed = getProfileDismissed(dismissedByProfile, activeProfileKey);

    if (seen[id] || dismissed[id]) return false;

    if (isLibraryOpen) {
      if (!queuedCardIds.includes(id)) {
        set({ queuedCardIds: [...queuedCardIds, id] });
      }
      return false;
    }

    if (activeCardId) {
      if (activeCardId === id) return false;
      if (!queuedCardIds.includes(id)) {
        set({ queuedCardIds: [...queuedCardIds, id] });
      }
      return false;
    }

    set({ activeCardId: id });
    return true;
  },
}));
