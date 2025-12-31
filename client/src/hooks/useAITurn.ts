import { useEffect, useRef, useState } from 'react';
import { useLocalGame } from '../lib/stores/useLocalGame';
import { AITurnManager } from '@shared/ai/aiTurnManager';

/**
 * Hook to handle AI turns automatically
 * Returns isAIProcessing and currentAIPlayer for UI indicators
 */
export function useAITurn() {
  const { gameState, dispatch, onlineSession } = useLocalGame();
  const aiTurnManagerRef = useRef<AITurnManager | null>(null);
  const isExecutingRef = useRef(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [currentAIPlayer, setCurrentAIPlayer] = useState<{ name: string; factionId: string } | null>(null);

  useEffect(() => {
    if (!gameState || isExecutingRef.current) return;
    if (onlineSession && onlineSession.userId !== onlineSession.hostUserId) return;

    // Check if current player is AI and needs to take a turn
    if (AITurnManager.shouldExecuteAITurn(gameState)) {
      isExecutingRef.current = true;

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];

      // Set AI processing state for UI indicator
      setIsAIProcessing(true);
      setCurrentAIPlayer({ name: currentPlayer.name, factionId: currentPlayer.factionId });

      // Create AI turn manager if not exists
      if (!aiTurnManagerRef.current) {
        aiTurnManagerRef.current = new AITurnManager(gameState, dispatch);
      }

      // Execute AI turn with a small delay for visual feedback
      const executeAITurn = async () => {
        try {
          await aiTurnManagerRef.current!.executeAIPlayerTurn();
        } catch (error) {
          console.error('Error executing AI turn:', error);
        } finally {
          isExecutingRef.current = false;
          setIsAIProcessing(false);
          setCurrentAIPlayer(null);
        }
      };

      // Small delay to allow UI to update before AI acts
      const timeoutId = setTimeout(executeAITurn, 1500);

      return () => {
        clearTimeout(timeoutId);
        isExecutingRef.current = false;
        setIsAIProcessing(false);
        setCurrentAIPlayer(null);
      };
    }
  }, [gameState?.currentPlayerIndex, gameState?.turn, dispatch, onlineSession?.userId, onlineSession?.hostUserId]);

  // Update AI turn manager when game state changes
  useEffect(() => {
    if (gameState && aiTurnManagerRef.current) {
      aiTurnManagerRef.current = new AITurnManager(gameState, dispatch);
    }
  }, [gameState, dispatch]);

  return { isAIProcessing, currentAIPlayer };
}
