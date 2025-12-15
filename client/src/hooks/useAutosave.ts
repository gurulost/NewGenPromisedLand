import { useEffect, useRef, useCallback } from 'react';
import { useLocalGame } from '../lib/stores/useLocalGame';
import { saveAutosave } from '../lib/autosaveStorage';

const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useAutosave() {
  const gameState = useLocalGame((state) => state.gameState);
  const gameStateRef = useRef(gameState);
  const lastTurnRef = useRef<number | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const isSavingRef = useRef(false);

  // Keep gameStateRef updated with latest state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const performAutosave = useCallback(async () => {
    const currentState = gameStateRef.current;
    if (!currentState || currentState.phase !== 'playing' || isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    try {
      await saveAutosave(currentState);
      lastSaveTimeRef.current = Date.now();
      console.log('[Autosave] Game saved successfully at turn', currentState.turn);
    } catch (error) {
      console.error('[Autosave] Failed to save:', error);
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // Autosave on turn change
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') {
      lastTurnRef.current = null;
      return;
    }

    const currentTurn = gameState.turn;
    
    if (lastTurnRef.current !== null && currentTurn !== lastTurnRef.current) {
      performAutosave();
    }
    
    lastTurnRef.current = currentTurn;
  }, [gameState?.turn, gameState?.phase]);

  // Periodic autosave every 2 minutes
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') {
      return;
    }

    const intervalId = setInterval(() => {
      const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
      if (timeSinceLastSave >= AUTOSAVE_INTERVAL_MS) {
        performAutosave();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [gameState?.phase]);

  // Initial autosave when game starts
  useEffect(() => {
    if (gameState?.phase === 'playing' && lastSaveTimeRef.current === 0) {
      const timer = setTimeout(() => {
        performAutosave();
      }, 5000); // Wait 5 seconds after game starts
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase]);
}
