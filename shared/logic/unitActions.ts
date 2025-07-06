import { GameState, GameAction } from "../types/game";
import { Unit, UnitType } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { GAME_RULES } from "../data/gameRules";
import { ABILITIES } from "../data/abilities";

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

  if (action === 'BUILD_IMPROVEMENT' && target && buildingType) {
    // Check if improvement can be built on this terrain
    const hex = state.map?.tiles.find(tile => 
      tile.coordinate.q === target.q && tile.coordinate.r === target.r
    );
    
    if (!hex) {
      return { success: false, message: "Invalid location" };
    }

    // Handle Harvest action
    if (action === 'HARVEST') {
      return executeHarvestAction(state, unit, hex);
    }

    // Handle Clear Forest action
    if (action === 'CLEAR_FOREST') {
      return executeClearForestAction(state, unit, hex);
    }

    // Handle Build Road action
    if (action === 'BUILD_ROAD') {
      return executeBuildRoadAction(state, unit, hex);
    }

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
  // Check if tile has harvestable resources
  const harvestableResources = ['fruit', 'game', 'fish', 'ruins'];
  if (!harvestableResources.includes(hex.terrain) && !hex.resource) {
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

  // Apply harvest bonus based on resource type
  const harvestBonus = hex.terrain === 'fruit' ? 3 : 
                      hex.terrain === 'game' ? 2 : 
                      hex.terrain === 'fish' ? 2 : 1;

  const newState = {
    ...state,
    cities: state.cities?.map(city => 
      city.id === closestCity.id 
        ? { ...city, population: Math.min(city.population + harvestBonus, 20) }
        : city
    ),
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile =>
        tile.coordinate.q === hex.coordinate.q && tile.coordinate.r === hex.coordinate.r
          ? { ...tile, terrain: 'plains', resource: undefined }
          : tile
      )
    }
  };

  return {
    success: true,
    message: `Harvested ${hex.terrain} - ${closestCity.name} gained ${harvestBonus} population`,
    newState,
    effects: { }
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
  if (hex.terrain !== 'forest') {
    return { success: false, message: "Can only clear forest tiles" };
  }

  const player = state.players.find(p => p.units.some(u => u.id === unit.id));
  if (!player || player.stars < 5) {
    return { success: false, message: "Need 5 stars to clear forest" };
  }

  const newState = {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { ...p, stars: p.stars - 5 }
        : p
    ),
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile =>
        tile.coordinate.q === hex.coordinate.q && tile.coordinate.r === hex.coordinate.r
          ? { ...tile, terrain: 'plains' }
          : tile
      )
    }
  };

  return {
    success: true,
    message: "Forest cleared - tile converted to plains",
    newState,
    effects: { }
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
  if (hex.terrain === 'water' || hex.terrain === 'mountain') {
    return { success: false, message: "Cannot build roads on water or mountains" };
  }

  // Check if road already exists
  const existingRoad = state.improvements?.find(imp => 
    imp.coordinate.q === hex.coordinate.q && 
    imp.coordinate.r === hex.coordinate.r &&
    imp.type === 'road'
  );

  if (existingRoad) {
    return { success: false, message: "Road already exists on this tile" };
  }

  const player = state.players.find(p => p.units.some(u => u.id === unit.id));
  if (!player || player.stars < 3) {
    return { success: false, message: "Need 3 stars to build road" };
  }

  const roadImprovement = {
    id: `road_${hex.coordinate.q}_${hex.coordinate.r}_${Date.now()}`,
    type: 'road' as const,
    coordinate: hex.coordinate,
    playerId: player.id,
    cityId: '',
    starsPerTurn: 0
  };

  const newState = {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { ...p, stars: p.stars - 3 }
        : p
    ),
    improvements: [...(state.improvements || []), roadImprovement]
  };

  return {
    success: true,
    message: "Road built - reduces movement cost for friendly units",
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
  
  if (action === 'STEALTH' && unitDef.abilities.includes('STEALTH')) {
    // Toggle stealth mode - invisible to enemies unless adjacent
    const newStatus = unit.status === 'defending' ? 'active' : 'defending';
    const newState = {
      ...state,
      units: state.units.map(u => 
        u.id === unit.id 
          ? { ...u, status: newStatus as 'active' | 'defending' }
          : u
      )
    };
    
    return {
      success: true,
      message: newStatus === 'active' ? "Scout revealed" : "Scout hidden",
      newState,
      effects: { }
    };
  }

  if (action === 'REVEAL_AREA' && unitDef.abilities.includes('EXTENDED_VISION')) {
    // Reveal large area around scout
    const revealRadius = unit.visionRadius + 2;
    return {
      success: true,
      message: `Revealed area within ${revealRadius} tiles`,
      effects: { }
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
  
  if (action === 'FORMATION' && unitDef.abilities.includes('FORMATION_FIGHTING')) {
    // When adjacent to other spearmen, gain defense bonus
    const adjacentSpearmen = state.units.filter(u => 
      u.playerId === unit.playerId && 
      u.type === 'spearman' && 
      u.id !== unit.id &&
      hexDistance(u.coordinate, unit.coordinate) === 1
    );
    
    const defenseBonus = adjacentSpearmen.length * 2;
    
    return {
      success: true,
      message: `Formation bonus: +${defenseBonus} defense`,
      effects: { }
    };
  }

  if (action === 'ANTI_CAVALRY_STANCE' && unitDef.abilities.includes('ANTI_CAVALRY')) {
    // Deal extra damage to mounted/fast units
    return {
      success: true,
      message: "Prepared to counter cavalry charges",
      effects: { }
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
    // Reveal coastal areas and find resources
    return {
      success: true,
      message: "Exploring coastal waters",
      effects: { }
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
      effects: { }
    };
  }

  if (action === 'BOMBARDMENT' && unitDef.abilities.includes('LONG_RANGE_BOMBARDMENT')) {
    // Area of effect attack
    if (!target) {
      return { success: false, message: "No target specified" };
    }
    
    const affectedTiles = hexNeighbors(target);
    
    return {
      success: true,
      message: `Bombardment affects ${affectedTiles.length + 1} tiles`,
      effects: { }
    };
  }

  if (action === 'SETUP') {
    // Must setup before attacking, cannot move when setup
    const newState = {
      ...state,
      units: state.units.map(u => 
        u.id === unit.id 
          ? { ...u, status: 'defending' as const, remainingMovement: 0 }
          : u
      )
    };
    
    return {
      success: true,
      message: "Catapult setup for siege",
      newState,
      effects: { }
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

  if (action === 'CONVERT' && unitDef.abilities.includes('CONVERT')) {
    if (!target || !('id' in target)) {
      return { success: false, message: "No target unit specified" };
    }
    
    const targetUnit = target as Unit;
    const distance = hexDistance(unit.coordinate, targetUnit.coordinate);
    
    if (distance > 1) {
      return { success: false, message: "Target too far away" };
    }
    
    // Conversion chance based on faith vs target's defense
    const faithRequirement = ABILITIES.conversion?.requirements?.faith || 50;
    if (player.stats.faith < faithRequirement) {
      return { success: false, message: "Insufficient faith for conversion" };
    }
    
    const conversionChance = Math.min(0.8, player.stats.faith / 100);
    const success = Math.random() < conversionChance;
    
    if (success) {
      const newState = {
        ...state,
        units: state.units.map(u => 
          u.id === targetUnit.id 
            ? { ...u, playerId: unit.playerId }
            : u
        )
      };
      
      return {
        success: true,
        message: `Converted ${targetUnit.type} to your cause`,
        newState,
        effects: { conversion: [targetUnit.id] }
      };
    } else {
      return { success: false, message: "Conversion attempt failed" };
    }
  }

  if (action === 'HEAL' && unitDef.abilities.includes('HEAL')) {
    const healingRange = 2;
    const healingAmount = GAME_RULES.units.healingAmount;
    
    const nearbyAllies = state.units.filter(u => 
      u.playerId === unit.playerId && 
      u.id !== unit.id &&
      hexDistance(u.coordinate, unit.coordinate) <= healingRange &&
      u.hp < u.maxHp
    );
    
    const newState = {
      ...state,
      units: state.units.map(u => {
        if (nearbyAllies.some(ally => ally.id === u.id)) {
          return { ...u, hp: Math.min(u.maxHp, u.hp + healingAmount) };
        }
        return u;
      })
    };
    
    return {
      success: true,
      message: `Healed ${nearbyAllies.length} nearby allies`,
      newState,
      effects: { healing: healingAmount }
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
  
  if (action === 'RALLY' && unitDef.abilities.includes('LEADERSHIP')) {
    const rallyRange = 3;
    const nearbyAllies = state.units.filter(u => 
      u.playerId === unit.playerId && 
      u.id !== unit.id &&
      hexDistance(u.coordinate, unit.coordinate) <= rallyRange
    );
    
    // Restore movement and remove exhausted status
    const newState = {
      ...state,
      units: state.units.map(u => {
        if (nearbyAllies.some(ally => ally.id === u.id)) {
          return { 
            ...u, 
            remainingMovement: Math.min(u.movement, u.remainingMovement + 1),
            status: u.status === 'exhausted' ? 'active' : u.status
          };
        }
        return u;
      })
    };
    
    return {
      success: true,
      message: `Rallied ${nearbyAllies.length} nearby units`,
      newState,
      effects: { }
    };
  }

  if (action === 'TACTICAL_COMMAND' && unitDef.abilities.includes('TACTICAL_COMMAND')) {
    // Allow coordinated attacks - nearby units can attack after moving
    const commandRange = 2;
    const commandedUnits = state.units.filter(u => 
      u.playerId === unit.playerId && 
      u.id !== unit.id &&
      hexDistance(u.coordinate, unit.coordinate) <= commandRange
    );
    
    const newState = {
      ...state,
      units: state.units.map(u => {
        if (commandedUnits.some(cmd => cmd.id === u.id)) {
          return { ...u, hasAttacked: false };
        }
        return u;
      })
    };
    
    return {
      success: true,
      message: `Commanded ${commandedUnits.length} units for tactical maneuvers`,
      newState,
      effects: { }
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