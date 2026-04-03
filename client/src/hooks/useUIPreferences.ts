import { useEffect } from 'react';
import { create } from 'zustand';

import {
  DEFAULT_UI_PREFERENCES,
  type UIPreferences,
  loadUserPreferences,
  updateUIPreferences,
} from '../lib/userPreferences';

interface UIPreferencesState {
  preferences: UIPreferences;
  isLoaded: boolean;
  isLoading: boolean;
  load: () => Promise<UIPreferences>;
  updateUI: (updates: Partial<UIPreferences>) => Promise<UIPreferences>;
}

let inFlightLoad: Promise<UIPreferences> | null = null;
let requestVersion = 0;

export const useUIPreferencesStore = create<UIPreferencesState>((set, get) => ({
  preferences: DEFAULT_UI_PREFERENCES,
  isLoaded: false,
  isLoading: false,

  load: async () => {
    if (get().isLoaded) {
      return get().preferences;
    }

    if (inFlightLoad) {
      return inFlightLoad;
    }

    const currentVersion = ++requestVersion;
    set({ isLoading: true });

    inFlightLoad = loadUserPreferences()
      .then((userPreferences) => {
        const preferences = {
          ...DEFAULT_UI_PREFERENCES,
          ...userPreferences.ui,
        };

        if (currentVersion === requestVersion) {
          set({
            preferences,
            isLoaded: true,
            isLoading: false,
          });
        }

        return preferences;
      })
      .catch((error) => {
        if (currentVersion === requestVersion) {
          set({ isLoading: false });
        }
        throw error;
      })
      .finally(() => {
        inFlightLoad = null;
      });

    return inFlightLoad;
  },

  updateUI: async (updates) => {
    const currentVersion = ++requestVersion;
    set({ isLoading: true });

    try {
      const userPreferences = await updateUIPreferences(updates);
      const preferences = {
        ...DEFAULT_UI_PREFERENCES,
        ...userPreferences.ui,
      };

      if (currentVersion === requestVersion) {
        set({
          preferences,
          isLoaded: true,
          isLoading: false,
        });
      }

      return preferences;
    } catch (error) {
      if (currentVersion === requestVersion) {
        set({ isLoading: false });
      }
      throw error;
    }
  },
}));

export function useUIPreferences() {
  const preferences = useUIPreferencesStore((state) => state.preferences);
  const isLoaded = useUIPreferencesStore((state) => state.isLoaded);
  const isLoading = useUIPreferencesStore((state) => state.isLoading);
  const load = useUIPreferencesStore((state) => state.load);
  const updateUI = useUIPreferencesStore((state) => state.updateUI);

  useEffect(() => {
    if (isLoaded || isLoading) {
      return;
    }

    void load().catch(() => {});
  }, [isLoaded, isLoading, load]);

  return {
    preferences,
    isLoaded,
    isLoading,
    updateUI,
  };
}
