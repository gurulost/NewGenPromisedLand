import { useEffect } from 'react';

export function useSfx(soundPath: string) {
  useEffect(() => {
    // Optional SFX hook - graceful no-op fallback
    // Could be implemented with howler.js or Web Audio API in the future
    console.log(`SFX would play: ${soundPath}`);
  }, [soundPath]);
}