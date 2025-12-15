import { useEffect } from 'react';
import { useParticleStore } from '../components/effects/ParticleEffects';
import { useMapToastStore } from '../lib/stores/useMapToasts';

/**
 * Global memory cleanup hook that periodically runs garbage collection
 * on all stores to prevent memory leaks during long play sessions.
 * 
 * This serves as a safety net in case individual component cleanup
 * callbacks fail (e.g., when tab is backgrounded and timers are throttled).
 */
export function useMemoryCleanup(intervalMs: number = 10000) {
  useEffect(() => {
    const cleanup = () => {
      // Clean up particle events that are stale
      useParticleStore.getState().cleanupStale();
      
      // Clean up map toasts that are stale
      useMapToastStore.getState().cleanupStale();
    };

    const intervalId = setInterval(cleanup, intervalMs);
    
    // Also run cleanup when tab becomes visible again after being backgrounded
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        cleanup();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}

/**
 * Hook to run cleanup when turn ends - a natural boundary for memory management
 */
export function useTurnEndCleanup(currentTurn: number) {
  useEffect(() => {
    // Run cleanup on turn change
    useParticleStore.getState().cleanupStale();
    useMapToastStore.getState().cleanupStale();
  }, [currentTurn]);
}
