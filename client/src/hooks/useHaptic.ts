import { useCallback } from 'react';
import { useTouchMode } from './useTouchMode';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [30, 30, 30],
  error: [50, 100, 50],
};

export function useHaptic() {
  const { isTouchDevice } = useTouchMode();

  const vibrate = useCallback((pattern: HapticPattern = 'light') => {
    if (!isTouchDevice) return;
    
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(patterns[pattern]);
      } catch {
        // Vibration not supported or blocked
      }
    }
  }, [isTouchDevice]);

  return vibrate;
}
