import { GameState, PlayerState } from '../types/game';
import { executeAITurn, AIDecision, AIDifficulty } from './aiEngine';
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
      return;
    }





    const startTime = performance.now();
    
    try {
      // Get AI decisions for this turn
      const decisions = executeAITurn(this.gameState, currentPlayer);

      // Execute decisions in order of priority
      await this.executeDecisions(decisions, currentPlayer);
      
      // End the AI's turn
      this.endAITurn(currentPlayer);
      
      const totalTime = performance.now() - startTime;

      
    } catch (error) {
      console.error('💥 CRITICAL ERROR during AI turn execution:', error);
      console.error('📍 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Failsafe: just end the turn if AI encounters an error
      this.endAITurn(currentPlayer);
    }
  }

  /**
   * Execute AI decisions with proper timing and validation
   */
  private async executeDecisions(decisions: AIDecision[], aiPlayer: PlayerState): Promise<void> {
    let actionsExecuted = 0;
    let actionsFailed = 0;
    const difficulty = (aiPlayer.aiDifficulty as AIDifficulty) || 'normal';
    const maxActionsPerTurn = this.getMaxActionsForDifficulty(difficulty);

    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];
      
      if (actionsExecuted >= maxActionsPerTurn) {

        break;
      }
      
      const success = await this.executeDecision(decision, aiPlayer);
      if (success) {
        actionsExecuted++;
        // Add delay between actions for more natural feel
        const delay = this.getActionDelay(difficulty);
        await this.delay(delay);
      } else {
        actionsFailed++;
      }
    }



  }

  /**
   * Execute a single AI decision
   */
  private async executeDecision(decision: AIDecision, aiPlayer: PlayerState): Promise<boolean> {
    const actionStart = performance.now();
    
    try {
      
      switch (decision.type) {
        case 'MOVE_UNIT':
          if (decision.unitId && decision.targetCoordinate) {
            this.onDispatchAction({
              type: 'MOVE_UNIT',
              payload: {
                unitId: decision.unitId,
                targetCoordinate: decision.targetCoordinate
              }
            });
            return true;
          } else {
          }
          break;

        case 'ATTACK_UNIT':
          if (decision.unitId && decision.targetId) {
            this.onDispatchAction({
              type: 'ATTACK_UNIT',
              payload: {
                attackerId: decision.unitId,
                targetId: decision.targetId
              }
            });
            return true;
          } else {
          }
          break;

        case 'RESEARCH_TECH':
          if (decision.techId) {
            this.onDispatchAction({
              type: 'RESEARCH_TECH',
              payload: {
                playerId: aiPlayer.id,
                techId: decision.techId
              }
            });
            return true;
          } else {
          }
          break;

        case 'BUILD_STRUCTURE':
          if (decision.cityId && decision.buildingType) {
            const payload: any = {
              type: 'START_CONSTRUCTION',
              payload: {
                playerId: aiPlayer.id,
                buildingType: decision.buildingType,
                cityId: decision.cityId,
                category: decision.constructionCategory ?? 'structures'
              }
            };

            if ((decision.constructionCategory === 'improvements' || decision.constructionCategory === 'structures') && decision.targetCoordinate) {
              payload.payload.coordinate = decision.targetCoordinate;
            }

            this.onDispatchAction({
              ...payload
            });
            return true;
          } else {
          }
          break;

        case 'USE_ABILITY':
          if (decision.abilityId) {
            this.onDispatchAction({
              type: 'USE_ABILITY',
              payload: {
                playerId: aiPlayer.id,
                abilityId: decision.abilityId
              }
            });
            return true;
          } else {
          }
          break;

        case 'HEAL_UNIT':
          if (decision.unitId) {
            this.onDispatchAction({
              type: 'HEAL_UNIT',
              payload: {
                unitId: decision.unitId,
                playerId: aiPlayer.id,
              },
            });
            return true;
          } else {
          }
          break;

        case 'APPLY_STEALTH':
          if (decision.unitId) {
            this.onDispatchAction({
              type: 'APPLY_STEALTH',
              payload: {
                unitId: decision.unitId,
                playerId: aiPlayer.id,
              },
            });
            return true;
          } else {
          }
          break;

        case 'FORMATION_FIGHTING':
          if (decision.unitId) {
            this.onDispatchAction({
              type: 'FORMATION_FIGHTING',
              payload: {
                unitId: decision.unitId,
                playerId: aiPlayer.id,
              },
            });
            return true;
          } else {
          }
          break;

        case 'SIEGE_MODE':
          if (decision.unitId) {
            this.onDispatchAction({
              type: 'SIEGE_MODE',
              payload: {
                unitId: decision.unitId,
                playerId: aiPlayer.id,
              },
            });
            return true;
          } else {
          }
          break;

        case 'RALLY_TROOPS':
          if (decision.unitId) {
            this.onDispatchAction({
              type: 'RALLY_TROOPS',
              payload: {
                unitId: decision.unitId,
                playerId: aiPlayer.id,
              },
            });
            return true;
          } else {
          }
          break;

        default:
          break;
      }
    } catch (error) {
      const actionTime = performance.now() - actionStart;
      console.error(`   💥 Failed to execute AI decision ${decision.type} after ${actionTime.toFixed(1)}ms:`, error);
      console.error(`   📍 Error details:`, error instanceof Error ? error.message : error);
    }
    return false;
  }

  /**
   * End the AI player's turn
   */
  private endAITurn(aiPlayer: PlayerState): void {


    
    this.onDispatchAction({
      type: 'END_TURN',
      payload: {
        playerId: aiPlayer.id
      }
    });

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
