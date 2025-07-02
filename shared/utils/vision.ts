import type { HexCoordinate } from '../types/game';
import type { Unit } from '../types/unit';

/**
 * Calculate if a target coordinate is within vision range of any friendly unit
 */
export function isInCurrentVision(
  targetCoordinate: HexCoordinate,
  friendlyUnits: Unit[],
  visionRadius: number = 2
): boolean {
  return friendlyUnits.some(unit => {
    const distance = Math.max(
      Math.abs(targetCoordinate.q - unit.coordinate.q),
      Math.abs(targetCoordinate.r - unit.coordinate.r),
      Math.abs(targetCoordinate.s - unit.coordinate.s)
    );
    
    return distance <= visionRadius;
  });
}

/**
 * Get all coordinates currently visible to a player's units
 */
export function getCurrentVisionMask(
  units: Unit[],
  playerId: string,
  visionRadius: number = 2
): string[] {
  const visibleTiles: string[] = [];
  const playerUnits = units.filter(unit => unit.playerId === playerId);
  
  playerUnits.forEach(unit => {
    // Add all tiles within vision radius of this unit
    for (let q = unit.coordinate.q - visionRadius; q <= unit.coordinate.q + visionRadius; q++) {
      for (let r = unit.coordinate.r - visionRadius; r <= unit.coordinate.r + visionRadius; r++) {
        const s = -q - r;
        const distance = Math.max(
          Math.abs(q - unit.coordinate.q),
          Math.abs(r - unit.coordinate.r),
          Math.abs(s - unit.coordinate.s)
        );
        
        if (distance <= visionRadius) {
          visibleTiles.push(`${q},${r}`);
        }
      }
    }
  });
  
  return Array.from(new Set(visibleTiles)); // Remove duplicates
}

/**
 * Check if an enemy unit is currently visible to the player
 */
export function isEnemyUnitVisible(
  enemyUnit: Unit,
  playerUnits: Unit[],
  visionRadius: number = 2
): boolean {
  return isInCurrentVision(enemyUnit.coordinate, playerUnits, visionRadius);
}