/**
 * AI Tactical Engine - Advanced Decision Making for AAA Quality
 * Provides influence maps, threat assessment, and sophisticated target selection
 */

import { GameState, PlayerState } from '../types/game';
import { Unit } from '../types/unit';
import { City } from '../types/city';
import { HexCoordinate } from '../types/coordinates';
import { hexDistance, hexNeighbors } from '../utils/hex';
import { getUnitDefinition } from '../data/units';
import { SeededRNG } from './aiFoundation';

export interface InfluenceMap {
  // Positive values = friendly influence, negative = enemy influence
  influences: Map<string, number>;
  maxInfluence: number;
  minInfluence: number;
}

export interface ThreatAssessment {
  coordinate: HexCoordinate;
  threatLevel: number; // 0-1, higher = more dangerous
  sources: Array<{
    unitId: string;
    distance: number;
    damage: number;
  }>;
  isLethal: boolean;
}

export interface TacticalTarget {
  coordinate: HexCoordinate;
  targetType: 'unit' | 'city' | 'resource' | 'choke_point' | 'exploration';
  priority: number;
  reasoning: string;
  unitId?: string;
  cityId?: string;
}

/**
 * Advanced tactical decision-making engine
 */
export class TacticalEngine {
  private gameState: GameState;
  private aiPlayer: PlayerState;
  private rng: SeededRNG;

  constructor(gameState: GameState, aiPlayer: PlayerState, seed: number) {
    this.gameState = gameState;
    this.aiPlayer = aiPlayer;
    this.rng = new SeededRNG(seed);
  }

  /**
   * Generate influence map showing territorial control
   */
  generateInfluenceMap(): InfluenceMap {
    const influences = new Map<string, number>();
    let maxInfluence = 0;
    let minInfluence = 0;

    // Calculate influence for each tile
    for (const tile of this.gameState.map.tiles) {
      const coord = tile.coordinate;
      const key = `${coord.q},${coord.r}`;
      let totalInfluence = 0;

      // Unit influence
      for (const unit of this.gameState.units) {
        const distance = hexDistance(coord, unit.coordinate);
        const unitDef = getUnitDefinition(unit.type);
        const range = Math.max(unitDef.baseStats.attackRange || 1, 3);
        
        if (distance <= range) {
          const influence = this.calculateUnitInfluence(unit, distance);
          if (unit.playerId === this.aiPlayer.id) {
            totalInfluence += influence;
          } else {
            totalInfluence -= influence;
          }
        }
      }

      // City influence
      for (const city of this.gameState.cities) {
        const distance = hexDistance(coord, city.coordinate);
        if (distance <= 4) { // Cities have 4-tile influence radius
          const influence = this.calculateCityInfluence(city, distance);
          if (city.ownerId === this.aiPlayer.id) {
            totalInfluence += influence;
          } else {
            totalInfluence -= influence;
          }
        }
      }

      influences.set(key, totalInfluence);
      maxInfluence = Math.max(maxInfluence, totalInfluence);
      minInfluence = Math.min(minInfluence, totalInfluence);
    }

    return { influences, maxInfluence, minInfluence };
  }

  /**
   * Assess threats to a specific coordinate
   */
  assessThreat(coordinate: HexCoordinate): ThreatAssessment {
    const sources: ThreatAssessment['sources'] = [];
    let totalThreat = 0;
    let maxDamage = 0;

    // Check enemy units that can attack this position
    const enemyUnits = this.gameState.units.filter(u => u.playerId !== this.aiPlayer.id);
    
    for (const enemy of enemyUnits) {
      const distance = hexDistance(coordinate, enemy.coordinate);
      const unitDef = getUnitDefinition(enemy.type);
      const attackRange = unitDef.baseStats.attackRange || 1;
      const movementRange = enemy.remainingMovement || unitDef.baseStats.movement;
      
      // Can this unit threaten this position this turn or next?
      const canReach = distance <= attackRange + movementRange;
      
      if (canReach) {
        const damage = this.estimateDamage(enemy, coordinate);
        const threat = damage / Math.max(1, distance);
        
        sources.push({
          unitId: enemy.id,
          distance,
          damage
        });
        
        totalThreat += threat;
        maxDamage += damage;
      }
    }

    const threatLevel = Math.min(1, totalThreat / 50); // Normalize to 0-1
    const isLethal = maxDamage >= 80; // Lethal if could deal 80+ damage

    return {
      coordinate,
      threatLevel,
      sources,
      isLethal
    };
  }

  /**
   * Find best tactical targets for units
   */
  findTacticalTargets(unit: Unit): TacticalTarget[] {
    const targets: TacticalTarget[] = [];
    const unitDef = getUnitDefinition(unit.type);
    const attackRange = unitDef.baseStats.attackRange || 1;
    const maxRange = unit.remainingMovement + attackRange;

    // 1. Enemy units within range
    const enemyUnits = this.gameState.units.filter(u => 
      u.playerId !== this.aiPlayer.id && 
      hexDistance(unit.coordinate, u.coordinate) <= maxRange
    );

    for (const enemy of enemyUnits) {
      const distance = hexDistance(unit.coordinate, enemy.coordinate);
      const priority = this.calculateTargetPriority(unit, enemy);
      
      targets.push({
        coordinate: enemy.coordinate,
        targetType: 'unit',
        priority,
        reasoning: `Attack ${enemy.type} (${priority.toFixed(1)} priority)`,
        unitId: enemy.id
      });
    }

    // 2. Enemy cities within range
    const enemyCities = this.gameState.cities.filter(c => 
      c.ownerId !== this.aiPlayer.id && 
      hexDistance(unit.coordinate, c.coordinate) <= maxRange
    );

    for (const city of enemyCities) {
      const distance = hexDistance(unit.coordinate, city.coordinate);
      const priority = this.calculateCityTargetPriority(unit, city, distance);
      
      targets.push({
        coordinate: city.coordinate,
        targetType: 'city',
        priority,
        reasoning: `Attack city (${priority.toFixed(1)} priority)`,
        cityId: city.id
      });
    }

    // 3. Strategic positions (choke points, resources)
    targets.push(...this.findStrategicPositions(unit));

    // 4. Exploration targets
    targets.push(...this.findExplorationTargets(unit));

    return targets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate unit formation bonuses
   */
  calculateFormationBonus(unit: Unit): number {
    const neighbors = hexNeighbors(unit.coordinate);
    let friendlyNeighbors = 0;
    let totalStrength = 0;

    for (const neighbor of neighbors) {
      const adjacentUnit = this.gameState.units.find(u => 
        u.coordinate.q === neighbor.q && 
        u.coordinate.r === neighbor.r && 
        u.playerId === unit.playerId
      );
      
      if (adjacentUnit) {
        friendlyNeighbors++;
        const unitDef = getUnitDefinition(adjacentUnit.type);
        totalStrength += unitDef.baseStats.attack + unitDef.baseStats.defense;
      }
    }

    // Formation bonus: 10% per adjacent friendly, max 30%
    const formationBonus = Math.min(0.3, friendlyNeighbors * 0.1);
    
    // Strength bonus: Additional bonus based on combined strength
    const strengthBonus = Math.min(0.2, totalStrength / 100);
    
    return formationBonus + strengthBonus;
  }

  /**
   * Find safe retreat positions for damaged units
   */
  findRetreatPositions(unit: Unit): HexCoordinate[] {
    const retreatPositions: Array<{ coord: HexCoordinate; safety: number }> = [];
    const maxDistance = unit.remainingMovement;

    // Check all positions within movement range
    for (let q = unit.coordinate.q - maxDistance; q <= unit.coordinate.q + maxDistance; q++) {
      for (let r = unit.coordinate.r - maxDistance; r <= unit.coordinate.r + maxDistance; r++) {
        const s = -q - r;
        const coord = { q, r, s };
        const distance = hexDistance(unit.coordinate, coord);
        
        if (distance <= maxDistance && distance > 0) {
          const tile = this.gameState.map.tiles.find(t => 
            t.coordinate.q === q && t.coordinate.r === r
          );
          
          if (tile && this.isPassable(tile)) {
            const threat = this.assessThreat(coord);
            const safetyScore = this.calculateSafetyScore(coord, unit);
            
            retreatPositions.push({
              coord,
              safety: safetyScore - threat.threatLevel
            });
          }
        }
      }
    }

    return retreatPositions
      .sort((a, b) => b.safety - a.safety)
      .slice(0, 5)
      .map(p => p.coord);
  }

  /**
   * Calculate escort priorities for workers/settlers
   */
  calculateEscortPriority(worker: Unit): number {
    const threat = this.assessThreat(worker.coordinate);
    const importance = this.calculateUnitImportance(worker);
    
    // Higher priority if worker is threatened and important
    return threat.threatLevel * importance;
  }

  // Private helper methods

  private calculateUnitInfluence(unit: Unit, distance: number): number {
    const unitDef = getUnitDefinition(unit.type);
    const baseInfluence = unitDef.baseStats.attack + unitDef.baseStats.defense;
    const distanceDecay = Math.max(0, 1 - distance / 5);
    return baseInfluence * distanceDecay;
  }

  private calculateCityInfluence(city: City, distance: number): number {
    const baseInfluence = 30; // Cities are strong influence sources
    const distanceDecay = Math.max(0, 1 - distance / 6);
    return baseInfluence * distanceDecay;
  }

  private estimateDamage(attacker: Unit, targetCoord: HexCoordinate): number {
    const attackerDef = getUnitDefinition(attacker.type);
    const baseDamage = attackerDef.baseStats.attack;
    
    // Add terrain and formation modifiers
    const formationBonus = this.calculateFormationBonus(attacker);
    const terrainBonus = this.getTerrainBonus(attacker.coordinate);
    
    return baseDamage * (1 + formationBonus + terrainBonus);
  }

  private calculateTargetPriority(attacker: Unit, target: Unit): number {
    const targetDef = getUnitDefinition(target.type);
    const attackerDef = getUnitDefinition(attacker.type);
    
    // Base priority from target value
    let priority = targetDef.baseStats.attack + targetDef.baseStats.defense;
    
    // Bonus for soft targets
    if (targetDef.baseStats.defense < 20) {
      priority *= 1.5;
    }
    
    // Bonus for damaged enemies
    if (target.hp < target.maxHp * 0.5) {
      priority *= 2;
    }
    
    // Range consideration
    const distance = hexDistance(attacker.coordinate, target.coordinate);
    const rangeBonus = distance <= 1 ? 1.3 : 1.0;
    
    return priority * rangeBonus;
  }

  private calculateCityTargetPriority(attacker: Unit, city: City, distance: number): number {
    let priority = 100; // Cities are high value
    
    // Distance penalty
    priority *= Math.max(0.3, 1 - distance / 10);
    
    // Size bonus
    priority *= (1 + city.population * 0.1);
    
    return priority;
  }

  private findStrategicPositions(unit: Unit): TacticalTarget[] {
    const targets: TacticalTarget[] = [];
    
    // Look for choke points (mountains/forests near water)
    // Look for resource tiles
    // Look for defensive positions
    
    return targets;
  }

  private findExplorationTargets(unit: Unit): TacticalTarget[] {
    const targets: TacticalTarget[] = [];
    const maxRange = unit.remainingMovement;
    
    // Find unexplored tiles within range
    for (const tile of this.gameState.map.tiles) {
      if (!tile.exploredBy.includes(this.aiPlayer.id)) {
        const distance = hexDistance(unit.coordinate, tile.coordinate);
        
        if (distance <= maxRange) {
          const priority = this.calculateExplorationPriority(tile, distance);
          
          targets.push({
            coordinate: tile.coordinate,
            targetType: 'exploration',
            priority,
            reasoning: `Explore unknown territory`
          });
        }
      }
    }
    
    return targets.slice(0, 3); // Limit exploration targets
  }

  private calculateSafetyScore(coord: HexCoordinate, unit: Unit): number {
    // Higher score = safer position
    let safety = 0;
    
    // Distance from friendly units/cities
    const friendlyUnits = this.gameState.units.filter(u => u.playerId === this.aiPlayer.id);
    const nearestFriendly = Math.min(...friendlyUnits.map(u => hexDistance(coord, u.coordinate)));
    safety += Math.max(0, 5 - nearestFriendly) * 10;
    
    // Terrain bonuses
    const tile = this.gameState.map.tiles.find(t => 
      t.coordinate.q === coord.q && t.coordinate.r === coord.r
    );
    
    if (tile) {
      if (tile.terrain === 'forest' || tile.terrain === 'mountain') {
        safety += 20; // Defensive terrain
      }
    }
    
    return safety;
  }

  private calculateUnitImportance(unit: Unit): number {
    const unitDef = getUnitDefinition(unit.type);
    
    // Workers and settlers are very important
    if (unit.type === 'worker') {
      return 1.0;
    }
    
    // Combat units less important for escort
    return 0.3;
  }

  private calculateExplorationPriority(tile: any, distance: number): number {
    let priority = 50 - distance * 5; // Closer is better
    
    // Bonus for potential resources
    if (tile.resources && tile.resources.length > 0) {
      priority += 30;
    }
    
    // Bonus for being near water (exploration value)
    if (tile.terrain === 'water') {
      priority += 15;
    }
    
    return Math.max(0, priority);
  }

  private isPassable(tile: any): boolean {
    return tile.terrain !== 'water' && tile.terrain !== 'mountain';
  }

  private getTerrainBonus(coord: HexCoordinate): number {
    const tile = this.gameState.map.tiles.find(t => 
      t.coordinate.q === coord.q && t.coordinate.r === coord.r
    );
    
    if (!tile) return 0;
    
    switch (tile.terrain) {
      case 'mountain': return 0.3;
      case 'forest': return 0.2;
      case 'plains': return 0.1;
      default: return 0;
    }
  }
}