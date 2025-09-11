import { GameState, PlayerState } from '../types/game';
import { Unit, UnitType } from '../types/unit';
import { HexCoordinate } from '../types/coordinates';
import { hexDistance, hexNeighbors } from '../utils/hex';
import { getUnitDefinition } from '../data/units';
import { TECHNOLOGIES } from '../data/technologies';
import { GAME_RULES } from '../data/gameRules';
import { getFaction } from '../data/factions';
import { TacticalEngine, TacticalTarget } from './aiTacticalEngine';
import { FactionPersonalityEngine } from './aiFactionPersonality';
import { SeededRNG, aiDebugOverlay } from './aiFoundation';

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
  private tacticalEngine: TacticalEngine;
  private personalityEngine: FactionPersonalityEngine;
  private rng: SeededRNG;

  constructor(gameState: GameState, aiPlayer: PlayerState) {
    this.gameState = gameState;
    this.aiPlayer = aiPlayer;
    this.difficulty = aiPlayer.aiDifficulty || 'normal';
    
    // Initialize advanced AI systems
    const seed = this.generateSeed();
    this.tacticalEngine = new TacticalEngine(gameState, aiPlayer, seed);
    this.personalityEngine = new FactionPersonalityEngine(aiPlayer, seed);
    this.rng = new SeededRNG(seed);
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
    
    // Generate influence map for tactical awareness
    const influenceMap = this.tacticalEngine.generateInfluenceMap();
    
    // 1. Enhanced combat evaluation with tactical engine
    decisions.push(...this.evaluateAdvancedCombat());
    
    // 2. Intelligent movement with threat assessment
    decisions.push(...this.evaluateIntelligentMovement());
    
    // 3. Personality-driven technology research
    decisions.push(...this.evaluatePersonalityTechResearch());
    
    // 4. Faction-specific city building
    decisions.push(...this.evaluateFactionCityBuilding());
    
    // 5. Advanced unit abilities usage
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

  // Enhanced AI methods using tactical engine and personality

  /**
   * Enhanced combat evaluation using tactical engine
   */
  private evaluateAdvancedCombat(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myUnits = this.getMyUnits();

    for (const unit of myUnits) {
      if (unit.remainingMovement <= 0) continue;

      // Get tactical targets from advanced engine
      const targets = this.tacticalEngine.findTacticalTargets(unit);
      
      for (const target of targets.slice(0, 3)) { // Top 3 targets per unit
        if (target.targetType === 'unit' && target.unitId) {
          // Check if we should attack based on personality
          const advantage = this.calculateCombatAdvantage(unit, target);
          const riskLevel = this.assessCombatRisk(unit, target);
          
          if (this.personalityEngine.shouldAttack(advantage, riskLevel)) {
            decisions.push({
              type: 'ATTACK_UNIT',
              unitId: unit.id,
              targetId: target.unitId,
              priority: target.priority * this.personalityEngine.getDecisionModifier('attack'),
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
    }

    return decisions;
  }

  /**
   * Personality-driven technology research
   */
  private evaluatePersonalityTechResearch(): AIDecision[] {
    const decisions: AIDecision[] = [];
    
    if (this.aiPlayer.currentResearch) {
      return decisions; // Already researching
    }

    const availableTechs = this.getAvailableTechnologies();
    
    for (const tech of availableTechs) {
      let priority = this.calculateTechValue(tech);
      
      // Apply personality modifiers
      if (tech.category === 'faith' || tech.category === 'religious') {
        priority *= (1 + this.personalityEngine.getDecisionModifier('tech_faith'));
      }
      
      if (tech.category === 'military' || tech.category === 'warfare') {
        priority *= (1 + this.personalityEngine.getDecisionModifier('tech_military'));
      }
      
      // Faction-specific tech priorities
      const factionBonus = this.personalityEngine.getPersonality().techPriorities.includes(tech.id) ? 1.5 : 1.0;
      priority *= factionBonus;
      
      if (priority > 30 && this.aiPlayer.stars >= tech.cost) {
        decisions.push({
          type: 'RESEARCH_TECH',
          techId: tech.id,
          priority: priority,
        });
      }
    }

    return decisions;
  }

  /**
   * Faction-specific city building
   */
  private evaluateFactionCityBuilding(): AIDecision[] {
    const decisions: AIDecision[] = [];
    const myCities = this.getMyCities();

    for (const city of myCities) {
      if (city.currentProduction) continue; // Already building

      const availableBuildings = this.getAvailableBuildings(city.id);
      
      for (const building of availableBuildings) {
        let priority = this.calculateBuildingValue(building, city);
        
        // Apply personality-based building preferences
        const personalityBonus = this.personalityEngine.getBuildingPriority(building.type);
        priority *= (1 + personalityBonus);
        
        if (priority > 25 && this.canAffordBuilding(building)) {
          decisions.push({
            type: 'BUILD_STRUCTURE',
            buildingType: building.type,
            cityId: city.id,
            priority: priority,
          });
        }
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
      const availableAbilities = this.getAvailableAbilities(unit);
      
      for (const ability of availableAbilities) {
        const priority = this.calculateAbilityPriority(unit, ability);
        
        if (priority > 40) {
          decisions.push({
            type: 'USE_ABILITY',
            unitId: unit.id,
            abilityId: ability.id,
            priority: priority,
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
    // Calculate recent events for mood update
    // Track recent victories from game history (placeholder for future game history feature)
    const recentVictories = 0; // TODO: Implement when GameState includes gameHistory and currentTurn
    const recentDefeats = 0;
    const territoryLost = 0;
    const faithGained = this.aiPlayer.stats.faith;
    const enemyThreat = this.assessEnemyThreat();

    this.personalityEngine.updateMood({
      recentVictories,
      recentDefeats,
      territoryLost,
      faithGained,
      enemyThreat
    });
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

  private calculateCombatAdvantage(attacker: Unit, target: TacticalTarget): number {
    // Simplified advantage calculation
    return this.rng.nextFloat(0.3, 0.8);
  }

  private assessCombatRisk(attacker: Unit, target: TacticalTarget): number {
    // Simplified risk assessment
    return this.rng.nextFloat(0.2, 0.7);
  }

  private calculateUnitAdvantage(unit: Unit): number {
    // Calculate local military advantage
    return this.rng.nextFloat(-0.5, 0.5);
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
    return `Pursuing ${personality.preferredVictory} victory`;
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

  private calculateAbilityPriority(unit: Unit, ability: any): number {
    // Simplified ability priority calculation
    return this.rng.nextFloat(20, 60);
  }

  private getAvailableAbilities(unit: Unit): any[] {
    // Get unit abilities from definition
    const unitDef = getUnitDefinition(unit.type);
    const abilities = unitDef.abilities || [];
    
    // Filter abilities based on unit state and game conditions
    return abilities.filter(ability => {
      // Check if unit can use this ability (has movement, not on cooldown, etc.)
      if (ability === 'heal' && unit.hp >= unit.maxHp) return false;
      if (ability === 'build_village' && unit.type !== 'worker') return false;
      if (ability === 'fortify' && unit.remainingMovement <= 0) return false;
      return true;
    }).map(ability => ({ name: ability, cost: 0, available: true }));
  }

  private canAffordBuilding(building: any): boolean {
    return this.aiPlayer.stars >= (building.cost || 50);
  }

  private getAvailableBuildings(cityId: string): any[] {
    const availableBuildings = [];
    const city = this.getMyCities().find(c => c.id === cityId);
    if (!city) return [];
    
    // Define basic building types with requirements
    const buildingTypes = [
      { type: 'temple', cost: 20, requiredTech: 'prayer', category: 'religious' },
      { type: 'barracks', cost: 15, requiredTech: 'warrior_code', category: 'military' },
      { type: 'market', cost: 25, requiredTech: 'trade', category: 'economic' },
      { type: 'granary', cost: 18, requiredTech: 'farming', category: 'economic' },
      { type: 'forge', cost: 30, requiredTech: 'metalworking', category: 'military' },
      { type: 'observatory', cost: 35, requiredTech: 'astronomy', category: 'exploration' }
    ];
    
    for (const building of buildingTypes) {
      // Check if player has required tech and resources
      const hasReqTech = !building.requiredTech || this.aiPlayer.researchedTechs.includes(building.requiredTech);
      const hasResources = this.aiPlayer.stars >= building.cost;
      const notAlreadyBuilt = !city.structures || !city.structures.includes(building.type);
      
      if (hasReqTech && hasResources && notAlreadyBuilt) {
        availableBuildings.push(building);
      }
    }
    
    return availableBuildings;
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

  private calculateBuildingValue(building: any, city: any): number {
    // Base building value calculation
    let value = 40;
    
    // Bonus for faction preferences
    const personality = this.personalityEngine.getPersonality();
    if (personality.buildingPriorities.includes(building.type)) {
      value += 25;
    }
    
    // Bonus based on city needs
    if (city.population > 5 && building.type === 'granary') {
      value += 20;
    }
    
    return value;
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