import { get, set } from 'idb-keyval';

// User preference types
export interface CameraPreferences {
  autoFollowTurnChange: boolean;
  autoFollowUnitSelection: boolean;
  cameraSpeed: number;
  zoomSpeed: number;
}

export interface UIPreferences {
  showTooltips: boolean;
  tooltipDelay: number;
  reducedMotion: boolean;
  showAnimations: boolean;
}

export interface AudioPreferences {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  uiSoundsEnabled: boolean;
}

export interface UserPreferences {
  camera: CameraPreferences;
  ui: UIPreferences;
  audio: AudioPreferences;
  version: number;
}

export const DEFAULT_CAMERA_PREFERENCES: CameraPreferences = {
  autoFollowTurnChange: true,
  autoFollowUnitSelection: false, // Polytopia-style manual control by default
  cameraSpeed: 1.0,
  zoomSpeed: 1.0,
};

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  showTooltips: true,
  tooltipDelay: 500,
  reducedMotion: false,
  showAnimations: true,
};

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  isMuted: false,
  uiSoundsEnabled: true,
};

// Default preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  camera: {
    ...DEFAULT_CAMERA_PREFERENCES,
  },
  ui: {
    ...DEFAULT_UI_PREFERENCES,
  },
  audio: {
    ...DEFAULT_AUDIO_PREFERENCES,
  },
  version: 1,
};

const PREFERENCES_KEY = 'user_preferences';

/**
 * Load user preferences from storage
 */
export async function loadUserPreferences(): Promise<UserPreferences> {
  try {
    const stored = await get(PREFERENCES_KEY) as UserPreferences | undefined;
    
    if (stored && stored.version === DEFAULT_PREFERENCES.version) {
      // Merge with defaults to ensure all properties exist
      return {
        ...DEFAULT_PREFERENCES,
        ...stored,
        camera: { ...DEFAULT_PREFERENCES.camera, ...stored.camera },
        ui: { ...DEFAULT_PREFERENCES.ui, ...stored.ui },
        audio: { ...DEFAULT_PREFERENCES.audio, ...stored.audio },
      };
    }
    
    // First time or version mismatch - return defaults
    return DEFAULT_PREFERENCES;
  } catch (error) {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save user preferences to storage
 */
export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  try {
    await set(PREFERENCES_KEY, preferences);
  } catch (error) {
    console.error('Failed to save user preferences:', error);
    throw error;
  }
}

/**
 * Update specific camera preferences
 */
export async function updateCameraPreferences(updates: Partial<CameraPreferences>): Promise<UserPreferences> {
  const current = await loadUserPreferences();
  const updated = {
    ...current,
    camera: { ...current.camera, ...updates }
  };
  await saveUserPreferences(updated);
  return updated;
}

/**
 * Update specific UI preferences
 */
export async function updateUIPreferences(updates: Partial<UIPreferences>): Promise<UserPreferences> {
  const current = await loadUserPreferences();
  const updated = {
    ...current,
    ui: { ...current.ui, ...updates }
  };
  await saveUserPreferences(updated);
  return updated;
}

/**
 * Update specific audio preferences
 */
export async function updateAudioPreferences(updates: Partial<AudioPreferences>): Promise<UserPreferences> {
  const current = await loadUserPreferences();
  const updated = {
    ...current,
    audio: { ...current.audio, ...updates }
  };
  await saveUserPreferences(updated);
  return updated;
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<UserPreferences> {
  await saveUserPreferences(DEFAULT_PREFERENCES);
  return DEFAULT_PREFERENCES;
}
