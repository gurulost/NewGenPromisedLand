import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { getReachableTiles } from "./pathfinding";
import { GAME_RULES } from "../data/gameRules";
import { hexDistance } from "../utils/hex";

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
  
  // Allow movement to unexplored tiles (units can explore new areas)
  // Units should be able to move to and explore adjacent unexplored tiles
  
  // Check for units on the target tile
  const unitOnTile = gameState.units.find(u => 
    u.coordinate.q === coordinate.q && 
    u.coordinate.r === coordinate.r &&
    u.coordinate.s === coordinate.s
  );
  
  if (unitOnTile) {
    // Can't move to tiles with enemy units
    if (unit && unitOnTile.playerId !== unit.playerId) return false;
    // Allow friendly units to stack on the same tile
    // This is common in many strategy games for tactical positioning
  }
  
  // Additional unit-specific checks could be added here
  // (e.g., naval units can pass through water, flying units over mountains)
  
  return true;
}

/**
 * Calculates all tiles reachable by a unit within its movement range
 * Support both old (unit, gameState) and new (gameState, coordinate, movementRange) signatures
 */
export function calculateReachableTiles(
  unitOrGameState: Unit | GameState,
  gameStateOrCoordinate: GameState | HexCoordinate,
  movementRange?: number
): HexCoordinate[] {
  // Handle both function signatures for backward compatibility
  let gameState: GameState;
  let coordinate: HexCoordinate;
  let movement: number;
  
  if ('units' in unitOrGameState) {
    // New signature: (gameState, coordinate, movementRange)
    gameState = unitOrGameState;
    coordinate = gameStateOrCoordinate as HexCoordinate;
    movement = movementRange || 0;
  } else {
    // Old signature: (unit, gameState)
    const unit = unitOrGameState as Unit;
    gameState = gameStateOrCoordinate as GameState;
    coordinate = unit.coordinate;
    movement = unit.remainingMovement;
  }
  
  const isPassable = (coord: HexCoordinate): boolean => {
    return isPassableForUnit(coord, gameState);
  };
  
  return getReachableTiles(
    coordinate,
    movement,
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
  const reachableTiles = calculateReachableTiles(gameState, unit.coordinate, unit.remainingMovement);
  
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
    
    // Must be within attack range using proper hex distance
    const distance = hexDistance(unit.coordinate, target.coordinate);
    
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
  
  // Must be within attack range using proper hex distance
  const distance = hexDistance(attacker.coordinate, target.coordinate);
  
  return distance <= attacker.attackRange;
}

/**
 * Checks if a unit is visible to a player based on three-tiered fog of war system
 * Units are only visible if they're in currently visible tiles (not just explored)
 */
export function isUnitVisibleToPlayer(
  unit: Unit,
  playerId: string,
  gameState: GameState
): boolean {
  // Player's own units are always visible
  if (unit.playerId === playerId) {
    return true;
  }
  
  // Find all friendly units for the player
  const playerUnits = gameState.units.filter(u => u.playerId === playerId);
  
  // Check if the enemy unit's tile is currently visible (not just explored)
  const unitTileKey = `${unit.coordinate.q},${unit.coordinate.r}`;
  
  // Calculate currently visible tiles for this player
  const isVisible = playerUnits.some(friendlyUnit => {
    const distance = hexDistance(friendlyUnit.coordinate, unit.coordinate);
    const visionRadius = friendlyUnit.visionRadius || 2;
    return distance <= visionRadius;
  });
  
  // Enemy units are only visible if they're in currently visible tiles
  return isVisible;
  return isVisible;
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
  
  const allUnits = gameState.units;
  const visibleUnits = allUnits.filter(unit => 
    isUnitVisibleToPlayer(unit, playerId, gameState)
  );
  
  // Debug logging
  console.log('🎮 getVisibleUnits Debug:', {
    currentPlayerId: playerId,
    totalUnits: allUnits.length,
    visibleUnits: visibleUnits.length,
    allUnitsInfo: allUnits.map(u => ({
      id: u.id,
      playerId: u.playerId,
      coordinate: u.coordinate,
      visionRadius: u.visionRadius,
      attackRange: u.attackRange,
      isVisible: isUnitVisibleToPlayer(u, playerId, gameState)
    }))
  });
  
  return visibleUnits;
}