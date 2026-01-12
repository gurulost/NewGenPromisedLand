import { GameState, PlayerState } from '../types/game';
import { Unit, UnitType, UnitDefinition } from '../types/unit';
import { HexCoordinate } from '../types/coordinates';
import { hexDistance, hexNeighbors } from '../utils/hex';
import { UNIT_DEFINITIONS, getUnitDefinition } from '../data/units';
import { TECHNOLOGIES } from '../data/technologies';
import { GAME_RULES, GameRuleHelpers } from '../data/gameRules';
import { getFaction } from '../data/factions';
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from '../types/city';
import { TacticalEngine, TacticalTarget } from './aiTacticalEngine';
import { FactionPersonalityEngine } from './aiFactionPersonality';
import { SeededRNG, aiDebugOverlay } from './aiFoundation';
import { emitTelemetry } from '../logic/telemetry';
import { getTechCostDetails } from '../logic/technologyHelpers';
import { calculateReachableTiles, canUnitReachCoordinate, getUnitActionsRemaining } from '../logic/unitLogic';
import { resolveCombat } from '../logic/combatResolver';
import { getFriendlyBuildAnchors, isTileExploredByPlayer, isWithinFriendlyBuildRadius, STRUCTURE_BUILD_RADIUS } from '../logic/constructionRules';
import type { Technology } from '../data/technologies';
import type { City, StructureDefinition, StructureType } from '../types/city';
import type { Tile } from '../types/game';
import type { FactionPersonality } from './aiFactionPersonality';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIDecision {
  type:
  | 'MOVE_UNIT'
  | 'ATTACK_UNIT'
  | 'RESEARCH_TECH'
  | 'BUILD_STRUCTURE'
  | 'END_TURN'
  | 'USE_ABILITY'
  | 'HEAL_UNIT'
  | 'APPLY_STEALTH'
  | 'FORMATION_FIGHTING'
  | 'SIEGE_MODE'
  | 'RALLY_TROOPS';
  unitId?: string;
  targetCoordinate?: HexCoordinate;
  targetId?: string;
  techId?: string;
  buildingType?: string;
  cityId?: string;
  abilityId?: string;
  constructionCategory?: 'improvements' | 'structures' | 'units';
  priority: number; // Higher = more important
}

interface AITechTarget {
  id: string;
  priority: number;
  cost: number;
  discount: number;
}

interface AICityPlanEntry {
  optionId: string;
  category: 'improvements' | 'structures' | 'units';
  priority: number;
  cost: number;
  reason: string;
  coordinate?: HexCoordinate;
  faithCost?: number;
  prideCost?: number;
}

interface AIStrategyGoal {
  id: string;
  type: 'tech' | 'structure' | 'improvement' | 'unit';
  targetId: string;
  cityId?: string;
  priority: number;
  reason: string;
}

interface AIImprovementJob {
  id: string;
  cityId: string;
  improvementId: string;
  coordinate: HexCoordinate;
  priority: number;
  reason: string;
}

interface AIExplorationGoal {
  id: string;
  target: HexCoordinate;
  priority: number;
  reason: string;
}

interface AIBudgetState {
  totalStars: number;
  reservedStars: number;
  availableStars: number;
  savingForTech: boolean;
  targetCost?: number;
  // Economic planning additions
  incomePerTurn: number;        // Projected income from cities
  turnsToSaveForTech: number;   // How many turns needed to afford target tech
  shouldDelayPurchases: boolean; // If true, avoid non-essential spending
}

/**
 * Victory progress tracking for strategy pivoting
 * FAIR PLAY: Only uses visible information
 */
interface VictoryProgress {
  conquest: number;    // 0-100 based on cities controlled vs total visible
  faith: number;       // 0-100 based on faith level vs target
  economic: number;    // 0-100 based on tech progress and income
  cultural: number;    // 0-100 based on improvements and population
  preferredType: 'conquest' | 'faith' | 'cultural' | 'economic';
  shouldPivot: boolean; // True if another victory path is more viable
  pivotRecommendation?: 'conquest' | 'faith' | 'cultural' | 'economic';
}

interface AIStrategicPlan {
  techTarget?: AITechTarget;
  savingsNeeded: number;
  budget: AIBudgetState;
  cityPlans: Record<string, AICityPlanEntry[]>;
  goalQueue: AIStrategyGoal[];
  improvementJobs: AIImprovementJob[];
  explorationGoals: AIExplorationGoal[];
  victoryProgress?: VictoryProgress; // Victory condition tracking
}

const CITY_WORK_RADIUS = 2;

/**
 * Core AI Engine for Chronicles of the Promised Land
 * Provides strategic decision-making for AI players
 */
export class AIEngine {
  private difficulty: AIDifficulty;
  private gameState: GameState;
  private aiPlayer: PlayerState;
  private tacticalEngine: TacticalEngine;
  private personalityEngine: FactionPersonalityEngine;
  private rng: SeededRNG;
  private strategy: AIStrategicPlan;
  private reservedUnits: Set<string>;

  constructor(gameState: GameState, aiPlayer: PlayerState) {
    this.gameState = gameState;
    this.aiPlayer = aiPlayer;
    this.difficulty = (aiPlayer.aiDifficulty as AIDifficulty) || 'normal';

    // Initialize advanced AI systems
    const seed = this.generateSeed();
    this.tacticalEngine = new TacticalEngine(gameState, aiPlayer, seed);
    this.personalityEngine = new FactionPersonalityEngine(aiPlayer, seed);
    this.rng = new SeededRNG(seed);
    this.strategy = {
      savingsNeeded: 0,
      budget: {
        totalStars: aiPlayer.stars,
        reservedStars: 0,
        availableStars: aiPlayer.stars,
        savingForTech: false,
        incomePerTurn: 0,
        turnsToSaveForTech: 0,
        shouldDelayPurchases: false,
      },
      cityPlans: {},
      goalQueue: [],
      improvementJobs: [],
      explorationGoals: [],
    };
    this.reservedUnits = new Set();
  }

  /**
   * Enhanced AI decision-making with tactical engine and personality
   * Returns the best action for the AI to take this turn
   */
  public makeDecision(): AIDecision[] {
    const startTime = performance.now();
    const decisions: AIDecision[] = [];

    // Update AI mood based on current game state
    this.updatePersonalityMood();
    this.recalculateStrategy();

    // Generate influence map for tactical awareness
    const influenceMap = this.tacticalEngine.generateInfluenceMap();

    // 1. Economy automation – execute improvement jobs before other actions
    decisions.push(...this.evaluateWorkerAutomation());

    // 2. Directed exploration before combat commitments
    decisions.push(...this.evaluateExplorationGoals());

    // 3. Enhanced combat evaluation with tactical engine
    decisions.push(...this.evaluateAdvancedCombat());

    // 4. Intelligent movement with threat assessment
    decisions.push(...this.evaluateIntelligentMovement());

    // 4.5. Naval movement - embark/sail/disembark for water crossings
    decisions.push(...this.evaluateNavalMovement());

    // 5. Personality-driven technology research
    decisions.push(...this.evaluatePersonalityTechResearch());

    // 6. Faction-specific city building
    decisions.push(...this.evaluateFactionCityBuilding());

    // 7. Advanced unit abilities usage
    decisions.push(...this.evaluateAbilityUsage());

    // Apply personality modifiers to decisions
    this.applyPersonalityModifiers(decisions);

    // Sort by priority and limit actions based on difficulty
    const maxActions = this.getMaxActionsPerTurn();
    const finalDecisions = decisions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxActions);

    // Update debug overlay
    this.updateDebugInfo(influenceMap, decisions, performance.now() - startTime);

    return finalDecisions;
  }

  /**
   * Evaluate combat opportunities
   */
  private evaluateCombatOptions(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();
    const enemyUnits = this.getEnemyUnitsInRange();

    for (const unit of myUnits) {
      if (unit.remainingMovement <= 0) continue;

      const unitDef = getUnitDefinition(unit.type);
      const attackRange = unitDef.baseStats.attackRange || 1;

      // Find enemy units within attack range
      for (const enemy of enemyUnits) {
        const distance = hexDistance(unit.coordinate, enemy.coordinate);

        if (distance <= attackRange) {
          const combatOdds = this.calculateCombatOdds(unit, enemy);
          const modifiers = this.getDifficultyModifiers();

          // ADAPTIVE DIFFICULTY: Easy AI might miss optimal attacks
          if (this.shouldSkipOptimalPlay()) continue;

          // BUILD ARMY THRESHOLD: Don't attack with too few units
          if (!this.hasMinimumArmyForAttack()) {
            // Still attack if enemy is very weak or we're defending
            const isDefensive = hexDistance(unit.coordinate, this.getMyCities()[0]?.coordinate || unit.coordinate) <= 3;
            if (!isDefensive && enemy.hp > unit.hp * 0.5) continue;
          }

          // Use difficulty-adjusted combat odds threshold
          if (combatOdds > modifiers.combatOddsThreshold) {
            decisions.push({
              type: 'ATTACK_UNIT',
              unitId: unit.id,
              targetId: enemy.id,
              priority: 100 + combatOdds * 20 + modifiers.aggressionBonus
            });
          }
        }
      }
    }

    return decisions;
  }

  /**
   * Evaluate movement options for units
   */
  private evaluateMovementOptions(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();

    for (const unit of myUnits) {
      if (unit.remainingMovement <= 0) continue;

      const bestMove = this.findBestMovement(unit);
      if (bestMove) {
        decisions.push({
          type: 'MOVE_UNIT',
          unitId: unit.id,
          targetCoordinate: bestMove.target,
          priority: bestMove.priority
        });
      }
    }

    return decisions;
  }

  /**
   * Evaluate technology research options
   */
  private evaluateTechResearch(): AIDecision[] {
    const decisions: AIDecision[] = [];

    const availableTechs = Object.keys(TECHNOLOGIES).filter(techId => {
      const tech = TECHNOLOGIES[techId];
      return !this.aiPlayer.researchedTechs.includes(techId) &&
        tech.prerequisites.every(prereq => this.aiPlayer.researchedTechs.includes(prereq));
    });

    for (const techId of availableTechs) {
      const tech = TECHNOLOGIES[techId];
      const { finalCost, discount } = getTechCostDetails(tech, this.aiPlayer);
      if (this.aiPlayer.stars < finalCost) continue;

      let priority = this.evaluateTechPriority(techId);
      priority += discount * 2;

      if (priority > 30) { // Only consider worthwhile techs
        decisions.push({
          type: 'RESEARCH_TECH',
          techId,
          priority: priority + 40 // Medium-high priority for tech
        });
      }
    }

    return decisions;
  }

  /**
   * Evaluate city building opportunities
   */
  private evaluateCityBuilding(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myCities = this.getMyCities();

    for (const city of myCities) {
      // Evaluate building structures/improvements
      const buildingOptions = this.evaluateBuildingOptions(city.id);
      decisions.push(...buildingOptions);
    }

    return decisions;
  }

  /**
   * Find the best movement for a unit
   */
  private findBestMovement(unit: Unit): { target: HexCoordinate; priority: number } | null {
    const possibleMoves = this.getReachableTiles(unit);
    let bestMove: { target: HexCoordinate; priority: number } | null = null;

    for (const coordinate of possibleMoves) {
      const priority = this.evaluateMovementPriority(unit, coordinate);

      if (!bestMove || priority > bestMove.priority) {
        bestMove = { target: coordinate, priority };
      }
    }

    return bestMove;
  }

  /**
   * Evaluate the priority of moving to a specific coordinate
   */
  private evaluateMovementPriority(unit: Unit, coordinate: HexCoordinate): number {
    let priority = 0;

    // 1. Exploration bonus - prefer unexplored tiles
    const tileKey = `${coordinate.q},${coordinate.r}`;
    if (!this.aiPlayer.exploredTiles.includes(tileKey)) {
      priority += 30;
    }

    // 2. Resource proximity bonus
    const nearbyResources = this.getNearbyResources(coordinate);
    priority += nearbyResources.length * 10;

    // 3. Enemy proximity consideration
    const nearbyEnemies = this.getNearbyEnemies(coordinate);
    if (nearbyEnemies.length > 0) {
      const unitDef = getUnitDefinition(unit.type);
      if (unitDef.baseStats.attack > unitDef.baseStats.defense) {
        // Combat unit - approach enemies
        priority += 25;
      } else {
        // Non-combat unit - avoid enemies
        priority -= 40;
      }
    }

    // 4. City proximity for workers
    if (unit.type === 'worker') {
      const nearbyCity = this.getNearbyFriendlyCity(coordinate);
      if (nearbyCity) {
        priority += 20;
      }
    }

    // 5. Strategic positioning near faction territory
    const faction = getFaction(this.aiPlayer.factionId as any);
    priority += this.evaluateStrategicValue(coordinate, faction);

    return priority;
  }

  /**
   * Calculate combat odds between two units
   */
  private calculateCombatOdds(attacker: Unit, defender: Unit): number {
    const attackerDef = getUnitDefinition(attacker.type);
    const defenderDef = getUnitDefinition(defender.type);

    const attackPower = attackerDef.baseStats.attack * (attacker.hp / attacker.maxHp);
    const defensePower = defenderDef.baseStats.defense * (defender.hp / defender.maxHp);

    // Simple odds calculation - in real implementation this would be more complex
    const totalPower = attackPower + defensePower;
    return totalPower > 0 ? attackPower / totalPower : 0.5;
  }

  /**
   * Evaluate the priority of researching a specific technology
   */
  private evaluateTechPriority(techId: string): number {
    const tech = TECHNOLOGIES[techId];
    let priority = 0;

    // Base priority based on tech type and AI strategy
    switch (this.difficulty) {
      case 'easy':
        priority += Math.random() * 20; // More random decisions
        break;
      case 'normal':
        priority += 30;
        break;
      case 'hard':
        priority += 50; // More focused tech choices
        break;
    }

    // Faction-specific tech preferences
    const faction = getFaction(this.aiPlayer.factionId as any);
    // AI will prioritize techs that align with faction strengths
    if (faction.name.includes('Nephite') && tech.category === 'religious') {
      priority += 20;
    } else if (faction.name.includes('Lamanite') && tech.category === 'military') {
      priority += 20;
    }

    // Military vs economic focus based on game state
    const enemyThreat = this.assessEnemyThreat();
    if (enemyThreat > 0.6 && tech.category === 'military') {
      priority += 30;
    } else if (enemyThreat < 0.4 && tech.category === 'economic') {
      priority += 25;
    }

    return priority;
  }

  // Helper methods for AI decision making

  private getMyUnits(): Unit[] {
    return this.gameState.units.filter(unit => unit.playerId === this.aiPlayer.id);
  }

  private canBuildStructure(structureId: string): boolean {
    const def = STRUCTURE_DEFINITIONS[structureId as keyof typeof STRUCTURE_DEFINITIONS];
    if (!def) return false;
    if (def.requiredTech && !this.aiPlayer.researchedTechs.includes(def.requiredTech)) {
      return false;
    }
    return true;
  }

  private getEnemyUnitsInRange(): Unit[] {
    return this.gameState.units.filter(unit =>
      unit.playerId !== this.aiPlayer.id &&
      this.aiPlayer.visibilityMask.includes(`${unit.coordinate.q},${unit.coordinate.r}`)
    );
  }

  private getMyCities(): City[] {
    return (this.gameState.cities || []).filter(city => city.ownerId === this.aiPlayer.id);
  }

  private getReachableTiles(unit: Unit): HexCoordinate[] {
    return calculateReachableTiles(unit, this.gameState).filter(coord =>
      coord.q !== unit.coordinate.q || coord.r !== unit.coordinate.r
    );
  }

  private getNearbyResources(coordinate: HexCoordinate): any[] {
    // Find nearby resource tiles
    return this.gameState.map.tiles
      .filter(tile => tile.resources.length > 0)
      .filter(tile => hexDistance(coordinate, tile.coordinate) <= 2);
  }

  private getNearbyEnemies(coordinate: HexCoordinate): Unit[] {
    return this.gameState.units
      .filter(unit => unit.playerId !== this.aiPlayer.id)
      .filter(unit => hexDistance(coordinate, unit.coordinate) <= 3);
  }

  private getNearbyFriendlyCity(coordinate: HexCoordinate) {
    const myCities = this.getMyCities();
    return myCities.find(city => hexDistance(coordinate, city.coordinate) <= 2);
  }

  private evaluateStrategicValue(coordinate: HexCoordinate, faction: any): number {
    // Evaluate strategic value based on faction preferences and map position
    let value = 0;

    // Center of map bonus
    const mapCenter = {
      q: Math.floor(this.gameState.map.width / 2),
      r: Math.floor(this.gameState.map.height / 2),
      s: 0
    };
    const distanceFromCenter = hexDistance(coordinate, mapCenter);
    value += Math.max(0, 10 - distanceFromCenter);

    return value;
  }

  private assessEnemyThreat(): number {
    const myUnits = this.getMyUnits();
    const enemyUnits = this.getEnemyUnitsInRange();

    if (myUnits.length === 0) return 1; // Maximum threat if no units

    const enemyStrength = enemyUnits.reduce((total, unit) => {
      const def = getUnitDefinition(unit.type);
      return total + def.baseStats.attack + def.baseStats.defense;
    }, 0);

    const myStrength = myUnits.reduce((total, unit) => {
      const def = getUnitDefinition(unit.type);
      return total + def.baseStats.attack + def.baseStats.defense;
    }, 0);

    const totalStrength = enemyStrength + myStrength;
    return totalStrength > 0 ? enemyStrength / totalStrength : 0;
  }

  private getGameStanding(): number {
    const myScore = this.scorePlayer(this.aiPlayer);
    const enemyScores = this.gameState.players
      .filter(p => p.id !== this.aiPlayer.id)
      .map(p => this.scorePlayer(p));
    const maxEnemy = enemyScores.length ? Math.max(...enemyScores) : myScore;
    if (maxEnemy === 0) return 0;
    // -1 (far behind) to +1 (far ahead)
    return Math.max(-1, Math.min(1, (myScore - maxEnemy) / Math.max(1, maxEnemy)));
  }

  private scorePlayer(player: PlayerState): number {
    const stars = player.stars;
    const techs = player.researchedTechs.length * 8;
    const cities = player.citiesOwned.length * 15;
    const units = this.gameState.units.filter(u => u.playerId === player.id).length * 3;
    return stars + techs + cities + units;
  }

  // Enhanced AI methods using tactical engine and personality

  /**
   * Enhanced combat evaluation using tactical engine
   */
  private evaluateAdvancedCombat(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();

    for (const unit of myUnits) {
      if (this.reservedUnits.has(unit.id)) continue;
      if (unit.remainingMovement <= 0) continue;

      // Get tactical targets from advanced engine
      const targets = this.tacticalEngine.findTacticalTargets(unit);

      for (const target of targets.slice(0, 3)) { // Top 3 targets per unit
        if (target.targetType === 'unit' && target.unitId) {
          // Check if we should attack based on personality
          const advantage = this.calculateCombatAdvantage(unit, target);
          const riskLevel = this.assessCombatRisk(unit, target);

          if (this.personalityEngine.shouldAttack(advantage, riskLevel)) {
            const basePriority = target.priority + advantage * 60 - riskLevel * 30;
            const modifier = this.personalityEngine.getDecisionModifier('attack');
            decisions.push({
              type: 'ATTACK_UNIT',
              unitId: unit.id,
              targetId: target.unitId,
              priority: Math.max(10, basePriority * modifier),
            });
          }
        }
      }

      // Check for retreat if unit is damaged
      if (unit.hp < unit.maxHp * 0.6) {
        const advantage = this.calculateUnitAdvantage(unit);
        if (this.personalityEngine.shouldRetreat(unit.hp / unit.maxHp, advantage)) {
          const retreatPositions = this.tacticalEngine.findRetreatPositions(unit);

          if (retreatPositions.length > 0) {
            decisions.push({
              type: 'MOVE_UNIT',
              unitId: unit.id,
              targetCoordinate: retreatPositions[0],
              priority: 80 + this.personalityEngine.getDecisionModifier('retreat') * 20,
            });
          }
        }
      }
    }

    return decisions;
  }

  /**
   * Intelligent movement with escort logic and threat assessment
   */
  private evaluateIntelligentMovement(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();

    for (const unit of myUnits) {
      if (this.reservedUnits.has(unit.id)) continue;
      if (unit.remainingMovement <= 0) continue;

      const unitDef = getUnitDefinition(unit.type);

      // Escort logic for vulnerable units  
      if (unit.type === 'worker') {
        const escortPriority = this.tacticalEngine.calculateEscortPriority(unit);

        if (escortPriority > 0.5) {
          // Find nearby military units to escort
          const escorts = this.findNearbyMilitaryUnits(unit.coordinate);
          if (escorts.length === 0) {
            // Move to safety
            const retreatPositions = this.tacticalEngine.findRetreatPositions(unit);
            if (retreatPositions.length > 0) {
              decisions.push({
                type: 'MOVE_UNIT',
                unitId: unit.id,
                targetCoordinate: retreatPositions[0],
                priority: 70,
              });
            }
          }
        }
      }

      // Formation bonuses
      const formationBonus = this.tacticalEngine.calculateFormationBonus(unit);
      if (formationBonus < 0.1) {
        // Try to move closer to friendly units
        const friendlyUnits = this.getMyUnits().filter(u => u.id !== unit.id);
        if (friendlyUnits.length > 0) {
          const nearestFriendly = this.findNearestUnit(unit.coordinate, friendlyUnits);
          if (nearestFriendly && hexDistance(unit.coordinate, nearestFriendly.coordinate) > 2) {
            const moveTarget = this.findPositionNear(nearestFriendly.coordinate, 2);
            if (moveTarget) {
              decisions.push({
                type: 'MOVE_UNIT',
                unitId: unit.id,
                targetCoordinate: moveTarget,
                priority: 40,
              });
            }
          }
        }
      }

      if (unit.remainingMovement > 0 && (unit.type === 'scout' || (unit.abilities || []).includes('reconnaissance'))) {
        const exploration = this.findExplorationMove(unit);
        if (exploration) {
          decisions.push({
            type: 'MOVE_UNIT',
            unitId: unit.id,
            targetCoordinate: exploration.target,
            priority: exploration.priority,
          });
        }
      }
    }

    return decisions;
  }

  private evaluateWorkerAutomation(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const jobs = this.strategy.improvementJobs;
    if (!jobs.length) return decisions;

    const workers = this.getMyUnits().filter(unit => unit.type === 'worker' && unit.remainingMovement > 0 && !this.reservedUnits.has(unit.id));
    if (workers.length === 0) return decisions;

    const assignedWorkers = new Set<string>();
    const improvementCache = new Map<string, Map<string, string>>();
    const queuedImprovementCache = new Map<string, Map<string, string>>();
    let remainingBudget = Math.max(0, this.strategy.budget?.availableStars ?? this.aiPlayer.stars);

    const getImprovementMaps = (cityId: string) => {
      if (!improvementCache.has(cityId)) {
        improvementCache.set(cityId, this.getCityImprovementsMap(cityId));
      }
      if (!queuedImprovementCache.has(cityId)) {
        queuedImprovementCache.set(cityId, this.getQueuedImprovements(cityId));
      }
      return {
        existing: improvementCache.get(cityId)!,
        queued: queuedImprovementCache.get(cityId)!,
      };
    };

    const availableWorkers = [...workers];

    const sortedJobs = [...jobs].sort((a, b) => b.priority - a.priority);

    for (const job of sortedJobs) {
      const { existing, queued } = getImprovementMaps(job.cityId);
      const key = this.getImprovementKey(job.coordinate);

      if (existing.has(key) || queued.has(key)) {
        continue;
      }

      const improvementDef = IMPROVEMENT_DEFINITIONS[job.improvementId as keyof typeof IMPROVEMENT_DEFINITIONS];
      if (!improvementDef) continue;

      if (remainingBudget < improvementDef.cost) {
        continue;
      }

      const worker = this.findBestWorkerForJob(job, availableWorkers, assignedWorkers);
      if (!worker) continue;

      const distance = hexDistance(worker.coordinate, job.coordinate);
      if (distance === 0) {
        decisions.push({
          type: 'BUILD_STRUCTURE',
          buildingType: job.improvementId,
          cityId: job.cityId,
          constructionCategory: 'improvements',
          targetCoordinate: job.coordinate,
          priority: 95 + job.priority / 10,
        });
        this.reservedUnits.add(worker.id);
        assignedWorkers.add(worker.id);
        remainingBudget = Math.max(0, remainingBudget - improvementDef.cost);
        emitTelemetry({
          channel: 'system',
          status: 'info',
          playerId: this.aiPlayer.id,
          reason: 'ai_worker_build_improvement',
          metadata: {
            improvementId: job.improvementId,
            cityId: job.cityId,
            coordinate: `${job.coordinate.q},${job.coordinate.r}`,
          },
        });
        continue;
      }

      const nextStep = this.getNextStepTowards(worker, job.coordinate);
      if (!nextStep) continue;
      if (!canUnitReachCoordinate(worker, nextStep, this.gameState)) continue;

      decisions.push({
        type: 'MOVE_UNIT',
        unitId: worker.id,
        targetCoordinate: nextStep,
        priority: 80 + job.priority / 10,
      });
      this.reservedUnits.add(worker.id);
      assignedWorkers.add(worker.id);
      emitTelemetry({
        channel: 'system',
        status: 'info',
        playerId: this.aiPlayer.id,
        reason: 'ai_worker_move_job',
        metadata: {
          improvementId: job.improvementId,
          cityId: job.cityId,
          from: `${worker.coordinate.q},${worker.coordinate.r}`,
          to: `${nextStep.q},${nextStep.r}`,
        },
      });
    }

    return decisions;
  }

  private evaluateExplorationGoals(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const goals = this.strategy.explorationGoals;
    if (!goals.length) return decisions;

    const explorers = this.getMyUnits().filter(unit => this.isExplorerUnit(unit) && unit.remainingMovement > 0 && !this.reservedUnits.has(unit.id));
    if (!explorers.length) return decisions;

    const assignedExplorers = new Set<string>();
    const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority);

    for (const goal of sortedGoals) {
      const tile = this.gameState.map.tiles.find(t => t.coordinate.q === goal.target.q && t.coordinate.r === goal.target.r);
      if (!tile) continue;
      if (tile.exploredBy.includes(this.aiPlayer.id)) continue;

      const explorer = this.findBestExplorer(goal, explorers, assignedExplorers);
      if (!explorer) continue;

      const distance = hexDistance(explorer.coordinate, goal.target);
      if (distance === 0) {
        // Already on tile – no move needed this turn
        this.reservedUnits.add(explorer.id);
        assignedExplorers.add(explorer.id);
        continue;
      }

      const nextStep = this.getNextStepTowards(explorer, goal.target);
      if (!nextStep) continue;
      if (!canUnitReachCoordinate(explorer, nextStep, this.gameState)) continue;

      decisions.push({
        type: 'MOVE_UNIT',
        unitId: explorer.id,
        targetCoordinate: nextStep,
        priority: 70 + goal.priority / 10,
      });

      this.reservedUnits.add(explorer.id);
      assignedExplorers.add(explorer.id);
      emitTelemetry({
        channel: 'system',
        status: 'info',
        playerId: this.aiPlayer.id,
        reason: 'ai_exploration_move',
        metadata: {
          unitId: explorer.id,
          target: `${goal.target.q},${goal.target.r}`,
          step: `${nextStep.q},${nextStep.r}`,
        },
      });
    }

    return decisions;
  }

  /**
   * Personality-driven technology research
   */
  private evaluatePersonalityTechResearch(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const target = this.strategy.techTarget;
    const budget = this.strategy.budget;

    if (target && !this.aiPlayer.researchedTechs.includes(target.id)) {
      if (this.aiPlayer.stars >= target.cost) {
        const tech = TECHNOLOGIES[target.id];
        const categoryModifier =
          tech.category === 'religious'
            ? this.personalityEngine.getDecisionModifier('tech_faith')
            : tech.category === 'military'
              ? this.personalityEngine.getDecisionModifier('tech_military')
              : 0.5;

        const urgencyBonus = budget.savingForTech ? 50 : 30;
        const priority = target.priority + urgencyBonus * (1 + categoryModifier);

        decisions.push({
          type: 'RESEARCH_TECH',
          techId: target.id,
          priority,
        });
        return decisions;
      }

      // Not enough stars yet – keep saving and skip alternative techs
      return decisions;
    }

    const availableBudget = budget?.availableStars ?? this.aiPlayer.stars;
    if (availableBudget <= 0) {
      return decisions;
    }

    let bestChoice: { techId: string; priority: number } | null = null;
    const availableTechs = this.getAvailableTechnologies();

    for (const tech of availableTechs) {
      if (target && tech.id === target.id) continue;
      const { finalCost, discount } = getTechCostDetails(tech, this.aiPlayer);
      if (finalCost > availableBudget) continue;

      let priority = this.calculateTechValue(tech);
      priority += discount * 1.5;

      if (tech.category === 'religious') {
        priority *= 1 + this.personalityEngine.getDecisionModifier('tech_faith');
      } else if (tech.category === 'military') {
        priority *= 1 + this.personalityEngine.getDecisionModifier('tech_military');
      }

      if (priority > 25 && (!bestChoice || priority > bestChoice.priority)) {
        bestChoice = { techId: tech.id, priority };
      }
    }

    if (bestChoice) {
      decisions.push({
        type: 'RESEARCH_TECH',
        techId: bestChoice.techId,
        priority: bestChoice.priority,
      });
    }

    return decisions;
  }

  /**
   * Faction-specific city building
   */
  private evaluateFactionCityBuilding(): AIDecision[] {
    const decisions: AIDecision[] = [];
    let remainingBudget = Math.max(0, this.strategy.budget?.availableStars ?? this.aiPlayer.stars);

    for (const city of this.getMyCities()) {
      if (city.currentProduction || remainingBudget <= 0) continue;

      const plans = this.strategy.cityPlans[city.id] ?? [];
      for (const plan of plans) {
        if (plan.cost > remainingBudget) continue;

        if (plan.category === 'structures' && !this.isStructurePlanValid(city, plan.optionId as StructureType)) {
          continue;
        }

        if (plan.category === 'improvements' && (!plan.coordinate || !this.canScheduleImprovement(city, plan))) {
          continue;
        }

        if (plan.category === 'units' && !this.canScheduleUnit(plan)) {
          continue;
        }

        const decision: AIDecision = {
          type: 'BUILD_STRUCTURE',
          buildingType: plan.optionId,
          cityId: city.id,
          constructionCategory: plan.category,
          priority: plan.priority,
        };

        if (plan.coordinate) {
          decision.targetCoordinate = plan.coordinate;
        }

        decisions.push(decision);
        remainingBudget -= plan.cost;
        break;
      }
    }

    return decisions;
  }

  /**
   * Enhanced ability usage
   */
  private evaluateAbilityUsage(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();

    for (const unit of myUnits) {
      if (this.reservedUnits.has(unit.id)) continue;
      const abilitySet = new Set((unit.abilities || []).map(a => a.toLowerCase()));

      if (abilitySet.has('heal') && getUnitActionsRemaining(unit) > 0 && this.aiPlayer.stats.faith >= 5) {
        const healValue = this.evaluateHealOpportunity(unit);
        if (healValue > 0) {
          decisions.push({
            type: 'HEAL_UNIT',
            unitId: unit.id,
            priority: 80 + healValue,
          });
        }
      }

      if (abilitySet.has('siege') && unit.status !== 'siege_mode' && unit.remainingMovement === unit.movement && getUnitActionsRemaining(unit) > 0) {
        if (this.hasSiegeOpportunity(unit)) {
          decisions.push({
            type: 'SIEGE_MODE',
            unitId: unit.id,
            priority: 70,
          });
        }
      }

      if (abilitySet.has('stealth') && unit.status !== 'stealthed' && getUnitActionsRemaining(unit) > 0) {
        if (this.shouldApplyStealth(unit)) {
          decisions.push({
            type: 'APPLY_STEALTH',
            unitId: unit.id,
            priority: 45,
          });
        }
      }

      if (abilitySet.has('formation_fighting') && unit.status !== 'formation' && getUnitActionsRemaining(unit) > 0) {
        const adjacentAllies = this.countAdjacentAllies(unit, 1);
        if (adjacentAllies >= 1) {
          decisions.push({
            type: 'FORMATION_FIGHTING',
            unitId: unit.id,
            priority: 55 + adjacentAllies * 5,
          });
        }
      }

      if (abilitySet.has('rally') && getUnitActionsRemaining(unit) > 0 && this.aiPlayer.stats.pride >= 5) {
        const allies = this.countAlliesInRadius(unit, 2);
        if (allies >= 2) {
          decisions.push({
            type: 'RALLY_TROOPS',
            unitId: unit.id,
            priority: 60 + allies * 5,
          });
        }
      }
    }

    return decisions;
  }

  /**
   * Apply personality modifiers to all decisions
   */
  private applyPersonalityModifiers(decisions: AIDecision[]): void {
    for (const decision of decisions) {
      const modifier = this.getPersonalityModifier(decision.type);
      decision.priority *= modifier;
    }
  }

  /**
   * Update personality mood based on game state
   */
  private updatePersonalityMood(): void {
    // Calculate recent events for mood update using current board state as approximation
    const myCities = this.getMyCities().length;
    const enemyCities = (this.gameState.cities || []).filter(city => city.ownerId && city.ownerId !== this.aiPlayer.id).length;
    const myUnits = this.getMyUnits().length;
    const enemyUnits = this.gameState.units.filter(unit => unit.playerId !== this.aiPlayer.id).length;

    const netAdvantage = (myCities + myUnits) - (enemyCities + enemyUnits);
    const recentVictories = Math.max(0, netAdvantage);
    const recentDefeats = Math.max(0, -netAdvantage);
    const territoryLost = Math.max(0, enemyCities - myCities) / Math.max(1, enemyCities + myCities);
    const faithGained = Math.max(0, Math.min(1, this.aiPlayer.stats.faith / 100));
    const enemyThreat = this.assessEnemyThreat();

    this.personalityEngine.updateMood({
      recentVictories,
      recentDefeats,
      territoryLost,
      faithGained,
      enemyThreat
    });

    if (process.env.NODE_ENV !== 'production') {
      const moodSnapshot = this.personalityEngine.getPersonality().currentMood;
      emitTelemetry({
        channel: 'system',
        status: 'info',
        playerId: this.aiPlayer.id,
        reason: 'ai_mood_update',
        metadata: {
          confidence: moodSnapshot.confidence,
          desperation: moodSnapshot.desperation,
          zealotry: moodSnapshot.zealotry,
          pragmatism: moodSnapshot.pragmatism,
          netAdvantage,
          enemyThreat,
        },
      });
    }
  }

  private recalculateStrategy(): void {
    const personality = this.personalityEngine.getPersonality();
    const techCandidates: AITechTarget[] = [];

    for (const techId of Object.keys(TECHNOLOGIES)) {
      if (this.aiPlayer.researchedTechs.includes(techId)) continue;
      const tech = TECHNOLOGIES[techId];
      if (!tech.prerequisites.every(prereq => this.aiPlayer.researchedTechs.includes(prereq))) continue;

      const { finalCost, discount } = getTechCostDetails(tech, this.aiPlayer);
      const guidance = (tech as any).aiGuidance ?? { priority: 60, minFaith: 200, recommendedCities: 4 };
      const personalityWeight = (this.personalityEngine as any).getTechPreferenceWeight?.(techId) ??
        (personality.techPriorities.includes(techId) ? 1.25 : 1);
      const situationalModifier = this.getSituationalTechModifier(techId, tech, personality);
      const priority = guidance.priority * personalityWeight * situationalModifier + discount * 0.5;

      techCandidates.push({ id: techId, cost: finalCost, discount, priority });
    }

    techCandidates.sort((a, b) => b.priority - a.priority || a.cost - b.cost);
    const techTarget = techCandidates[0];
    const savingsNeeded = techTarget ? Math.max(0, techTarget.cost - this.aiPlayer.stars) : 0;
    const savingForTech = !!techTarget && this.aiPlayer.stars < techTarget.cost;
    const reservedStars = techTarget
      ? (savingForTech ? this.aiPlayer.stars : Math.min(this.aiPlayer.stars, Math.ceil(techTarget.cost * 0.25)))
      : 0;
    const availableStars = Math.max(0, this.aiPlayer.stars - reservedStars);

    // Calculate income per turn from cities for economic planning
    const myCities = this.getMyCities();
    const incomePerTurn = myCities.reduce((total, city) => {
      // Base star production + improvements
      const baseProduction = city.starProduction || 2;
      return total + baseProduction;
    }, 0);

    // Calculate how many turns needed to save for target tech
    const turnsToSaveForTech = savingsNeeded > 0 && incomePerTurn > 0
      ? Math.ceil(savingsNeeded / incomePerTurn)
      : 0;

    // Delay non-essential purchases if saving for expensive tech within 3 turns
    const shouldDelayPurchases = savingForTech && turnsToSaveForTech <= 3 && techTarget && techTarget.priority > 60;

    const budget: AIBudgetState = {
      totalStars: this.aiPlayer.stars,
      reservedStars,
      availableStars,
      savingForTech,
      targetCost: techTarget?.cost,
      incomePerTurn,
      turnsToSaveForTech,
      shouldDelayPurchases,
    };

    const playerFaith = this.aiPlayer.stats.faith;
    const targetFaith = techTarget ? ((TECHNOLOGIES[techTarget.id] as any).aiGuidance?.minFaith ?? playerFaith) : playerFaith;
    const faithDeficit = Math.max(0, targetFaith - playerFaith);

    const cityPlans = this.buildCityPlans(personality, faithDeficit, availableStars);
    const improvementJobs = this.createImprovementJobs(cityPlans);
    const explorationGoals = this.buildExplorationGoals(personality);
    const goalQueue: AIStrategyGoal[] = [];

    if (techTarget) {
      goalQueue.push({
        id: `tech:${techTarget.id}`,
        type: 'tech',
        targetId: techTarget.id,
        priority: techTarget.priority,
        reason: 'Primary research focus',
      });
    }

    for (const [cityId, plans] of Object.entries(cityPlans)) {
      if (plans.length === 0) continue;
      const top = plans[0];
      goalQueue.push({
        id: `city:${cityId}:${top.optionId}`,
        type: top.category === 'structures' ? 'structure' : top.category === 'improvements' ? 'improvement' : 'unit',
        targetId: top.optionId,
        cityId,
        priority: top.priority,
        reason: top.reason,
      });
    }

    // Calculate victory progress for strategic focus
    const victoryProgress = this.calculateVictoryProgress(personality);

    this.strategy = {
      techTarget,
      savingsNeeded,
      budget,
      cityPlans,
      goalQueue,
      improvementJobs,
      explorationGoals,
      victoryProgress,
    };

    if (process.env.NODE_ENV !== 'production') {
      emitTelemetry({
        channel: 'system',
        status: 'info',
        playerId: this.aiPlayer.id,
        reason: 'ai_strategy_update',
        metadata: {
          techTarget: techTarget?.id,
          reservedStars,
          availableStars,
          savingForTech,
          savingsNeeded,
          faithDeficit,
          cityPlanCount: Object.keys(cityPlans).length,
          goalsTracked: goalQueue.length,
          improvementJobs: improvementJobs.length,
          explorationGoals: explorationGoals.length,
        },
      });
    }
  }

  /**
   * Plan builds for a city: choose best improvement/structure the city can afford.
   */
  private evaluateBuildingOptions(cityId: string): AIDecision[] {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return [];

    const decisions: AIDecision[] = [];
    const availableStars = this.strategy?.budget?.availableStars ?? this.aiPlayer.stars;
    const researched = new Set(this.aiPlayer.researchedTechs);
    const anchorCoords = getFriendlyBuildAnchors(this.gameState, this.aiPlayer.id);
    const structurePlacement = this.findStructurePlacementCoordinate(city, anchorCoords);

    // Structures the city does not already have
    Object.values(STRUCTURE_DEFINITIONS).forEach(struct => {
      if (city.structures.includes(struct.id)) return;
      if (struct.requiredTech && !researched.has(struct.requiredTech)) return;
      if (struct.cost > availableStars) return;
      if (!structurePlacement) return;

      const benefit =
        (struct.effects.starProduction || 0) * 3 +
        (struct.effects.defenseBonus || 0) * 2 +
        (struct.effects.unitProduction || 0);

      const priority = 50 + benefit * 5 - struct.cost;
      decisions.push({
        type: 'BUILD_STRUCTURE',
        cityId: city.id,
        buildingType: struct.id,
        constructionCategory: 'structures',
        targetCoordinate: structurePlacement,
        priority,
      });
    });

    // Improvements around the city
    const workableTiles = this.getCityWorkableTiles(city);
    const occupiedKeys = new Set(
      this.gameState.improvements.map(
        imp => `${imp.coordinate.q},${imp.coordinate.r}`,
      ),
    );
    const queuedKeys = new Set(
      (this.aiPlayer.constructionQueue || [])
        .filter(item => item.coordinate)
        .map(item => `${item.coordinate!.q},${item.coordinate!.r}`),
    );

    workableTiles.forEach(tile => {
      const key = `${tile.coordinate.q},${tile.coordinate.r}`;
      if (occupiedKeys.has(key)) return;
      if (queuedKeys.has(key)) return;
      if (!isTileExploredByPlayer(this.gameState, this.aiPlayer.id, tile.coordinate)) return;
      if (!isWithinFriendlyBuildRadius(anchorCoords, tile.coordinate)) return;

      Object.values(IMPROVEMENT_DEFINITIONS).forEach(imp => {
        if (imp.requiredTech && !researched.has(imp.requiredTech)) return;
        if (!imp.validTerrain.includes(tile.terrain)) return;
        if (imp.cost > availableStars) return;

        const priority =
          40 +
          (imp.starProduction || 0) * 6 +
          (imp.effects?.populationGrowth ? imp.effects.populationGrowth * 4 : 0) -
          imp.cost;

        decisions.push({
          type: 'BUILD_STRUCTURE',
          cityId: city.id,
          buildingType: imp.id,
          constructionCategory: 'improvements',
          targetCoordinate: tile.coordinate,
          priority,
        });
      });
    });

    return decisions;
  }

  private getSituationalTechModifier(techId: string, tech: Technology, personality: FactionPersonality): number {
    let modifier = 1;
    const enemyThreat = this.assessEnemyThreat();
    const myCities = this.getMyCities();

    switch (tech.category) {
      case 'military':
        modifier += enemyThreat * 0.6 + personality.aggression * 0.2;
        break;
      case 'religious':
        modifier += personality.piety * 0.3;
        if (this.aiPlayer.stats.faith < 60) {
          modifier += 0.1;
        }
        break;
      case 'economic': {
        const avgProduction = myCities.reduce((sum, city) => sum + city.starProduction, 0) / Math.max(1, myCities.length);
        if (avgProduction < 3) {
          modifier += 0.25;
        }
        break;
      }
      case 'exploration': {
        const unexploredTiles = this.gameState.map.tiles.length - this.aiPlayer.exploredTiles.length;
        if (unexploredTiles > this.gameState.map.tiles.length * 0.4) {
          modifier += 0.2 + personality.expansionism * 0.1;
        }
        break;
      }
      default:
        break;
    }

    if (tech.unlocks?.units?.some(unitId => personality.unitPreferences.includes(unitId))) {
      modifier += 0.1;
    }

    return Math.max(0.5, modifier);
  }

  private buildCityPlans(personality: FactionPersonality, faithDeficit: number, availableStars: number): Record<string, AICityPlanEntry[]> {
    const plans: Record<string, AICityPlanEntry[]> = {};
    const myCities = this.getMyCities();

    for (const city of myCities) {
      const entries: AICityPlanEntry[] = [];
      const threatLevel = this.tacticalEngine.assessThreat(city.coordinate).threatLevel;
      const structuresOwned = this.getCityStructuresSet(city.id);
      const queuedStructures = this.getQueuedStructures(city.id);
      const existingImprovements = this.getCityImprovementsMap(city.id);
      const queuedImprovements = this.getQueuedImprovements(city.id);

      // City Specialization: classify city role
      const cityRole = this.classifyCityRole(city, myCities);

      for (const structure of Object.values(STRUCTURE_DEFINITIONS)) {
        if (structuresOwned.has(structure.id)) continue;
        if (queuedStructures.has(structure.id)) continue;
        if (!this.canBuildStructure(structure.id)) continue;
        if (structure.id === 'lighthouse' && !this.isCoastalCity(city)) continue;

        const { score, reason } = this.evaluateStructurePlan(city, structure, personality, faithDeficit, threatLevel, cityRole);
        if (score <= 0) continue;

        entries.push({
          optionId: structure.id,
          category: 'structures',
          priority: score,
          cost: structure.cost,
          reason,
        });
      }

      entries.push(
        ...this.evaluateImprovementPlans(
          city,
          personality,
          availableStars,
          threatLevel,
          existingImprovements,
          queuedImprovements
        )
      );

      entries.push(
        ...this.evaluateUnitPlans(city, personality, threatLevel)
      );

      entries.sort((a, b) => b.priority - a.priority);
      if (entries.length > 0) {
        plans[city.id] = entries;
      }
    }

    return plans;
  }

  /**
   * Classify a city's role for specialization
   * - capital: First city or highest population
   * - frontier: Near visible enemies or at map edge
   * - interior: Safe cities away from threats
   */
  private classifyCityRole(city: City, allMyCities: City[]): 'capital' | 'frontier' | 'interior' {
    // Capital: first city (usually) or highest pop
    const isCapital = allMyCities.length === 1 ||
      allMyCities.indexOf(city) === 0 ||
      city.population >= Math.max(...allMyCities.map(c => c.population || 1));

    if (isCapital) return 'capital';

    // Frontier: near visible enemies
    const visibleEnemies = this.getVisibleEnemyUnits();
    const nearbyEnemies = visibleEnemies.filter(e =>
      hexDistance(city.coordinate, e.coordinate) <= 5
    );

    const visibleEnemyCities = this.gameState.cities.filter(c => {
      if (c.ownerId === this.aiPlayer.id) return false;
      const key = `${c.coordinate.q},${c.coordinate.r}`;
      return this.aiPlayer.exploredTiles.includes(key) &&
        hexDistance(city.coordinate, c.coordinate) <= 6;
    });

    if (nearbyEnemies.length > 0 || visibleEnemyCities.length > 0) {
      return 'frontier';
    }

    return 'interior';
  }

  private evaluateStructurePlan(
    city: City,
    structure: StructureDefinition,
    personality: FactionPersonality,
    faithDeficit: number,
    threatLevel: number,
    cityRole: 'capital' | 'frontier' | 'interior' = 'interior'
  ): { score: number; reason: string } {
    let score = 10;
    const reasons: string[] = [];
    const mood = personality.currentMood;

    const preferenceIndex = personality.buildingPriorities.indexOf(structure.id);
    if (preferenceIndex >= 0) {
      score += Math.max(0, 25 - preferenceIndex * 4);
      reasons.push('faction preference');
    }

    // CITY SPECIALIZATION: Role-based bonuses
    switch (cityRole) {
      case 'frontier':
        // Frontier cities prioritize defense and military
        if (['fortress', 'walls', 'barracks'].includes(structure.id)) {
          score += 25;
          reasons.push('frontier defense');
        }
        break;
      case 'interior':
        // Interior cities prioritize economy
        if (['granary', 'market', 'farm'].includes(structure.id)) {
          score += 20;
          reasons.push('interior economy');
        }
        break;
      case 'capital':
        // Capital prioritizes tech, faith, and prestige buildings
        if (['temple', 'cathedral', 'academy', 'library'].includes(structure.id)) {
          score += 20;
          reasons.push('capital development');
        }
        break;
    }

    switch (structure.id) {
      case 'temple': {
        score += personality.piety * 35 + faithDeficit * 0.2 + mood.zealotry * 20;
        if (faithDeficit > 0) reasons.push('faith deficit');
        break;
      }
      case 'cathedral': {
        score += personality.piety * 25 + faithDeficit * 0.25;
        reasons.push('long-term faith');
        break;
      }
      case 'granary': {
        const growthPressure = city.population >= city.maxPopulation ? 30 : (city.population / city.maxPopulation) * 20;
        if (growthPressure > 0) reasons.push('population pressure');
        score += growthPressure + mood.pragmatism * 10;
        break;
      }
      case 'lighthouse': {
        if (!this.isCoastalCity(city)) {
          return { score: 0, reason: '' };
        }
        score += 25 + personality.opportunism * 15 + mood.pragmatism * 5;
        reasons.push('coastal trade');
        break;
      }
      case 'academy':
      case 'library': {
        const knowledgeBoost = 15 + personality.opportunism * 5 + mood.pragmatism * 12;
        score += knowledgeBoost;
        reasons.push('knowledge economy');
        break;
      }
      case 'fortress': {
        const defenseScore = threatLevel * 90 + personality.aggression * 10 - personality.riskTolerance * 10;
        score += defenseScore;
        if (threatLevel > 0.15) reasons.push('threat response');
        break;
      }
      default:
        break;
    }

    if (structure.effects.starProduction > 0) {
      score += structure.effects.starProduction * 6;
      reasons.push('star production');
    }
    if (structure.effects.populationGrowth > 0) {
      score += structure.effects.populationGrowth * 4;
    }
    if (structure.effects.defenseBonus > 0) {
      score += structure.effects.defenseBonus * 5;
    }

    return score > 20
      ? { score, reason: reasons.join(', ') || 'strategic priority' }
      : { score: 0, reason: '' };
  }

  private evaluateImprovementPlans(
    city: City,
    personality: FactionPersonality,
    availableStars: number,
    threatLevel: number,
    existingImprovements: Map<string, string>,
    queuedImprovements: Map<string, string>
  ): AICityPlanEntry[] {
    const entries: AICityPlanEntry[] = [];
    const playerId = this.aiPlayer.id;
    const workableTiles = this.getCityWorkableTiles(city);
    const capitalMood = personality.currentMood;

    workableTiles.forEach(tile => {
      const tileKey = this.getImprovementKey(tile.coordinate);
      if (existingImprovements.has(tileKey)) return;
      if (queuedImprovements.has(tileKey)) return;
      if (!tile.exploredBy.includes(playerId)) return;
      if (tile.feature) return;

      Object.values(IMPROVEMENT_DEFINITIONS).forEach(improvement => {
        if (!improvement.validTerrain.includes(tile.terrain)) return;
        if (!this.aiPlayer.researchedTechs.includes(improvement.requiredTech)) return;

        if (improvement.id === 'port' && !this.isCoastalCity(city)) {
          return;
        }

        if (improvement.id === 'sawmill') {
          const adjacentHuts = this.countAdjacentImprovements(
            city.id,
            tile.coordinate,
            'lumber_hut',
            existingImprovements,
            queuedImprovements
          );
          if (adjacentHuts === 0) return;
        }

        let score = 10;
        const reasons: string[] = [];

        if (improvement.starProduction > 0) {
          score += improvement.starProduction * 8;
          reasons.push('star income');
        }

        if (tile.resources.length > 0) {
          score += tile.resources.length * 5;
          reasons.push('leverages resources');
        }

        if (improvement.effects?.populationGrowth) {
          score += improvement.effects.populationGrowth * 6;
          reasons.push('population growth');
        }

        if (improvement.id === 'farm' || improvement.id === 'plantation' || improvement.id === 'irrigation') {
          score += 8 + personality.expansionism * 10;
          reasons.push('food economy');
        }

        if (improvement.id === 'lumber_hut' || improvement.id === 'forest_camp') {
          score += 5 + personality.expansionism * 6;
          reasons.push('forest industry');
        }

        if (improvement.id === 'workshop' || improvement.id === 'mine') {
          score += 6 + personality.aggression * 8 + capitalMood.pragmatism * 10;
          reasons.push('production boost');
          if (threatLevel > 0.35) {
            score += threatLevel * 15;
            reasons.push('war footing');
          }
        }

        if (improvement.id === 'port') {
          score += 12 + personality.opportunism * 10;
          reasons.push('trade network');
        }

        if (improvement.id === 'sawmill') {
          score += 10;
          reasons.push('timber hub');
        }

        if (improvement.cost > availableStars) {
          score -= 5;
          reasons.push('requires savings');
        }

        if (score <= 20) return;

        entries.push({
          optionId: improvement.id,
          category: 'improvements',
          priority: score,
          cost: improvement.cost,
          coordinate: tile.coordinate,
          reason: reasons.join(', ') || 'infrastructure expansion',
        });
      });
    });

    return entries.sort((a, b) => b.priority - a.priority);
  }

  private evaluateUnitPlans(
    city: City,
    personality: FactionPersonality,
    threatLevel: number
  ): AICityPlanEntry[] {
    const entries: AICityPlanEntry[] = [];
    const factionId = (this.aiPlayer.factionId || '').toUpperCase();
    const unitCounts = this.getMyUnits().reduce<Record<string, number>>((acc, unit) => {
      acc[unit.type] = (acc[unit.type] || 0) + 1;
      return acc;
    }, {});
    const queuedUnits = new Set(
      (this.aiPlayer.constructionQueue || [])
        .filter(item => item.cityId === city.id && item.category === 'units')
        .map(item => item.type)
    );
    const cityHasHarbor = this.isCoastalCity(city);

    Object.values(UNIT_DEFINITIONS).forEach(unitDef => {
      if (!this.canRecruitUnit(unitDef, factionId)) return;
      if (queuedUnits.has(unitDef.type)) return;
      if (!this.cityCanProduceUnit(city, unitDef, cityHasHarbor)) return;

      const { score, reason } = this.scoreUnitPlan(
        unitDef,
        personality,
        threatLevel,
        unitCounts
      );

      if (score <= 25) {
        return;
      }

      entries.push({
        optionId: unitDef.type,
        category: 'units',
        priority: score,
        cost: unitDef.cost,
        reason,
        faithCost: unitDef.requirements?.faith,
        prideCost: unitDef.requirements?.pride,
      });
    });

    return entries.sort((a, b) => b.priority - a.priority);
  }

  private getCityStructuresSet(cityId: string): Set<StructureType> {
    const ownedStructures = new Set<StructureType>();
    const structures = (this.gameState.structures || []).filter(
      structure => structure.cityId === cityId && structure.ownerId === this.aiPlayer.id
    );
    structures.forEach(structure => ownedStructures.add(structure.type as StructureType));

    const city = this.gameState.cities?.find(c => c.id === cityId);
    if (city) {
      (city.structures || []).forEach(structureId => {
        if (STRUCTURE_DEFINITIONS[structureId as StructureType]) {
          ownedStructures.add(structureId as StructureType);
        }
      });
    }

    return ownedStructures;
  }

  private getQueuedStructures(cityId: string): Set<StructureType> {
    return new Set(
      (this.aiPlayer.constructionQueue || [])
        .filter(item => item.cityId === cityId && item.category === 'structures')
        .map(item => item.type as StructureType)
    );
  }

  private getCityImprovementsMap(cityId: string): Map<string, string> {
    const map = new Map<string, string>();
    (this.gameState.improvements || [])
      .filter(improvement => improvement.cityId === cityId && improvement.ownerId === this.aiPlayer.id)
      .forEach(improvement => {
        map.set(this.getImprovementKey(improvement.coordinate), improvement.type);
      });
    return map;
  }

  private getQueuedImprovements(cityId: string): Map<string, string> {
    const queueMap = new Map<string, string>();
    (this.aiPlayer.constructionQueue || [])
      .filter(item => item.cityId === cityId && item.category === 'improvements' && item.coordinate)
      .forEach(item => {
        queueMap.set(this.getImprovementKey(item.coordinate as HexCoordinate), item.type);
      });
    return queueMap;
  }

  private getImprovementKey(coordinate: HexCoordinate): string {
    return `${coordinate.q},${coordinate.r}`;
  }

  private isStructureQueued(cityId: string, structureId: StructureType): boolean {
    return (this.aiPlayer.constructionQueue || []).some(
      item => item.cityId === cityId && item.category === 'structures' && item.type === structureId
    );
  }

  private isStructurePlanValid(city: City, structureId: StructureType): boolean {
    if (!this.canBuildStructure(structureId)) return false;
    if (this.getCityStructuresSet(city.id).has(structureId)) return false;
    if (this.isStructureQueued(city.id, structureId)) return false;
    if (structureId === 'lighthouse' && !this.isCoastalCity(city)) return false;
    return true;
  }

  private isCoastalCity(city: City): boolean {
    const neighbors = hexNeighbors(city.coordinate);
    return neighbors.some(coord => {
      const tile = this.gameState.map.tiles.find(t => t.coordinate.q === coord.q && t.coordinate.r === coord.r);
      return tile?.terrain === 'water';
    });
  }

  private findStructurePlacementCoordinate(city: City, anchorCoords: HexCoordinate[]): HexCoordinate | null {
    const occupiedKeys = new Set(
      (this.gameState.improvements || []).map(imp => `${imp.coordinate.q},${imp.coordinate.r}`),
    );

    const structureKeys = new Set(
      (this.gameState.structures || [])
        .filter(structure => structure.coordinate)
        .map(structure => `${structure.coordinate!.q},${structure.coordinate!.r}`),
    );

    const queuedKeys = new Set(
      (this.aiPlayer.constructionQueue || [])
        .filter(item => item.coordinate)
        .map(item => `${item.coordinate!.q},${item.coordinate!.r}`),
    );

    const cityKeys = new Set(
      (this.gameState.cities || []).map(c => `${c.coordinate.q},${c.coordinate.r}`),
    );

    const unitKeys = new Set(
      this.gameState.units.map(u => `${u.coordinate.q},${u.coordinate.r}`),
    );

    const candidates = this.gameState.map.tiles.filter(tile => {
      if (!isTileExploredByPlayer(this.gameState, this.aiPlayer.id, tile.coordinate)) return false;
      if (!isWithinFriendlyBuildRadius(anchorCoords, tile.coordinate, STRUCTURE_BUILD_RADIUS)) return false;
      if (tile.terrain === 'water') return false;
      if (tile.feature === 'village') return false;

      const key = `${tile.coordinate.q},${tile.coordinate.r}`;
      if (occupiedKeys.has(key)) return false;
      if (structureKeys.has(key)) return false;
      if (queuedKeys.has(key)) return false;
      if (cityKeys.has(key)) return false;
      if (unitKeys.has(key)) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) =>
      hexDistance(city.coordinate, a.coordinate) - hexDistance(city.coordinate, b.coordinate),
    );

    return candidates[0].coordinate;
  }

  private getCityWorkableTiles(city: City): Tile[] {
    return this.gameState.map.tiles.filter(tile => {
      const distance = hexDistance(tile.coordinate, city.coordinate);
      if (distance === 0) return false;
      return distance <= CITY_WORK_RADIUS;
    });
  }

  private simulateCombatOutcome(attacker: Unit, defender: Unit) {
    const distance = hexDistance(attacker.coordinate, defender.coordinate);
    if (distance > attacker.attackRange) {
      return null;
    }
    return resolveCombat(attacker, defender, this.gameState);
  }

  private calculateLocalStrength(center: HexCoordinate, playerId: string, radius: number): number {
    return this.gameState.units.reduce((total, unit) => {
      if (unit.playerId !== playerId) return total;
      if (hexDistance(unit.coordinate, center) > radius) return total;
      const healthFactor = unit.hp / Math.max(1, unit.maxHp);
      return total + unit.attack + unit.defense + healthFactor * 5;
    }, 0);
  }

  private calculateEnemyStrength(center: HexCoordinate, playerId: string, radius: number): number {
    return this.gameState.units.reduce((total, unit) => {
      if (unit.playerId === playerId) return total;
      if (hexDistance(unit.coordinate, center) > radius) return total;
      const healthFactor = unit.hp / Math.max(1, unit.maxHp);
      return total + unit.attack + unit.defense + healthFactor * 5;
    }, 0);
  }

  private getCoordinateKey(coordinate: HexCoordinate): string {
    return `${coordinate.q},${coordinate.r}`;
  }

  private isTileOccupiedByEnemy(coordinate: HexCoordinate, playerId: string): boolean {
    return this.gameState.units.some(unit =>
      unit.playerId !== playerId &&
      unit.coordinate.q === coordinate.q &&
      unit.coordinate.r === coordinate.r &&
      unit.coordinate.s === coordinate.s
    );
  }

  private isTileOccupiedByFriendly(coordinate: HexCoordinate, playerId: string): boolean {
    return this.gameState.units.some(unit =>
      unit.playerId === playerId &&
      unit.coordinate.q === coordinate.q &&
      unit.coordinate.r === coordinate.r &&
      unit.coordinate.s === coordinate.s &&
      !this.reservedUnits.has(unit.id)
    );
  }

  private countUnexploredNeighbors(coordinate: HexCoordinate): number {
    return hexNeighbors(coordinate).reduce((count, neighbor) => {
      const key = this.getCoordinateKey(neighbor);
      return count + (this.aiPlayer.exploredTiles.includes(key) ? 0 : 1);
    }, 0);
  }

  private findExplorationMove(unit: Unit): { target: HexCoordinate; priority: number } | null {
    const reachable = this.getReachableTiles(unit);
    let best: { target: HexCoordinate; priority: number } | null = null;

    for (const coordinate of reachable) {
      if (this.isTileOccupiedByEnemy(coordinate, unit.playerId)) continue;
      const key = this.getCoordinateKey(coordinate);
      const isUnexplored = !this.aiPlayer.exploredTiles.includes(key);
      const frontierScore = this.countUnexploredNeighbors(coordinate);
      if (!isUnexplored && frontierScore === 0) continue;

      let priority = 50 + frontierScore * 5;
      if (isUnexplored) {
        priority += 15;
      }
      if (unit.type === 'scout') {
        priority += 10;
      }

      if (!best || priority > best.priority) {
        best = { target: coordinate, priority };
      }
    }

    return best;
  }

  private evaluateHealOpportunity(unit: Unit): number {
    let bestDeficit = 0;
    this.gameState.units.forEach(ally => {
      if (ally.playerId !== unit.playerId || ally.id === unit.id) return;
      const distance = hexDistance(unit.coordinate, ally.coordinate);
      if (distance > 2) return;
      const deficit = ally.maxHp - ally.hp;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
      }
    });
    return bestDeficit;
  }

  private hasSiegeOpportunity(unit: Unit): boolean {
    const attackRange = unit.attackRange || 1;
    const enemyUnitNearby = this.gameState.units.some(enemy =>
      enemy.playerId !== unit.playerId &&
      enemy.hp > 0 &&
      hexDistance(unit.coordinate, enemy.coordinate) <= attackRange + 1
    );
    if (enemyUnitNearby) {
      return true;
    }
    return (this.gameState.cities || []).some(city =>
      city.ownerId &&
      city.ownerId !== unit.playerId &&
      hexDistance(unit.coordinate, city.coordinate) <= attackRange + 1
    );
  }

  private shouldApplyStealth(unit: Unit): boolean {
    const nearbyEnemy = this.gameState.units.some(enemy =>
      enemy.playerId !== unit.playerId &&
      hexDistance(unit.coordinate, enemy.coordinate) <= 3
    );
    return nearbyEnemy || this.countUnexploredNeighbors(unit.coordinate) > 0;
  }

  private countAdjacentAllies(unit: Unit, radius: number): number {
    return this.gameState.units.reduce((count, ally) => {
      if (ally.playerId !== unit.playerId || ally.id === unit.id) return count;
      return count + (hexDistance(unit.coordinate, ally.coordinate) <= radius ? 1 : 0);
    }, 0);
  }

  private countAlliesInRadius(unit: Unit, radius: number): number {
    return this.gameState.units.reduce((count, ally) => {
      if (ally.playerId !== unit.playerId || ally.id === unit.id) return count;
      return count + (hexDistance(unit.coordinate, ally.coordinate) <= radius ? 1 : 0);
    }, 0);
  }

  private canScheduleImprovement(city: City, plan: AICityPlanEntry): boolean {
    if (!plan.coordinate) return false;
    const improvement = IMPROVEMENT_DEFINITIONS[plan.optionId as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvement) return false;

    const tile = this.gameState.map.tiles.find(
      t => t.coordinate.q === plan.coordinate!.q && t.coordinate.r === plan.coordinate!.r
    );
    if (!tile) return false;
    if (!tile.exploredBy.includes(this.aiPlayer.id)) return false;
    if (!improvement.validTerrain.includes(tile.terrain)) return false;

    const existing = this.getCityImprovementsMap(city.id);
    const queued = this.getQueuedImprovements(city.id);
    const key = this.getImprovementKey(plan.coordinate);
    if (existing.has(key) || queued.has(key)) return false;

    if (improvement.id === 'port' && !this.isCoastalCity(city)) {
      return false;
    }

    if (improvement.id === 'sawmill') {
      const adjacentHuts = this.countAdjacentImprovements(city.id, plan.coordinate, 'lumber_hut', existing, queued);
      if (adjacentHuts === 0) return false;
    }

    if (!this.aiPlayer.researchedTechs.includes(improvement.requiredTech)) return false;

    return true;
  }

  private canScheduleUnit(plan: AICityPlanEntry): boolean {
    const unitDef = UNIT_DEFINITIONS[plan.optionId as UnitType];
    if (!unitDef) return false;

    if (plan.faithCost && this.aiPlayer.stats.faith < plan.faithCost) {
      return false;
    }
    if (plan.prideCost && this.aiPlayer.stats.pride < plan.prideCost) {
      return false;
    }
    if (unitDef.requirements?.dissent && this.aiPlayer.stats.internalDissent < unitDef.requirements.dissent) {
      return false;
    }

    return true;
  }

  private countAdjacentImprovements(
    _cityId: string,
    coordinate: HexCoordinate,
    improvementId: string,
    existingImprovements: Map<string, string>,
    queuedImprovements: Map<string, string>
  ): number {
    return hexNeighbors(coordinate).reduce((count, neighbor) => {
      const key = this.getImprovementKey(neighbor);
      const existing = existingImprovements.get(key);
      if (existing === improvementId) {
        return count + 1;
      }
      const queued = queuedImprovements.get(key);
      if (queued === improvementId) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  private canRecruitUnit(unitDef: UnitDefinition, factionId: string): boolean {
    if (unitDef.requiredTechnology && !this.aiPlayer.researchedTechs.includes(unitDef.requiredTechnology)) {
      return false;
    }
    if (unitDef.factionSpecific && unitDef.factionSpecific.length > 0) {
      const allowed = unitDef.factionSpecific.map(f => f.toUpperCase());
      if (!allowed.includes(factionId)) {
        return false;
      }
    }
    if (unitDef.requirements?.faith && this.aiPlayer.stats.faith < unitDef.requirements.faith) {
      return false;
    }
    if (unitDef.requirements?.pride && this.aiPlayer.stats.pride < unitDef.requirements.pride) {
      return false;
    }
    if (unitDef.requirements?.dissent && this.aiPlayer.stats.internalDissent < unitDef.requirements.dissent) {
      return false;
    }
    if (this.aiPlayer.stars < unitDef.cost) {
      return false;
    }
    return true;
  }

  private cityCanProduceUnit(city: City, unitDef: UnitDefinition, cityHasHarbor: boolean): boolean {
    if (unitDef.type === 'boat' && !cityHasHarbor) {
      return false;
    }
    return true;
  }

  private scoreUnitPlan(
    unitDef: UnitDefinition,
    personality: FactionPersonality,
    threatLevel: number,
    unitCounts: Record<string, number>
  ): { score: number; reason: string } {
    let score = 25;
    const reasons: string[] = [];
    const preference = this.personalityEngine.getUnitPreference(unitDef.type);
    score += preference * 40;
    if (preference > 0.6) {
      reasons.push('faction preference');
    }

    score += unitDef.baseStats.attack * 2;
    score += unitDef.baseStats.defense * 1.5;

    if (threatLevel > 0.35) {
      score += threatLevel * (unitDef.baseStats.defense + unitDef.baseStats.attack);
      reasons.push('responding to threat');
    }

    // FAIR PLAY: Counter-unit logic based only on VISIBLE enemy units
    const counterBonus = this.calculateCounterUnitBonus(unitDef);
    if (counterBonus > 0) {
      score += counterBonus;
      reasons.push('counters visible enemy units');
    }

    // Army composition balance - avoid too many of same type
    const myTypeCount = unitCounts[unitDef.type] || 0;
    const totalUnits = Object.values(unitCounts).reduce((sum, c) => sum + c, 0);
    if (totalUnits > 0) {
      const ratio = myTypeCount / totalUnits;
      if (ratio > 0.4) {
        score -= 15; // Already have too many of this type
      } else if (ratio < 0.1 && unitDef.baseStats.attack > 3) {
        score += 10; // Need more variety in army
        reasons.push('army diversity');
      }
    }

    if (unitDef.type === 'worker') {
      const workerTarget = Math.max(1, this.getMyCities().length * 2);
      const workerCount = unitCounts.worker ?? 0;
      if (workerCount < workerTarget) {
        score += (workerTarget - workerCount) * 10;
        reasons.push('expand infrastructure');
      } else {
        score -= 15;
      }
    }

    if (unitDef.type === 'missionary' || unitDef.type === 'royal_envoy') {
      score += personality.piety * 20 + threatLevel * -10 + this.personalityEngine.getDecisionModifier('diplomacy') * 15;
      reasons.push('influence push');
    }

    if (unitDef.type === 'catapult') {
      score += threatLevel * 30 + personality.aggression * 15;
      reasons.push('siege capability');
    }

    if (unitDef.type === 'boat') {
      score += this.personalityEngine.getDecisionModifier('expand') * 20;
      reasons.push('naval reach');
    }

    return { score, reason: reasons.join(', ') || 'balanced army composition' };
  }

  /**
   * Calculate bonus for recruiting units that counter VISIBLE enemy units
   * FAIR PLAY: Only considers units within AI's visibility mask
   */
  private calculateCounterUnitBonus(unitDef: UnitDefinition): number {
    const visibleEnemies = this.getVisibleEnemyUnits();
    if (visibleEnemies.length === 0) return 0;

    let bonus = 0;

    // Count visible enemy unit types
    const enemyCounts: Record<string, number> = {};
    for (const enemy of visibleEnemies) {
      enemyCounts[enemy.type] = (enemyCounts[enemy.type] || 0) + 1;
    }

    // Counter-unit relationships (rock-paper-scissors style)
    const counters: Record<string, string[]> = {
      spearman: ['scout'], // Spears counter fast movers
      slinger: ['warrior', 'spearman'], // Ranged counters infantry
      wilderness_hunter: ['warrior', 'spearman'],
      scout: ['slinger', 'wilderness_hunter', 'catapult'], // Fast units counter ranged/siege
      warrior: ['slinger', 'wilderness_hunter'], // Basic can swarm ranged
      catapult: ['guard', 'warrior'], // Siege pressures slow/defensive units
    };

    const unitCounters = counters[unitDef.type] || [];
    for (const counteredType of unitCounters) {
      const counteredCount = enemyCounts[counteredType] || 0;
      bonus += counteredCount * 8; // +8 per visible enemy we counter
    }

    return bonus;
  }

  /**
   * Get enemy units within AI's visibility mask
   * FAIR PLAY: AI only sees what a human player in their position would see
   */
  private getVisibleEnemyUnits(): Unit[] {
    return this.gameState.units.filter(unit => {
      if (unit.playerId === this.aiPlayer.id) return false; // Not our unit
      const tileKey = `${unit.coordinate.q},${unit.coordinate.r}`;
      return this.aiPlayer.visibilityMask.includes(tileKey); // Only if visible
    });
  }

  /**
   * Calculate progress toward each victory condition
   * FAIR PLAY: Only uses information the AI can actually see
   */
  private calculateVictoryProgress(personality: FactionPersonality): VictoryProgress {
    const preferredType = personality.preferredVictory;

    // --- Conquest Progress ---
    // FAIR PLAY: Only count cities we can see (explored tiles)
    const myCities = this.getMyCities().length;
    const visibleEnemyCities = this.gameState.cities.filter(city => {
      if (city.ownerId === this.aiPlayer.id) return false;
      const tileKey = `${city.coordinate.q},${city.coordinate.r}`;
      return this.aiPlayer.exploredTiles.includes(tileKey);
    }).length;
    const totalVisibleCities = myCities + visibleEnemyCities;
    const conquestProgress = totalVisibleCities > 0
      ? Math.min(100, (myCities / totalVisibleCities) * 150) // 66% of visible = 100%
      : 50;

    // --- Faith Progress ---
    const faithTarget = GAME_RULES.victory.faithThreshold;
    const faithDissentMax = GAME_RULES.victory.faithDissentMax;
    const faithBase = Math.min(100, (this.aiPlayer.stats.faith / faithTarget) * 100);
    const faithDissent = this.aiPlayer.stats.internalDissent;
    const dissentClamp = Math.max(1, faithDissentMax);
    const dissentFactor = faithDissent <= faithDissentMax
      ? 1
      : Math.max(0, 1 - ((faithDissent - faithDissentMax) / dissentClamp));
    const faithProgress = Math.min(100, faithBase * dissentFactor);

    // --- Economic Progress ---
    const techCount = this.aiPlayer.researchedTechs.length;
    const totalTechs = Object.keys(TECHNOLOGIES).length || 1;
    const income = this.strategy.budget?.incomePerTurn || 0;
    const economicTargets = GameRuleHelpers.getEconomicVictoryThresholds(this.gameState.players.length);
    const incomeProgress = Math.min(100, (income / economicTargets.income) * 100);
    const treasuryProgress = Math.min(100, (this.aiPlayer.stars / economicTargets.treasury) * 100);
    const techProgress = Math.min(100, ((techCount / totalTechs) / economicTargets.techPercent) * 100);
    const economicProgress = Math.min(100, (incomeProgress + treasuryProgress + techProgress) / 3);

    // --- Cultural Progress ---
    const totalPop = this.getMyCities().reduce((sum, c) => sum + (c.population || 0), 0);
    const culturalTargets = GameRuleHelpers.getCulturalVictoryThresholds(this.gameState.players.length);
    const structureCount = (this.gameState.structures || []).filter(
      s => s.ownerId === this.aiPlayer.id && s.constructionTurns === 0 && culturalTargets.structureTypes.includes(s.type)
    ).length;
    const improvementCount = (this.gameState.improvements || []).filter(
      i => i.ownerId === this.aiPlayer.id && i.constructionTurns === 0 && culturalTargets.improvementTypes.includes(i.type)
    ).length;
    const culturalSites = structureCount + improvementCount;
    const populationProgress = Math.min(100, (totalPop / culturalTargets.population) * 100);
    const sitesProgress = Math.min(100, (culturalSites / culturalTargets.structures) * 100);
    const dissent = this.aiPlayer.stats.internalDissent;
    const dissentProgress = dissent <= culturalTargets.dissentMax
      ? 100
      : Math.max(0, 100 - ((dissent - culturalTargets.dissentMax) / culturalTargets.dissentMax) * 100);
    const culturalProgress = Math.min(100, (populationProgress + sitesProgress + dissentProgress) / 3);

    // Determine if we should pivot strategy
    const progressMap = { conquest: conquestProgress, faith: faithProgress, economic: economicProgress, cultural: culturalProgress };
    const currentProgress = progressMap[preferredType];

    // Find best alternative
    let bestAlt: typeof preferredType = preferredType;
    let bestAltProgress = currentProgress;
    for (const [type, progress] of Object.entries(progressMap) as [typeof preferredType, number][]) {
      if (type !== preferredType && progress > bestAltProgress + 20) {
        bestAlt = type;
        bestAltProgress = progress;
      }
    }

    const shouldPivot = bestAlt !== preferredType && bestAltProgress > currentProgress + 20;

    return {
      conquest: conquestProgress,
      faith: faithProgress,
      economic: economicProgress,
      cultural: culturalProgress,
      preferredType,
      shouldPivot,
      pivotRecommendation: shouldPivot ? bestAlt : undefined,
    };
  }

  private createImprovementJobs(cityPlans: Record<string, AICityPlanEntry[]>): AIImprovementJob[] {
    const jobs: AIImprovementJob[] = [];
    Object.entries(cityPlans).forEach(([cityId, plans]) => {
      plans
        .filter(plan => plan.category === 'improvements' && plan.coordinate)
        .forEach(plan => {
          const coordinate = plan.coordinate as HexCoordinate;
          const jobId = `improve:${cityId}:${plan.optionId}:${coordinate.q},${coordinate.r}`;
          jobs.push({
            id: jobId,
            cityId,
            improvementId: plan.optionId,
            coordinate,
            priority: plan.priority,
            reason: plan.reason,
          });
        });
    });
    // Add connective road jobs between nearby cities to boost mobility
    jobs.push(...this.createRoadJobs());

    return jobs.sort((a, b) => b.priority - a.priority).slice(0, 20);
  }

  private createRoadJobs(): AIImprovementJob[] {
    const jobs: AIImprovementJob[] = [];
    const myCities = this.getMyCities();
    if (myCities.length < 2) return jobs;

    // Pair each city with its nearest neighbor
    for (const city of myCities) {
      const nearest = this.findNearestCity(city, myCities.filter(c => c.id !== city.id));
      if (!nearest) continue;

      const path = this.buildStraightPath(city.coordinate, nearest.coordinate);
      path.forEach((coord, idx) => {
        const jobId = `road:${city.id}:${nearest.id}:${idx}`;
        jobs.push({
          id: jobId,
          cityId: city.id,
          improvementId: 'road',
          coordinate: coord,
          priority: 55,
          reason: 'connect cities for faster movement',
        });
      });
    }

    return jobs;
  }

  private buildExplorationGoals(personality: FactionPersonality): AIExplorationGoal[] {
    const unexploredTiles = this.gameState.map.tiles.filter(tile => !tile.exploredBy.includes(this.aiPlayer.id));
    if (unexploredTiles.length === 0) {
      return [];
    }

    const goals: AIExplorationGoal[] = [];
    const myUnits = this.getMyUnits();

    unexploredTiles.forEach(tile => {
      const coordinate = tile.coordinate;
      const nearestUnitDistance = this.distanceToNearestUnit(coordinate, myUnits);
      if (nearestUnitDistance === Infinity) {
        return;
      }

      const score = this.scoreExplorationTile(tile, nearestUnitDistance, personality);
      if (score <= 15) return;

      goals.push({
        id: `explore:${coordinate.q},${coordinate.r}`,
        target: coordinate,
        priority: score,
        reason: tile.feature ? `Investigate ${tile.feature}` : 'Reveal frontier tiles',
      });
    });

    goals.sort((a, b) => b.priority - a.priority);
    return goals.slice(0, 15);
  }

  private buildStraightPath(from: HexCoordinate, to: HexCoordinate): HexCoordinate[] {
    return this.findShortestLandPath(from, to);
  }

  private findShortestLandPath(from: HexCoordinate, to: HexCoordinate): HexCoordinate[] {
    // BFS pathfinding constrained to non-water tiles
    const visited = new Set<string>();
    const queue: Array<{ coord: HexCoordinate; path: HexCoordinate[] }> = [{ coord: from, path: [] }];
    const isPassable = (coord: HexCoordinate) => {
      const tile = this.gameState.map.tiles.find(t => t.coordinate.q === coord.q && t.coordinate.r === coord.r);
      return tile && tile.terrain !== 'water';
    };

    while (queue.length) {
      const { coord, path } = queue.shift()!;
      const key = `${coord.q},${coord.r}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (coord.q === to.q && coord.r === to.r) {
        return path;
      }

      for (const neighbor of hexNeighbors(coord)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        if (visited.has(neighborKey)) continue;
        if (!isPassable(neighbor)) continue;
        queue.push({ coord: neighbor, path: [...path, neighbor] });
      }
    }

    return [];
  }

  private findNearestCity(source: City, others: City[]): City | null {
    let nearest: City | null = null;
    let best = Infinity;
    for (const city of others) {
      const dist = hexDistance(source.coordinate, city.coordinate);
      if (dist < best) {
        best = dist;
        nearest = city;
      }
    }
    return nearest;
  }

  private distanceToNearestUnit(target: HexCoordinate, units: Unit[]): number {
    let min = Infinity;
    for (const unit of units) {
      const distance = hexDistance(unit.coordinate, target);
      if (distance < min) {
        min = distance;
      }
    }
    return min;
  }

  private scoreExplorationTile(
    tile: GameState['map']['tiles'][number],
    distance: number,
    personality: FactionPersonality
  ): number {
    const hasResource = tile.resources.length > 0;
    const isFeature = !!tile.feature;

    let score = 40 - distance * 4;
    if (hasResource) score += 12;
    if (isFeature) score += 18;

    score += personality.expansionism * 20;
    score += personality.opportunism * 10;

    const enemyPresence = this.calculateEnemyStrength(tile.coordinate, this.aiPlayer.id, 2);
    if (enemyPresence > 0) {
      score -= Math.min(20, enemyPresence / 3);
    }

    return score;
  }

  private findBestWorkerForJob(
    job: AIImprovementJob,
    workers: Unit[],
    assignedWorkers: Set<string>
  ): Unit | null {
    let bestWorker: Unit | null = null;
    let bestDistance = Infinity;

    for (const worker of workers) {
      if (assignedWorkers.has(worker.id)) continue;
      if (worker.remainingMovement <= 0) continue;
      const distance = hexDistance(worker.coordinate, job.coordinate);
      if (distance < bestDistance) {
        bestWorker = worker;
        bestDistance = distance;
      }
    }

    return bestWorker;
  }

  private getNextStepTowards(unit: Unit, target: HexCoordinate): HexCoordinate | null {
    const currentDistance = hexDistance(unit.coordinate, target);
    if (currentDistance === 0) return null;

    let bestNeighbor: HexCoordinate | null = null;
    let bestDistance = currentDistance;

    for (const neighbor of hexNeighbors(unit.coordinate)) {
      if (!this.isValidMovePosition(neighbor)) continue;
      if (this.isTileOccupiedByFriendly(neighbor, unit.playerId)) continue;
      if (this.isTileOccupiedByEnemy(neighbor, unit.playerId)) continue;

      const distance = hexDistance(neighbor, target);
      if (distance < bestDistance) {
        bestNeighbor = neighbor;
        bestDistance = distance;
      }
    }

    return bestNeighbor;
  }

  private isExplorerUnit(unit: Unit): boolean {
    if (unit.type === 'scout' || unit.type === 'boat') return true;
    const abilities = new Set(unit.abilities?.map(a => a.toUpperCase()) ?? []);
    if (abilities.has('RECONNAISSANCE') || abilities.has('NAVAL_COMMAND')) {
      return true;
    }
    return unit.type === 'commander';
  }

  private findBestExplorer(
    goal: AIExplorationGoal,
    explorers: Unit[],
    assignedExplorers: Set<string>
  ): Unit | null {
    let best: Unit | null = null;
    let bestDistance = Infinity;

    for (const explorer of explorers) {
      if (assignedExplorers.has(explorer.id)) continue;
      if (explorer.remainingMovement <= 0) continue;
      const distance = hexDistance(explorer.coordinate, goal.target);
      if (distance < bestDistance) {
        best = explorer;
        bestDistance = distance;
      }
    }

    return best;
  }

  /**
   * Update debug information for visualization
   */
  private updateDebugInfo(influenceMap: any, decisions: AIDecision[], decisionTime: number): void {
    if (aiDebugOverlay.isEnabled()) {
      const personality = this.personalityEngine.getPersonality();

      aiDebugOverlay.updateDebugInfo(this.aiPlayer.id, {
        influenceMap: influenceMap.influences,
        threatAssessment: new Map(),
        strategicGoals: [personality.preferredVictory],
        currentPlan: this.getStrategicPlan(),
        resourcePriorities: {
          stars: this.getResourcePriority('stars'),
          faith: this.getResourcePriority('faith'),
          pride: this.getResourcePriority('pride')
        },
        factionMood: {
          aggression: personality.aggression,
          piety: personality.piety,
          opportunism: personality.opportunism,
          riskTolerance: personality.riskTolerance
        }
      });
    }
  }

  // Helper methods

  private generateSeed(): number {
    return Date.now() + parseInt(this.aiPlayer.id) * 1000;
  }

  private getMaxActionsPerTurn(): number {
    switch (this.difficulty) {
      case 'easy': return 2;
      case 'normal': return 3;
      case 'hard': return 4;
      default: return 3;
    }
  }

  /**
   * ADAPTIVE DIFFICULTY: Easy AI occasionally misses optimal plays
   * This makes Easy feel more forgiving without being completely random
   */
  private shouldSkipOptimalPlay(): boolean {
    if (this.difficulty !== 'easy') return false;

    // 15% chance to skip an optimal decision on Easy
    return this.rng.next() < 0.15;
  }

  /**
   * ADAPTIVE DIFFICULTY: Check if AI has minimum army before aggressive actions
   * Prevents suicidal lone-unit attacks
   */
  private hasMinimumArmyForAttack(): boolean {
    const combatUnits = this.getMyUnits().filter(u => {
      const def = getUnitDefinition(u.type);
      return def.baseStats.attack > 0 && u.type !== 'worker';
    });

    // Minimum army thresholds by difficulty
    const minArmy = this.difficulty === 'easy' ? 2 :
      this.difficulty === 'normal' ? 3 : 4;

    return combatUnits.length >= minArmy;
  }

  /**
   * ADAPTIVE DIFFICULTY: Get combat odds modifier based on difficulty
   * Hard AI takes more calculated risks, Easy is more cautious
   */
  private getDifficultyModifiers(): {
    combatOddsThreshold: number;
    economyFocus: number;
    aggressionBonus: number;
  } {
    switch (this.difficulty) {
      case 'easy':
        return {
          combatOddsThreshold: 0.7,  // Only attack with 70%+ odds
          economyFocus: 1.3,          // Focus more on economy
          aggressionBonus: -10        // Less aggressive
        };
      case 'hard':
        return {
          combatOddsThreshold: 0.4,  // Take risks at 40%+ odds
          economyFocus: 0.8,          // Less economy focus
          aggressionBonus: 15         // More aggressive
        };
      default: // normal
        return {
          combatOddsThreshold: 0.55,
          economyFocus: 1.0,
          aggressionBonus: 0
        };
    }
  }

  private calculateCombatAdvantage(attacker: Unit, target: TacticalTarget): number {
    if (target.targetType !== 'unit' || !target.unitId) {
      return 0;
    }

    const defender = this.gameState.units.find(u => u.id === target.unitId);
    if (!defender) {
      return 0;
    }

    const outcome = this.simulateCombatOutcome(attacker, defender);
    if (!outcome || !outcome.success) {
      return 0;
    }

    const defenderRemaining = Math.max(0, outcome.defenderHp);
    const attackerRemaining = Math.max(0, outcome.attackerHp);
    const defenderLoss = defender.hp - defenderRemaining;
    const attackerLoss = attacker.hp - attackerRemaining;
    const lethalityBonus = outcome.defenderHp > 0 ? 0 : defender.hp * 0.5;
    const netGain = defenderLoss + lethalityBonus - attackerLoss;
    const normaliser = Math.max(1, attacker.hp + defender.hp);

    return Math.max(-1, Math.min(1, netGain / normaliser));
  }

  private assessCombatRisk(attacker: Unit, target: TacticalTarget): number {
    if (target.targetType !== 'unit' || !target.unitId) {
      return 0.5;
    }

    const defender = this.gameState.units.find(u => u.id === target.unitId);
    if (!defender) {
      return 0.5;
    }

    const outcome = this.simulateCombatOutcome(attacker, defender);
    if (!outcome || !outcome.success) {
      return 0.6;
    }

    const attackerLossRatio = (attacker.hp - outcome.attackerHp) / Math.max(1, attacker.hp);
    const defenderLossRatio = (defender.hp - outcome.defenderHp) / Math.max(1, defender.hp);
    let risk = attackerLossRatio - defenderLossRatio * 0.4;
    if (outcome.defenderHp <= 0) {
      risk -= 0.1;
    }

    // Adaptive aggression: if behind, take a bit more risk; if ahead, be more cautious
    const standing = this.getGameStanding();
    risk += standing * 0.1;

    return Math.max(0, Math.min(1, risk + 0.3));
  }

  private calculateUnitAdvantage(unit: Unit): number {
    const friendlyStrength = this.calculateLocalStrength(unit.coordinate, unit.playerId, 2);
    const enemyStrength = this.calculateEnemyStrength(unit.coordinate, unit.playerId, 2);
    const total = friendlyStrength + enemyStrength;
    if (total === 0) return 0;
    return (friendlyStrength - enemyStrength) / total;
  }

  private findNearbyMilitaryUnits(coord: HexCoordinate): Unit[] {
    return this.getMyUnits().filter(unit => {
      const unitDef = getUnitDefinition(unit.type);
      return unitDef.baseStats.attack > 0 && hexDistance(coord, unit.coordinate) <= 3;
    });
  }

  private findNearestUnit(coord: HexCoordinate, units: Unit[]): Unit | null {
    if (units.length === 0) return null;

    return units.reduce((nearest, unit) => {
      const distance = hexDistance(coord, unit.coordinate);
      const nearestDistance = hexDistance(coord, nearest.coordinate);
      return distance < nearestDistance ? unit : nearest;
    });
  }

  private findPositionNear(coord: HexCoordinate, distance: number): HexCoordinate | null {
    // Find valid position near target coordinate
    const neighbors = hexNeighbors(coord);
    return neighbors.find(pos => this.isValidMovePosition(pos)) || null;
  }

  private isValidMovePosition(coord: HexCoordinate): boolean {
    const tile = this.gameState.map.tiles.find(t =>
      t.coordinate.q === coord.q && t.coordinate.r === coord.r
    );
    return tile ? tile.terrain !== 'water' : false;
  }

  private getPersonalityModifier(actionType: string): number {
    return this.personalityEngine.getDecisionModifier(actionType);
  }

  private getStrategicPlan(): string {
    const personality = this.personalityEngine.getPersonality();
    const techTarget = this.strategy.techTarget?.id ? ` | Tech: ${this.strategy.techTarget.id}` : '';
    return `Pursuing ${personality.preferredVictory} victory${techTarget}`;
  }

  private getResourcePriority(resource: string): number {
    const personality = this.personalityEngine.getPersonality();

    switch (resource) {
      case 'stars': return 70;
      case 'faith': return Math.round(personality.piety * 100);
      case 'pride': return Math.round((1 - personality.piety) * 100);
      default: return 50;
    }
  }

  private getAvailableTechnologies(): any[] {
    return Object.keys(TECHNOLOGIES).filter(techId => {
      const tech = TECHNOLOGIES[techId];
      const playerTechs = this.aiPlayer.researchedTechs || [];
      return !playerTechs.includes(techId) &&
        tech.prerequisites.every(prereq => playerTechs.includes(prereq));
    }).map(techId => ({ ...TECHNOLOGIES[techId], id: techId }));
  }

  private calculateTechValue(tech: any): number {
    // Base tech value calculation
    let value = 50;

    // Bonus for faction alignment
    const personality = this.personalityEngine.getPersonality();
    if (personality.techPriorities.includes(tech.id)) {
      value += 30;
    }

    // Bonus for urgent needs (military vs economic)
    const enemyThreat = this.assessEnemyThreat();
    if (enemyThreat > 0.6 && tech.category === 'military') {
      value += 25;
    } else if (enemyThreat < 0.4 && tech.category === 'economic') {
      value += 20;
    }

    return value;
  }

  // ============================================================
  // NAVAL MOVEMENT SYSTEM
  // Enables AI to cross water using boats (embark/sail/disembark)
  // ============================================================

  /**
   * Evaluate naval movement opportunities for units that need to cross water
   */
  private evaluateNavalMovement(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();
    const myBoats = myUnits.filter((u: Unit) => u.type === 'boat');

    // Skip if no boats available
    if (myBoats.length === 0) return decisions;

    for (const unit of myUnits) {
      if (this.reservedUnits.has(unit.id)) continue;
      if (unit.remainingMovement <= 0) continue;
      if (unit.type === 'boat') continue;

      // Check if unit needs naval transport
      const navalOpp = this.findNavalOpportunity(unit);
      if (!navalOpp) continue;

      const { boat, embarkPoint, disembarkPoint, priority } = navalOpp;
      const unitOnBoat = this.isUnitOnBoat(unit);

      if (unitOnBoat) {
        const distToDisembark = hexDistance(unit.coordinate, disembarkPoint);

        if (distToDisembark <= 1) {
          decisions.push({
            type: 'MOVE_UNIT',
            unitId: unit.id,
            targetCoordinate: disembarkPoint,
            priority: priority + 20
          });
          this.reservedUnits.add(unit.id);
        } else {
          const sailTarget = this.findSailPosition(unit.coordinate, disembarkPoint);
          if (sailTarget) {
            decisions.push({
              type: 'MOVE_UNIT',
              unitId: unit.id,
              targetCoordinate: sailTarget,
              priority: priority + 10
            });
            this.reservedUnits.add(unit.id);
          }
        }
      } else {
        const distToEmbark = hexDistance(unit.coordinate, embarkPoint);

        if (distToEmbark <= 1 && boat) {
          decisions.push({
            type: 'MOVE_UNIT',
            unitId: unit.id,
            targetCoordinate: boat.coordinate,
            priority: priority + 15
          });
          this.reservedUnits.add(unit.id);
        } else if (canUnitReachCoordinate(unit, embarkPoint, this.gameState)) {
          const nextStep = this.getNextStepTowards(unit, embarkPoint);
          if (nextStep) {
            decisions.push({
              type: 'MOVE_UNIT',
              unitId: unit.id,
              targetCoordinate: nextStep,
              priority: priority
            });
            this.reservedUnits.add(unit.id);
          }
        }
      }
    }

    // Move idle boats towards units waiting to embark
    for (const boat of myBoats) {
      if (this.reservedUnits.has(boat.id)) continue;
      if (boat.remainingMovement <= 0) continue;

      const waitingUnits = this.findUnitsWaitingToEmbark();
      if (waitingUnits.length > 0) {
        const nearestWaiting = this.findNearestUnit(boat.coordinate, waitingUnits);
        if (nearestWaiting) {
          const pickupPoint = this.findWaterTileNear(nearestWaiting.coordinate);
          if (pickupPoint) {
            const nextStep = this.findSailPosition(boat.coordinate, pickupPoint);
            if (nextStep) {
              decisions.push({
                type: 'MOVE_UNIT',
                unitId: boat.id,
                targetCoordinate: nextStep,
                priority: 55
              });
              this.reservedUnits.add(boat.id);
            }
          }
        }
      }
    }

    return decisions;
  }

  /**
   * Find if unit has a naval opportunity (target across water)
   */
  private findNavalOpportunity(unit: Unit): {
    boat: Unit | null;
    embarkPoint: HexCoordinate;
    disembarkPoint: HexCoordinate;
    priority: number;
  } | null {
    // Check if any tactical targets are across water
    const targets = this.tacticalEngine.findTacticalTargets(unit);

    for (const target of targets) {
      if (!this.requiresWaterCrossing(unit.coordinate, target.coordinate)) continue;

      // This target requires water crossing
      const embarkPoint = this.findNearestCoastTile(unit.coordinate);
      const disembarkPoint = this.findNearestCoastTile(target.coordinate);

      if (!embarkPoint || !disembarkPoint) continue;

      const boat = this.findAvailableBoat(embarkPoint);

      return {
        boat,
        embarkPoint,
        disembarkPoint,
        priority: target.priority * 0.8 // Slight discount for complexity
      };
    }

    return null;
  }

  /**
   * Check if path between two points requires crossing water
   */
  private requiresWaterCrossing(from: HexCoordinate, to: HexCoordinate): boolean {
    // Simple check: if direct path crosses water tiles
    const distance = hexDistance(from, to);
    if (distance <= 1) return false; // Adjacent tiles don't require crossing

    // Check tiles along rough path
    const steps = Math.max(1, Math.floor(distance / 2));
    for (let i = 1; i < steps; i++) {
      const ratio = i / steps;
      const checkQ = Math.round(from.q + (to.q - from.q) * ratio);
      const checkR = Math.round(from.r + (to.r - from.r) * ratio);

      const tile = this.gameState.map.tiles.find(t =>
        t.coordinate.q === checkQ && t.coordinate.r === checkR
      );

      if (tile && tile.terrain === 'water') {
        return true;
      }
    }

    return false;
  }

  /**
   * Find nearest coast tile from a position
   */
  private findNearestCoastTile(from: HexCoordinate): HexCoordinate | null {
    let nearestCoast: HexCoordinate | null = null;
    let nearestDist = Infinity;

    for (const tile of this.gameState.map.tiles) {
      if (tile.terrain === 'water') continue; // Must be land

      // Check if adjacent to water
      const neighbors = hexNeighbors(tile.coordinate);
      const adjacentToWater = neighbors.some(n => {
        const neighborTile = this.gameState.map.tiles.find(t =>
          t.coordinate.q === n.q && t.coordinate.r === n.r
        );
        return neighborTile && neighborTile.terrain === 'water';
      });

      if (adjacentToWater) {
        const dist = hexDistance(from, tile.coordinate);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCoast = tile.coordinate;
        }
      }
    }

    return nearestCoast;
  }

  /**
   * Find available boat near an embark point
   */
  private findAvailableBoat(nearPoint: HexCoordinate): Unit | null {
    const myBoats = this.getMyUnits().filter(u => u.type === 'boat');

    let nearestBoat: Unit | null = null;
    let nearestDist = Infinity;

    for (const boat of myBoats) {
      if (this.reservedUnits.has(boat.id)) continue;

      const dist = hexDistance(nearPoint, boat.coordinate);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBoat = boat;
      }
    }

    return nearestBoat;
  }

  /**
   * Check if unit is currently on a boat (on water tile)
   */
  private isUnitOnBoat(unit: Unit): boolean {
    const tile = this.gameState.map.tiles.find(t =>
      t.coordinate.q === unit.coordinate.q && t.coordinate.r === unit.coordinate.r
    );
    return tile !== undefined && tile.terrain === 'water';
  }

  /**
   * Find next sail position towards destination
   */
  private findSailPosition(from: HexCoordinate, to: HexCoordinate): HexCoordinate | null {
    const neighbors = hexNeighbors(from);
    let best: HexCoordinate | null = null;
    let bestDist = Infinity;

    for (const neighbor of neighbors) {
      const tile = this.gameState.map.tiles.find(t =>
        t.coordinate.q === neighbor.q && t.coordinate.r === neighbor.r
      );

      // Allow sailing on water or moving to coast (disembark)
      if (tile && (tile.terrain === 'water' || this.isCoastTile(tile.coordinate))) {
        const dist = hexDistance(neighbor, to);
        if (dist < bestDist) {
          bestDist = dist;
          best = neighbor;
        }
      }
    }

    return best;
  }

  /**
   * Check if tile is a coast tile (land adjacent to water)
   */
  private isCoastTile(coord: HexCoordinate): boolean {
    const tile = this.gameState.map.tiles.find(t =>
      t.coordinate.q === coord.q && t.coordinate.r === coord.r
    );

    if (!tile || tile.terrain === 'water') return false;

    const neighbors = hexNeighbors(coord);
    return neighbors.some(n => {
      const neighborTile = this.gameState.map.tiles.find(t =>
        t.coordinate.q === n.q && t.coordinate.r === n.r
      );
      return neighborTile && neighborTile.terrain === 'water';
    });
  }

  /**
   * Find units waiting to embark (near coast, have cross-water targets)
   */
  private findUnitsWaitingToEmbark(): Unit[] {
    const myUnits = this.getMyUnits();

    return myUnits.filter(unit => {
      if (unit.type === 'boat') return false;
      if (this.isUnitOnBoat(unit)) return false;

      // Check if near coast
      return this.isCoastTile(unit.coordinate);
    });
  }

  /**
   * Find water tile near a land coordinate
   */
  private findWaterTileNear(coord: HexCoordinate): HexCoordinate | null {
    const neighbors = hexNeighbors(coord);

    for (const neighbor of neighbors) {
      const tile = this.gameState.map.tiles.find(t =>
        t.coordinate.q === neighbor.q && t.coordinate.r === neighbor.r
      );

      if (tile && tile.terrain === 'water') {
        return neighbor;
      }
    }

    return null;
  }

}

/**
 * Factory function to create AI engine for a player
 */
export function createAIEngine(gameState: GameState, aiPlayer: PlayerState): AIEngine {
  return new AIEngine(gameState, aiPlayer);
}

/**
 * Execute AI decisions for a player's turn
 */
export function executeAITurn(gameState: GameState, aiPlayer: PlayerState): AIDecision[] {
  const aiEngine = createAIEngine(gameState, aiPlayer);
  return aiEngine.makeDecision();
}
