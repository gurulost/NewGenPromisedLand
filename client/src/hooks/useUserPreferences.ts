import { useState, useEffect, useCallback } from 'react';
import { 
  UserPreferences, 
  CameraPreferences, 
  UIPreferences, 
  AudioPreferences,
  loadUserPreferences, 
  saveUserPreferences,
  updateCameraPreferences,
  updateUIPreferences,
  updateAudioPreferences,
  resetPreferences
} from '../lib/userPreferences';

/**
 * Hook for managing user preferences with persistence
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const prefs = await loadUserPreferences();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPrefs();
  }, []);

  // Update camera preferences
  const updateCamera = useCallback(async (updates: Partial<CameraPreferences>) => {
    try {
      const updated = await updateCameraPreferences(updates);
      setPreferences(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update camera preferences:', error);
      throw error;
    }
  }, []);

  // Update UI preferences
  const updateUI = useCallback(async (updates: Partial<UIPreferences>) => {
    try {
      const updated = await updateUIPreferences(updates);
      setPreferences(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update UI preferences:', error);
      throw error;
    }
  }, []);

  // Update audio preferences
  const updateAudio = useCallback(async (updates: Partial<AudioPreferences>) => {
    try {
      const updated = await updateAudioPreferences(updates);
      setPreferences(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update audio preferences:', error);
      throw error;
    }
  }, []);

  // Reset all preferences
  const reset = useCallback(async () => {
    try {
      const defaultPrefs = await resetPreferences();
      setPreferences(defaultPrefs);
      return defaultPrefs;
    } catch (error) {
      console.error('Failed to reset preferences:', error);
      throw error;
    }
  }, []);

  // Save current preferences
  const save = useCallback(async (newPreferences: UserPreferences) => {
    try {
      await saveUserPreferences(newPreferences);
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  }, []);

  return {
    preferences,
    isLoading,
    updateCamera,
    updateUI,
    updateAudio,
    reset,
    save,
  };
}