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
      console.warn('🚫 Current player is not an AI player - skipping AI turn');
      return;
    }

    console.log(`\n🤖 ===== AI TURN START =====`);
    console.log(`🎮 Player: "${currentPlayer.name}" (${currentPlayer.factionId})`);
    console.log(`🎯 Difficulty: ${currentPlayer.aiDifficulty}`);
    console.log(`💰 Stars: ${currentPlayer.stars}, 🙏 Faith: ${currentPlayer.stats.faith}`);
    console.log(`🗺️  Units: ${this.gameState.units.filter(u => u.playerId === currentPlayer.id).length}`);

    const startTime = performance.now();
    
    try {
      // Get AI decisions for this turn
      console.log(`🧠 Generating AI decisions...`);
      const decisions = executeAITurn(this.gameState, currentPlayer);
      
      console.log(`📊 AI DECISION SUMMARY:`);
      console.log(`   Total potential actions: ${decisions.length}`);
      if (decisions.length > 0) {
        console.log(`   Highest priority: ${decisions[0].type} (${decisions[0].priority.toFixed(1)})`);
        console.log(`   Decision breakdown:`, decisions.map(d => `${d.type}(${d.priority.toFixed(1)})`).join(', '));
      } else {
        console.log(`   ⚠️  No actions generated - AI may be stuck or have no valid moves`);
      }
      
      // Execute decisions in order of priority
      await this.executeDecisions(decisions, currentPlayer);
      
      // End the AI's turn
      this.endAITurn(currentPlayer);
      
      const totalTime = performance.now() - startTime;
      console.log(`⏱️  AI turn completed in ${totalTime.toFixed(1)}ms`);
      console.log(`🤖 ===== AI TURN END =====\n`);
      
    } catch (error) {
      console.error('💥 CRITICAL ERROR during AI turn execution:', error);
      console.error('📍 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.log(`🚨 Failsafe: Ending AI turn due to error`);
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
    const maxActionsPerTurn = this.getMaxActionsForDifficulty(aiPlayer.aiDifficulty || 'normal');

    console.log(`🎯 Executing up to ${maxActionsPerTurn} actions...`);

    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];
      
      if (actionsExecuted >= maxActionsPerTurn) {
        console.log(`🛑 AI reached maximum actions (${maxActionsPerTurn}) - stopping execution`);
        console.log(`📋 Remaining actions skipped: ${decisions.length - i}`);
        break;
      }

      console.log(`\n🎬 Action ${actionsExecuted + 1}/${maxActionsPerTurn}: ${decision.type} (priority: ${decision.priority.toFixed(1)})`);
      
      const success = await this.executeDecision(decision, aiPlayer);
      if (success) {
        actionsExecuted++;
        console.log(`✅ Action executed successfully`);
        // Add delay between actions for more natural feel
        const delay = this.getActionDelay(aiPlayer.aiDifficulty || 'normal');
        console.log(`⏳ Waiting ${delay}ms before next action...`);
        await this.delay(delay);
      } else {
        actionsFailed++;
        console.log(`❌ Action failed to execute`);
      }
    }

    console.log(`\n📈 EXECUTION SUMMARY:`);
    console.log(`   ✅ Actions executed: ${actionsExecuted}`);
    console.log(`   ❌ Actions failed: ${actionsFailed}`);
    console.log(`   📊 Success rate: ${decisions.length > 0 ? ((actionsExecuted / decisions.length) * 100).toFixed(1) : 0}%`);
  }

  /**
   * Execute a single AI decision
   */
  private async executeDecision(decision: AIDecision, aiPlayer: PlayerState): Promise<boolean> {
    const actionStart = performance.now();
    
    try {
      console.log(`🔧 Executing ${decision.type}...`);
      
      switch (decision.type) {
        case 'MOVE_UNIT':
          if (decision.unitId && decision.targetCoordinate) {
            console.log(`   🚶 Moving unit ${decision.unitId} from current position to (${decision.targetCoordinate.q}, ${decision.targetCoordinate.r})`);
            this.onDispatchAction({
              type: 'MOVE_UNIT',
              unitId: decision.unitId,
              targetCoordinate: decision.targetCoordinate
            });
            console.log(`   📦 Action dispatched to game state`);
            return true;
          } else {
            console.log(`   ⚠️  Missing unitId or targetCoordinate for MOVE_UNIT`);
          }
          break;

        case 'ATTACK_UNIT':
          if (decision.unitId && decision.targetId) {
            console.log(`   ⚔️  Attack: unit ${decision.unitId} targeting ${decision.targetId}`);
            this.onDispatchAction({
              type: 'ATTACK_UNIT',
              attackerId: decision.unitId,
              targetId: decision.targetId
            });
            console.log(`   📦 Attack action dispatched to game state`);
            return true;
          } else {
            console.log(`   ⚠️  Missing unitId or targetId for ATTACK_UNIT`);
          }
          break;

        case 'RESEARCH_TECH':
          if (decision.techId) {
            console.log(`   🔬 Researching technology: ${decision.techId}`);
            this.onDispatchAction({
              type: 'RESEARCH_TECH',
              playerId: aiPlayer.id,
              techId: decision.techId
            });
            console.log(`   📦 Research action dispatched to game state`);
            return true;
          } else {
            console.log(`   ⚠️  Missing techId for RESEARCH_TECH`);
          }
          break;

        case 'BUILD_STRUCTURE':
          if (decision.cityId && decision.buildingType) {
            console.log(`   🏗️  Building ${decision.buildingType} in city ${decision.cityId}`);
            this.onDispatchAction({
              type: 'START_CONSTRUCTION',
              playerId: aiPlayer.id,
              buildingType: decision.buildingType,
              cityId: decision.cityId,
              category: 'structures'
            });
            console.log(`   📦 Construction action dispatched to game state`);
            return true;
          } else {
            console.log(`   ⚠️  Missing cityId or buildingType for BUILD_STRUCTURE`);
          }
          break;

        case 'USE_ABILITY':
          if (decision.abilityId) {
            console.log(`   ✨ Using ability: ${decision.abilityId}`);
            this.onDispatchAction({
              type: 'USE_ABILITY',
              playerId: aiPlayer.id,
              abilityId: decision.abilityId
            });
            console.log(`   📦 Ability action dispatched to game state`);
            return true;
          } else {
            console.log(`   ⚠️  Missing abilityId for USE_ABILITY`);
          }
          break;

        default:
          console.warn(`   ❓ Unknown AI decision type: ${decision.type}`);
          break;
      }
    } catch (error) {
      const actionTime = performance.now() - actionStart;
      console.error(`   💥 Failed to execute AI decision ${decision.type} after ${actionTime.toFixed(1)}ms:`, error);
      console.error(`   📍 Error details:`, error instanceof Error ? error.message : error);
    }

    console.log(`   ❌ Decision execution failed`);
    return false;
  }

  /**
   * End the AI player's turn
   */
  private endAITurn(aiPlayer: PlayerState): void {
    console.log(`\n🏁 ENDING AI TURN`);
    console.log(`   Player: "${aiPlayer.name}"`);
    console.log(`   📤 Dispatching END_TURN action...`);
    
    this.onDispatchAction({
      type: 'END_TURN',
      playerId: aiPlayer.id
    });

    console.log(`   ✅ Turn end action dispatched successfully`);
    console.log(`🎉 AI turn completed for ${aiPlayer.name}`);
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