import { useEffect, useRef } from 'react';
import { useLocalGame } from '../lib/stores/useLocalGame';
import { AITurnManager } from '@shared/ai/aiTurnManager';
import { useToastContext } from '../components/ui/ToastProvider';

/**
 * Hook to handle AI turns automatically
 */
export function useAITurn() {
  const { gameState, dispatch } = useLocalGame();
  const toast = useToastContext();
  const aiTurnManagerRef = useRef<AITurnManager | null>(null);
  const isExecutingRef = useRef(false);

  useEffect(() => {
    if (!gameState || isExecutingRef.current) return;

    // Check if current player is AI and needs to take a turn
    if (AITurnManager.shouldExecuteAITurn(gameState)) {
      isExecutingRef.current = true;
      
      // Create AI turn manager if not exists
      if (!aiTurnManagerRef.current) {
        aiTurnManagerRef.current = new AITurnManager(gameState, dispatch);
      }

      // Show AI turn progress feedback
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      toast?.info('AI Turn Starting', `${currentPlayer.name} is thinking...`);

      // Execute AI turn with a small delay for visual feedback
      const executeAITurn = async () => {
        try {
          toast?.info('AI Processing', `${currentPlayer.name} is making decisions and taking actions...`);
          await aiTurnManagerRef.current!.executeAIPlayerTurn();
          toast?.success('AI Turn Complete', `${currentPlayer.name} has finished their turn`);
        } catch (error) {
          console.error('Error executing AI turn:', error);
          toast?.error('AI Turn Failed', `${currentPlayer.name} encountered an error during their turn`);
        } finally {
          isExecutingRef.current = false;
        }
      };

      // Small delay to allow UI to update before AI acts
      const timeoutId = setTimeout(executeAITurn, 1500);
      
      return () => {
        clearTimeout(timeoutId);
        isExecutingRef.current = false;
      };
    }
  }, [gameState?.currentPlayerIndex, gameState?.turn, dispatch]);

  // Update AI turn manager when game state changes
  useEffect(() => {
    if (gameState && aiTurnManagerRef.current) {
      aiTurnManagerRef.current = new AITurnManager(gameState, dispatch);
    }
  }, [gameState, dispatch]);
}