import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { getReachableTiles } from "./pathfinding";
import { GAME_RULES } from "../data/gameRules";

/**
 * Centralized unit logic functions to be shared between UI and game reducer
 */

/**
 * Determines if a coordinate is passable for unit movement
 */
export function isPassableForUnit(
  coordinate: HexCoordinate,
  gameState: GameState,
  unit?: Unit
): boolean {
  const tile = gameState.map.tiles.find(t => 
    t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r
  );
  
  if (!tile) return false;
  
  // Check basic terrain passability using game rules
  const movementCost = GAME_RULES.terrain.movementCosts[tile.terrain];
  const isImpassable = GAME_RULES.terrain.impassableTypes.includes(tile.terrain);
  
  if (isImpassable || movementCost === undefined) return false;
  
  // Check if tile is explored by the unit's player
  if (unit && !tile.exploredBy.includes(unit.playerId)) return false;
  
  // Additional unit-specific checks could be added here
  // (e.g., naval units can pass through water, flying units over mountains)
  
  return true;
}

/**
 * Calculates all tiles reachable by a unit within its movement range
 */
export function calculateReachableTiles(
  unit: Unit,
  gameState: GameState
): HexCoordinate[] {
  const isPassable = (coord: HexCoordinate): boolean => {
    return isPassableForUnit(coord, gameState, unit);
  };
  
  return getReachableTiles(
    unit.coordinate,
    unit.remainingMovement,
    isPassable
  );
}

/**
 * Determines if a unit can be selected by the current player
 */
export function canSelectUnit(
  unit: Unit,
  gameState: GameState
): boolean {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // Only allow selecting units that belong to the current player
  return currentPlayer?.id === unit.playerId;
}

/**
 * Gets the movement cost for a unit to move to a specific terrain type
 */
export function getMovementCostForTerrain(
  terrainType: string,
  unit?: Unit
): number {
  // Use centralized game rules for movement costs
  const baseCost = GAME_RULES.terrain.movementCosts[terrainType];
  
  if (baseCost === undefined) return Infinity; // Impassable
  
  // Unit-specific movement modifiers could be added here
  // (e.g., scouts move faster, naval units have different costs)
  
  return baseCost;
}

/**
 * Checks if a unit has enough movement to reach a target coordinate
 */
export function canUnitReachCoordinate(
  unit: Unit,
  targetCoordinate: HexCoordinate,
  gameState: GameState
): boolean {
  const reachableTiles = calculateReachableTiles(unit, gameState);
  
  return reachableTiles.some(coord => 
    coord.q === targetCoordinate.q && 
    coord.r === targetCoordinate.r
  );
}

/**
 * Gets all valid attack targets for a unit
 */
export function getValidAttackTargets(
  unit: Unit,
  gameState: GameState
): Unit[] {
  // Find all enemy units within attack range
  return gameState.units.filter(target => {
    // Must be an enemy unit
    if (target.playerId === unit.playerId) return false;
    
    // Must be within attack range
    const distance = Math.abs(target.coordinate.q - unit.coordinate.q) +
                    Math.abs(target.coordinate.r - unit.coordinate.r) +
                    Math.abs(target.coordinate.s - unit.coordinate.s);
    
    return distance <= unit.attackRange;
  });
}

/**
 * Checks if a unit can attack a specific target
 */
export function canUnitAttackTarget(
  attacker: Unit,
  target: Unit,
  gameState: GameState
): boolean {
  // Must be an enemy unit
  if (attacker.playerId === target.playerId) return false;
  
  // Attacker must not be exhausted
  if (attacker.status === 'exhausted') return false;
  
  // Must be within attack range
  const distance = Math.abs(target.coordinate.q - attacker.coordinate.q) +
                  Math.abs(target.coordinate.r - attacker.coordinate.r) +
                  Math.abs(target.coordinate.s - attacker.coordinate.s);
  
  return distance <= attacker.attackRange;
}

/**
 * Checks if a unit is visible to a player based on their units' vision
 */
export function isUnitVisibleToPlayer(
  unit: Unit,
  playerId: string,
  gameState: GameState
): boolean {
  // Player's own units are always visible
  if (unit.playerId === playerId) return true;
  
  // Find all friendly units for the player
  const playerUnits = gameState.units.filter(u => u.playerId === playerId);
  
  // Check if any friendly unit can see this enemy unit
  return playerUnits.some(friendlyUnit => {
    const distance = Math.max(
      Math.abs(unit.coordinate.q - friendlyUnit.coordinate.q),
      Math.abs(unit.coordinate.r - friendlyUnit.coordinate.r),
      Math.abs(unit.coordinate.s - friendlyUnit.coordinate.s)
    );
    
    return distance <= friendlyUnit.visionRadius;
  });
}

/**
 * Gets all units visible to the current player
 */
export function getVisibleUnits(
  gameState: GameState,
  playerId?: string
): Unit[] {
  if (!playerId) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    playerId = currentPlayer.id;
  }
  
  return gameState.units.filter(unit => 
    isUnitVisibleToPlayer(unit, playerId, gameState)
  );
}