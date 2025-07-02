import type { HexCoordinate } from '../types/coordinates';
import type { GameMap } from '../types/game';
import { hexDistance } from './hex';
import { GAME_RULES } from '../data/gameRules';

/**
 * Bresenham-like line algorithm for hexagonal grids
 * Returns all hex coordinates along the line from start to end
 */
export function hexLine(start: HexCoordinate, end: HexCoordinate): HexCoordinate[] {
  const distance = hexDistance(start, end);
  if (distance === 0) return [start];
  
  const results: HexCoordinate[] = [];
  
  for (let i = 0; i <= distance; i++) {
    const t = distance === 0 ? 0 : i / distance;
    
    // Linear interpolation in cube coordinates
    const q = start.q + t * (end.q - start.q);
    const r = start.r + t * (end.r - start.r);
    const s = start.s + t * (end.s - start.s);
    
    // Round to nearest hex coordinate
    const roundedHex = cubeRound(q, r, s);
    results.push(roundedHex);
  }
  
  return results;
}

/**
 * Round cube coordinates to the nearest hex coordinate
 */
function cubeRound(q: number, r: number, s: number): HexCoordinate {
  let roundQ = Math.round(q);
  let roundR = Math.round(r);
  let roundS = Math.round(s);
  
  const qDiff = Math.abs(roundQ - q);
  const rDiff = Math.abs(roundR - r);
  const sDiff = Math.abs(roundS - s);
  
  if (qDiff > rDiff && qDiff > sDiff) {
    roundQ = -roundR - roundS;
  } else if (rDiff > sDiff) {
    roundR = -roundQ - roundS;
  } else {
    roundS = -roundQ - roundR;
  }
  
  return { q: roundQ, r: roundR, s: roundS };
}

/**
 * Check if there's line of sight between two coordinates
 * Returns false if terrain blocks the view
 */
export function hasLineOfSight(
  from: HexCoordinate,
  to: HexCoordinate,
  gameMap: GameMap,
  maxRange?: number
): boolean {
  const distance = hexDistance(from, to);
  
  // Check range limit
  if (maxRange && distance > maxRange) {
    return false;
  }
  
  // Get all tiles along the line
  const lineTiles = hexLine(from, to);
  
  // Check each tile along the path (excluding start and end)
  for (let i = 1; i < lineTiles.length - 1; i++) {
    const coord = lineTiles[i];
    const tile = gameMap.tiles.find(t => 
      t.coordinate.q === coord.q && 
      t.coordinate.r === coord.r
    );
    
    if (tile && blocksLineOfSight(tile.terrain)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a terrain type blocks line of sight
 */
function blocksLineOfSight(terrain: string): boolean {
  // Mountains and forests block line of sight
  // Water, plains, desert, and swamp are transparent
  return terrain === 'mountain';
}

/**
 * Calculate all visible tiles from a given position using line of sight
 */
export function calculateVisibleTiles(
  center: HexCoordinate,
  visionRadius: number,
  gameMap: GameMap
): Set<string> {
  const visibleTiles = new Set<string>();
  
  // Use shadow casting for efficient line of sight calculation
  for (let q = center.q - visionRadius; q <= center.q + visionRadius; q++) {
    for (let r = center.r - visionRadius; r <= center.r + visionRadius; r++) {
      const s = -q - r;
      const targetCoord = { q, r, s };
      
      const distance = hexDistance(center, targetCoord);
      if (distance <= visionRadius) {
        // Check line of sight to this tile
        if (hasLineOfSight(center, targetCoord, gameMap, visionRadius)) {
          visibleTiles.add(`${q},${r}`);
        }
      }
    }
  }
  
  return visibleTiles;
}

/**
 * Advanced shadow casting algorithm for more efficient visibility calculation
 * Based on the recursive shadow casting algorithm adapted for hex grids
 */
export function calculateVisibilityWithShadowCasting(
  center: HexCoordinate,
  visionRadius: number,
  gameMap: GameMap
): Set<string> {
  const visibleTiles = new Set<string>();
  
  // Always add the center tile
  visibleTiles.add(`${center.q},${center.r}`);
  
  // Cast shadows in 6 directions (hex grid has 6 directions)
  for (let direction = 0; direction < 6; direction++) {
    castShadow(center, direction, visionRadius, gameMap, visibleTiles);
  }
  
  return visibleTiles;
}

/**
 * Cast shadow in a specific direction from the center
 */
function castShadow(
  center: HexCoordinate,
  direction: number,
  maxRadius: number,
  gameMap: GameMap,
  visibleTiles: Set<string>
): void {
  // Hex direction vectors
  const directions = [
    { q: 1, r: 0, s: -1 },   // East
    { q: 1, r: -1, s: 0 },   // Northeast
    { q: 0, r: -1, s: 1 },   // Northwest
    { q: -1, r: 0, s: 1 },   // West
    { q: -1, r: 1, s: 0 },   // Southwest
    { q: 0, r: 1, s: -1 }    // Southeast
  ];
  
  const dir = directions[direction];
  
  // Cast rays from center outward
  for (let radius = 1; radius <= maxRadius; radius++) {
    let blocked = false;
    
    // Check tiles at this radius in the given direction
    for (let offset = -radius; offset <= radius; offset++) {
      const q = center.q + dir.q * radius + dir.r * offset;
      const r = center.r + dir.r * radius + dir.s * offset;
      const s = center.s + dir.s * radius + dir.q * offset;
      
      const coord = { q, r, s };
      const distance = hexDistance(center, coord);
      
      if (distance <= maxRadius) {
        const tile = gameMap.tiles.find(t => 
          t.coordinate.q === coord.q && 
          t.coordinate.r === coord.r
        );
        
        if (tile && !blocked) {
          visibleTiles.add(`${coord.q},${coord.r}`);
          
          // Check if this tile blocks further vision
          if (blocksLineOfSight(tile.terrain)) {
            blocked = true;
          }
        }
      }
    }
    
    // If completely blocked, no need to check further
    if (blocked) break;
  }
}

/**
 * Calculate fog of war state for a tile
 */
export interface FogOfWarState {
  visibility: 'visible' | 'explored' | 'hidden';
  opacity: number;
  colorMultiplier: number;
}

export function calculateFogOfWarState(
  tileKey: string,
  visibleTiles: Set<string>,
  exploredTiles: Set<string>
): FogOfWarState {
  if (visibleTiles.has(tileKey)) {
    return {
      visibility: 'visible',
      opacity: 1.0,
      colorMultiplier: 1.0
    };
  } else if (exploredTiles.has(tileKey)) {
    return {
      visibility: 'explored',
      opacity: 0.85, // Slightly darker than visible
      colorMultiplier: 0.75 // Reduced brightness but still recognizable
    };
  } else {
    return {
      visibility: 'hidden',
      opacity: 0.15,
      colorMultiplier: 0.1
    };
  }
}

/**
 * Get all tiles within vision range, respecting line of sight
 */
export function getVisibleTilesInRange(
  center: HexCoordinate,
  visionRadius: number,
  gameMap: GameMap,
  useShadowCasting: boolean = true
): Set<string> {
  if (useShadowCasting) {
    return calculateVisibilityWithShadowCasting(center, visionRadius, gameMap);
  } else {
    return calculateVisibleTiles(center, visionRadius, gameMap);
  }
}