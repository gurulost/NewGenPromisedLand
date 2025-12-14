/**
 * AI Sandbox for testing and debugging AI behavior
 * Enables bot-vs-bot matches, step-by-step execution, and automated testing
 */

import { GameState, PlayerState } from '../types/game';
import { AIEngine, AIDifficulty } from './aiEngine';
import { SeededRNG, AILogger, aiPerformanceMonitor } from './aiFoundation';
// Note: Using simplified game state for sandbox testing

/**
 * Create a minimal game state for AI sandbox testing
 */
function createInitialGameState(players: PlayerState[], mapSize: string): GameState {
  const mapSizeConfig: Record<string, { width: number; height: number }> = {
    tiny: { width: 10, height: 10 },
    small: { width: 15, height: 15 },
    normal: { width: 20, height: 20 },
    large: { width: 30, height: 30 }
  };

  const size = mapSizeConfig[mapSize] || mapSizeConfig.normal;

  // Create basic map with tiles
  const tiles = [];
  for (let q = 0; q < size.width; q++) {
    for (let r = 0; r < size.height; r++) {
      const s = -q - r;
      tiles.push({
        coordinate: { q, r, s },
        terrain: 'plains' as const,
        resources: [],
        hasCity: false,
        exploredBy: [],
        cityOwner: undefined,
        feature: undefined
      });
    }
  }

  return {
    id: `sandbox_game_${Date.now()}`,
    turn: 1,
    currentPlayerIndex: 0,
    phase: 'playing',
    players: players,
    units: [],
    cities: [],
    improvements: [],
    structures: [],
    map: {
      width: size.width,
      height: size.height,
      tiles: tiles
    },
    visibility: {},
  };
}

export interface SandboxConfig {
  mapSize: 'tiny' | 'small' | 'normal' | 'large';
  aiPlayers: Array<{
    name: string;
    factionId: string;
    difficulty: AIDifficulty;
  }>;
  seed: number;
  maxTurns: number;
  stepMode: boolean; // If true, require manual advancement
  logLevel: 'none' | 'basic' | 'detailed' | 'verbose';
}

export interface SandboxResult {
  winner: string | null;
  totalTurns: number;
  endReason: 'victory' | 'max_turns' | 'error' | 'manual_stop';
  performanceMetrics: {
    avgTurnTime: number;
    maxTurnTime: number;
    totalTime: number;
  };
  gameLog: string;
}

/**
 * AI Sandbox for automated testing and analysis
 */
export class AISandbox {
  private config: SandboxConfig;
  private gameState: GameState;
  private rng: SeededRNG;
  private logger: AILogger;
  private running: boolean = false;
  private paused: boolean = false;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
    this.logger = new AILogger(`sandbox_${config.seed}`);
    this.gameState = this.initializeGame();
  }

  /**
   * Initialize a new game with AI players
   */
  private initializeGame(): GameState {
    const players: PlayerState[] = this.config.aiPlayers.map((aiConfig, index) => ({
      id: `ai_${index}`,
      name: aiConfig.name,
      factionId: aiConfig.factionId as any,
      isAI: true,
      aiDifficulty: aiConfig.difficulty,
      stars: 0,
      stats: { faith: 0, pride: 0, internalDissent: 0 },
      modifiers: [],
      abilityCooldowns: {},
      researchedTechs: [],
      researchProgress: 0,
      researchInspiration: 0,
      citiesOwned: [],
      exploredTiles: [],
      visibilityMask: [],
      turnOrder: index,
      isEliminated: false,
      constructionQueue: [],
      currentResearch: undefined,
      // Diplomatic relations - AI starts with none
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    }));

    return createInitialGameState(players, this.config.mapSize);
  }

  /**
   * Run the sandbox simulation
   */
  async runSimulation(): Promise<SandboxResult> {
    this.running = true;
    const startTime = performance.now();
    let turnCount = 0;

    this.log('Sandbox simulation started', 'basic');
    this.log(`Config: ${JSON.stringify(this.config, null, 2)}`, 'detailed');

    try {
      while (this.running && turnCount < this.config.maxTurns) {
        if (this.config.stepMode && this.paused) {
          await this.waitForStep();
        }

        const result = await this.executeTurn();
        turnCount++;

        if (result.gameEnded) {
          const totalTime = performance.now() - startTime;
          return {
            winner: result.winner || null,
            totalTurns: turnCount,
            endReason: 'victory',
            performanceMetrics: {
              avgTurnTime: aiPerformanceMonitor.getAverageTime(),
              maxTurnTime: Math.max(...this.getAllTurnTimes()),
              totalTime
            },
            gameLog: this.logger.exportLogs()
          };
        }

        // Small delay to prevent blocking
        await this.delay(10);
      }

      // Simulation ended due to max turns
      const totalTime = performance.now() - startTime;
      return {
        winner: this.determineWinner(),
        totalTurns: turnCount,
        endReason: 'max_turns',
        performanceMetrics: {
          avgTurnTime: aiPerformanceMonitor.getAverageTime(),
          maxTurnTime: Math.max(...this.getAllTurnTimes()),
          totalTime
        },
        gameLog: this.logger.exportLogs()
      };

    } catch (error) {
      this.log(`Simulation error: ${error}`, 'basic');
      const totalTime = performance.now() - startTime;

      return {
        winner: null,
        totalTurns: turnCount,
        endReason: 'error',
        performanceMetrics: {
          avgTurnTime: aiPerformanceMonitor.getAverageTime(),
          maxTurnTime: Math.max(...this.getAllTurnTimes()),
          totalTime
        },
        gameLog: this.logger.exportLogs()
      };
    }
  }

  /**
   * Execute a single turn
   */
  private async executeTurn(): Promise<{ gameEnded: boolean; winner?: string }> {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) {
      return { gameEnded: true };
    }

    this.log(`Turn ${this.gameState.turn}: ${currentPlayer.name} (${currentPlayer.factionId})`, 'basic');

    aiPerformanceMonitor.startTurn(currentPlayer.id);

    // Execute AI turn
    const aiEngine = new AIEngine(this.gameState, currentPlayer);
    const decisions = aiEngine.makeDecision();

    this.log(`AI decisions: ${decisions.length}`, 'detailed');
    decisions.forEach((decision, index) => {
      this.log(`  ${index + 1}. ${decision.type} (priority: ${decision.priority})`, 'verbose');
    });

    // Apply decisions to game state (simplified for sandbox)
    for (const decision of decisions.slice(0, 3)) { // Limit actions per turn
      this.applyDecision(decision, currentPlayer);
    }

    const turnTime = aiPerformanceMonitor.endTurn(currentPlayer.id);

    this.logger.logAction(
      this.gameState.turn,
      currentPlayer.id,
      `Turn completed with ${decisions.length} decisions`,
      'Sandbox execution',
      this.generateStateHash(),
      {
        decisionTimeMs: turnTime,
        alternativesConsidered: decisions.length,
        confidenceScore: this.calculateConfidence(decisions)
      }
    );

    // Check for victory conditions
    const winner = this.checkVictoryConditions();
    if (winner) {
      return { gameEnded: true, winner };
    }

    // Advance to next player
    this.advanceToNextPlayer();

    return { gameEnded: false };
  }

  /**
   * Apply an AI decision to the game state (simplified)
   */
  private applyDecision(decision: any, player: PlayerState): void {
    // This is a simplified implementation for sandbox testing
    // In a real game, these would go through the full game reducer
    this.log(`Applying decision: ${decision.type}`, 'verbose');

    switch (decision.type) {
      case 'MOVE_UNIT':
        this.log(`  Moving unit ${decision.unitId} to ${JSON.stringify(decision.targetCoordinate)}`, 'verbose');
        break;
      case 'ATTACK_UNIT':
        this.log(`  Attacking unit ${decision.targetId} with ${decision.unitId}`, 'verbose');
        break;
      case 'RESEARCH_TECH':
        this.log(`  Researching technology ${decision.techId}`, 'verbose');
        break;
      case 'BUILD_STRUCTURE':
        this.log(`  Building ${decision.buildingType} in city ${decision.cityId}`, 'verbose');
        break;
    }
  }

  /**
   * Control methods
   */
  step(): void {
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  stop(): void {
    this.running = false;
  }

  /**
   * Helper methods
   */
  private getCurrentPlayer(): PlayerState | undefined {
    return this.gameState.players[this.gameState.currentPlayerIndex];
  }

  private advanceToNextPlayer(): void {
    const nextIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;

    if (nextIndex === 0) {
      this.gameState.turn++;
    }

    this.gameState.currentPlayerIndex = nextIndex;
  }

  private checkVictoryConditions(): string | null {
    // Simplified victory conditions for sandbox
    const alivePlayers = this.gameState.players.filter(p => !p.isEliminated);
    if (alivePlayers.length === 1) {
      return alivePlayers[0].id;
    }
    return null;
  }

  private determineWinner(): string | null {
    // Determine winner by score
    const bestPlayer = this.gameState.players.reduce((best, current) =>
      (current.stars || 0) > (best.stars || 0) ? current : best
    );
    return bestPlayer.id;
  }

  private calculateConfidence(decisions: any[]): number {
    if (decisions.length === 0) return 0;
    const topPriority = decisions[0].priority;
    const avgPriority = decisions.reduce((sum, d) => sum + d.priority, 0) / decisions.length;
    return Math.min(1, topPriority / (avgPriority * 2));
  }

  private generateStateHash(): string {
    return `turn_${this.gameState.turn}_player_${this.gameState.currentPlayerIndex}`;
  }

  private getAllTurnTimes(): number[] {
    return aiPerformanceMonitor['performanceHistory']?.map(h => h.turnTime) || [0];
  }

  private async waitForStep(): Promise<void> {
    return new Promise(resolve => {
      const checkStep = () => {
        if (!this.paused) {
          resolve();
        } else {
          setTimeout(checkStep, 100);
        }
      };
      checkStep();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string, level: string): void {
    if (this.shouldLog(level)) {
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['none', 'basic', 'detailed', 'verbose'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel <= configLevel;
  }

  /**
   * Get current game state for inspection
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Get sandbox statistics
   */
  getStatistics() {
    return {
      turn: this.gameState.turn,
      currentPlayer: this.getCurrentPlayer()?.name,
      performanceMetrics: this.logger.getMetrics(),
      isRunning: this.running,
      isPaused: this.paused
    };
  }
}

/**
 * Factory function to create and run quick AI tests
 */
export async function runQuickAITest(
  factions: string[] = ['nephites', 'lamanites'],
  difficulty: AIDifficulty = 'normal',
  maxTurns: number = 50
): Promise<SandboxResult> {
  const config: SandboxConfig = {
    mapSize: 'tiny',
    aiPlayers: factions.map((faction, index) => ({
      name: `AI ${index + 1}`,
      factionId: faction,
      difficulty
    })),
    seed: Math.floor(Math.random() * 1000000),
    maxTurns,
    stepMode: false,
    logLevel: 'basic'
  };

  const sandbox = new AISandbox(config);
  return await sandbox.runSimulation();
}
