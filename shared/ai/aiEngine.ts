import { GameState, PlayerState } from '../types/game';
import { Unit, UnitType } from '../types/unit';
import { HexCoordinate } from '../types/coordinates';
import { hexDistance, hexNeighbors } from '../utils/hex';
import { getUnitDefinition } from '../data/units';
import { TECHNOLOGIES } from '../data/technologies';
import { GAME_RULES } from '../data/gameRules';
import { getFaction } from '../data/factions';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIDecision {
  type: 'MOVE_UNIT' | 'ATTACK_UNIT' | 'RESEARCH_TECH' | 'BUILD_STRUCTURE' | 'END_TURN' | 'USE_ABILITY';
  unitId?: string;
  targetCoordinate?: HexCoordinate;
  targetId?: string;
  techId?: string;
  buildingType?: string;
  cityId?: string;
  abilityId?: string;
  priority: number; // Higher = more important
}

/**
 * Core AI Engine for Chronicles of the Promised Land
 * Provides strategic decision-making for AI players
 */
export class AIEngine {
  private difficulty: AIDifficulty;
  private gameState: GameState;
  private aiPlayer: PlayerState;

  constructor(gameState: GameState, aiPlayer: PlayerState) {
    this.gameState = gameState;
    this.aiPlayer = aiPlayer;
    this.difficulty = aiPlayer.aiDifficulty || 'normal';
  }

  /**
   * Main AI decision-making function
   * Returns the best action for the AI to take this turn
   */
  public makeDecision(): AIDecision[] {
    const decisions: AIDecision[] = [];
    
    // 1. Evaluate combat opportunities (highest priority)
    decisions.push(...this.evaluateCombatOptions());
    
    // 2. Evaluate unit movement for exploration/positioning
    decisions.push(...this.evaluateMovementOptions());
    
    // 3. Evaluate technology research
    decisions.push(...this.evaluateTechResearch());
    
    // 4. Evaluate city building and improvements
    decisions.push(...this.evaluateCityBuilding());
    
    // 5. Sort by priority and return top decisions
    return decisions.sort((a, b) => b.priority - a.priority).slice(0, 5);
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
          
          // Attack if we have good odds or if we're on hard difficulty
          if (combatOdds > 0.6 || (this.difficulty === 'hard' && combatOdds > 0.4)) {
            decisions.push({
              type: 'ATTACK_UNIT',
              unitId: unit.id,
              targetId: enemy.id,
              priority: 100 + combatOdds * 20 // Very high priority for favorable combat
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
    
    if (this.aiPlayer.currentResearch) {
      // Already researching something
      return decisions;
    }

    const availableTechs = Object.keys(TECHNOLOGIES).filter(techId => {
      const tech = TECHNOLOGIES[techId];
      return !this.aiPlayer.researchedTechs.includes(techId) &&
             tech.prerequisites.every(prereq => this.aiPlayer.researchedTechs.includes(prereq));
    });

    for (const techId of availableTechs) {
      const priority = this.evaluateTechPriority(techId);
      
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

  /**
   * Evaluate building options for a city
   */
  private evaluateBuildingOptions(cityId: string): AIDecision[] {
    const decisions: AIDecision[] = [];
    
    // This would evaluate what structures/improvements to build
    // For now, return basic structure building
    decisions.push({
      type: 'BUILD_STRUCTURE',
      cityId,
      buildingType: 'temple', // Basic structure
      priority: 35
    });

    return decisions;
  }

  // Helper methods for AI decision making

  private getMyUnits(): Unit[] {
    return this.gameState.units.filter(unit => unit.playerId === this.aiPlayer.id);
  }

  private getEnemyUnitsInRange(): Unit[] {
    return this.gameState.units.filter(unit => 
      unit.playerId !== this.aiPlayer.id && 
      this.aiPlayer.visibilityMask.includes(`${unit.coordinate.q},${unit.coordinate.r}`)
    );
  }

  private getMyCities() {
    return this.gameState.cities?.filter(city => city.ownerId === this.aiPlayer.id) || [];
  }

  private getReachableTiles(unit: Unit): HexCoordinate[] {
    const reachable: HexCoordinate[] = [];
    const maxDistance = unit.remainingMovement;
    
    // Simple pathfinding - check tiles within movement range
    for (let q = unit.coordinate.q - maxDistance; q <= unit.coordinate.q + maxDistance; q++) {
      for (let r = unit.coordinate.r - maxDistance; r <= unit.coordinate.r + maxDistance; r++) {
        const s = -q - r;
        const distance = hexDistance(unit.coordinate, { q, r, s });
        
        if (distance <= maxDistance && distance > 0) {
          const tile = this.gameState.map.tiles.find(t => 
            t.coordinate.q === q && t.coordinate.r === r
          );
          
          if (tile && tile.terrain !== 'water') { // Basic passability check
            reachable.push({ q, r, s });
          }
        }
      }
    }
    
    return reachable;
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