import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { getPathCost, getReachableTiles } from "./pathfinding";
import { GAME_RULES } from "../data/gameRules";
import { hexDistance } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { getVisibleTilesInRange } from "../utils/lineOfSight";

/**
 * Centralized unit logic functions to be shared between UI and game reducer
 */

const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
export const unitHasAbility = (unit: Unit, abilityId: string) =>
  (unit.abilities || []).some(ability => normalizeAbility(String(ability)) === normalizeAbility(abilityId));
const unitHasBombardment = (unit: Unit) =>
  unitHasAbility(unit, 'SIEGE') || unitHasAbility(unit, 'BOMBARDMENT');
const definitionHasAbility = (
  unitDef: ReturnType<typeof getUnitDefinition> | undefined,
  abilityId: string
) => (unitDef?.abilities || []).some(ability => normalizeAbility(String(ability)) === normalizeAbility(abilityId));

export const getUnitAttackRangeFromDefinition = (
  unitDef?: ReturnType<typeof getUnitDefinition>
): number => {
  const baseRange = unitDef?.baseStats?.attackRange ?? 1;
  const hasRangedAbility = (unitDef?.abilities || []).some(
    ability => normalizeAbility(String(ability)) === 'RANGED_ATTACK'
  );
  if (hasRangedAbility && baseRange <= 1) return 2;
  return baseRange;
};

export const getEffectiveAttackRange = (unit: Unit): number => {
  const baseRange = unit.attackRange ?? 1;
  if (baseRange > 1) return baseRange;
  return unitHasAbility(unit, 'RANGED_ATTACK') ? 2 : baseRange;
};
const isNavalUnit = (unit?: Unit) => {
  if (!unit) return false;
  const unitDef = getUnitDefinition(unit.type as any);
  return definitionHasAbility(unitDef, 'NAVAL_TRANSPORT') || unit.type === 'boat';
};

const isAmphibiousUnit = (unit?: Unit) => {
  if (!unit) return false;
  const unitDef = getUnitDefinition(unit.type as any);
  return definitionHasAbility(unitDef, 'AMPHIBIOUS');
};

export const getUnitMaxActions = (unit: Unit): number => {
  const unitDef = getUnitDefinition(unit.type as any);
  return unit.maxActions ?? unitDef.baseStats.actions ?? 1;
};

export const getUnitActionsRemaining = (unit: Unit): number => {
  const maxActions = getUnitMaxActions(unit);
  return unit.actionsRemaining ?? maxActions;
};

export const spendUnitActions = (unit: Unit, cost = 1): Unit => {
  const maxActions = getUnitMaxActions(unit);
  const remaining = Math.max(0, getUnitActionsRemaining(unit) - cost);
  return {
    ...unit,
    maxActions,
    actionsRemaining: remaining,
    hasAttacked: remaining === 0,
  };
};

export const resetUnitActions = (unit: Unit): Unit => {
  const maxActions = getUnitMaxActions(unit);
  return {
    ...unit,
    maxActions,
    actionsRemaining: maxActions,
    hasAttacked: false,
  };
};

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
  
  const isNaval = isNavalUnit(unit);
  const isAmphibious = isAmphibiousUnit(unit);

  // Special-case naval movement: boats (and other NAVAL_TRANSPORT units) can move on water.
  if (tile.terrain === 'water') {
    return isNaval || isAmphibious;
  }

  // Check basic terrain passability using game rules
  const movementCost = GAME_RULES.terrain.movementCosts[tile.terrain];
  const isImpassable = GAME_RULES.terrain.impassableTypes.includes(tile.terrain);
  if (isImpassable || movementCost === undefined) return false;

  // Naval units remain on water unless amphibious.
  if (isNaval && !isAmphibious) return false;
  
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
  
  const unit = 'units' in unitOrGameState ? undefined : (unitOrGameState as Unit);
  const isPassable = (coord: HexCoordinate): boolean =>
    isPassableForUnit(coord, gameState, unit);
  const getMoveCost = (coord: HexCoordinate): number =>
    getMovementCostForCoordinate(coord, gameState, unit);

  return getReachableTiles(
    coordinate,
    movement,
    isPassable,
    getMoveCost
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

export function getMovementCostForCoordinate(
  coordinate: HexCoordinate,
  gameState: GameState,
  unit?: Unit
): number {
  const tile = gameState.map.tiles.find(t =>
    t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r
  );
  if (!tile) return Infinity;

  const naval = isNavalUnit(unit);
  const amphibious = isAmphibiousUnit(unit);

  if (tile.terrain === 'water') {
    return (naval || amphibious) ? 1 : Infinity;
  }

  const baseCost = GAME_RULES.terrain.movementCosts[tile.terrain];
  const isImpassable = GAME_RULES.terrain.impassableTypes.includes(tile.terrain);
  if (isImpassable || baseCost === undefined) return Infinity;

  if (naval && !amphibious) return Infinity;

  const hasRoad = (gameState.improvements || []).some(
    imp =>
      imp.type === 'road' &&
      imp.coordinate.q === coordinate.q &&
      imp.coordinate.r === coordinate.r
  );

  if (hasRoad) {
    const roadCost = GAME_RULES.terrain.movementCosts.plains ?? 1;
    return Math.min(baseCost, roadCost);
  }

  return baseCost;
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

export function getMovementCostToCoordinate(
  unit: Unit,
  targetCoordinate: HexCoordinate,
  gameState: GameState
): number | null {
  const isPassable = (coord: HexCoordinate): boolean =>
    isPassableForUnit(coord, gameState, unit);
  const getMoveCost = (coord: HexCoordinate): number =>
    getMovementCostForCoordinate(coord, gameState, unit);

  return getPathCost(
    unit.coordinate,
    targetCoordinate,
    isPassable,
    unit.remainingMovement,
    getMoveCost
  );
}

/**
 * Gets all valid attack targets for a unit
 */
export function getValidAttackTargets(
  unit: Unit,
  gameState: GameState
): Unit[] {
  if (getUnitActionsRemaining(unit) <= 0) return [];
  // Find all enemy units within attack range
  const hasBombardment = unitHasBombardment(unit);
  return gameState.units.filter(target => {
    // Must be an enemy unit
    if (target.playerId === unit.playerId) return false;

    // Must be visible to the attacker
    if (!isUnitVisibleToPlayer(target, unit.playerId, gameState)) return false;
    
    // Must be within attack range using proper hex distance
    const distance = hexDistance(unit.coordinate, target.coordinate);
    if (distance > getEffectiveAttackRange(unit)) return false;

    if (target.status === 'stealthed' && distance > 1) return false;
    if (hasBombardment && distance <= 1) return false;
    if (hasBombardment && distance > 1 && unit.status !== 'siege_mode') return false;
    if (hasBombardment && distance > 1 && unit.remainingMovement !== unit.movement) return false;

    return true;
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

  if (getUnitActionsRemaining(attacker) <= 0) return false;

  // Target must be visible to the attacker
  if (!isUnitVisibleToPlayer(target, attacker.playerId, gameState)) return false;
  
  // Attacker must not be exhausted
  if (attacker.status === 'exhausted') return false;

  if (target.status === 'stealthed' && hexDistance(attacker.coordinate, target.coordinate) > 1) {
    return false;
  }
  
  // Must be within attack range using proper hex distance
  const distance = hexDistance(attacker.coordinate, target.coordinate);

  if (distance > getEffectiveAttackRange(attacker)) return false;

  const hasBombardment = unitHasBombardment(attacker);
  if (hasBombardment && distance <= 1) return false;
  if (hasBombardment && distance > 1 && attacker.status !== 'siege_mode') return false;
  if (hasBombardment && distance > 1 && attacker.remainingMovement !== attacker.movement) return false;

  return true;
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
  
  // Check if the enemy unit's tile is currently visible using proper line-of-sight
  const unitTileKey = `${unit.coordinate.q},${unit.coordinate.r}`;
  
  // Calculate currently visible tiles for this player using proper vision system
  const allVisibleTiles = new Set<string>();
  
  playerUnits.forEach(friendlyUnit => {
    // Use unit's actual vision radius from definition (same as MapFeatures)
    const unitDef = getUnitDefinition(friendlyUnit.type);
    const visionRadius = friendlyUnit.visionRadius ?? unitDef.baseStats.visionRadius;
    
    // Get visible tiles with line-of-sight calculations (same as MapFeatures)
    const unitVisibleTiles = getVisibleTilesInRange(
      friendlyUnit.coordinate,
      visionRadius,
      gameState.map,
      true // Enable shadow casting for performance
    );
    
    // Add all visible tiles to the set
    unitVisibleTiles.forEach(tileKey => allVisibleTiles.add(tileKey));
  });
  
  // Enemy units are only visible if they're in currently visible tiles
  return allVisibleTiles.has(unitTileKey);
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

  return visibleUnits;
}
