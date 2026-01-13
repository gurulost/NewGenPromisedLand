// @ts-nocheck
import { GameState, GameAction } from "../types/game";
import { Unit, UnitType } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { GAME_RULES } from "../data/gameRules";
import { ABILITIES } from "../data/abilities";
import { attemptUnitConversion, getUnitConversionFaithCost } from "./conversion";
import { nextId } from "./rng";
import { applyPopulationGain } from "./cityGrowth";
import { spendUnitActions } from "./unitLogic";
import { gameReducer } from "./gameReducer";

/**
 * Unit Action System - Handles special unit abilities and actions
 * Each unit type has unique capabilities that go beyond basic movement/attack
 */

export interface UnitActionResult {
  success: boolean;
  message: string;
  newState?: GameState;
  effects?: {
    healing?: number;
    conversion?: string[];
    construction?: boolean;
    transport?: boolean;
    areaEffect?: boolean;
    range?: number;
    areaRadius?: number;
    centerDamage?: number;
    areaDamage?: number;
  };
}

/**
 * Worker Actions - Building and Construction
 */
export function executeWorkerAction(
  state: GameState,
  unit: Unit,
  action: 'BUILD_IMPROVEMENT' | 'BUILD_STRUCTURE' | 'REPAIR' | 'HARVEST' | 'CLEAR_FOREST' | 'BUILD_ROAD',
  target?: HexCoordinate,
  buildingType?: string
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);

  if (!unitDef.abilities.includes('BUILD')) {
    return { success: false, message: "Unit cannot build" };
  }

  // Get hex for target location if provided
  const hex = target ? state.map?.tiles.find(tile =>
    tile.coordinate.q === target.q && tile.coordinate.r === target.r
  ) : state.map?.tiles.find(tile =>
    tile.coordinate.q === unit.coordinate.q && tile.coordinate.r === unit.coordinate.r
  );

  if (!hex) {
    return { success: false, message: "Invalid location" };
  }

  // Handle each action type independently
  if (action === 'HARVEST' && unitDef.abilities.includes('HARVEST')) {
    return executeHarvestAction(state, unit, hex);
  }

  if (action === 'CLEAR_FOREST') {
    return executeClearForestAction(state, unit, hex);
  }

  if (action === 'BUILD_ROAD') {
    return executeBuildRoadAction(state, unit, hex);
  }

  if (action === 'BUILD_IMPROVEMENT' && buildingType) {
    // Building logic would integrate with existing improvement system
    return {
      success: true,
      message: `Building ${buildingType} on ${hex.terrain}`,
      effects: { construction: true }
    };
  }

  return { success: false, message: "Invalid build action" };
}

/**
 * Worker Harvest Action - Polytopia-style resource harvesting
 * Removes resource from tile and provides immediate population boost to nearest city
 */
function executeHarvestAction(
  state: GameState,
  unit: Unit,
  hex: any
): UnitActionResult {
  // Check if tile has harvestable world elements - unified system
  const harvestableResources = ['timber_grove', 'wild_goats', 'grain_patch', 'ore_vein', 'fishing_shoal', 'sea_beast', 'jaredite_ruins'];
  if (!hex.resources || !hex.resources.some(r => harvestableResources.includes(r))) {
    return { success: false, message: "No harvestable resources on this tile" };
  }

  // Find nearest friendly city
  const player = state.players.find(p => p.units.some(u => u.id === unit.id));
  if (!player) return { success: false, message: "Player not found" };

  const playerCities = state.cities?.filter(city =>
    player.citiesOwned.includes(city.id)
  ) || [];

  if (playerCities.length === 0) {
    return { success: false, message: "No cities to receive harvest bonus" };
  }

  // Find closest city
  let closestCity = playerCities[0];
  let closestDistance = hexDistance(unit.coordinate, closestCity.coordinate);

  for (const city of playerCities) {
    const distance = hexDistance(unit.coordinate, city.coordinate);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestCity = city;
    }
  }

  // Apply harvest bonus based on unified world element system
  const resource = hex.resources.find(r => harvestableResources.includes(r));
  const harvestBonus = resource === 'grain_patch' ? 2 :
    resource === 'timber_grove' ? 1 :
      resource === 'wild_goats' ? 1 :
        resource === 'ore_vein' ? 1 : 1;

  const newState = {
    ...state,
    cities: state.cities?.map(city =>
      city.id === closestCity.id
        ? applyPopulationGain(city, harvestBonus)
        : city
    ),
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile =>
        tile.coordinate.q === hex.coordinate.q && tile.coordinate.r === hex.coordinate.r
          ? {
            ...tile,
            terrain: 'plains',
            resources: (tile.resources || []).filter(r => r !== resource)
          }
          : tile
      )
    }
  };

  return {
    success: true,
    message: `Harvested ${hex.terrain} - ${closestCity.name} gained ${harvestBonus} population`,
    newState,
    effects: {}
  };
}

/**
 * Worker Clear Forest Action - Terraforming ability
 * Removes forest and allows building on plains terrain
 */
function executeClearForestAction(
  state: GameState,
  unit: Unit,
  hex: any
): UnitActionResult {
  const action = {
    type: 'CLEAR_FOREST' as const,
    payload: { unitId: unit.id, targetCoordinate: hex.coordinate, playerId: unit.playerId }
  };
  const newState = gameReducer(state, action);

  // Check if state changed (success)
  if (newState === state) {
    return { success: false, message: "Cannot clear forest (check tech, cost, or terrain)" };
  }

  return {
    success: true,
    message: "Forest cleared (+2 Stars, +1 Pride, +1 Dissent)",
    newState,
    effects: {}
  };
}

/**
 * Worker Build Road Action - Infrastructure development
 * Creates roads that reduce movement cost for friendly units
 */
function executeBuildRoadAction(
  state: GameState,
  unit: Unit,
  hex: any
): UnitActionResult {
  const action = {
    type: 'BUILD_ROAD' as const,
    payload: { unitId: unit.id, targetCoordinate: hex.coordinate, playerId: unit.playerId }
  };
  const newState = gameReducer(state, action);

  if (newState === state) {
    return { success: false, message: "Cannot build road (check tech, cost, or terrain)" };
  }

  return {
    success: true,
    message: "Road built (Cost: 3 Stars)",
    newState,
    effects: { construction: true }
  };
}

/**
 * Scout Actions - Reconnaissance and Stealth
 */
export function executeScoutAction(
  state: GameState,
  unit: Unit,
  action: 'STEALTH' | 'EXTENDED_VISION' | 'REVEAL_AREA'
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);

  if (action === 'STEALTH' && unitDef.abilities.includes('stealth')) {
    const reduxAction = {
      type: 'APPLY_STEALTH' as const,
      payload: { unitId: unit.id, playerId: unit.playerId }
    };
    const newState = gameReducer(state, reduxAction);

    // Check if status changed
    const newUnit = newState.units.find(u => u.id === unit.id);
    const success = newUnit?.status === 'stealthed';

    return {
      success,
      message: success ? "Unit entered stealth" : "Failed to enter stealth",
      newState,
      effects: {}
    };
  }

  if (action === 'REVEAL_AREA' && unitDef.abilities.includes('EXTENDED_VISION')) {
    // Reveal large area around scout
    const revealRadius = unit.visionRadius + 2;
    return {
      success: true,
      message: `Revealed area within ${revealRadius} tiles`,
      effects: {}
    };
  }

  return { success: false, message: "Invalid scout action" };
}

/**
 * Spearman Actions - Anti-Cavalry and Formation Fighting
 */
export function executeSpearmanAction(
  state: GameState,
  unit: Unit,
  action: 'FORMATION' | 'ANTI_CAVALRY_STANCE',
  allies?: Unit[]
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);

  if (action === 'FORMATION' && unitDef.abilities.includes('formation_fighting')) {
    const reduxAction = {
      type: 'FORMATION_FIGHTING' as const,
      payload: { unitId: unit.id, playerId: unit.playerId }
    };
    const newState = gameReducer(state, reduxAction);
    const newUnit = newState.units.find(u => u.id === unit.id);
    const success = newUnit?.status === 'formation';

    return {
      success,
      message: success ? "Formation established (+2 Defense)" : "Failed to form formation",
      newState,
      effects: {}
    };
  }

  if (action === 'ANTI_CAVALRY_STANCE' && unitDef.abilities.includes('ANTI_CAVALRY')) {
    // Deal extra damage to mounted/fast units
    return {
      success: true,
      message: "Prepared to counter cavalry charges",
      effects: {}
    };
  }

  return { success: false, message: "Invalid spearman action" };
}

/**
 * Boat Actions - Naval Transport and Exploration
 */
export function executeBoatAction(
  state: GameState,
  unit: Unit,
  action: 'TRANSPORT' | 'COASTAL_EXPLORE' | 'EMBARK' | 'DISEMBARK',
  target?: HexCoordinate,
  passengers?: Unit[]
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);

  if (action === 'TRANSPORT' && unitDef.abilities.includes('NAVAL_TRANSPORT')) {
    // Can carry up to 2 land units
    const maxCapacity = 2;
    const currentPassengers = passengers?.length || 0;

    if (currentPassengers >= maxCapacity) {
      return { success: false, message: "Boat at full capacity" };
    }

    return {
      success: true,
      message: `Transporting ${currentPassengers}/${maxCapacity} units`,
      effects: { transport: true }
    };
  }

  if (action === 'COASTAL_EXPLORE' && unitDef.abilities.includes('COASTAL_EXPLORATION')) {
    const reduxAction = {
      type: 'COASTAL_EXPLORE' as const,
      payload: { unitId: unit.id, playerId: unit.playerId }
    };
    const newState = gameReducer(state, reduxAction);

    if (newState === state) {
      return { success: false, message: "Exploration failed (already acted?)" };
    }

    return {
      success: true,
      message: "Exploring coastal waters",
      newState,
      effects: {}
    };
  }

  return { success: false, message: "Invalid boat action" };
}

/**
 * Catapult Actions - Siege Warfare and Long-Range Bombardment
 */
export function executeCatapultAction(
  state: GameState,
  unit: Unit,
  action: 'SIEGE_ATTACK' | 'BOMBARDMENT' | 'SETUP' | 'PACK_UP',
  target?: HexCoordinate
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);

  if (action === 'SIEGE_ATTACK' && unitDef.abilities.includes('SIEGE_WEAPON')) {
    if (!target) {
      return { success: false, message: "No target specified" };
    }

    const distance = hexDistance(unit.coordinate, target);
    if (distance > unit.attackRange) {
      return { success: false, message: "Target out of range" };
    }

    // Extra damage to structures and cities
    const baseDamage = unit.attack;
    const siegeDamage = baseDamage * 2; // Double damage to structures

    return {
      success: true,
      message: `Siege attack deals ${siegeDamage} damage`,
      effects: {}
    };
  }

  if (action === 'BOMBARDMENT' && unitDef.abilities.includes('LONG_RANGE_BOMBARDMENT')) {
    // Area of effect attack with targeting
    if (!target) {
      return { success: false, message: "No target specified" };
    }

    const distance = hexDistance(unit.coordinate, target);
    if (distance > unit.attackRange) {
      return { success: false, message: "Target out of bombardment range" };
    }

    // Calculate area of effect - center tile + all neighbors (7 tiles total)
    const affectedTiles = [target, ...hexNeighbors(target)];
    const affectedUnits = state.units.filter(u =>
      affectedTiles.some(tile =>
        tile.q === u.coordinate.q && tile.r === u.coordinate.r
      )
    );

    // Enhanced bombardment damage calculation
    const centerDamage = Math.floor(unit.attack * 0.8); // 80% damage to center
    const areaDamage = Math.floor(unit.attack * 0.5);   // 50% damage to surrounding tiles

    const newState = {
      ...state,
      units: state.units.map(u => {
        if (affectedUnits.some(affected => affected.id === u.id)) {
          const isCenter = u.coordinate.q === target.q && u.coordinate.r === target.r;
          const damage = isCenter ? centerDamage : areaDamage;
          return { ...u, hp: Math.max(0, u.hp - damage) };
        }
        if (u.id === unit.id) {
          return spendUnitActions(u);
        }
        return u;
      }).filter(u => u.hp > 0) // Remove destroyed units
    };

    return {
      success: true,
      message: `Bombardment hit ${affectedUnits.length} units across ${affectedTiles.length} tiles`,
      newState,
      effects: {
        areaEffect: true,
        range: unit.attackRange,
        areaRadius: 1,
        centerDamage,
        areaDamage
      }
    };
  }

  if (action === 'SETUP') {
    // Enter siege mode (spends an action; moving will break siege).
    const newState = {
      ...state,
      units: state.units.map(u =>
        u.id === unit.id
          ? { ...spendUnitActions(u), status: 'siege_mode' as const }
          : u
      )
    };

    return {
      success: true,
      message: "Catapult setup for siege",
      newState,
      effects: {}
    };
  }

  return { success: false, message: "Invalid catapult action" };
}

/**
 * Missionary Actions - Conversion and Healing
 */
export function executeMissionaryAction(
  state: GameState,
  unit: Unit,
  action: 'CONVERT' | 'HEAL' | 'ESTABLISH_MISSION',
  target?: HexCoordinate | Unit
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);
  const player = state.players.find(p => p.id === unit.playerId);

  if (!player) {
    return { success: false, message: "Player not found" };
  }

  if (action === 'CONVERT') {
    if (!target || !('id' in target)) {
      return { success: false, message: "No target unit specified" };
    }

    const targetUnit = target as Unit;

    const outcome = attemptUnitConversion(state, unit.id, targetUnit.id);
    if (!outcome.ok) {
      const faithCost = getUnitConversionFaithCost();
      const reason =
        outcome.reason === 'not_owner_turn' ? 'Not your turn' :
          outcome.reason === 'same_player' ? 'Cannot convert allied units' :
            outcome.reason === 'out_of_range' ? `Target too far away (range ${GAME_RULES.abilities.conversionRadius})` :
              outcome.reason === 'exhausted' ? 'Unit has already acted this turn' :
                outcome.reason === 'insufficient_faith' ? `Insufficient faith (need ${faithCost})` :
                  'Conversion attempt is not valid';
      return { success: false, message: reason };
    }

    return {
      success: outcome.success,
      message: outcome.success
        ? `Converted ${targetUnit.type} to your cause`
        : `Conversion attempt failed (${Math.round(outcome.chance * 100)}% chance)`,
      newState: outcome.state,
      effects: outcome.success ? { conversion: [targetUnit.id] } : undefined
    };
  }

  if (action === 'HEAL' && unitDef.abilities.includes('heal')) {
    const reduxAction = {
      type: 'HEAL_UNIT' as const,
      payload: { unitId: unit.id, playerId: unit.playerId }
    };
    const newState = gameReducer(state, reduxAction);

    // If state changed, it succeeded
    const success = newState !== state;
    return {
      success,
      message: success ? "Allies healed" : "Healing failed (no targets or insufficient faith)",
      newState,
      effects: success ? { healing: 3 } : undefined
    };
  }

  return { success: false, message: "Invalid missionary action" };
}

/**
 * Commander Actions - Leadership and Tactical Command
 */
export function executeCommanderAction(
  state: GameState,
  unit: Unit,
  action: 'RALLY' | 'TACTICAL_COMMAND' | 'COORDINATE_ATTACK',
  target?: HexCoordinate
): UnitActionResult {
  const unitDef = getUnitDefinition(unit.type);

  if (action === 'RALLY' && unitDef.abilities.includes('rally_troops')) {
    const reduxAction = {
      type: 'RALLY_TROOPS' as const,
      payload: { unitId: unit.id, playerId: unit.playerId }
    };
    const newState = gameReducer(state, reduxAction);
    const success = newState !== state;

    return {
      success,
      message: success ? "Troops rallied (+2 Attack)" : "Rally failed (check cooldown)",
      newState,
      effects: {}
    };
  }

  return { success: false, message: "Invalid commander action" };
}

/**
 * Main Unit Action Dispatcher
 */
export function executeUnitAction(
  state: GameState,
  unitId: string,
  actionType: string,
  parameters?: any
): UnitActionResult {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) {
    return { success: false, message: "Unit not found" };
  }

  // Route to appropriate handler based on unit type
  switch (unit.type) {
    case 'worker':
      return executeWorkerAction(state, unit, actionType as any, parameters?.target, parameters?.buildingType);

    case 'scout':
      return executeScoutAction(state, unit, actionType as any);

    case 'spearman':
      return executeSpearmanAction(state, unit, actionType as any, parameters?.allies);

    case 'boat':
      return executeBoatAction(state, unit, actionType as any, parameters?.target, parameters?.passengers);

    case 'catapult':
      return executeCatapultAction(state, unit, actionType as any, parameters?.target);

    case 'missionary':
      return executeMissionaryAction(state, unit, actionType as any, parameters?.target);

    case 'commander':
      return executeCommanderAction(state, unit, actionType as any, parameters?.target);

    default:
      return { success: false, message: "Unit type not supported" };
  }
}
