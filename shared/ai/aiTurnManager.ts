import { GameAction, GameState, PlayerState } from '../types/game';
import { executeAITurn, AIDecision, AIDifficulty } from './aiEngine';
import { getUnitSpawnCoordinate } from '../logic/actions/spawnUtils';
import { getFactionAbilityAvailability } from '../logic/factionAbilityAvailability';
import { resolveActionState } from '../logic/resolveAction';
import type { HexCoordinate } from '../types/coordinates';
import type { UnitType } from '../types/unit';
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

    let plannedDecisions = decisions;

    while (actionsExecuted < maxActionsPerTurn) {
      const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.id !== aiPlayer.id) {
        break;
      }

      if (plannedDecisions.length === 0) {
        plannedDecisions = executeAITurn(this.gameState, currentPlayer);
      }

      if (plannedDecisions.length === 0) {
        break;
      }

      let committedAction = false;
      for (const decision of plannedDecisions) {
        const success = await this.executeDecision(decision, currentPlayer);
        if (success) {
          actionsExecuted++;
          committedAction = true;
          plannedDecisions = [];
          const delay = this.getActionDelay(difficulty);
          await this.delay(delay);
          break;
        }

        actionsFailed++;
      }

      if (!committedAction) {
        break;
      }
    }



  }

  /**
   * Execute a single AI decision
   */
  private async executeDecision(decision: AIDecision, aiPlayer: PlayerState): Promise<boolean> {
    const actionStart = performance.now();
    
    try {
      const action = this.translateDecisionToAction(decision, aiPlayer);
      if (!action) {
        return false;
      }

      const nextState = resolveActionState(this.gameState, action, { source: 'ai' });
      if (nextState === this.gameState) {
        return false;
      }

      this.onDispatchAction(action);
      this.gameState = nextState;
      return true;
    } catch (error) {
      const actionTime = performance.now() - actionStart;
      console.error(`   💥 Failed to execute AI decision ${decision.type} after ${actionTime.toFixed(1)}ms:`, error);
      console.error(`   📍 Error details:`, error instanceof Error ? error.message : error);
    }
    return false;
  }

  private translateDecisionToAction(decision: AIDecision, aiPlayer: PlayerState): GameAction | null {
    switch (decision.type) {
      case 'MOVE_UNIT':
        if (decision.unitId && decision.targetCoordinate) {
          return {
            type: 'MOVE_UNIT',
            payload: {
              unitId: decision.unitId,
              targetCoordinate: decision.targetCoordinate,
            },
          };
        }
        return null;

      case 'ATTACK_UNIT':
        if (decision.unitId && decision.targetId) {
          return {
            type: 'ATTACK_UNIT',
            payload: {
              attackerId: decision.unitId,
              targetId: decision.targetId,
            },
          };
        }
        return null;

      case 'CAPTURE_CITY':
        if (decision.unitId && decision.cityId) {
          return {
            type: 'CAPTURE_CITY',
            payload: {
              playerId: aiPlayer.id,
              unitId: decision.unitId,
              cityId: decision.cityId,
            },
          };
        }
        return null;

      case 'CONQUER_VILLAGE':
        if (decision.unitId) {
          return {
            type: 'CONQUER_VILLAGE',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      case 'CONVERT_VILLAGE':
        if (decision.unitId) {
          return {
            type: 'CONVERT_VILLAGE',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      case 'EXPLORE_RUINS':
        if (decision.unitId && decision.targetCoordinate) {
          return {
            type: 'EXPLORE_RUINS',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
              coordinate: decision.targetCoordinate,
            },
          };
        }
        return null;

      case 'WORLD_ELEMENT_HARVEST':
        if (decision.unitId && decision.elementId && decision.targetCoordinate) {
          return {
            type: 'WORLD_ELEMENT_HARVEST',
            payload: {
              playerId: aiPlayer.id,
              unitId: decision.unitId,
              elementId: decision.elementId,
              coordinate: decision.targetCoordinate,
            },
          };
        }
        return null;

      case 'WORLD_ELEMENT_BUILD':
        if (decision.unitId && decision.elementId && decision.targetCoordinate) {
          return {
            type: 'WORLD_ELEMENT_BUILD',
            payload: {
              playerId: aiPlayer.id,
              unitId: decision.unitId,
              elementId: decision.elementId,
              coordinate: decision.targetCoordinate,
            },
          };
        }
        return null;

      case 'RESEARCH_TECH':
        if (decision.techId) {
          return {
            type: 'RESEARCH_TECH',
            payload: {
              playerId: aiPlayer.id,
              techId: decision.techId,
            },
          };
        }
        return null;

      case 'START_CONSTRUCTION':
        if (decision.cityId && decision.buildingType) {
          const payload = {
            type: 'START_CONSTRUCTION' as const,
            payload: {
              playerId: aiPlayer.id,
              buildingType: decision.buildingType,
              cityId: decision.cityId,
              category: decision.constructionCategory ?? 'structures',
            } as {
              playerId: string;
              buildingType: string;
              cityId: string;
              category: 'improvements' | 'structures' | 'units';
              coordinate?: HexCoordinate;
              builderUnitId?: string;
            },
          };

          if (decision.builderUnitId) {
            payload.payload.builderUnitId = decision.builderUnitId;
          }

          if ((decision.constructionCategory === 'improvements' || decision.constructionCategory === 'structures') && decision.targetCoordinate) {
            payload.payload.coordinate = decision.targetCoordinate;
          }

          if (decision.constructionCategory === 'units' && decision.targetCoordinate) {
            payload.payload.coordinate = decision.targetCoordinate;
          } else if (decision.constructionCategory === 'units') {
            const city = this.gameState.cities?.find(c => c.id === decision.cityId);
            if (!city) return null;
            const spawnCoordinate = getUnitSpawnCoordinate(
              this.gameState,
              decision.buildingType as UnitType,
              city.coordinate
            );
            if (!spawnCoordinate) return null;
            payload.payload.coordinate = spawnCoordinate;
          }

          return payload as GameAction;
        }
        return null;

      case 'USE_ABILITY':
        if (decision.abilityId) {
          const availability = getFactionAbilityAvailability(this.gameState, aiPlayer.id, decision.abilityId);
          if (!availability.available) return null;

          return {
            type: 'USE_ABILITY',
            payload: {
              playerId: aiPlayer.id,
              abilityId: decision.abilityId,
            },
          };
        }
        return null;

      case 'HEAL_UNIT':
        if (decision.unitId) {
          return {
            type: 'HEAL_UNIT',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      case 'APPLY_STEALTH':
        if (decision.unitId) {
          return {
            type: 'APPLY_STEALTH',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      case 'FORMATION_FIGHTING':
        if (decision.unitId) {
          return {
            type: 'FORMATION_FIGHTING',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      case 'SIEGE_MODE':
        if (decision.unitId) {
          return {
            type: 'SIEGE_MODE',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      case 'RALLY_TROOPS':
        if (decision.unitId) {
          return {
            type: 'RALLY_TROOPS',
            payload: {
              unitId: decision.unitId,
              playerId: aiPlayer.id,
            },
          };
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * End the AI player's turn
   */
  private endAITurn(aiPlayer: PlayerState): void {
    const action: GameAction = {
      type: 'END_TURN',
      payload: {
        playerId: aiPlayer.id
      }
    };

    this.onDispatchAction(action);
    this.gameState = resolveActionState(this.gameState, action, { source: 'ai' });

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
