import { GameState, GameAction, PlayerState } from "../types/game";
import { Unit, UnitType, UnitTemporaryEffect } from "../types/unit";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { getActiveModifiers, getUnitModifiers, GameModifier } from "../data/modifiers";
import { TECHNOLOGIES } from "../data/technologies";
import { GAME_RULES, GameRuleHelpers } from "../data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../types/city";
import { ABILITIES, AbilityDefinition } from "../data/abilities";
import { getFaction } from "../data/factions";
import { executeUnitAction } from "./unitActions";
import { executeAbility } from "./abilitySystem";
import { executeElementHarvest, executeElementBuild } from "./worldElementActions";
import { HexCoordinate } from "../types/coordinates";
import { AITurnManager } from "../ai/aiTurnManager";
import { emitTelemetry } from "./telemetry";
import { resolveMeleeCombat, calculateRangedAttack } from "./combatSystem";
import { getTechnology, getEffectiveTechCostForPlayer, getTechCostDetails, canPlayerResearchTechnology, playerHasTechPrerequisites } from "./technologyHelpers";

function normalizeAbilityId(abilityId: string): string {
  return abilityId.toUpperCase();
}

function hasAbility(unit: Unit, abilityId: string): boolean {
  const normalized = normalizeAbilityId(abilityId);
  return (unit.abilities || []).some(ability => ability.toUpperCase() === normalized);
}

function getAbilitySet(unit: Unit): Set<string> {
  return new Set((unit.abilities || []).map(ability => ability.toUpperCase()));
}

function adjustUnitStatForEffect(unit: Unit, unitDef: ReturnType<typeof getUnitDefinition>, type: UnitTemporaryEffect['type'], delta: number): Unit {
  if (delta === 0) return unit;

  switch (type) {
    case 'attack_buff':
      return { ...unit, attack: Math.max(unitDef.baseStats.attack, unit.attack + delta) };
    case 'defense_buff':
      return { ...unit, defense: Math.max(unitDef.baseStats.defense, unit.defense + delta) };
    case 'movement_buff': {
      const baseMovement = unitDef.baseStats.movement;
      const nextMovement = Math.max(baseMovement, unit.movement + delta);
      const nextRemaining = Math.min(nextMovement, Math.max(0, unit.remainingMovement + delta));
      return { ...unit, movement: nextMovement, remainingMovement: nextRemaining };
    }
    default:
      return unit;
  }
}

function refreshTimedBuff(
  unit: Unit,
  unitDef: ReturnType<typeof getUnitDefinition>,
  effectId: string,
  type: UnitTemporaryEffect['type'],
  amount: number,
  duration: number,
  source: string
): Unit {
  const effects = [...(unit.temporaryEffects || [])];
  const index = effects.findIndex(effect => effect.id === effectId);
  let updatedUnit = unit;

  if (index >= 0) {
    const existing = effects[index];
    const currentAmount = existing.amount || 0;
    if (currentAmount !== amount) {
      updatedUnit = adjustUnitStatForEffect(updatedUnit, unitDef, type, amount - currentAmount);
    }
    effects[index] = {
      ...existing,
      amount,
      turnsRemaining: duration,
      source,
    };
  } else {
    updatedUnit = adjustUnitStatForEffect(updatedUnit, unitDef, type, amount);
    effects.push({
      id: effectId,
      type,
      amount,
      turnsRemaining: duration,
      source,
    });
  }

  return {
    ...updatedUnit,
    temporaryEffects: effects,
  };
}

function refreshStatusEffect(
  unit: Unit,
  effectId: string,
  duration: number,
  source: string
): Unit {
  const effects = [...(unit.temporaryEffects || [])];
  const statusEffect: UnitTemporaryEffect = {
    id: effectId,
    type: 'status_immunity',
    turnsRemaining: duration,
    source,
  };

  const index = effects.findIndex(effect => effect.id === effectId);
  if (index >= 0) {
    effects[index] = statusEffect;
  } else {
    effects.push(statusEffect);
  }

  return {
    ...unit,
    temporaryEffects: effects,
  };
}

function updatePermanentEffect(
  unit: Unit,
  unitDef: ReturnType<typeof getUnitDefinition>,
  effectId: string,
  type: UnitTemporaryEffect['type'],
  amount: number
): Unit {
  const effects = unit.temporaryEffects || [];
  const index = effects.findIndex(effect => effect.id === effectId);
  const currentAmount = index >= 0 ? (effects[index].amount || 0) : 0;
  let updatedEffects = [...effects];
  let updatedUnit = unit;

  if (amount <= 0) {
    if (index >= 0) {
      updatedEffects.splice(index, 1);
      updatedUnit = adjustUnitStatForEffect(updatedUnit, unitDef, type, -currentAmount);
    }
  } else if (index >= 0) {
    if (currentAmount !== amount) {
      updatedUnit = adjustUnitStatForEffect(updatedUnit, unitDef, type, amount - currentAmount);
    }
    updatedEffects[index] = {
      ...updatedEffects[index],
      amount,
      turnsRemaining: -1,
      source: effectId,
    };
  } else {
    updatedUnit = adjustUnitStatForEffect(updatedUnit, unitDef, type, amount);
    updatedEffects.push({
      id: effectId,
      type,
      amount,
      turnsRemaining: -1,
      source: effectId,
    });
  }

  return {
    ...updatedUnit,
    temporaryEffects: updatedEffects.length > 0 ? updatedEffects : undefined,
  };
}

function enforceTerrainBoundEffects(
  units: Unit[],
  map: GameState['map']
): Unit[] {
  return units.map(unit => {
    const tile = map.tiles.find(
      t => t.coordinate.q === unit.coordinate.q && t.coordinate.r === unit.coordinate.r
    );
    if (!tile) return unit;

    const onWildTerrain = tile.terrain === 'forest' || tile.terrain === 'swamp';
    if (onWildTerrain) return unit;

    const unitDef = getUnitDefinition(unit.type as any);
    let updated = updatePermanentEffect(unit, unitDef, `guerrilla_tactics_defense_${unit.id}`, 'defense_buff', 0);
    updated = updatePermanentEffect(updated, unitDef, `guerrilla_tactics_movement_${unit.id}`, 'movement_buff', 0);

    if (updated.temporaryEffects?.some(effect => effect.source === 'lamanite_guerrilla_tactics')) {
      updated = {
        ...updated,
        temporaryEffects: updated.temporaryEffects.filter(effect => effect.source !== 'lamanite_guerrilla_tactics'),
      };
    }

    return updated;
  });
}

function recalculateProtectiveBonuses(units: Unit[]): Map<string, number> {
  const bonuses = new Map<string, number>();
  units.forEach(unit => {
    const abilities = getAbilitySet(unit);
    if (!abilities.has('PROTECTIVE_STANCE')) return;

    units.forEach(other => {
      if (other.playerId !== unit.playerId || other.id === unit.id) return;
      if (other.type !== 'worker' && other.type !== 'missionary') return;
      const distance = hexDistance(other.coordinate, unit.coordinate);
      if (distance <= 1) {
        bonuses.set(other.id, Math.max(bonuses.get(other.id) || 0, 2));
      }
    });
  });
  return bonuses;
}

function applyProtectiveBonuses(
  units: Unit[],
  bonuses: Map<string, number>
): Unit[] {
  return units.map(unit => {
    const bonus = bonuses.get(unit.id) || 0;
    const unitDef = getUnitDefinition(unit.type as any);
    return updatePermanentEffect(unit, unitDef, 'ability::protective_stance', 'defense_buff', bonus);
  });
}

function applyIntrinsicUnitAbilities(
  unit: Unit,
  player: PlayerState | undefined,
  state: GameState
): Unit {
  if (!player) return unit;

  const abilitySet = getAbilitySet(unit);
  const unitDef = getUnitDefinition(unit.type as any);
  let updated = unit;

  if (abilitySet.has('FAITHFUL_DEFENSE')) {
    const faithBonus = Math.floor(player.stats.faith / 20);
    updated = updatePermanentEffect(updated, unitDef, 'ability::faithful_defense', 'defense_buff', faithBonus);
  } else {
    updated = updatePermanentEffect(updated, unitDef, 'ability::faithful_defense', 'defense_buff', 0);
  }

  if (abilitySet.has('YOUNG_VIGOR')) {
    if (updated.status === 'exhausted') {
      updated = { ...updated, status: 'active' };
    }
    if (updated.hp <= updated.maxHp / 2) {
      const minimumMovement = Math.ceil(unitDef.baseStats.movement / 2);
      updated = {
        ...updated,
        remainingMovement: Math.max(updated.remainingMovement, minimumMovement),
      };
    }
  }

  if (abilitySet.has('FOREST_STEALTH')) {
    const tile = state.map.tiles.find(tile => tile.coordinate.q === updated.coordinate.q && tile.coordinate.r === updated.coordinate.r);
    if (tile?.terrain === 'forest') {
      if (updated.status !== 'stealthed') {
        updated = { ...updated, status: 'stealthed' };
      }
    } else if (updated.status === 'stealthed') {
      updated = { ...updated, status: 'active' };
    }
  }

  return updated;
}

// Tech Research Handler
function handleResearchTech(
  state: GameState,
  payload: { playerId: string; techId: string }
): GameState {
  return handleResearchTechnology(state, {
    playerId: payload.playerId,
    technologyId: payload.techId,
  });
}

// Start Construction Handler - adds to construction queue
function handleStartConstruction(
  state: GameState,
  payload: { 
    playerId: string; 
    buildingType: string; 
    category: 'improvements' | 'structures' | 'units';
    coordinate?: any; 
    cityId: string; 
  }
): GameState {
  const { playerId, buildingType, category, coordinate, cityId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  const emitConstructionTelemetry = (
    status: 'success' | 'blocked' | 'error' | 'info',
    reason: string,
    metadata: Record<string, unknown> = {}
  ) =>
    emitTelemetry({
      channel: 'system',
      status,
      playerId,
      reason,
      metadata: {
        category,
        buildingType,
        cityId,
        ...metadata,
      },
    });

  if (!player) {
    emitConstructionTelemetry('error', 'construction_player_not_found');
    return state;
  }

  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) {
    emitConstructionTelemetry('error', 'construction_city_not_found');
    return state;
  }

  if (!player.citiesOwned.includes(cityId)) {
    emitConstructionTelemetry('blocked', 'construction_city_not_owned');
    return state;
  }
  
  // Get building cost and time based on category
  let cost = { stars: 0, faith: 0, pride: 0 };
  let buildTime = 1;
  
  if (category === 'improvements') {
    const improvement = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvement) {
      emitConstructionTelemetry('error', 'construction_invalid_improvement');
      return state;
    }
    cost.stars = improvement.cost;
    buildTime = improvement.constructionTime;
  } else if (category === 'structures') {
    const structure = STRUCTURE_DEFINITIONS[buildingType as keyof typeof STRUCTURE_DEFINITIONS];
    if (!structure) {
      emitConstructionTelemetry('error', 'construction_invalid_structure');
      return state;
    }
    cost.stars = structure.cost;
    buildTime = 1; // Default build time for structures
  } else if (category === 'units') {
    const unitDef = getUnitDefinition(buildingType as any);
    if (!unitDef) {
      emitConstructionTelemetry('error', 'construction_invalid_unit');
      return state;
    }
    cost.stars = unitDef.cost; // Units have direct cost number
    cost.faith = unitDef.requirements?.faith || 0;
    cost.pride = unitDef.requirements?.pride || 0;
    buildTime = 1; // Units build quickly
    
    // Special validation for boats - they need coastal access
    if (buildingType === 'boat') {
      if (targetCity) {
        // Check if city has coastal access (adjacent to water)
        const cityTile = state.map.tiles.find(t => 
          t.coordinate.q === targetCity.coordinate.q && 
          t.coordinate.r === targetCity.coordinate.r
        );
        
        if (cityTile && cityTile.terrain === 'water') {
          // City is on water, allow boat building
        } else {
          // Check for adjacent water tiles
          const adjacentWater = state.map.tiles.some(tile => {
            const distance = Math.abs(tile.coordinate.q - targetCity.coordinate.q) + 
                           Math.abs(tile.coordinate.r - targetCity.coordinate.r) + 
                           Math.abs(tile.coordinate.s - targetCity.coordinate.s);
            return distance === 2 && tile.terrain === 'water'; // Adjacent hex distance is 2 in cube coordinates
          });
          
          if (!adjacentWater) {
            emitConstructionTelemetry('blocked', 'construction_requires_coastal_access');
            return state;
          }
        }
      }
    }

    if (unitDef.requirements) {
      if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) {
        emitConstructionTelemetry('blocked', 'construction_insufficient_faith', { required: unitDef.requirements.faith });
        return state;
      }
      if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) {
        emitConstructionTelemetry('blocked', 'construction_insufficient_pride', { required: unitDef.requirements.pride });
        return state;
      }
      if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) {
        emitConstructionTelemetry('blocked', 'construction_insufficient_dissent', { required: unitDef.requirements.dissent });
        return state;
      }
    }
  }
  
  // Check if player can afford
  if (player.stars < cost.stars || 
      player.stats.faith < (cost.faith || 0) || 
      player.stats.pride < (cost.pride || 0)) {
    emitConstructionTelemetry('blocked', 'construction_insufficient_resources', { cost });
    return state;
  }

  
  // Create construction item
  const constructionId = `${buildingType}_${cityId}_${Date.now()}`;
  const constructionItem = {
    id: constructionId,
    type: buildingType,
    category,
    coordinate: coordinate || undefined,
    cityId,
    playerId,
    turnsRemaining: buildTime,
    totalTurns: buildTime,
    cost,
  };

  emitConstructionTelemetry('success', 'construction_started', {
    cost,
    buildTime,
    coordinate,
  });
  
  // Deduct costs and add to construction queue
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { 
            ...p, 
            stars: p.stars - cost.stars,
            stats: {
              ...p.stats,
              faith: p.stats.faith - (cost.faith || 0),
              pride: p.stats.pride - (cost.pride || 0),
            },
            constructionQueue: [...(p.constructionQueue || []), constructionItem]
          }
        : p
    ),
  };
}

// Build Improvement Handler
function handleBuildImprovement(
  state: GameState,
  payload: { playerId: string; coordinate: any; improvementType: string; cityId: string }
): GameState {
  const { playerId, coordinate, improvementType, cityId } = payload;
  
  const improvementDef = IMPROVEMENT_DEFINITIONS[improvementType as keyof typeof IMPROVEMENT_DEFINITIONS];
  if (!improvementDef) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Check if player can afford the improvement
  if (player.stars < improvementDef.cost) return state;
  
  // Check if player has required technology
  if (!player.researchedTechs.includes(improvementDef.requiredTech)) return state;
  
  // Find the target tile
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === coordinate.q &&
    tile.coordinate.r === coordinate.r
  );
  if (!targetTile) return state;
  
  // Validate terrain compatibility
  if (!improvementDef.validTerrain.includes(targetTile.terrain)) return state;
  
  // Check if tile is explored by player
  if (!targetTile.exploredBy.includes(playerId)) return state;
  
  // Check if tile already has an improvement
  const existingImprovement = state.improvements?.find(imp => 
    imp.coordinate.q === coordinate.q && imp.coordinate.r === coordinate.r
  );
  if (existingImprovement) return state;
  
  // Create new improvement with proper typing
  const newImprovement = {
    id: `${improvementType}_${coordinate.q}_${coordinate.r}_${Date.now()}`,
    type: improvementType as keyof typeof IMPROVEMENT_DEFINITIONS,
    coordinate,
    ownerId: playerId,
    starProduction: improvementDef.starProduction,
    cityId,
    constructionTurns: 0 // Built immediately for now
  };
  
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - improvementDef.cost }
        : p
    ),
    improvements: [...(state.improvements || []), newImprovement]
  };
}

// Build Structure Handler
function handleBuildStructure(
  state: GameState,
  payload: { playerId: string; cityId: string; structureType: string }
): GameState {
  const { playerId, cityId, structureType } = payload;
  
  const structureDef = STRUCTURE_DEFINITIONS[structureType as keyof typeof STRUCTURE_DEFINITIONS];
  if (!structureDef) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Check if player can afford the structure
  if (player.stars < structureDef.cost) return state;
  
  // Check if player has required technology
  if (!player.researchedTechs.includes(structureDef.requiredTech)) return state;
  
  // Find the target city
  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;
  
  // Check if player owns the city
  if (!player.citiesOwned.includes(cityId)) return state;
  
  // Check if city already has this structure type
  const existingStructure = state.structures?.find(structure => 
    structure.cityId === cityId && structure.type === structureType
  );
  if (existingStructure) return state;
  
  // Create new structure with proper typing
  const newStructure = {
    id: `${structureType}_${cityId}_${Date.now()}`,
    type: structureType as keyof typeof STRUCTURE_DEFINITIONS,
    cityId,
    ownerId: playerId,
    constructionTurns: 0, // Built immediately for now
    effects: structureDef.effects
  };
  
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - structureDef.cost }
        : p
    ),
    structures: [...(state.structures || []), newStructure]
  };
}

// Capture City Handler
function handleCaptureCity(
  state: GameState,
  payload: { playerId: string; cityId: string }
): GameState {
  const { playerId, cityId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Find the target city
  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;
  
  // Check if city is already owned by this player
  if (player.citiesOwned.includes(cityId)) return state;
  
  // Find city tile to verify player can reach it
  const cityTile = state.map.tiles.find(tile => 
    tile.coordinate.q === targetCity.coordinate.q &&
    tile.coordinate.r === targetCity.coordinate.r &&
    tile.hasCity
  );
  if (!cityTile) return state;
  
  // Check if player has a unit adjacent to or on the city tile
  const playerUnits = state.units.filter(unit => unit.playerId === playerId);
  const canCapture = playerUnits.some(unit => {
    const distance = Math.max(
      Math.abs(unit.coordinate.q - targetCity.coordinate.q),
      Math.abs(unit.coordinate.r - targetCity.coordinate.r),
      Math.abs(unit.coordinate.s - targetCity.coordinate.s)
    );
    return distance <= 1; // Adjacent or on the tile
  });
  
  if (!canCapture) return state;
  
  // Remove city from previous owner and add to new owner
  const updatedPlayers = state.players.map(p => {
    if (p.citiesOwned.includes(cityId)) {
      // Remove from previous owner
      return {
        ...p,
        citiesOwned: p.citiesOwned.filter(id => id !== cityId)
      };
    } else if (p.id === playerId) {
      // Add to new owner
      return {
        ...p,
        citiesOwned: [...p.citiesOwned, cityId]
      };
    }
    return p;
  });
  
  // Update city ownership
  const updatedCities = state.cities?.map(city =>
    city.id === cityId
      ? { ...city, ownerId: playerId }
      : city
  );
  
  // Apply capture rules for structures based on game configuration
  let updatedStructures = state.structures || [];
  if (GAME_RULES.capture.destroyAllStructures) {
    // Destroy all structures in captured city
    updatedStructures = updatedStructures.filter(structure => 
      structure.cityId !== cityId
    );
  } else if (GAME_RULES.capture.transferStructures) {
    // Transfer structures to new owner
    updatedStructures = updatedStructures.map(structure =>
      structure.cityId === cityId
        ? { ...structure, ownerId: playerId }
        : structure
    );
  }

  // Apply capture rules for improvements
  let updatedImprovements = state.improvements || [];
  if (GAME_RULES.capture.destroyImprovements) {
    // Destroy improvements near captured city
    updatedImprovements = updatedImprovements.filter(improvement =>
      improvement.cityId !== cityId
    );
  } else if (GAME_RULES.capture.transferImprovements) {
    // Transfer improvements to new owner
    updatedImprovements = updatedImprovements.map(improvement =>
      improvement.cityId === cityId
        ? { ...improvement, ownerId: playerId }
        : improvement
    );
  }
  
  return {
    ...state,
    players: updatedPlayers,
    cities: updatedCities,
    structures: updatedStructures,
    improvements: updatedImprovements
  };
}

// Capture Village Handler
function handleCaptureVillage(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  // Find the unit attempting to capture
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Find the village tile at the unit's current position
  const villageTile = state.map.tiles.find(tile => 
    tile.coordinate.q === unit.coordinate.q &&
    tile.coordinate.r === unit.coordinate.r &&
    tile.feature === 'village'
  );
  
  if (!villageTile) return state;
  
  // Check if village is already captured by this player
  if (villageTile.cityOwner === playerId) return state;
  
  // Find the player
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Capture the village - update tile ownership and give rewards
  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === unit.coordinate.q && 
        tile.coordinate.r === unit.coordinate.r && 
        tile.feature === 'village') {
      return {
        ...tile,
        cityOwner: playerId,
        exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
      };
    }
    return tile;
  });
  
  // Give rewards to the player (stars and possibly tech boost)
  const VILLAGE_STAR_REWARD = 5;
  const VILLAGE_TECH_BOOST = 1;
  
  const updatedPlayers = state.players.map(p => {
    if (p.id === playerId) {
      return {
        ...p,
        stars: p.stars + VILLAGE_STAR_REWARD,
        researchInspiration: GameRuleHelpers.clampInspiration((p.researchInspiration || 0) + VILLAGE_TECH_BOOST)
      };
    }
    return p;
  });
  
  // Exhaust the unit after capturing
  const updatedUnits = state.units.map(u => 
    u.id === unitId 
      ? { ...u, remainingMovement: 0, hasAttacked: true }
      : u
  );
  
  return {
    ...state,
    map: {
      ...state.map,
      tiles: updatedMapTiles
    },
    players: updatedPlayers,
    units: updatedUnits
  };
}

// World Element Action Handlers
function handleWorldElementHarvest(
  state: GameState,
  payload: { playerId: string; elementId: string; coordinate: HexCoordinate }
): GameState {
  const result = executeElementHarvest(state, payload.playerId, payload.elementId, payload.coordinate);
  
  if (result.success && result.newState) {
    emitTelemetry({
      channel: 'system',
      status: 'success',
      playerId: payload.playerId,
      reason: 'world_element_harvest_success',
      metadata: {
        elementId: payload.elementId,
        coordinate: payload.coordinate,
        message: result.message,
        deltas: result.resourceDeltas,
        effects: result.effects,
      },
    });
    return result.newState;
  }

  emitTelemetry({
    channel: 'system',
    status: 'blocked',
    playerId: payload.playerId,
    reason: 'world_element_harvest_blocked',
    metadata: {
      elementId: payload.elementId,
      coordinate: payload.coordinate,
      message: result.message,
    },
  });
  
  return state;
}

function handleWorldElementBuild(
  state: GameState,
  payload: { playerId: string; elementId: string; coordinate: HexCoordinate }
): GameState {
  const result = executeElementBuild(state, payload.playerId, payload.elementId, payload.coordinate);
  
  if (result.success && result.newState) {
    emitTelemetry({
      channel: 'system',
      status: 'success',
      playerId: payload.playerId,
      reason: 'world_element_build_success',
      metadata: {
        elementId: payload.elementId,
        coordinate: payload.coordinate,
        message: result.message,
        deltas: result.resourceDeltas,
        effects: result.effects,
      },
    });
    return result.newState;
  }

  emitTelemetry({
    channel: 'system',
    status: 'blocked',
    playerId: payload.playerId,
    reason: 'world_element_build_blocked',
    metadata: {
      elementId: payload.elementId,
      coordinate: payload.coordinate,
      message: result.message,
    },
  });
  
  return state;
}

// Recruit Unit Handler
function handleRecruitUnit(
  state: GameState,
  payload: { playerId: string; cityId: string; unitType: string }
): GameState {
  const { playerId, cityId, unitType } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  // Get unit definition and validate
  const unitDef = getUnitDefinition(unitType as any);
  if (!unitDef) return state;
  
  // Check if player can afford the unit
  if (player.stars < unitDef.cost) return state;
  
  // Find the target city
  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;
  
  // Check if player owns the city
  if (!player.citiesOwned.includes(cityId)) return state;
  
  // Check unit requirements (faith, pride, etc.)
  if (unitDef.requirements) {
    if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return state;
    if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return state;
    if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) return state;
  }
  
  // Check faction restrictions
  const playerFaction = state.players.find(p => p.id === playerId)?.factionId;
  if (unitDef.factionSpecific.length > 0 && (!playerFaction || !unitDef.factionSpecific.includes(playerFaction))) {
    return state;
  }
  
  // Check if city has space for new units (max units rule)
  const existingCityUnits = state.units.filter(unit => 
    unit.coordinate.q === targetCity.coordinate.q &&
    unit.coordinate.r === targetCity.coordinate.r
  );
  if (existingCityUnits.length >= GAME_RULES.units.maxUnitsPerCity) return state;
  
  // Create new unit with proper typing
  const newUnit = {
    id: `${unitType}_${playerId}_${Date.now()}`,
    type: unitType as UnitType,
    playerId,
    coordinate: targetCity.coordinate,
    hp: unitDef.baseStats.hp,
    maxHp: unitDef.baseStats.hp,
    attack: unitDef.baseStats.attack,
    defense: unitDef.baseStats.defense,
    movement: unitDef.baseStats.movement,
    remainingMovement: unitDef.baseStats.movement,
    status: 'active' as const,
    abilities: unitDef.abilities,
    level: 1,
    experience: 0,
    visionRadius: unitDef.baseStats.visionRadius,
    attackRange: unitDef.baseStats.attackRange,
    hasAttacked: false
  };
  
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - unitDef.cost }
        : p
    ),
    units: [...state.units, newUnit]
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE_UNIT':
      return handleMoveUnit(state, action.payload);
    
    case 'ATTACK_UNIT':
      return handleAttackUnit(state, action.payload);
    
    case 'USE_ABILITY':
      return handleUseAbility(state, action.payload);
    
    case 'END_TURN':
      return handleEndTurn(state, action.payload);
    
    case 'BUILD_UNIT':
      return handleBuildUnit(state, action.payload);
    
    case 'RESEARCH_TECH':
      return handleResearchTech(state, action.payload);
    
    case 'BUILD_IMPROVEMENT':
      return handleBuildImprovement(state, action.payload);
    
    case 'START_CONSTRUCTION':
      return handleStartConstruction(state, action.payload);
    
    case 'BUILD_STRUCTURE':
      return handleBuildStructure(state, action.payload);
    
    case 'CAPTURE_CITY':
      return handleCaptureCity(state, action.payload);
    
    case 'CAPTURE_VILLAGE':
      return handleCaptureVillage(state, action.payload);
    
    case 'RECRUIT_UNIT':
      return handleRecruitUnit(state, action.payload);
    
    case 'ESTABLISH_TRADE_ROUTE':
      return handleEstablishTradeRoute(state, action.payload);
    
    case 'DECLARE_WAR':
      return handleDeclareWar(state, action.payload);
    
    case 'FORM_ALLIANCE':
      return handleFormAlliance(state, action.payload);
    
    case 'CONVERT_CITY':
      return handleConvertCity(state, action.payload);
    
    case 'UPGRADE_UNIT':
      return handleUpgradeUnit(state, action.payload);
    
    case 'UNIT_ACTION':
      return handleUnitAction(state, action.payload);
    
    case 'HEAL_UNIT':
      return handleHealUnit(state, action.payload);
    
    case 'APPLY_STEALTH':
      return handleApplyStealth(state, action.payload);
    
    case 'RECONNAISSANCE':
      return handleReconnaissance(state, action.payload);
    
    case 'FORMATION_FIGHTING':
      return handleFormationFighting(state, action.payload);
    
    case 'SIEGE_MODE':
      return handleSiegeMode(state, action.payload);
    
    case 'RALLY_TROOPS':
      return handleRallyTroops(state, action.payload);
    
    case 'RESEARCH_TECHNOLOGY':
      return handleResearchTechnology(state, action.payload);
    
    case 'ACTIVATE_FACTION_ABILITY':
      return handleActivateFactionAbility(state, action.payload);
    
    case 'HARVEST_RESOURCE':
      return handleHarvestResource(state, action.payload);
    
    case 'CLEAR_FOREST':
      return handleClearForest(state, action.payload);
    
    case 'BUILD_ROAD':
      return handleBuildRoad(state, action.payload);
    
    case 'WORLD_ELEMENT_HARVEST':
      return handleWorldElementHarvest(state, action.payload);
    
    case 'WORLD_ELEMENT_BUILD':
      return handleWorldElementBuild(state, action.payload);
    
    default:
      return state;
  }
}

function handleMoveUnit(
  state: GameState, 
  payload: { unitId: string; targetCoordinate: any }
): GameState {
  const unit = state.units.find((u: Unit) => u.id === payload.unitId);
  if (!unit) {
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) {
    return state;
  }

  // Check if movement is valid
  const distance = hexDistance(unit.coordinate, payload.targetCoordinate);
  if (distance > unit.remainingMovement) {
    return state;
  }

  // Check if target tile is passable using centralized logic
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === payload.targetCoordinate.q &&
    tile.coordinate.r === payload.targetCoordinate.r
  );
  if (!targetTile) {
    return state;
  }

  // Check basic terrain passability
  if (GAME_RULES.terrain.impassableTypes.includes(targetTile.terrain)) {
    return state;
  }
  
  // Allow units to move and explore - no additional blocking logic needed

  // Update unit position and movement
  const updatedUnits = state.units.map((u: Unit) => 
    u.id === payload.unitId 
      ? { 
          ...u, 
          coordinate: payload.targetCoordinate,
          remainingMovement: u.remainingMovement - distance
        }
      : u
  );

  // Use unit's actual vision radius from definition
  const unitDef = getUnitDefinition(unit.type);
  const visionRadius = unitDef.baseStats.visionRadius;
  const visibleTiles: string[] = [];
  
  // Get all tiles within vision radius
  for (let q = payload.targetCoordinate.q - visionRadius; q <= payload.targetCoordinate.q + visionRadius; q++) {
    for (let r = payload.targetCoordinate.r - visionRadius; r <= payload.targetCoordinate.r + visionRadius; r++) {
      const s = -q - r;
      const distance = Math.max(Math.abs(q - payload.targetCoordinate.q), 
                               Math.abs(r - payload.targetCoordinate.r), 
                               Math.abs(s - payload.targetCoordinate.s));
      
      if (distance <= visionRadius) {
        visibleTiles.push(`${q},${r}`);
      }
    }
  }
  
  const updatedPlayers = state.players.map(player => 
    player.id === currentPlayer.id
      ? {
          ...player,
          visibilityMask: Array.from(new Set([...player.visibilityMask, ...visibleTiles])),
          exploredTiles: Array.from(new Set([...player.exploredTiles, ...visibleTiles]))
        }
      : player
  );

  // Update explored tiles - explore all visible tiles
  const updatedTiles = state.map.tiles.map(tile => {
    const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
    if (visibleTiles.includes(tileKey)) {
      return {
        ...tile,
        exploredBy: Array.from(new Set([...tile.exploredBy, currentPlayer.id]))
      };
    }
    return tile;
  });

  let newState = {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    map: {
      ...state.map,
      tiles: updatedTiles
    }
  };

  // Auto-capture village if unit moved onto one
  if (targetTile.feature === 'village' && targetTile.cityOwner !== currentPlayer.id) {
    newState = handleCaptureVillage(newState, {
      unitId: payload.unitId,
      playerId: currentPlayer.id
    });
  }

  // Auto-explore Jaredite Ruins if unit moved onto one
  if (targetTile.resources.includes('jaredite_ruins')) {
    newState = handleWorldElementHarvest(newState, {
      playerId: currentPlayer.id,
      elementId: 'jaredite_ruins',
      coordinate: payload.targetCoordinate
    });
  }

  const terrainAdjustedUnits = enforceTerrainBoundEffects(newState.units, newState.map);
  const finalUnits = applyProtectiveBonuses(terrainAdjustedUnits, recalculateProtectiveBonuses(terrainAdjustedUnits));

  return {
    ...newState,
    units: finalUnits,
  };
}

function handleAttackUnit(
  state: GameState,
  payload: { attackerId: string; targetId: string }
): GameState {
  const attacker = state.units.find((u: Unit) => u.id === payload.attackerId);
  const defender = state.units.find((u: Unit) => u.id === payload.targetId);
  
  if (!attacker || !defender) return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (attacker.playerId !== currentPlayer.id) return state;

  if (attacker.playerId === defender.playerId) return state;
  if (attacker.hasAttacked) return state;

  const attackerAbilities = getAbilitySet(attacker);
  const defenderAbilities = getAbilitySet(defender);
  if (attackerAbilities.has('PACIFIST_DEFENSE')) return state;

  const distance = hexDistance(attacker.coordinate, defender.coordinate);
  if (distance > attacker.attackRange) return state;
  if (distance > 1 && attacker.attackRange > 1 && attacker.type === 'catapult' && attacker.status !== 'siege_mode') {
    emitTelemetry({
      channel: 'combat',
      status: 'blocked',
      attackerId: attacker.id,
      defenderId: defender.id,
      reason: 'catapult_not_deployed',
      metadata: { distance },
    });
    return state;
  }
  if (defender.status === 'stealthed' && distance > 1) return state;

  const attackerPlayer = state.players.find(p => p.id === attacker.playerId);
  const defenderPlayer = state.players.find(p => p.id === defender.playerId);
  let updatedPlayers = state.players;

  if (attacker.type === 'catapult' && attacker.attackRange > 1 && distance > 1) {
    const bombardment = calculateRangedAttack(state, attacker, defender.coordinate);
    if (!bombardment.success) {
      emitTelemetry({
        channel: 'combat',
        status: 'info',
        attackerId: attacker.id,
        defenderId: defender.id,
        reason: 'bombardment_no_targets',
      });
      return state;
    }

    const damageMap = new Map<string, number>();
    bombardment.impacts.forEach(impact => {
      damageMap.set(impact.unit.id, impact.damage);
    });

    let updatedUnits = state.units.map(unit => {
      if (unit.id === attacker.id) {
        const newStatus = unit.status === 'stealthed' ? 'active' : unit.status;
        return {
          ...unit,
          hasAttacked: true,
          remainingMovement: 0,
          status: newStatus,
        };
      }
      const damage = damageMap.get(unit.id);
      if (damage) {
        return { ...unit, hp: Math.max(0, unit.hp - damage) };
      }
      return unit;
    });

    const casualties = bombardment.impacts
      .filter(impact => impact.unit.id !== attacker.id)
      .map(impact => impact.unit)
      .filter(unit => {
        const updated = updatedUnits.find(u => u.id === unit.id);
        return updated && updated.hp <= 0;
      });

    casualties.forEach(deadUnit => {
      const result = applyUnitDeathEffects(state, updatedUnits, updatedPlayers, deadUnit);
      updatedUnits = result.units;
      updatedPlayers = result.players;
    });

    emitTelemetry({
      channel: 'combat',
      status: 'success',
      attackerId: attacker.id,
      defenderId: defender.id,
      damage: damageMap.get(defender.id) ?? 0,
      metadata: {
        type: 'bombardment',
        impacts: bombardment.impacts.map(impact => ({
          unitId: impact.unit.id,
          damage: impact.damage,
          isCenter: impact.isCenter,
        })),
      },
    });

    updatedUnits = enforceTerrainBoundEffects(updatedUnits, state.map);
    updatedUnits = applyProtectiveBonuses(updatedUnits, recalculateProtectiveBonuses(updatedUnits));

    return {
      ...state,
      units: updatedUnits,
      players: updatedPlayers,
    };
  }

  let attackBonus = 0;
  let defenseBonus = 0;
  let counterAttackBonus = 0;
  let counterDefenseBonus = 0;

  if (attackerPlayer) {
    const attackModifiers = getActiveModifiers(attackerPlayer, 'on_attack');
    attackModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.stat === 'attack' && effect.target === 'self') {
          attackBonus += effect.value;
        }
      });
    });
  }

  if (defenderPlayer) {
    const defenseModifiers = getActiveModifiers(defenderPlayer, 'on_defend');
    defenseModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.stat === 'defense' && effect.target === 'self') {
          defenseBonus += effect.value;
        }
      });
    });
  }

  if (defenderPlayer) {
    const counterAttackModifiers = getActiveModifiers(defenderPlayer, 'on_attack');
    counterAttackModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.stat === 'attack' && effect.target === 'self') {
          counterAttackBonus += effect.value;
        }
      });
    });
  }

  if (attackerPlayer) {
    const counterDefenseModifiers = getActiveModifiers(attackerPlayer, 'on_defend');
    counterDefenseModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.stat === 'defense' && effect.target === 'self') {
          counterDefenseBonus += effect.value;
        }
      });
    });
  }

  const outcome = resolveMeleeCombat(state, attacker, defender, {
    attackBonus,
    defenseBonus,
    counterAttackBonus,
    counterDefenseBonus,
  });

  if (outcome.negotiation && attackerPlayer && defenderPlayer) {
    emitTelemetry({
      channel: 'combat',
      status: 'blocked',
      attackerId: attacker.id,
      defenderId: defender.id,
      reason: outcome.reason || 'diplomacy',
      metadata: { events: outcome.events },
    });
    const updatedPlayers = state.players.map(player => {
      if (player.id === attackerPlayer.id) {
        return {
          ...player,
          stats: {
            ...player.stats,
            pride: Math.max(0, player.stats.pride + outcome.negotiation!.attackerPrideDelta),
          },
        };
      }
      if (player.id === defenderPlayer.id) {
        return {
          ...player,
          stats: {
            ...player.stats,
            internalDissent: Math.max(0, player.stats.internalDissent + outcome.negotiation!.defenderDissentDelta),
          },
        };
      }
      return player;
    });
    return {
      ...state,
      players: updatedPlayers,
    };
  }

  if (!outcome.success) {
    return state;
  }

  const newHp = Math.max(0, defender.hp - outcome.damageToDefender);
  const attackerRemainingHp = Math.max(0, attacker.hp - outcome.damageToAttacker);
  emitTelemetry({
    channel: 'combat',
    status: 'success',
    attackerId: attacker.id,
    defenderId: defender.id,
    damage: outcome.damageToDefender,
    metadata: {
      events: outcome.events,
      counterEvents: outcome.counterEvents,
      counterDamage: outcome.damageToAttacker,
      defenderSurvived: outcome.defenderSurvived,
      counterOccurred: outcome.counterOccurred,
    },
  });
  const counterSummary = outcome.damageToAttacker > 0
    ? ` ${defender.type} counters for ${outcome.damageToAttacker}.`
    : '';
  const counterEventSummary =
    outcome.counterEvents.length > 0 ? ` Counter events: ${outcome.counterEvents.join(', ')}.` : '';

  let updatedUnits = state.units.map(unit => {
    if (unit.id === defender.id) {
      return { ...unit, hp: newHp };
    }
    if (unit.id === attacker.id) {
      const newStatus = unit.status === 'stealthed' ? 'active' : unit.status;
      return { ...unit, hp: attackerRemainingHp, hasAttacked: true, status: newStatus };
    }
    return unit;
  });

  if (newHp <= 0) {
    const result = applyUnitDeathEffects(state, updatedUnits, updatedPlayers, defender);
    updatedUnits = result.units;
    updatedPlayers = result.players;
  }

  if (attackerRemainingHp <= 0) {
    const result = applyUnitDeathEffects(state, updatedUnits, updatedPlayers, attacker);
    updatedUnits = result.units;
    updatedPlayers = result.players;
  }

  if (defenderAbilities.has('NON_VIOLENCE')) {
    updatedPlayers = updatedPlayers.map(player => {
      if (player.id !== attacker.playerId) return player;
      return {
        ...player,
        stats: {
          ...player.stats,
          pride: Math.max(0, player.stats.pride - 2),
        },
      };
    });
  }

  updatedUnits = enforceTerrainBoundEffects(updatedUnits, state.map);
  updatedUnits = applyProtectiveBonuses(updatedUnits, recalculateProtectiveBonuses(updatedUnits));

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function handleUseAbility(
  state: GameState,
  payload: { playerId: string; abilityId: string; target?: any; unitId?: string; targetCoordinate?: any; targetUnitId?: string }
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const ability = ABILITIES[payload.abilityId];
  if (!ability) {
    emitTelemetry({
      channel: 'ability',
      status: 'error',
      abilityId: payload.abilityId,
      playerId: player.id,
      reason: 'missing',
    });
    return state;
  }

  const activeCooldown = player.abilityCooldowns?.[ability.id] ?? 0;
  if (activeCooldown > 0) {
    emitTelemetry({
      channel: 'ability',
      status: 'blocked',
      abilityId: ability.id,
      playerId: player.id,
      reason: 'cooldown',
      metadata: { remaining: activeCooldown },
    });
    return state;
  }

  // Check resource requirements
  const unmet: string[] = [];
  if (ability.requirements) {
    if (ability.requirements.faith && player.stats.faith < ability.requirements.faith) {
      unmet.push(`faith:${player.stats.faith}/${ability.requirements.faith}`);
    }
    if (ability.requirements.pride && player.stats.pride < ability.requirements.pride) {
      unmet.push(`pride:${player.stats.pride}/${ability.requirements.pride}`);
    }
    if (ability.requirements.dissent && player.stats.internalDissent < ability.requirements.dissent) {
      unmet.push(`dissent:${player.stats.internalDissent}/${ability.requirements.dissent}`);
    }
  }

  if (unmet.length > 0) {
    emitTelemetry({
      channel: 'ability',
      status: 'blocked',
      abilityId: ability.id,
      playerId: player.id,
      reason: 'requirements',
      metadata: { unmet },
    });
    return state;
  }

  let abilityResultState = state;

  // Implement specific ability effects
  switch (payload.abilityId) {
    case 'TITLE_OF_LIBERTY':
      abilityResultState = applyTitleOfLiberty(state, player, ability);
      break;
    case 'RAMEUMPTOM':
      abilityResultState = applyRameumptom(state, player);
      break;
    case 'COVENANT_OF_PEACE':
      abilityResultState = applyCovenantOfPeace(state, player, payload);
      break;
    case 'RIGHTEOUS_DEFENSE':
      abilityResultState = applyRighteousDefense(state, player, ability);
      break;
    case 'MISSIONARY_ZEAL':
      abilityResultState = applyMissionaryZeal(state, player, ability);
      break;
    case 'WARRIOR_RAGE':
      abilityResultState = applyWarriorRage(state, player, ability);
      break;
    case 'ANCIENT_KNOWLEDGE':
      abilityResultState = applyFactionAncientKnowledge(state, player, ability);
      break;
    case 'CULTURAL_RECLAMATION':
      abilityResultState = applyCulturalReclamation(state, player, ability);
      break;
    case 'WEALTH_ACCUMULATION':
      abilityResultState = toggleWealthAccumulation(state, player);
      break;
    case 'ANCIENT_MIGHT':
      abilityResultState = applyAncientMight(state, player, ability);
      break;
    case 'PROPHETIC_COLLAPSE':
      abilityResultState = applyPropheticCollapse(state, player, ability);
      break;
    case 'DIVINE_WARD':
      abilityResultState = applyDivineWard(state, player, payload);
      break;
    case 'SPIRITUAL_WARFARE':
      abilityResultState = applySpiritualWarfare(state, player);
      break;
    case 'RIGHTEOUS_FURY':
      abilityResultState = applyRighteousFury(state, player, payload);
      break;
    
    // Nephite faction abilities
    case 'nephite_righteous_charge':
      abilityResultState = applyRighteousCharge(state, payload);
      break;
    case 'nephite_faith_healing':
      abilityResultState = applyFaithHealing(state, payload);
      break;
    
    // Lamanite faction abilities  
    case 'lamanite_guerrilla_tactics':
      abilityResultState = applyGuerrillaTactics(state, payload, ability);
      break;
    case 'lamanite_ancestral_rage':
      abilityResultState = applyAncestralRage(state, payload);
      break;
    
    // Zoramite faction abilities
    case 'zoramite_convert_enemy':
      abilityResultState = applyConvertEnemy(state, payload, ability);
      break;
    case 'zoramite_pride_boost':
      abilityResultState = applyPrideBoost(state, payload, ability);
      break;
    
    // Jaredite faction abilities
    case 'jaredite_tower_vision':
      abilityResultState = applyTowerVision(state, payload, ability);
      break;
    case 'jaredite_ancient_knowledge':
      abilityResultState = applyAncientKnowledge(state, payload);
      break;
    
    // Anti-Nephi-Lehi faction abilities
    case 'anti_nephi_lehi_pacify':
      abilityResultState = applyPacify(state, payload);
      break;
    case 'anti_nephi_lehi_conversion':
      abilityResultState = applyConversion(state, payload);
      break;
    
    // Mulekite faction abilities
    case 'mulekite_trade_network':
      abilityResultState = applyTradeNetwork(state, payload);
      break;
    case 'mulekite_maritime_expansion':
      abilityResultState = applyMaritimeExpansion(state, payload);
      break;
    default:
      emitTelemetry({
        channel: 'ability',
        status: 'error',
        abilityId: ability.id,
        playerId: player.id,
        reason: 'unimplemented',
      });
      return state;
  }

  if (abilityResultState === state) {
    emitTelemetry({
      channel: 'ability',
      status: 'info',
      abilityId: ability.id,
      playerId: player.id,
      reason: 'no_effect',
    });
    return state;
  }

  emitTelemetry({
    channel: 'ability',
    status: 'success',
    abilityId: ability.id,
    playerId: player.id,
    metadata: { cooldown: ability.cooldown ?? 0 },
  });

  const cooldownValue = ability.cooldown && ability.cooldown > 0 ? ability.cooldown : 0;
  if (cooldownValue === 0) {
    return abilityResultState;
  }

  return {
    ...abilityResultState,
    players: abilityResultState.players.map(p => {
      if (p.id !== player.id) return p;
      const nextCooldowns = { ...(p.abilityCooldowns || {}) };
      nextCooldowns[ability.id] = cooldownValue;
      return {
        ...p,
        abilityCooldowns: nextCooldowns,
      };
    }),
  };
}

function handleEndTurn(
  state: GameState,
  payload: { playerId: string }
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== payload.playerId) return state;

  // Apply end-of-turn effects for current player
  let updatedPlayers = state.players.map(player => {
    if (player.id === currentPlayer.id) {
      const endTurnModifiers = getActiveModifiers(player, 'on_turn_end');
      let updatedStats = { ...player.stats };
      
      endTurnModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.stat === 'pride' || effect.stat === 'faith' || effect.stat === 'internalDissent') {
            updatedStats = {
              ...updatedStats,
              [effect.stat]: Math.max(0, Math.min(100, updatedStats[effect.stat as keyof typeof updatedStats] + effect.value))
            };
          }
        });
      });

      // Resource generation from cities and improvements using centralized rules
      const playerCities = player.citiesOwned.length;
      
      // Calculate base income from cities using Polytopia-style mechanics
      const faithGeneration = GameRuleHelpers.calculateFaithGeneration(playerCities);
      
      // Calculate star income based on city levels and production
      let starIncome = 0;
      const playerCityObjects = state.cities?.filter(city => city.ownerId === player.id) || [];
      playerCityObjects.forEach(city => {
        starIncome += city.starProduction;
      });
      
      // Add base star income if no cities (fallback)
      if (playerCityObjects.length === 0) {
        starIncome = GameRuleHelpers.calculateStarIncome(playerCities);
      }
      
      // Add income from improvements
      const playerImprovements = state.improvements?.filter(imp => imp.ownerId === player.id) || [];
      
      playerImprovements.forEach(improvement => {
        const improvementDef = IMPROVEMENT_DEFINITIONS[improvement.type as keyof typeof IMPROVEMENT_DEFINITIONS];
        if (improvementDef && improvement.constructionTurns === 0) {
          starIncome += improvement.starProduction;
        }
      });
      
      // Add income from structures
      const playerStructures = state.structures?.filter(struct => struct.ownerId === player.id) || [];
      
      playerStructures.forEach(structure => {
        const structureDef = STRUCTURE_DEFINITIONS[structure.type as keyof typeof STRUCTURE_DEFINITIONS];
        if (structureDef && structure.constructionTurns === 0) {
          starIncome += structure.effects.starProduction;
        }
      });
      
      updatedStats.faith = Math.min(100, updatedStats.faith + faithGeneration);
      
      // Process construction queue
      const updatedConstructionQueue = (player.constructionQueue || []).map(item => ({
        ...item,
        turnsRemaining: item.turnsRemaining - 1
      }));
      
      // Complete finished constructions
      const completedConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining <= 0);
      const ongoingConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining > 0);
      
      return { 
        ...player, 
        stats: updatedStats,
        stars: player.stars + starIncome,
        constructionQueue: ongoingConstructions,
        completedConstructions // We'll handle this below
      };
    }
    return player;
  });

  updatedPlayers = updatedPlayers.map(player => {
    const hasWealth = (player.modifiers || []).some((modifier: any) => modifier?.id === 'WEALTH_ACCUMULATION_ACTIVE');
    if (!hasWealth) return player;

    const playerCities = (state.cities || []).filter(city => city.ownerId === player.id);
    const bonusStars = playerCities.length;
    const penalty = Math.max(1, Math.ceil(playerCities.length / 2));

    return {
      ...player,
      stars: player.stars + bonusStars,
      stats: {
        ...player.stats,
        faith: Math.max(0, player.stats.faith - penalty),
        internalDissent: Math.min(100, player.stats.internalDissent + penalty),
      },
    };
  });

  updatedPlayers = updatedPlayers.map(player => {
    const cooldowns = player.abilityCooldowns || {};
    let changed = false;
    const nextCooldowns: Record<string, number> = {};

    Object.entries(cooldowns).forEach(([abilityId, value]) => {
      if (value <= 0) {
        changed = true;
        return;
      }
      const nextValue = value - 1;
      if (nextValue > 0) {
        nextCooldowns[abilityId] = nextValue;
      }
      if (nextValue !== value) {
        changed = true;
      }
    });

    if (!changed) return player;

    return {
      ...player,
      abilityCooldowns: nextCooldowns,
    };
  });

  updatedPlayers = updatedPlayers.map(player => {
    const currentInspiration = player.researchInspiration ?? 0;
    const decayed = GameRuleHelpers.applyInspirationDecay(currentInspiration);
    if (decayed === currentInspiration) {
      return player;
    }
    return {
      ...player,
      researchInspiration: decayed,
    };
  });

  // Process completed constructions and add to game state
  let updatedUnits = [...state.units];
  let updatedImprovements = [...(state.improvements || [])];
  let updatedStructures = [...(state.structures || [])];
  
  updatedPlayers.forEach(player => {
    if ((player as any).completedConstructions) {
      (player as any).completedConstructions.forEach((construction: any) => {
        if (construction.category === 'units') {
          // Create new unit at city location
          const city = state.cities?.find(c => c.id === construction.cityId);
          if (city) {
            const unitDef = getUnitDefinition(construction.type as any);
            const newUnit = {
              id: `unit_${Date.now()}_${Math.random()}`,
              status: 'active' as const,
              type: construction.type,
              playerId: construction.playerId,
              coordinate: city.coordinate,
              remainingMovement: unitDef.baseStats.movement,
              hasAttacked: false,
              hp: unitDef.baseStats.hp,
              maxHp: unitDef.baseStats.hp,
              attack: unitDef.baseStats.attack,
              defense: unitDef.baseStats.defense,
              movement: unitDef.baseStats.movement,
              visionRadius: unitDef.baseStats.visionRadius,
              attackRange: unitDef.baseStats.attackRange,
              abilities: unitDef.abilities || [],
              level: 1,
              experience: 0,
            };
            updatedUnits.push(newUnit);
          }
        } else if (construction.category === 'improvements') {
          // Create new improvement
          const newImprovement = {
            id: construction.id,
            type: construction.type,
            coordinate: construction.coordinate,
            ownerId: construction.playerId,
            starProduction: IMPROVEMENT_DEFINITIONS[construction.type as keyof typeof IMPROVEMENT_DEFINITIONS]?.starProduction || 0,
            cityId: construction.cityId,
            constructionTurns: 0,
          };
          updatedImprovements.push(newImprovement);
        } else if (construction.category === 'structures') {
          // Create new structure
          const structureDef = STRUCTURE_DEFINITIONS[construction.type as keyof typeof STRUCTURE_DEFINITIONS];
          const newStructure = {
            id: construction.id,
            type: construction.type,
            coordinate: construction.coordinate,
            ownerId: construction.playerId,
            effects: structureDef?.effects || { starProduction: 0, defenseBonus: 0, unitProduction: 0 },
            cityId: construction.cityId,
            constructionTurns: 0,
          };
          updatedStructures.push(newStructure);
        }
      });
      
      // Remove completedConstructions from player (temporary property)
      delete (player as any).completedConstructions;
    }
  });

  // Calculate next player and turn
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = updatedPlayers[nextPlayerIndex];
  const isNewTurn = nextPlayerIndex === 0;

  // Apply start-of-turn effects for next player
  updatedPlayers = updatedPlayers.map(player => {
    if (player.id === nextPlayer.id) {
      const startTurnModifiers = getActiveModifiers(player, 'on_turn_start');
      let updatedStats = { ...player.stats };
      
      startTurnModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.stat === 'pride' || effect.stat === 'faith' || effect.stat === 'internalDissent') {
            updatedStats = {
              ...updatedStats,
              [effect.stat]: Math.max(0, Math.min(100, updatedStats[effect.stat as keyof typeof updatedStats] + effect.value))
            };
          }
        });
      });
      
      return { ...player, stats: updatedStats };
    }
    return player;
  });

  // Reset movement and attack status for next player's units at start of their turn
  updatedUnits = updatedUnits.map((u: Unit) => {
    if (u.playerId === nextPlayer.id) {
      // Reset movement and attack state for next player
      const resetUnit = { 
        ...u, 
        hasAttacked: false, 
        remainingMovement: u.movement 
      };
      
      // Clear temporary status effects (keep permanent ones like formation/siege)
      if (u.status === 'rallied') {
        resetUnit.status = 'active';
      }
      
      return resetUnit;
    }
    return u;
  });

  const playerLookup = new Map(updatedPlayers.map(p => [p.id, p]));
  updatedUnits = updatedUnits.map(unit => applyIntrinsicUnitAbilities(unit, playerLookup.get(unit.playerId), state));

  const protectiveBonuses = recalculateProtectiveBonuses(updatedUnits);
  const navalBonuses = new Map<string, number>();
  const intelligenceBonuses = new Map<string, { progress: number; visibility: Set<string> }>();

  updatedUnits.forEach(unit => {
    const abilities = getAbilitySet(unit);
    if (abilities.has('NAVAL_COMMAND')) {
      updatedUnits.forEach(other => {
        if (other.playerId === unit.playerId && other.type === 'boat' && hexDistance(other.coordinate, unit.coordinate) <= 2) {
          navalBonuses.set(other.id, Math.max(navalBonuses.get(other.id) || 0, 1));
        }
      });
    }

    if (abilities.has('INTELLIGENCE')) {
      const city = (state.cities || []).find(c => c.ownerId && c.ownerId !== unit.playerId && hexDistance(c.coordinate, unit.coordinate) <= 1);
      if (city) {
        const entry = intelligenceBonuses.get(unit.playerId) || { progress: 0, visibility: new Set<string>() };
        entry.progress += 2;
        entry.visibility.add(`${city.coordinate.q},${city.coordinate.r}`);
        intelligenceBonuses.set(unit.playerId, entry);
      }
    }
    // Intimidate handled within combat calculations
  });

  updatedUnits = updatedUnits.map(unit => {
    const unitDef = getUnitDefinition(unit.type as any);
    const navalBonus = navalBonuses.get(unit.id) || 0;
    return updatePermanentEffect(unit, unitDef, 'ability::naval_command', 'movement_buff', navalBonus);
  });

  updatedUnits = applyProtectiveBonuses(updatedUnits, protectiveBonuses);
  updatedUnits = enforceTerrainBoundEffects(updatedUnits, state.map);

  if (intelligenceBonuses.size > 0) {
    updatedPlayers = updatedPlayers.map(player => {
      const entry = intelligenceBonuses.get(player.id);
      if (!entry) return player;
      const visibility = Array.from(entry.visibility);
      return {
        ...player,
        researchInspiration: GameRuleHelpers.clampInspiration((player.researchInspiration || 0) + entry.progress),
        visibilityMask: Array.from(new Set([...player.visibilityMask, ...visibility])),
        exploredTiles: Array.from(new Set([...player.exploredTiles, ...visibility])),
      };
    });
  }

  // Decrement temporary ability effects and clean up expired buffs
  updatedUnits = tickUnitTemporaryEffects(updatedUnits);

  // Check for victory conditions
  const updatedStateForVictory: GameState = {
    ...state,
    players: updatedPlayers,
    units: updatedUnits,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: state.cities,
  };

  const winner = checkVictoryConditions(updatedStateForVictory, updatedPlayers);

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: state.cities,
    currentPlayerIndex: nextPlayerIndex,
    turn: isNewTurn ? state.turn + 1 : state.turn,
    winner
  };
}

// Polytopia-style resource harvesting
function handleHarvestResource(
  state: GameState,
  payload: { unitId: string; resourceCoordinate: any; cityId: string }
): GameState {
  const { unitId, resourceCoordinate, cityId } = payload;
  
  // Find the unit
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return state;
  
  // Find the city
  const city = state.cities.find(c => c.id === cityId);
  if (!city || city.ownerId !== unit.playerId) return state;
  
  // Find the resource tile
  const resourceTile = state.map.tiles.find(tile => 
    tile.coordinate.q === resourceCoordinate.q &&
    tile.coordinate.r === resourceCoordinate.r &&
    (tile.terrain === 'forest' || tile.terrain === 'mountain' || tile.resources?.length)
  );
  
  if (!resourceTile) return state;
  
  // Check if resource is within city borders (adjacent to city)
  const distance = hexDistance(city.coordinate, resourceCoordinate);
  if (distance > 2) return state; // Cities control tiles within 2 hex distance
  
  // Check if resource has already been harvested
  const resourceId = `${resourceCoordinate.q},${resourceCoordinate.r}`;
  if (city.harvestedResources.includes(resourceId)) return state;
  
  // Check if player has required technology
  const player = state.players.find(p => p.id === unit.playerId);
  if (!player) return state;
  
  let canHarvest = false;
  if (resourceTile.terrain === 'forest' && player.researchedTechs.includes('forestry')) {
    canHarvest = true;
  } else if (resourceTile.terrain === 'mountain' && player.researchedTechs.includes('mining')) {
    canHarvest = true;
  } else if (resourceTile.resources?.includes('animals') && player.researchedTechs.includes('hunting')) {
    canHarvest = true;
  }
  
  if (!canHarvest) return state;
  
  // Harvest the resource - add population to city
  const updatedCities = state.cities.map(c => {
    if (c.id === cityId) {
      const newPopulation = c.population + 1;
      const shouldLevelUp = newPopulation >= c.maxPopulation;
      
      return {
        ...c,
        population: shouldLevelUp ? 1 : newPopulation, // Reset to 1 when leveling up
        level: shouldLevelUp ? c.level + 1 : c.level,
        maxPopulation: shouldLevelUp ? c.maxPopulation + 2 : c.maxPopulation, // Increase requirement
        starProduction: shouldLevelUp ? c.starProduction + 1 : c.starProduction, // Increase production
        harvestedResources: [...c.harvestedResources, resourceId]
      };
    }
    return c;
  });
  
  // Exhaust the unit after harvesting
  const updatedUnits = state.units.map(u => 
    u.id === unitId 
      ? { ...u, remainingMovement: 0 }
      : u
  );
  
  return {
    ...state,
    cities: updatedCities,
    units: updatedUnits
  };
}

// Clear Forest Handler
function handleClearForest(
  state: GameState,
  payload: { unitId: string; targetCoordinate: any; playerId: string }
): GameState {
  const { unitId, targetCoordinate, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.stars < 5) return state;
  
  // Find the target tile
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === targetCoordinate.q &&
    tile.coordinate.r === targetCoordinate.r
  );
  
  if (!targetTile || targetTile.terrain !== 'forest') return state;
  
  // Check if unit can perform this action
  const unitDef = getUnitDefinition(unit.type);
  if (!unitDef.abilities.includes('CLEAR_FOREST')) return state;
  
  // Check if unit is adjacent or on the tile
  const distance = hexDistance(unit.coordinate, targetCoordinate);
  if (distance > 1) return state;
  
  return {
    ...state,
    players: state.players.map(p => 
      p.id === playerId 
        ? { ...p, stars: p.stars - 5 }
        : p
    ),
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile =>
        tile.coordinate.q === targetCoordinate.q && tile.coordinate.r === targetCoordinate.r
          ? { ...tile, terrain: 'plains' }
          : tile
      )
    },
    units: state.units.map(u => 
      u.id === unitId 
        ? { ...u, remainingMovement: 0 } // Exhaust unit after clearing
        : u
    )
  };
}

// Build Road Handler
function handleBuildRoad(
  state: GameState,
  payload: { unitId: string; targetCoordinate: any; playerId: string }
): GameState {
  const { unitId, targetCoordinate, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.stars < 3) return state;
  
  // Find the target tile
  const targetTile = state.map.tiles.find(tile => 
    tile.coordinate.q === targetCoordinate.q &&
    tile.coordinate.r === targetCoordinate.r
  );
  
  if (!targetTile || targetTile.terrain === 'water' || targetTile.terrain === 'mountain') return state;
  
  // Check if unit can perform this action
  const unitDef = getUnitDefinition(unit.type);
  if (!unitDef.abilities.includes('BUILD_ROAD')) return state;
  
  // Check if unit is adjacent or on the tile
  const distance = hexDistance(unit.coordinate, targetCoordinate);
  if (distance > 1) return state;
  
  // Check if road already exists
  const existingRoad = state.improvements?.find(imp => 
    imp.coordinate.q === targetCoordinate.q && 
    imp.coordinate.r === targetCoordinate.r &&
    imp.type === 'road'
  );
  
  if (existingRoad) return state;
  
  const roadImprovement = {
    id: `road_${targetCoordinate.q}_${targetCoordinate.r}_${Date.now()}`,
    type: 'road' as const,
    coordinate: targetCoordinate,
    ownerId: playerId,
    cityId: '',
    starProduction: 0,
    constructionTurns: 0
  };
  
  return {
    ...state,
    players: state.players.map(p => 
      p.id === playerId 
        ? { ...p, stars: p.stars - 3 }
        : p
    ),
    improvements: [...(state.improvements || []), roadImprovement],
    units: state.units.map(u => 
      u.id === unitId 
        ? { ...u, remainingMovement: 0 } // Exhaust unit after building
        : u
    )
  };
}

// Unit Ability Handlers
function handleHealUnit(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Check if unit has heal ability and hasn't acted
  if (!unit.abilities.includes('heal') || unit.hasAttacked) return state;
  
  // Check faith cost requirement
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.stats.faith < 5) return state;
  
  // Find nearby friendly units to heal (within 2 tiles)
  const healRadius = 2;
  const updatedUnits = state.units.map(u => {
    if (u.playerId === playerId && u.id !== unitId) {
      const distance = hexDistance(unit.coordinate, u.coordinate);
      if (distance <= healRadius && u.hp < u.maxHp) {
        return { ...u, hp: Math.min(u.maxHp, u.hp + 10) };
      }
    }
    return u;
  });
  
  // Mark the healing unit as having acted and consume faith
  const updatedHealingUnits = updatedUnits.map(u => 
    u.id === unitId ? { ...u, hasAttacked: true } : u
  );
  
  const updatedPlayers = state.players.map(p => 
    p.id === playerId 
      ? { ...p, stats: { ...p.stats, faith: p.stats.faith - 5 } }
      : p
  );
  
  return {
    ...state,
    units: updatedHealingUnits,
    players: updatedPlayers
  };
}

function handleApplyStealth(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Check if unit has stealth ability and hasn't acted
  if (!unit.abilities.includes('stealth') || unit.hasAttacked) return state;
  if (unit.status === 'stealthed') return state;
  
  const updatedUnits = state.units.map(u => 
    u.id === unitId 
      ? { ...u, status: 'stealthed' as const, hasAttacked: true }
      : u
  );
  
  return {
    ...state,
    units: updatedUnits
  };
}

function handleReconnaissance(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Check if unit has reconnaissance ability and hasn't acted
  if (!unit.abilities.includes('reconnaissance') || unit.hasAttacked) return state;
  
  // Reveal large area around unit (radius 4)
  const reconRadius = 4;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  
  const newVisibleTiles: string[] = [];
  for (let q = unit.coordinate.q - reconRadius; q <= unit.coordinate.q + reconRadius; q++) {
    for (let r = unit.coordinate.r - reconRadius; r <= unit.coordinate.r + reconRadius; r++) {
      const s = -q - r;
      const distance = Math.max(Math.abs(q - unit.coordinate.q), Math.abs(r - unit.coordinate.r), Math.abs(s - (-unit.coordinate.q - unit.coordinate.r)));
      if (distance <= reconRadius) {
        newVisibleTiles.push(`${q},${r}`);
      }
    }
  }
  
  const updatedPlayers = state.players.map(p => 
    p.id === playerId 
      ? { 
          ...p, 
          visibilityMask: Array.from(new Set([...p.visibilityMask, ...newVisibleTiles])),
          exploredTiles: Array.from(new Set([...p.exploredTiles, ...newVisibleTiles]))
        }
      : p
  );
  
  const updatedUnits = state.units.map(u => 
    u.id === unitId ? { ...u, hasAttacked: true } : u
  );
  
  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers
  };
}

function handleFormationFighting(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Check if unit has formation fighting ability
  if (!unit.abilities.includes('formation_fighting')) return state;
  
  // Apply formation bonus - this is passive, just mark the unit as having used the action
  const updatedUnits = state.units.map(u => 
    u.id === unitId 
      ? { ...u, status: 'formation' as const, hasAttacked: true }
      : u
  );
  
  return {
    ...state,
    units: updatedUnits
  };
}

function handleSiegeMode(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Check if unit has siege ability and is stationary
  if (!unit.abilities.includes('siege') || unit.remainingMovement > 0) return state;
  
  const updatedUnits = state.units.map(u => 
    u.id === unitId 
      ? { ...u, status: 'siege_mode' as const, hasAttacked: true }
      : u
  );
  
  return {
    ...state,
    units: updatedUnits
  };
}

function handleRallyTroops(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  
  // Check if unit has rally ability and pride cost
  if (!unit.abilities.includes('rally') || unit.hasAttacked) return state;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.stats.pride < 5) return state;
  
  // Rally nearby friendly units (within 2 tiles)
  const rallyRadius = 2;
  const updatedUnits = state.units.map(u => {
    if (u.playerId === playerId && u.id !== unitId) {
      const distance = hexDistance(unit.coordinate, u.coordinate);
      if (distance <= rallyRadius) {
        // Temporarily boost attack for nearby units
        return { ...u, status: 'rallied' as const };
      }
    }
    return u;
  });
  
  // Mark the rally unit as having acted and consume pride
  const updatedRallyUnits = updatedUnits.map(u => 
    u.id === unitId ? { ...u, hasAttacked: true } : u
  );
  
  const updatedPlayers = state.players.map(p => 
    p.id === playerId 
      ? { ...p, stats: { ...p.stats, pride: p.stats.pride - 5 } }
      : p
  );
  
  return {
    ...state,
    units: updatedRallyUnits,
    players: updatedPlayers
  };
}

// Research Technology Handler
function handleResearchTechnology(
  state: GameState,
  payload: { playerId: string; technologyId: string }
): GameState {
  const { playerId, technologyId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    emitTelemetry({
      channel: 'technology',
      status: 'error',
      playerId,
      technologyId,
      reason: 'player_not_found',
    });
    return state;
  }
  const tech = getTechnology(technologyId);
  if (!tech) {
    emitTelemetry({
      channel: 'technology',
      status: 'error',
      playerId,
      technologyId,
      reason: 'technology_not_defined',
    });
    return state;
  }

  if (player.researchedTechs.includes(technologyId)) {
    emitTelemetry({
      channel: 'technology',
      status: 'info',
      playerId,
      technologyId,
      reason: 'already_researched',
    });
    return state;
  }

  if (!playerHasTechPrerequisites(player, tech)) {
    const missing = tech.prerequisites.filter(prereq => !player.researchedTechs.includes(prereq));
    emitTelemetry({
      channel: 'technology',
      status: 'blocked',
      playerId,
      technologyId,
      reason: 'missing_prerequisites',
      metadata: { missing },
    });
    return state;
  }

  const { baseCost, discount, finalCost } = getTechCostDetails(tech, player);
  if (player.stars < finalCost) {
    emitTelemetry({
      channel: 'technology',
      status: 'blocked',
      playerId,
      technologyId,
      reason: 'insufficient_stars',
      metadata: { required: finalCost, available: player.stars },
    });
    return state;
  }

  const updatedPlayers = state.players.map(p => {
    if (p.id !== playerId) return p;
    return {
      ...p,
      stars: p.stars - finalCost,
      researchedTechs: [...p.researchedTechs, technologyId],
      researchInspiration: GameRuleHelpers.clampInspiration((p.researchInspiration ?? 0) - discount),
    };
  });

  emitTelemetry({
    channel: 'technology',
    status: 'success',
    playerId,
    technologyId,
    metadata: {
      cost: finalCost,
      discount,
      baseCost,
      researchedCount: player.researchedTechs.length + 1,
    },
  });

  return {
    ...state,
    players: updatedPlayers,
  };
}

function checkVictoryConditions(state: GameState, players: PlayerState[]): string | undefined {
  // Check if any player has achieved dominance
  for (const player of players) {
    const { faith, pride, internalDissent } = player.stats;
    
    // Faith Victory: Using centralized rules
    if (GameRuleHelpers.hasFaithVictory(faith) && internalDissent < 10) {
      return player.id;
    }
    
    // Territorial Victory: Using centralized rules
    const totalCities = state.map.tiles.filter(tile => tile.hasCity).length;
    const playerCities = player.citiesOwned.length;
    
    if (totalCities > 0 && GameRuleHelpers.hasTerritorialVictory(playerCities, totalCities)) {
      return player.id;
    }
  }
  
  // Elimination Victory: Only one player still alive (has units OR cities)
  if (GAME_RULES.victory.eliminationRequired) {
    const playersWithUnits = new Set(state.units.map(unit => unit.playerId));
    const playersWithCities = new Set(
      (state.cities?.map(city => city.ownerId) || []).filter(Boolean) // Filter out neutral cities (undefined ownerId)
    );
    
    // A player is alive if they have either units OR cities
    const alivePlayers = new Set([...playersWithUnits, ...playersWithCities]);
    
    // Victory only if all other players are eliminated (no units AND no cities)
    if (alivePlayers.size === 1) {
      return Array.from(alivePlayers)[0];
    }
  }
  
  return undefined;
}

function handleBuildUnit(
  state: GameState,
  payload: { unitType: string; coordinate: any; playerId: string }
): GameState {
  // Implementation for building new units
  // This would check resources, valid placement, etc.
  return state;
}

// Helper functions for specific abilities
function applyTitleOfLiberty(state: GameState, player: PlayerState, ability: AbilityDefinition): GameState {
  const playerCities = (state.cities || []).filter(city => city.ownerId === player.id);
  if (playerCities.length === 0) return state;

  const duration = ability.duration ?? 3;
  const influenceRadius = 3;
  const affectedUnitIds = new Set<string>();

  playerCities.forEach(city => {
    state.units.forEach(unit => {
      if (unit.playerId === player.id && hexDistance(unit.coordinate, city.coordinate) <= influenceRadius) {
        affectedUnitIds.add(unit.id);
      }
    });
  });

  if (affectedUnitIds.size === 0) return state;

  const updatedUnits = state.units.map(unit => {
    if (!affectedUnitIds.has(unit.id)) return unit;

    const unitDef = getUnitDefinition(unit.type as UnitType);
    const attackBonus = Math.max(1, Math.round(unitDef.baseStats.attack * 0.3));
    const defenseBonus = Math.max(1, Math.round(unitDef.baseStats.defense * 0.3));

    let nextUnit = refreshTimedBuff(
      unit,
      unitDef,
      `title_of_liberty_attack_${unit.id}`,
      'attack_buff',
      attackBonus,
      duration,
      ability.id
    );

    nextUnit = refreshTimedBuff(
      nextUnit,
      unitDef,
      `title_of_liberty_defense_${unit.id}`,
      'defense_buff',
      defenseBonus,
      duration,
      ability.id
    );

    nextUnit = refreshStatusEffect(
      nextUnit,
      `title_of_liberty_status_${unit.id}`,
      duration,
      ability.id
    );

    return nextUnit;
  });

  const faithCost = Math.min(player.stats.faith, 35);

  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    return {
      ...p,
      stats: {
        ...p.stats,
        faith: Math.max(0, p.stats.faith - faithCost),
      },
    };
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function applyRameumptom(state: GameState, player: PlayerState): GameState {
  if (player.stats.pride < 70) return state;

  return {
    ...state,
    players: state.players.map(p => 
      p.id === player.id 
        ? { 
            ...p, 
            stats: { 
              ...p.stats, 
              pride: Math.min(100, p.stats.pride + 30), // Boost Pride significantly
              internalDissent: Math.min(100, p.stats.internalDissent + 20)
            }
          }
        : p
    )
  };
}

function applyCovenantOfPeace(
  state: GameState,
  player: PlayerState,
  payload: { targetUnitId?: string }
): GameState {
  const faithCost = Math.min(player.stats.faith, 15);

  let targetUnit = payload.targetUnitId
    ? state.units.find(unit => unit.id === payload.targetUnitId && unit.playerId !== player.id)
    : undefined;

  if (!targetUnit) {
    const missionaries = state.units.filter(
      unit => unit.playerId === player.id && (unit.type === 'missionary' || unit.type === 'peacekeeping_guard')
    );

    let chosen: Unit | undefined;
    missionaries.forEach(missionary => {
      state.units.forEach(enemy => {
        if (enemy.playerId === player.id) return;
        const distance = hexDistance(missionary.coordinate, enemy.coordinate);
        if (distance <= 2) {
          if (!chosen || enemy.hp < chosen.hp) {
            chosen = enemy;
          }
        }
      });
    });

    targetUnit = chosen;
  }

  if (!targetUnit) {
    return state;
  }

  const enemyPlayer = state.players.find(p => p.id === targetUnit!.playerId);
  const faithGap = player.stats.faith - (enemyPlayer?.stats.faith ?? 0);
  const wounded = targetUnit.hp <= targetUnit.maxHp / 2;
  const hasResistance = enemyPlayer ? playerHasFactionAbility(enemyPlayer, 'FAITHFUL_RESISTANCE') : false;
  const adjustedGap = hasResistance ? faithGap - 10 : faithGap;
  const success = adjustedGap >= -20 || wounded;

  let updatedUnits = state.units;
  if (success) {
    updatedUnits = state.units.map(unit => {
      if (unit.id !== targetUnit!.id) return unit;
      return {
        ...unit,
        playerId: player.id,
        hp: Math.min(unit.maxHp, unit.hp + 3),
        status: 'active',
        temporaryEffects: unit.temporaryEffects,
      };
    });
  }

  const updatedPlayers = state.players.map(p => {
    if (p.id === player.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          faith: Math.max(0, p.stats.faith - faithCost + (success ? 2 : 0)),
          internalDissent: Math.max(0, p.stats.internalDissent - (success ? 4 : 1)),
        },
      };
    }

    if (success && p.id === enemyPlayer?.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          pride: Math.max(0, p.stats.pride - 5),
          internalDissent: Math.min(100, p.stats.internalDissent + 5),
        },
      };
    }

    if (!success && p.id === enemyPlayer?.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          pride: Math.max(0, p.stats.pride - 2),
          internalDissent: Math.min(100, p.stats.internalDissent + 2),
        },
      };
    }

    return p;
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

// Nephite Faction Abilities
function applyRighteousCharge(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || !payload.targetUnitId) return state;

  const target = state.units.find(u => u.id === payload.targetUnitId);
  if (!target || target.playerId === unit.playerId) return state;

  // Righteous Charge: Gain significant attack bonus when charging at enemy
  const distance = hexDistance(unit.coordinate, target.coordinate);
  if (distance <= 2) {
    return {
      ...state,
      units: state.units.map(u => 
        u.id === unit.id 
          ? { ...u, attack: u.attack + GAME_RULES.abilities.attackBonuses.righteousCharge, remainingMovement: Math.max(0, u.remainingMovement - 1) }
          : u
      )
    };
  }
  return state;
}

function applyFaithHealing(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player || player.stats.faith < GAME_RULES.abilities.resourceCosts.faithHealing) return state;

  // Faith Healing: Restore HP to nearby friendly units
  const healRadius = GAME_RULES.abilities.healRadius;
  const nearbyAllies = state.units.filter(u => {
    if (u.playerId !== unit.playerId) return false;
    const distance = hexDistance(unit.coordinate, u.coordinate);
    return distance <= healRadius;
  });

  const healAmount = GAME_RULES.units.healingAmount;
  return {
    ...state,
    units: state.units.map(u => {
      if (nearbyAllies.some(ally => ally.id === u.id)) {
        const unitDef = getUnitDefinition(u.type);
        return { ...u, hp: Math.min(unitDef.baseStats.hp, u.hp + healAmount) };
      }
      return u;
    }),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - GAME_RULES.abilities.resourceCosts.faithHealing) } }
        : p
    )
  };
}

// Lamanite Faction Abilities
function applyGuerrillaTactics(
  state: GameState,
  payload: { playerId: string },
  ability: AbilityDefinition
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const duration = ability.duration ?? 2;
  const defenseBonus = 2;
  const movementBonus = 1;

  let applied = false;

  const updatedUnits = state.units.map(unit => {
    if (unit.playerId !== player.id) return unit;

    const tile = state.map.tiles.find(
      t => t.coordinate.q === unit.coordinate.q && t.coordinate.r === unit.coordinate.r
    );

    if (!tile || (tile.terrain !== 'forest' && tile.terrain !== 'swamp')) {
      return unit;
    }

    const unitDef = getUnitDefinition(unit.type as UnitType);

    let nextUnit = refreshTimedBuff(
      unit,
      unitDef,
      `guerrilla_tactics_defense_${unit.id}`,
      'defense_buff',
      defenseBonus,
      duration,
      ability.id
    );

    nextUnit = refreshTimedBuff(
      nextUnit,
      unitDef,
      `guerrilla_tactics_movement_${unit.id}`,
      'movement_buff',
      movementBonus,
      duration,
      ability.id
    );

    applied = true;
    return nextUnit;
  });

  if (!applied) return state;

  return {
    ...state,
    units: updatedUnits,
  };
}

function applyUnitDeathEffects(
  state: GameState,
  units: Unit[],
  players: PlayerState[],
  deadUnit: Unit
): { units: Unit[]; players: PlayerState[] } {
  let updatedUnits = units.filter(unit => unit.id !== deadUnit.id);
  let updatedPlayers = players;

  const ownerIndex = updatedPlayers.findIndex(player => player.id === deadUnit.playerId);
  const owner = ownerIndex >= 0 ? updatedPlayers[ownerIndex] : undefined;

  if (owner) {
    const deathModifiers = getActiveModifiers(owner, 'on_death');
    deathModifiers.forEach(modifier => {
      modifier.effect.forEach(effect => {
        if (effect.target === 'nearby' && effect.radius) {
          const affectedUnits = updatedUnits.filter(unit =>
            unit.playerId === deadUnit.playerId &&
            hexDistance(unit.coordinate, deadUnit.coordinate) <= effect.radius!
          );

          updatedUnits = updatedUnits.map(unit => {
            if (!affectedUnits.some(affected => affected.id === unit.id)) return unit;
            return {
              ...unit,
              [effect.stat]: (unit[effect.stat as keyof Unit] as number) + effect.value,
            };
          });
        }
      });
    });
  }

  if (owner && playerHasFactionAbility(owner, 'BLOOD_FEUD')) {
    const vengeanceRange = 2;
    const buffAmount = 1;
    updatedUnits = updatedUnits.map(unit => {
      if (unit.playerId !== deadUnit.playerId) return unit;
      if (hexDistance(unit.coordinate, deadUnit.coordinate) > vengeanceRange) return unit;
      const def = getUnitDefinition(unit.type as any);
      return updatePermanentEffect(unit, def, `blood_feud_${deadUnit.id}`, 'attack_buff', buffAmount);
    });
  }

  return { units: updatedUnits, players: updatedPlayers };
}

function applyAncestralRage(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player || player.stats.pride < 15) return state;

  // Ancestral Rage: All units gain attack bonus for several turns
  return {
    ...state,
    units: state.units.map(u => 
      u.playerId === player.id 
        ? { ...u, attack: u.attack + GAME_RULES.abilities.attackBonuses.ancestralRage }
        : u
    ),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.max(0, p.stats.pride - 15) } }
        : p
    )
  };
}

// Zoramite Faction Abilities
function applyConvertEnemy(
  state: GameState,
  payload: { playerId: string },
  ability: AbilityDefinition
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const envoys = state.units.filter(unit => unit.playerId === player.id && unit.type === 'royal_envoy');
  if (envoys.length === 0) return state;

  const conversionRadius = GAME_RULES.abilities.conversionRadius;
  let chosenEnvoy: Unit | undefined;
  let chosenTarget: Unit | undefined;

  envoys.forEach(envoy => {
    state.units.forEach(enemy => {
      if (enemy.playerId === player.id) return;
      const distance = hexDistance(envoy.coordinate, enemy.coordinate);
      if (distance <= conversionRadius) {
        if (!chosenTarget || enemy.attack > chosenTarget.attack || enemy.hp < chosenTarget.hp) {
          chosenEnvoy = envoy;
          chosenTarget = enemy;
        }
      }
    });
  });

  if (!chosenEnvoy || !chosenTarget) return state;

  const prideCost = Math.min(player.stats.pride, 20);
  const enemyPlayer = state.players.find(p => p.id === chosenTarget!.playerId);
  const hasResistance = enemyPlayer ? playerHasFactionAbility(enemyPlayer, 'FAITHFUL_RESISTANCE') : false;

  if (hasResistance) {
    const pressure = player.stats.pride;
    const resolve = (enemyPlayer?.stats.faith ?? 0) + 10;
    if (pressure < resolve) {
      return state;
    }
  }

  const updatedUnits = state.units.map(unit => {
    if (unit.id !== chosenTarget!.id) return unit;
    return {
      ...unit,
      playerId: player.id,
      status: 'active',
      hp: Math.min(unit.maxHp, unit.hp + 2),
    };
  });

  const updatedPlayers = state.players.map(p => {
    if (p.id === player.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          pride: Math.max(0, p.stats.pride - prideCost),
          faith: Math.min(100, p.stats.faith + 3),
        },
      };
    }

    if (p.id === enemyPlayer?.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          pride: Math.max(0, p.stats.pride - 4),
          internalDissent: Math.min(100, p.stats.internalDissent + 3),
        },
      };
    }

    return p;
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function applyPrideBoost(state: GameState, payload: any, ability: AbilityDefinition): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Pride Boost: Gain pride from nearby structures/cities
  const playerCities = state.cities?.filter(city => 
    player.citiesOwned.includes(city.id)
  ) || [];

  const ownedStructures = (state.structures || []).filter(
    structure => structure.ownerId === player.id && structure.constructionTurns === 0
  );

  const ownedImprovements = (state.improvements || []).filter(
    improvement => improvement.ownerId === player.id && improvement.constructionTurns === 0
  );

  const prideGain = playerCities.length * 3 + ownedStructures.length * 2 + Math.floor(ownedImprovements.length / 2);
  if (prideGain === 0) return state;

  const faithPenalty = Math.min(5, Math.floor(prideGain / 2));

  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { 
            ...p, 
            stats: { 
              ...p.stats, 
              pride: Math.min(100, p.stats.pride + prideGain),
              faith: Math.max(0, p.stats.faith - faithPenalty),
            } 
          }
        : p
    )
  };
}

// Jaredite Faction Abilities
function applyTowerVision(
  state: GameState,
  payload: { playerId: string },
  ability: AbilityDefinition
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const seeds: HexCoordinate[] = [];

  (state.cities || []).forEach(city => {
    if (city.ownerId === player.id) {
      seeds.push(city.coordinate);
    }
  });

  state.units.forEach(unit => {
    if (unit.playerId === player.id && unit.visionRadius >= 2) {
      seeds.push(unit.coordinate);
    }
  });

  if (seeds.length === 0) return state;

  const revealRadius = GAME_RULES.abilities.visionRevealRadius;
  const tilesToReveal = new Set<string>();

  seeds.forEach(seed => {
    for (let q = seed.q - revealRadius; q <= seed.q + revealRadius; q++) {
      for (let r = seed.r - revealRadius; r <= seed.r + revealRadius; r++) {
        const s = -q - r;
        const distance = Math.max(Math.abs(q - seed.q), Math.abs(r - seed.r), Math.abs(s - seed.s));
        if (distance <= revealRadius) {
          tilesToReveal.add(`${q},${r}`);
        }
      }
    }
  });

  const faithCost = Math.min(player.stats.faith, ability.requirements?.faith ?? 10);

  const updatedTiles = state.map.tiles.map(tile => {
    const key = `${tile.coordinate.q},${tile.coordinate.r}`;
    if (tilesToReveal.has(key) && !tile.exploredBy.includes(player.id)) {
      return {
        ...tile,
        exploredBy: [...tile.exploredBy, player.id],
      };
    }
    return tile;
  });

  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    return {
      ...p,
      stats: {
        ...p.stats,
        faith: Math.max(0, p.stats.faith - faithCost),
      },
    };
  });

  return {
    ...state,
    map: {
      ...state.map,
      tiles: updatedTiles,
    },
    players: updatedPlayers,
  };
}

function applyAncientKnowledge(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Ancient Knowledge: Gain research progress or unlock random tech
  const availableTechs = Object.keys(TECHNOLOGIES).filter(techId => 
    !player.researchedTechs.includes(techId)
  );

  if (availableTechs.length > 0) {
    const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
    return {
      ...state,
      players: state.players.map(p =>
        p.id === player.id
          ? { 
              ...p, 
              researchedTechs: [...p.researchedTechs, randomTech],
              stats: { ...p.stats, faith: Math.max(0, p.stats.faith - 25) }
            }
          : p
      )
    };
  }
  return state;
}

// Anti-Nephi-Lehi Faction Abilities
function applyPacify(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  // Pacify: Reduce attack of nearby enemy units
  const pacifyRadius = GAME_RULES.abilities.pacifyRadius;
  const nearbyEnemies = state.units.filter(u => {
    if (u.playerId === unit.playerId) return false;
    const distance = hexDistance(unit.coordinate, u.coordinate);
    return distance <= pacifyRadius;
  });

  return {
    ...state,
    units: state.units.map(u => {
      if (nearbyEnemies.some(enemy => enemy.id === u.id)) {
        return { ...u, attack: Math.max(1, u.attack - 3) };
      }
      return u;
    })
  };
}

function applyConversion(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Conversion: Increase faith, reduce internal dissent
  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { 
            ...p, 
            stats: { 
              ...p.stats, 
              faith: Math.min(100, p.stats.faith + 10),
              internalDissent: Math.max(0, p.stats.internalDissent - 15)
            }
          }
        : p
    )
  };
}

function applyRighteousDefense(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const playerCities = (state.cities || []).filter(city => city.ownerId === player.id);
  if (playerCities.length === 0) return state;

  const duration = ability.duration ?? 2;
  const buffAmount = 2;

  const unitsToBuff = new Set<string>();
  playerCities.forEach(city => {
    state.units.forEach(unit => {
      if (unit.playerId === player.id && hexDistance(unit.coordinate, city.coordinate) <= 2) {
        unitsToBuff.add(unit.id);
      }
    });
  });

  const updatedUnits = state.units.map(unit => {
    if (!unitsToBuff.has(unit.id)) return unit;

    const baseEffects = unit.temporaryEffects || [];
    const existingIndex = baseEffects.findIndex(effect => effect.source === ability.id);
    if (existingIndex !== -1) {
      const refreshed = [...baseEffects];
      refreshed[existingIndex] = {
        ...refreshed[existingIndex],
        turnsRemaining: duration,
      };
      return {
        ...unit,
        temporaryEffects: refreshed,
      };
    }

    const buffEffect: UnitTemporaryEffect = {
      id: `righteous_defense_${unit.id}_${Date.now()}`,
      type: 'defense_buff',
      amount: buffAmount,
      turnsRemaining: duration,
      source: ability.id,
    };

    const resultUnit: Unit = {
      ...unit,
      defense: unit.defense + buffAmount,
      temporaryEffects: [...baseEffects, buffEffect],
    };

    if (unit.type === 'missionary') {
      resultUnit.hp = Math.min(unit.maxHp, unit.hp + 3);
    }

    return resultUnit;
  });

  const faithCost = ability.requirements?.faith ?? 0;
  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    if (faithCost === 0) return p;
    return {
      ...p,
      stats: {
        ...p.stats,
        faith: Math.max(0, p.stats.faith - faithCost),
      },
    };
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function applyMissionaryZeal(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const missionaries = state.units.filter(unit => unit.playerId === player.id && unit.type === 'missionary');
  if (missionaries.length === 0) return state;

  const convertedUnitIds = new Set<string>();
  let updatedUnits = [...state.units];
  const enemyAdjustments = new Map<string, { pride: number; dissent: number }>();

  missionaries.forEach(missionary => {
    state.units.forEach(unit => {
      if (unit.playerId === player.id) return;
      if (hexDistance(unit.coordinate, missionary.coordinate) > 1) return;
      if (convertedUnitIds.has(unit.id)) return;

      const enemyPlayer = state.players.find(p => p.id === unit.playerId);
      if (!enemyPlayer) return;

      const faithGap = player.stats.faith - enemyPlayer.stats.faith;
      const requiredGap = playerHasFactionAbility(enemyPlayer, 'FAITHFUL_RESISTANCE') ? 15 : 10;
      if (faithGap >= requiredGap) {
        convertedUnitIds.add(unit.id);
        updatedUnits = updatedUnits.map(existing =>
          existing.id === unit.id
            ? {
                ...existing,
                playerId: player.id,
                hp: Math.min(existing.maxHp, existing.hp + 2),
                status: 'active',
              }
            : existing
        );
      } else {
        const entry = enemyAdjustments.get(enemyPlayer.id) || { pride: 0, dissent: 0 };
        entry.pride -= 3;
        entry.dissent += 2;
        enemyAdjustments.set(enemyPlayer.id, entry);
      }
    });
  });

  const faithCost = ability.requirements?.faith ?? 0;
  const updatedPlayers = state.players.map(p => {
    if (p.id === player.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          faith: Math.max(0, p.stats.faith - faithCost + convertedUnitIds.size),
          internalDissent: Math.max(0, p.stats.internalDissent - Math.max(1, missionaries.length)),
        },
      };
    }

    const adjustments = enemyAdjustments.get(p.id);
    if (adjustments) {
      return {
        ...p,
        stats: {
          ...p.stats,
          pride: Math.max(0, p.stats.pride + adjustments.pride),
          internalDissent: Math.min(100, Math.max(0, p.stats.internalDissent + adjustments.dissent)),
        },
      };
    }

    return p;
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function applyWarriorRage(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const duration = ability.duration ?? 2;
  const attackBonus = 2;
  const movementBonus = 1;

  const updatedUnits = state.units.map(unit => {
    if (unit.playerId !== player.id) return unit;

    const effects = unit.temporaryEffects || [];
    const attackEffectId = `warrior_rage_attack_${unit.id}`;
    const movementEffectId = `warrior_rage_move_${unit.id}`;

    let updated = { ...unit, temporaryEffects: effects };

    if (!effects.some(effect => effect.id === attackEffectId)) {
      const attackEffect: UnitTemporaryEffect = {
        id: attackEffectId,
        type: 'attack_buff',
        amount: attackBonus,
        turnsRemaining: duration,
        source: ability.id,
      };
      updated = {
        ...updated,
        attack: updated.attack + attackBonus,
        temporaryEffects: [...updated.temporaryEffects, attackEffect],
      };
    } else {
      updated = {
        ...updated,
        temporaryEffects: updated.temporaryEffects!.map(effect =>
          effect.id === attackEffectId ? { ...effect, turnsRemaining: duration } : effect
        ),
      };
    }

    if (!updated.temporaryEffects!.some(effect => effect.id === movementEffectId)) {
      const movementEffect: UnitTemporaryEffect = {
        id: movementEffectId,
        type: 'movement_buff',
        amount: movementBonus,
        turnsRemaining: duration,
        source: ability.id,
      };
      updated = {
        ...updated,
        movement: updated.movement + movementBonus,
        remainingMovement: updated.remainingMovement + movementBonus,
        temporaryEffects: [...updated.temporaryEffects!, movementEffect],
      };
    } else {
      updated = {
        ...updated,
        temporaryEffects: updated.temporaryEffects!.map(effect =>
          effect.id === movementEffectId ? { ...effect, turnsRemaining: duration } : effect
        ),
      };
    }

    return updated;
  });

  const prideCost = ability.requirements?.pride ?? 0;
  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    return {
      ...p,
      stats: {
        ...p.stats,
        pride: Math.max(0, p.stats.pride - prideCost),
        internalDissent: Math.min(100, p.stats.internalDissent + 5),
      },
    };
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function applyFactionAncientKnowledge(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const faithCost = ability.requirements?.faith ?? 0;
  const updatedTiles = state.map.tiles.map(tile => {
    if ((tile.feature === 'ruin' || tile.feature === 'shrine') && !tile.exploredBy.includes(player.id)) {
      return { ...tile, exploredBy: [...tile.exploredBy, player.id] };
    }
    return tile;
  });

  const revealedKeys = updatedTiles
    .filter(tile => tile.exploredBy.includes(player.id))
    .map(tile => `${tile.coordinate.q},${tile.coordinate.r}`);

  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    const visibilityMask = p.visibilityMask || [];
    const exploredTiles = p.exploredTiles || [];
    return {
      ...p,
      stats: {
        ...p.stats,
        faith: Math.max(0, p.stats.faith - faithCost + 2),
      },
      researchInspiration: GameRuleHelpers.clampInspiration((p.researchInspiration || 0) + 20),
      stars: p.stars + 10,
      visibilityMask: Array.from(new Set([...visibilityMask, ...revealedKeys])),
      exploredTiles: Array.from(new Set([...exploredTiles, ...revealedKeys])),
    };
  });

  return {
    ...state,
    map: {
      ...state.map,
      tiles: updatedTiles,
    },
    players: updatedPlayers,
  };
}

function applyCulturalReclamation(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const faithCost = ability.requirements?.faith ?? 0;

  const updatedCities = (state.cities || []).map(city => {
    const hasPresence = state.units.some(
      unit => unit.playerId === player.id && hexDistance(unit.coordinate, city.coordinate) <= 2
    );

    if (!hasPresence) return city;

    if (!city.ownerId) {
      return { ...city, ownerId: player.id };
    }

    if (city.ownerId !== player.id) {
      return {
        ...city,
        starProduction: Math.max(1, city.starProduction - 1),
      };
    }

    return city;
  });

  const updatedPlayers = state.players.map(p => {
    if (p.id === player.id) {
      return {
        ...p,
        stats: {
          ...p.stats,
          faith: Math.max(0, p.stats.faith - faithCost + 3),
        },
      };
    }

    const cityAffected = updatedCities.some(
      city => city.ownerId === p.id &&
        (state.cities || []).some(original => original.id === city.id && original.starProduction > city.starProduction)
    );

    if (cityAffected) {
      return {
        ...p,
        stats: {
          ...p.stats,
          internalDissent: Math.min(100, p.stats.internalDissent + 3),
        },
      };
    }

    return p;
  });

  return {
    ...state,
    cities: updatedCities,
    players: updatedPlayers,
  };
}

function toggleWealthAccumulation(
  state: GameState,
  player: PlayerState
): GameState {
  const active = (player.modifiers || []).some((modifier: any) => modifier?.id === 'WEALTH_ACCUMULATION_ACTIVE');

  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    const modifiers = [...(p.modifiers || [])];
    if (active) {
      return {
        ...p,
        modifiers: modifiers.filter(modifier => modifier?.id !== 'WEALTH_ACCUMULATION_ACTIVE'),
      };
    }

    modifiers.push({ id: 'WEALTH_ACCUMULATION_ACTIVE' });
    return {
      ...p,
      modifiers,
    };
  });

  return {
    ...state,
    players: updatedPlayers,
  };
}

function applyAncientMight(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const duration = ability.duration ?? 3;
  const buffAmount = 2;

  const updatedUnits = state.units.map(unit => {
    if (unit.playerId !== player.id) return unit;
    const effects = unit.temporaryEffects || [];
    const attackEffectId = `ancient_might_attack_${unit.id}`;
    const defenseEffectId = `ancient_might_defense_${unit.id}`;

    let updated = { ...unit, temporaryEffects: effects };

    if (!effects.some(effect => effect.id === attackEffectId)) {
      const attackEffect: UnitTemporaryEffect = {
        id: attackEffectId,
        type: 'attack_buff',
        amount: buffAmount,
        turnsRemaining: duration,
        source: ability.id,
      };
      updated = {
        ...updated,
        attack: updated.attack + buffAmount,
        temporaryEffects: [...updated.temporaryEffects, attackEffect],
      };
    } else {
      updated = {
        ...updated,
        temporaryEffects: updated.temporaryEffects!.map(effect =>
          effect.id === attackEffectId ? { ...effect, turnsRemaining: duration } : effect
        ),
      };
    }

    if (!updated.temporaryEffects!.some(effect => effect.id === defenseEffectId)) {
      const defenseEffect: UnitTemporaryEffect = {
        id: defenseEffectId,
        type: 'defense_buff',
        amount: buffAmount,
        turnsRemaining: duration,
        source: ability.id,
      };
      updated = {
        ...updated,
        defense: updated.defense + buffAmount,
        temporaryEffects: [...updated.temporaryEffects!, defenseEffect],
      };
    } else {
      updated = {
        ...updated,
        temporaryEffects: updated.temporaryEffects!.map(effect =>
          effect.id === defenseEffectId ? { ...effect, turnsRemaining: duration } : effect
        ),
      };
    }

    return updated;
  });

  const prideCost = ability.requirements?.pride ?? 0;
  const faithCost = ability.requirements?.faith ?? 0;

  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    return {
      ...p,
      stats: {
        ...p.stats,
        pride: Math.max(0, Math.min(100, p.stats.pride - prideCost + 5)),
        faith: Math.max(0, p.stats.faith - faithCost),
      },
    };
  });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
  };
}

function applyPropheticCollapse(
  state: GameState,
  player: PlayerState,
  ability: AbilityDefinition
): GameState {
  const playerUnits = state.units.filter(unit => unit.playerId === player.id);
  if (playerUnits.length <= 1) return state;

  const sorted = [...playerUnits].sort((a, b) => a.attack - b.attack || a.hp - b.hp);
  const removeCount = Math.floor(sorted.length / 2);
  const removalIds = new Set(sorted.slice(0, removeCount).map(unit => unit.id));

  const remainingUnits = state.units.filter(unit => !removalIds.has(unit.id));
  const boostedUnits = remainingUnits.map(unit => {
    if (unit.playerId !== player.id) return unit;
    return {
      ...unit,
      attack: unit.attack + 3,
      defense: unit.defense + 3,
      hp: Math.min(unit.maxHp, unit.hp + 5),
    };
  });

  const updatedPlayers = state.players.map(p => {
    if (p.id !== player.id) return p;
    return {
      ...p,
      stats: {
        ...p.stats,
        pride: Math.max(0, p.stats.pride - 10),
        faith: Math.max(60, p.stats.faith),
      },
    };
  });

  return {
    ...state,
    units: boostedUnits,
    players: updatedPlayers,
  };
}

// Mulekite Faction Abilities
function applyTradeNetwork(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  // Trade Network: Gain stars from nearby cities
  const tradeRadius = GAME_RULES.abilities.tradeRadius;
  const nearbyCities = state.cities?.filter(city => {
    const distance = hexDistance(unit.coordinate, city.coordinate);
    return distance <= tradeRadius;
  }) || [];

  const starGain = nearbyCities.length * 3;
  const player = state.players.find(p => p.id === unit.playerId);
  if (!player) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stars: p.stars + starGain }
        : p
    )
  };
}

function applyMaritimeExpansion(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Maritime Expansion: Reveal coastlines and gain movement bonus for water units
  return {
    ...state,
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile => {
        if ((tile.terrain === 'water') && 
            !tile.exploredBy.includes(player.id)) {
          return {
            ...tile,
            exploredBy: [...tile.exploredBy, player.id]
          };
        }
        return tile;
      })
    },
    units: state.units.map(u => 
      u.playerId === player.id && u.type === 'scout' // Scouts can act as naval units
        ? { ...u, movement: u.movement + 1, remainingMovement: u.remainingMovement + 1 }
        : u
    )
  };
}

function applyDivineWard(
  state: GameState,
  player: PlayerState,
  payload: { unitId?: string; targetUnitId?: string }
): GameState {
  const faithCost = ABILITIES.DIVINE_WARD.requirements?.faith || 0;
  const duration = ABILITIES.DIVINE_WARD.duration || 3;
  const targetUnit = state.units.find(
    u =>
      u.id === payload.unitId ||
      u.id === payload.targetUnitId
  ) || state.units.find(u => u.playerId === player.id);

  if (!targetUnit || targetUnit.playerId !== player.id) {
    return state;
  }

  const protectionEffect: UnitTemporaryEffect = {
    id: `divine_ward_${targetUnit.id}_${Date.now()}`,
    type: 'status_immunity',
    turnsRemaining: duration,
    source: 'DIVINE_WARD'
  };

  const updatedUnits = state.units.map(unit => {
    if (unit.id !== targetUnit.id) return unit;

    const existingEffects = (unit.temporaryEffects || []).filter(
      effect => effect.source !== 'DIVINE_WARD'
    );

    return {
      ...unit,
      status: 'active',
      hasAttacked: false,
      remainingMovement: unit.movement,
      temporaryEffects: [...existingEffects, protectionEffect]
    };
  });

  const updatedPlayers = state.players.map(p =>
    p.id === player.id && faithCost > 0
      ? {
          ...p,
          stats: {
            ...p.stats,
            faith: Math.max(0, p.stats.faith - faithCost)
          }
        }
      : p
  );

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers
  };
}

function applySpiritualWarfare(state: GameState, player: PlayerState): GameState {
  const friendlyUnits = state.units.filter(u => u.playerId === player.id);
  if (friendlyUnits.length === 0) return state;

  const drains: Record<string, number> = {};
  const drainPerContact = 2;

  friendlyUnits.forEach(friendly => {
    state.units.forEach(enemy => {
      if (enemy.playerId === player.id) return;
      if (hexDistance(friendly.coordinate, enemy.coordinate) <= 1) {
        drains[enemy.playerId] = (drains[enemy.playerId] || 0) + drainPerContact;
      }
    });
  });

  if (Object.keys(drains).length === 0) return state;

  const totalDrain = Object.values(drains).reduce((sum, value) => sum + value, 0);

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === player.id) {
        return {
          ...p,
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + Math.ceil(totalDrain / 2))
          }
        };
      }

      if (drains[p.id]) {
        return {
          ...p,
          stats: {
            ...p.stats,
            faith: Math.max(0, p.stats.faith - drains[p.id])
          }
        };
      }

      return p;
    })
  };
}

function applyRighteousFury(
  state: GameState,
  player: PlayerState,
  payload: { unitId?: string; targetUnitId?: string }
): GameState {
  const sourceUnit =
    state.units.find(
      u => u.id === payload.unitId || u.id === payload.targetUnitId
    ) || state.units.find(u => u.playerId === player.id);

  if (!sourceUnit || sourceUnit.playerId !== player.id) {
    return state;
  }

  const duration = ABILITIES.RIGHTEOUS_FURY.duration || 3;
  const buffAmount = 3;
  const buffRadius = 2;

  const affectedUnitIds = state.units
    .filter(
      u =>
        u.playerId === player.id &&
        hexDistance(u.coordinate, sourceUnit.coordinate) <= buffRadius
    )
    .map(u => u.id);

  if (affectedUnitIds.length === 0) return state;

  const updatedUnits = state.units.map(unit => {
    if (!affectedUnitIds.includes(unit.id)) return unit;

    const furyEffect: UnitTemporaryEffect = {
      id: `righteous_fury_${unit.id}_${Date.now()}`,
      type: 'attack_buff',
      amount: buffAmount,
      turnsRemaining: duration,
      source: 'RIGHTEOUS_FURY'
    };

    return {
      ...unit,
      attack: unit.attack + buffAmount,
      temporaryEffects: [...(unit.temporaryEffects || []), furyEffect]
    };
  });

  return {
    ...state,
    units: updatedUnits
  };
}

function tickUnitTemporaryEffects(units: Unit[]): Unit[] {
  return units.map(unit => {
    if (!unit.temporaryEffects || unit.temporaryEffects.length === 0) {
      return unit;
    }

    const unitDef = getUnitDefinition(unit.type);
    let attackAdjustment = 0;
    let defenseAdjustment = 0;
    let movementAdjustment = 0;
    let hasActiveStatusImmunity = false;
    const remainingEffects: UnitTemporaryEffect[] = [];

    unit.temporaryEffects.forEach(effect => {
      const updatedTurns = effect.turnsRemaining - 1;
      if (effect.turnsRemaining === -1) {
        remainingEffects.push(effect);
        if (effect.type === 'status_immunity') {
          hasActiveStatusImmunity = true;
        }
      } else if (updatedTurns > 0) {
        const updatedEffect = { ...effect, turnsRemaining: updatedTurns };
        remainingEffects.push(updatedEffect);
        if (effect.type === 'status_immunity') {
          hasActiveStatusImmunity = true;
        }
      } else if (effect.amount) {
        switch (effect.type) {
          case 'attack_buff':
            attackAdjustment -= effect.amount;
            break;
          case 'defense_buff':
            defenseAdjustment -= effect.amount;
            break;
          case 'movement_buff':
            movementAdjustment -= effect.amount;
            break;
          default:
            break;
        }
      }
    });

    let updatedUnit = unit;

    if (attackAdjustment !== 0) {
      updatedUnit = {
        ...updatedUnit,
        attack: Math.max(unitDef.baseStats.attack, updatedUnit.attack + attackAdjustment)
      };
    }
    if (defenseAdjustment !== 0) {
      updatedUnit = {
        ...updatedUnit,
        defense: Math.max(unitDef.baseStats.defense, updatedUnit.defense + defenseAdjustment)
      };
    }
    if (movementAdjustment !== 0) {
      const baseMovement = unitDef.baseStats.movement;
      const newMovement = Math.max(baseMovement, updatedUnit.movement + movementAdjustment);
      updatedUnit = {
        ...updatedUnit,
        movement: newMovement,
        remainingMovement: Math.min(newMovement, Math.max(0, updatedUnit.remainingMovement + movementAdjustment))
      };
    }

    if (hasActiveStatusImmunity && updatedUnit.status === 'exhausted') {
      updatedUnit = { ...updatedUnit, status: 'active' };
    }

    return {
      ...updatedUnit,
      temporaryEffects: remainingEffects.length > 0 ? remainingEffects : undefined
    };
  });
}

// Advanced Diplomacy and Trade Mechanics
function handleEstablishTradeRoute(
  state: GameState,
  payload: { playerId: string; fromCityId: string; toCityId: string }
): GameState {
  const { playerId, fromCityId, toCityId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const fromCity = state.cities?.find(city => city.id === fromCityId);
  const toCity = state.cities?.find(city => city.id === toCityId);
  
  if (!fromCity || !toCity) return state;
  if (!player.citiesOwned.includes(fromCityId)) return state;

  // Establish trade route between cities
  const distance = hexDistance(fromCity.coordinate, toCity.coordinate);
  const tradeValue = Math.max(1, Math.floor(10 - distance / 2));

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars + tradeValue }
        : p
    )
  };
}

function handleDeclareWar(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);
  
  if (!player || !targetPlayer) return state;
  if (playerId === targetPlayerId) return state;

  // Declaring war increases pride but also internal dissent
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          stats: {
            ...p.stats,
            pride: Math.min(100, p.stats.pride + 15),
            internalDissent: Math.min(100, p.stats.internalDissent + 5)
          }
        };
      }
      return p;
    })
  };
}

function handleFormAlliance(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId: allyPlayerId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  const ally = state.players.find(p => p.id === allyPlayerId);
  
  if (!player || !ally) return state;
  if (playerId === allyPlayerId) return state;

  // Forming alliances boosts faith and reduces internal dissent
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId || p.id === allyPlayerId) {
        return {
          ...p,
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 10)
          }
        };
      }
      return p;
    })
  };
}

function handleConvertCity(
  state: GameState,
  payload: { playerId: string; cityId: string; conversionType: 'faith' | 'pride' | 'peace' }
): GameState {
  const { playerId, cityId, conversionType } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const city = state.cities?.find(c => c.id === cityId);
  if (!city) return state;

  // Check if player has a unit near the city
  const playerUnits = state.units.filter(unit => unit.playerId === playerId);
  const canConvert = playerUnits.some(unit => {
    const distance = hexDistance(unit.coordinate, city.coordinate);
    return distance <= GAME_RULES.abilities.conversionRadius && unit.type === 'missionary';
  });

  if (!canConvert) return state;

  let resourceCost = 0;
  let statChanges = {};

  switch (conversionType) {
    case 'faith':
      resourceCost = 20;
      if (player.stats.faith < resourceCost) return state;
      statChanges = { faith: player.stats.faith - resourceCost };
      break;
    case 'pride':
      resourceCost = 15;
      if (player.stats.pride < resourceCost) return state;
      statChanges = { pride: player.stats.pride - resourceCost };
      break;
    case 'peace':
      resourceCost = 10;
      statChanges = { 
        faith: Math.min(100, player.stats.faith + 5),
        internalDissent: Math.max(0, player.stats.internalDissent - 10)
      };
      break;
  }

  // Convert city to player's control
  const currentOwner = state.players.find(p => p.citiesOwned.includes(cityId));
  
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          citiesOwned: [...p.citiesOwned, cityId],
          stats: { ...p.stats, ...statChanges }
        };
      } else if (currentOwner && p.id === currentOwner.id) {
        return {
          ...p,
          citiesOwned: p.citiesOwned.filter(id => id !== cityId)
        };
      }
      return p;
    })
  };
}

function handleUnitAction(
  state: GameState,
  payload: { unitId: string; actionType: string; playerId: string; target?: any }
): GameState {
  const { unitId, actionType, playerId, target } = payload;
  
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  switch (actionType) {
    case 'stealth':
      // Implement stealth mode for scouts
      if (unit.type === 'scout' && unit.remainingMovement >= 2) {
        return {
          ...state,
          units: state.units.map(u =>
            u.id === unitId
              ? { ...u, remainingMovement: u.remainingMovement - 2, status: 'stealth' as any }
              : u
          )
        };
      }
      break;
      
    case 'heal':
      // Implement healing for missionaries
      if (unit.type === 'missionary' && player.stats.faith >= 5) {
        const nearbyUnits = state.units.filter(u => 
          u.playerId === playerId && 
          hexDistance(u.coordinate, unit.coordinate) <= GAME_RULES.abilities.healRadius &&
          u.hp < u.maxHp
        );
        
        if (nearbyUnits.length > 0) {
          return {
            ...state,
            players: state.players.map(p =>
              p.id === playerId
                ? { ...p, stats: { ...p.stats, faith: p.stats.faith - 5 } }
                : p
            ),
            units: state.units.map(u => {
              if (nearbyUnits.some(nu => nu.id === u.id)) {
                return { ...u, hp: Math.min(u.maxHp, u.hp + GAME_RULES.units.healingAmount) };
              }
              return u;
            })
          };
        }
      }
      break;
      
    case 'reconnaissance':
      // Implement reconnaissance for scouts
      if (unit.type === 'scout') {
        const revealRadius = GAME_RULES.abilities.visionRevealRadius;
        const tilesToReveal: string[] = [];
        
        // Generate coordinates around the unit
        for (let q = -revealRadius; q <= revealRadius; q++) {
          for (let r = -revealRadius; r <= revealRadius; r++) {
            const s = -q - r;
            if (Math.abs(q) <= revealRadius && Math.abs(r) <= revealRadius && Math.abs(s) <= revealRadius) {
              const tileCoord = { q: unit.coordinate.q + q, r: unit.coordinate.r + r, s };
              tilesToReveal.push(`${tileCoord.q},${tileCoord.r}`);
            }
          }
        }
        
        return {
          ...state,
          players: state.players.map(p =>
            p.id === playerId
              ? { 
                  ...p, 
                  exploredTiles: [...p.exploredTiles, ...tilesToReveal.filter(tile => !p.exploredTiles.includes(tile))]
                }
              : p
          )
        };
      }
      break;
      
    default:
      break;
  }
  
  return state;
}

function handleUpgradeUnit(
  state: GameState,
  payload: { playerId: string; unitId: string; upgradeType?: 'attack' | 'defense' | 'movement' | 'vision' }
): GameState {
  const { playerId, unitId, upgradeType = 'attack' } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  // Check upgrade costs
  const upgradeCost = GAME_RULES.units.upgradeBaseCost;
  if (player.stars < upgradeCost) return state;

  let unitUpgrades = {};
  switch (upgradeType) {
    case 'attack':
      unitUpgrades = { attack: unit.attack + 2 };
      break;
    case 'defense':
      unitUpgrades = { defense: unit.defense + 2 };
      break;
    case 'movement':
      unitUpgrades = { 
        movement: unit.movement + 1,
        remainingMovement: unit.remainingMovement + 1
      };
      break;
    case 'vision':
      unitUpgrades = { visionRadius: unit.visionRadius + 1 };
      break;
  }

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - upgradeCost }
        : p
    ),
    units: state.units.map(u =>
      u.id === unitId
        ? { ...u, ...unitUpgrades }
        : u
    )
  };
}

function handleActivateFactionAbility(
  state: GameState,
  payload: { playerId: string; abilityId: string; targetId?: string }
): GameState {
  const { playerId, abilityId, targetId } = payload;
  
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const ability = ABILITIES[abilityId];
  if (!ability) return state;

  // Check requirements
  if (ability.requirements) {
    const hasResources = Object.entries(ability.requirements).every(([resource, cost]) => {
      if (resource === 'faith') return player.stats.faith >= cost;
      if (resource === 'pride') return player.stats.pride >= cost;
      return true;
    });
    
    if (!hasResources) return state;
  }

  // Deduct costs and apply ability effects (simplified implementation)
  let updatedPlayer = { ...player };
  if (ability.requirements?.faith) {
    updatedPlayer.stats = {
      ...updatedPlayer.stats,
      faith: updatedPlayer.stats.faith - ability.requirements.faith
    };
  }
  if (ability.requirements?.pride) {
    updatedPlayer.stats = {
      ...updatedPlayer.stats, 
      pride: updatedPlayer.stats.pride - ability.requirements.pride
    };
  }

  return {
    ...state,
    players: state.players.map(p => p.id === playerId ? updatedPlayer : p)
  };
}
