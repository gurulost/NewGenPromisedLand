import type { HexCoordinate } from '../types/coordinates';
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
 * Get vision radius for a specific unit (fully data-driven)
 */
export function getUnitVisionRadius(unit: Unit): number {
  // Get vision radius from unit definition - no hardcoded values
  return unit.visionRadius;
}

/**
 * Get all coordinates currently visible to a player's units
 */
export function getCurrentVisionMask(
  units: Unit[],
  playerId: string,
  defaultVisionRadius: number = 2
): string[] {
  const visibleTiles: string[] = [];
  const playerUnits = units.filter(unit => unit.playerId === playerId);
  
  playerUnits.forEach(unit => {
    const unitVisionRadius = getUnitVisionRadius(unit);
    
    // Add all tiles within vision radius of this unit
    for (let q = unit.coordinate.q - unitVisionRadius; q <= unit.coordinate.q + unitVisionRadius; q++) {
      for (let r = unit.coordinate.r - unitVisionRadius; r <= unit.coordinate.r + unitVisionRadius; r++) {
        const s = -q - r;
        const distance = Math.max(
          Math.abs(q - unit.coordinate.q),
          Math.abs(r - unit.coordinate.r),
          Math.abs(s - unit.coordinate.s)
        );
        
        if (distance <= unitVisionRadius) {
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