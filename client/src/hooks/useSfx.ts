import { useCallback } from 'react';
import { useAudio } from '../lib/stores/useAudio';

export type SfxType = string;

// Throttle map to prevent sound spam
const throttleMap = new Map<SfxType, number>();
const THROTTLE_DURATION = 150; // ms
const DEBUG_AUDIO = import.meta.env.DEV && import.meta.env.VITE_AUDIO_DEBUG === 'true';

export function useSfxEngine() {
  return useCallback((type: SfxType) => {
    const now = Date.now();
    const lastPlayed = throttleMap.get(type) || 0;
    if (now - lastPlayed < THROTTLE_DURATION) return;
    throttleMap.set(type, now);
    try {
      useAudio.getState().playSfx(type);
    } catch (error) {
      if (DEBUG_AUDIO) {
        console.debug('SFX playback failed:', error);
      }
    }
  }, []);
}

// Hook for individual sound effects
export function useSfx(type: SfxType, condition = true) {
  const playSound = useSfxEngine();

  return useCallback(() => {
    if (!condition) return;
    playSound(type);
  }, [condition, playSound, type]);
}
