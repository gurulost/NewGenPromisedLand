import { create } from 'zustand';
import { TutorialCardId, TUTORIAL_CARDS } from '../tutorial/tutorialCards';

const STORAGE_KEY = 'cpl-tutorial-seen-v1';

type TutorialSeenState = Record<TutorialCardId, boolean>;

type TutorialSessionState = Record<TutorialCardId, boolean>;

interface TutorialStore {
  activeCardId: TutorialCardId | null;
  queuedCardIds: TutorialCardId[];
  skipAllSession: boolean;
  isLibraryOpen: boolean;
  seen: TutorialSeenState;
  dismissed: TutorialSessionState;
  openCard: (id: TutorialCardId) => void;
  closeCard: () => void;
  openLibrary: () => void;
  closeLibrary: () => void;
  clearQueue: () => void;
  skipAllForSession: () => void;
  markSeen: (id: TutorialCardId) => void;
  dismissForSession: (id: TutorialCardId) => void;
  openIfNeeded: (id: TutorialCardId) => boolean;
}

const loadSeen = (): TutorialSeenState => {
  if (typeof window === 'undefined') return {} as TutorialSeenState;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {} as TutorialSeenState;
    const parsed = JSON.parse(stored) as Partial<TutorialSeenState> | null;
    if (!parsed || typeof parsed !== 'object') return {} as TutorialSeenState;
    return parsed as TutorialSeenState;
  } catch {
    return {} as TutorialSeenState;
  }
};

const saveSeen = (seen: TutorialSeenState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // Ignore storage failures (private mode, quotas, etc.)
  }
};

const allCardIds = Object.keys(TUTORIAL_CARDS) as TutorialCardId[];
const emptySessionState = (): TutorialSessionState =>
  allCardIds.reduce((acc, id) => {
    acc[id] = false;
    return acc;
  }, {} as TutorialSessionState);

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  activeCardId: null,
  queuedCardIds: [],
  skipAllSession: false,
  isLibraryOpen: false,
  seen: loadSeen(),
  dismissed: emptySessionState(),
  openCard: (id) => set({ activeCardId: id, isLibraryOpen: false }),
  closeCard: () => {
    const { queuedCardIds, activeCardId, seen, dismissed, skipAllSession, isLibraryOpen } = get();
    if (skipAllSession) {
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
  openLibrary: () => set({ isLibraryOpen: true }),
  closeLibrary: () => {
    const { queuedCardIds, activeCardId, seen, dismissed, skipAllSession } = get();
    if (skipAllSession) {
      set({ isLibraryOpen: false });
      return;
    }
    if (!activeCardId && queuedCardIds.length > 0) {
      const nextQueue = queuedCardIds.filter(
        (id) => !seen[id] && !dismissed[id]
      );
      if (nextQueue.length > 0) {
        const [next, ...rest] = nextQueue;
        set({ isLibraryOpen: false, activeCardId: next, queuedCardIds: rest });
        return;
      }
    }
    set({ isLibraryOpen: false });
  },
  clearQueue: () => set({ queuedCardIds: [] }),
  skipAllForSession: () =>
    set({ skipAllSession: true, activeCardId: null, queuedCardIds: [], isLibraryOpen: false }),
  markSeen: (id) => {
    const next = { ...get().seen, [id]: true };
    saveSeen(next);
    set({ seen: next });
  },
  dismissForSession: (id) => set({ dismissed: { ...get().dismissed, [id]: true } }),
  openIfNeeded: (id) => {
    const { activeCardId, seen, dismissed, queuedCardIds, skipAllSession, isLibraryOpen } = get();
    if (skipAllSession) return false;
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
