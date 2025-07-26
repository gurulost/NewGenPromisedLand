import { useCallback } from 'react';

// Simple SFX hook - can be enhanced with actual audio later
export function useSfx(soundEffect?: string) {
  const playSfx = useCallback((effect: string) => {
    // Future: implement actual sound playback
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔊 SFX: ${effect}`);
    }
  }, []);

  // If called with a sound effect, play it immediately (for panel open/close)
  if (soundEffect) {
    playSfx(soundEffect);
  }

  return playSfx;
}