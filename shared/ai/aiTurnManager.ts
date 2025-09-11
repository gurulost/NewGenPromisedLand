import { GameState, PlayerState } from '../types/game';
import { executeAITurn, AIDecision } from './aiEngine';
// Note: gameDebugger import removed to avoid cross-layer dependency

/**
 * AI Turn Manager
 * Handles automatic execution of AI player turns
 */
export class AITurnManager {
  private gameState: GameState;
  private onDispatchAction: (action: any) => void;

  constructor(gameState: GameState, onDispatchAction: (action: any) => void) {
    this.gameState = gameState;
    this.onDispatchAction = onDispatchAction;
  }

  /**
   * Execute a full AI turn for the current player
   */
  public async executeAIPlayerTurn(): Promise<void> {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    
    if (!currentPlayer || !currentPlayer.isAI) {
      console.warn('Current player is not an AI player');
      return;
    }

    console.log(`🤖 AI Player "${currentPlayer.name}" (${currentPlayer.factionId}) is taking their turn...`);
    console.log(`AI turn started for ${currentPlayer.name} (${currentPlayer.aiDifficulty})`);

    try {
      // Get AI decisions for this turn
      const decisions = executeAITurn(this.gameState, currentPlayer);
      
      console.log(`🧠 AI generated ${decisions.length} potential actions`);
      
      // Execute decisions in order of priority
      await this.executeDecisions(decisions, currentPlayer);
      
      // End the AI's turn
      this.endAITurn(currentPlayer);
      
    } catch (error) {
      console.error('Error during AI turn execution:', error);
      // Failsafe: just end the turn if AI encounters an error
      this.endAITurn(currentPlayer);
    }
  }

  /**
   * Execute AI decisions with proper timing and validation
   */
  private async executeDecisions(decisions: AIDecision[], aiPlayer: PlayerState): Promise<void> {
    let actionsExecuted = 0;
    const maxActionsPerTurn = this.getMaxActionsForDifficulty(aiPlayer.aiDifficulty || 'normal');

    for (const decision of decisions) {
      if (actionsExecuted >= maxActionsPerTurn) {
        console.log(`🎯 AI reached maximum actions (${maxActionsPerTurn}) for this turn`);
        break;
      }

      const success = await this.executeDecision(decision, aiPlayer);
      if (success) {
        actionsExecuted++;
        // Add delay between actions for more natural feel
        await this.delay(this.getActionDelay(aiPlayer.aiDifficulty || 'normal'));
      }
    }

    console.log(`⚡ AI executed ${actionsExecuted} actions this turn`);
  }

  /**
   * Execute a single AI decision
   */
  private async executeDecision(decision: AIDecision, aiPlayer: PlayerState): Promise<boolean> {
    try {
      switch (decision.type) {
        case 'MOVE_UNIT':
          if (decision.unitId && decision.targetCoordinate) {
            console.log(`🚶 AI moving unit ${decision.unitId} to (${decision.targetCoordinate.q}, ${decision.targetCoordinate.r})`);
            this.onDispatchAction({
              type: 'MOVE_UNIT',
              unitId: decision.unitId,
              targetCoordinate: decision.targetCoordinate
            });
            return true;
          }
          break;

        case 'ATTACK_UNIT':
          if (decision.unitId && decision.targetId) {
            console.log(`⚔️ AI attacking with unit ${decision.unitId} targeting ${decision.targetId}`);
            this.onDispatchAction({
              type: 'ATTACK_UNIT',
              attackerId: decision.unitId,
              targetId: decision.targetId
            });
            return true;
          }
          break;

        case 'RESEARCH_TECH':
          if (decision.techId) {
            console.log(`🔬 AI researching technology: ${decision.techId}`);
            this.onDispatchAction({
              type: 'RESEARCH_TECH',
              playerId: aiPlayer.id,
              techId: decision.techId
            });
            return true;
          }
          break;

        case 'BUILD_STRUCTURE':
          if (decision.cityId && decision.buildingType) {
            console.log(`🏗️ AI building ${decision.buildingType} in city ${decision.cityId}`);
            this.onDispatchAction({
              type: 'START_CONSTRUCTION',
              playerId: aiPlayer.id,
              buildingType: decision.buildingType,
              cityId: decision.cityId,
              category: 'structures'
            });
            return true;
          }
          break;

        case 'USE_ABILITY':
          if (decision.abilityId) {
            console.log(`✨ AI using ability: ${decision.abilityId}`);
            this.onDispatchAction({
              type: 'USE_ABILITY',
              playerId: aiPlayer.id,
              abilityId: decision.abilityId
            });
            return true;
          }
          break;

        default:
          console.warn(`Unknown AI decision type: ${decision.type}`);
          break;
      }
    } catch (error) {
      console.error(`Failed to execute AI decision ${decision.type}:`, error);
    }

    return false;
  }

  /**
   * End the AI player's turn
   */
  private endAITurn(aiPlayer: PlayerState): void {
    console.log(`🏁 AI Player "${aiPlayer.name}" ending turn`);
    
    this.onDispatchAction({
      type: 'END_TURN',
      playerId: aiPlayer.id
    });

    console.log(`AI turn completed for ${aiPlayer.name}`);
  }

  /**
   * Get maximum actions per turn based on AI difficulty
   */
  private getMaxActionsForDifficulty(difficulty: 'easy' | 'normal' | 'hard'): number {
    switch (difficulty) {
      case 'easy': return 2; // Fewer actions, simpler gameplay
      case 'normal': return 3; // Balanced gameplay
      case 'hard': return 4; // More actions, more pressure
      default: return 3;
    }
  }

  /**
   * Get delay between actions based on AI difficulty
   */
  private getActionDelay(difficulty: 'easy' | 'normal' | 'hard'): number {
    switch (difficulty) {
      case 'easy': return 1500; // Slower, more contemplative
      case 'normal': return 1000; // Balanced timing
      case 'hard': return 800; // Faster, more aggressive
      default: return 1000;
    }
  }

  /**
   * Simple delay utility for timing AI actions
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if the current player is an AI and should take a turn
   */
  public static shouldExecuteAITurn(gameState: GameState): boolean {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.isAI === true && !currentPlayer.isEliminated;
  }
}