/**
 * AI Foundation Layer - Deterministic Core for AAA AI Quality
 * Provides seeded RNG, action logging, replay capabilities, and debug instrumentation
 */

export interface AIActionLog {
  turn: number;
  playerId: string;
  timestamp: number;
  action: string;
  reasoning: string;
  gameStateHash: string;
  metrics: {
    decisionTimeMs: number;
    alternativesConsidered: number;
    confidenceScore: number;
  };
}

export interface AIDebugInfo {
  influenceMap: Map<string, number>;
  threatAssessment: Map<string, number>;
  strategicGoals: string[];
  currentPlan: string;
  resourcePriorities: {
    stars: number;
    faith: number;
    pride: number;
  };
  factionMood: {
    aggression: number;
    piety: number;
    opportunism: number;
    riskTolerance: number;
  };
}

/**
 * Seeded Random Number Generator for deterministic AI behavior
 * Ensures AI decisions are reproducible given the same game state and seed
 */
export class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Choose random element from array
   */
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Get current seed for saving/loading
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Reset to specific seed
   */
  setSeed(seed: number): void {
    this.seed = seed;
  }
}

/**
 * AI Session Logger for tracking decisions and performance
 */
export class AILogger {
  private logs: AIActionLog[] = [];
  private sessionId: string;
  private startTime: number;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.startTime = Date.now();
  }

  /**
   * Log an AI action with reasoning and metrics
   */
  logAction(
    turn: number,
    playerId: string,
    action: string,
    reasoning: string,
    gameStateHash: string,
    metrics: AIActionLog['metrics']
  ): void {
    this.logs.push({
      turn,
      playerId,
      timestamp: Date.now() - this.startTime,
      action,
      reasoning,
      gameStateHash,
      metrics
    });
  }

  /**
   * Get all logs for analysis
   */
  getLogs(): AIActionLog[] {
    return [...this.logs];
  }

  /**
   * Export logs as JSON for replay
   */
  exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      startTime: this.startTime,
      logs: this.logs
    }, null, 2);
  }

  /**
   * Get performance metrics for current session
   */
  getMetrics() {
    if (this.logs.length === 0) return null;

    const totalTime = this.logs.reduce((sum, log) => sum + log.metrics.decisionTimeMs, 0);
    const avgConfidence = this.logs.reduce((sum, log) => sum + log.metrics.confidenceScore, 0) / this.logs.length;
    const avgAlternatives = this.logs.reduce((sum, log) => sum + log.metrics.alternativesConsidered, 0) / this.logs.length;

    return {
      totalActions: this.logs.length,
      avgDecisionTime: totalTime / this.logs.length,
      maxDecisionTime: Math.max(...this.logs.map(l => l.metrics.decisionTimeMs)),
      avgConfidence,
      avgAlternatives,
      sessionDuration: Date.now() - this.startTime
    };
  }
}

/**
 * Game State Hash Generator for deterministic state tracking
 */
export function generateGameStateHash(gameState: any): string {
  // Simple hash function for game state - can be improved with proper hashing
  const stateString = JSON.stringify({
    turn: gameState.turn,
    currentPlayerIndex: gameState.currentPlayerIndex,
    unitCount: gameState.units?.length || 0,
    cityCount: gameState.cities?.length || 0,
    mapHash: gameState.map?.tiles?.length || 0
  });

  let hash = 0;
  for (let i = 0; i < stateString.length; i++) {
    const char = stateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * AI Debug Overlay System for visualizing AI thinking
 */
export class AIDebugOverlay {
  private enabled: boolean = false;
  private debugInfo: Map<string, AIDebugInfo> = new Map();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  updateDebugInfo(playerId: string, info: AIDebugInfo): void {
    if (this.enabled) {
      this.debugInfo.set(playerId, info);
    }
  }

  getDebugInfo(playerId: string): AIDebugInfo | undefined {
    return this.debugInfo.get(playerId);
  }

  getAllDebugInfo(): Map<string, AIDebugInfo> {
    return new Map(this.debugInfo);
  }

  clearDebugInfo(): void {
    this.debugInfo.clear();
  }
}

/**
 * AI Performance Monitor for tracking turn execution times
 */
export class AIPerformanceMonitor {
  private maxTurnTime: number;
  private currentTurnStart: number = 0;
  private performanceHistory: Array<{
    playerId: string;
    turnTime: number;
    timestamp: number;
  }> = [];

  constructor(maxTurnTimeMs: number = 150) {
    this.maxTurnTime = maxTurnTimeMs;
  }

  startTurn(playerId: string): void {
    this.currentTurnStart = performance.now();
  }

  endTurn(playerId: string): number {
    const turnTime = performance.now() - this.currentTurnStart;
    
    this.performanceHistory.push({
      playerId,
      turnTime,
      timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    if (turnTime > this.maxTurnTime) {
      console.warn(`AI turn exceeded time budget: ${turnTime.toFixed(2)}ms (max: ${this.maxTurnTime}ms)`);
    }

    return turnTime;
  }

  getAverageTime(playerId?: string): number {
    const filtered = playerId 
      ? this.performanceHistory.filter(h => h.playerId === playerId)
      : this.performanceHistory;

    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, h) => sum + h.turnTime, 0) / filtered.length;
  }

  getPerformanceReport(): string {
    const avgTime = this.getAverageTime();
    const maxTime = Math.max(...this.performanceHistory.map(h => h.turnTime));
    const exceedingBudget = this.performanceHistory.filter(h => h.turnTime > this.maxTurnTime).length;
    
    return `AI Performance Report:
Average Turn Time: ${avgTime.toFixed(2)}ms
Max Turn Time: ${maxTime.toFixed(2)}ms
Budget Exceeded: ${exceedingBudget}/${this.performanceHistory.length} turns
Budget Compliance: ${((1 - exceedingBudget / this.performanceHistory.length) * 100).toFixed(1)}%`;
  }
}

// Global instances for AI foundation
export const aiLogger = new AILogger(`session_${Date.now()}`);
export const aiDebugOverlay = new AIDebugOverlay();
export const aiPerformanceMonitor = new AIPerformanceMonitor();