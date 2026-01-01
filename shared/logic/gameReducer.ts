import { GameState, GameAction, PlayerState } from "../types/game";
import { Unit, UnitType } from "../types/unit";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { getActiveModifiers, getUnitModifiers, GameModifier } from "../data/modifiers";
import { TECHNOLOGIES, calculateResearchCost } from "../data/technologies";
import { GAME_RULES, GameRuleHelpers } from "../data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../types/city";
import { ABILITIES, AbilityDefinition } from "../data/abilities";
import { getFaction } from "../data/factions";
import { getWorldElement } from "../data/worldElements";
import type { RuinReward } from "../data/worldElements";
import type { RuinsReward } from "../data/ruinsRewards";
import { executeUnitAction } from "./unitActions";
import { executeAbility } from "./abilitySystem";
import { executeElementHarvest, executeElementBuild } from "./worldElementActions";
import { HexCoordinate } from "../types/coordinates";
import { isPassableForUnit } from "./unitLogic";
import { emitTelemetry } from "./telemetry";
import {
  areCitiesConnectedByRoad,
  calculateTradeRouteEstablishCostStars,
  calculateTradeRouteStarsPerTurn
} from "./tradeRoutes";
import { applyPopulationGain } from "./cityGrowth";
import { attemptUnitConversion } from "./conversion";
import { computeUnitPassiveEffectsForPlayer } from "./unitPassiveEffects";
import { nextFloat, nextId, nextInt } from "./rng";
import { resolveCombat } from "./combatResolver";

function getUnitSpawnCoordinate(
  state: GameState, 
  unitType: UnitType, 
  cityCoordinate: HexCoordinate,
  playerId: string,
  preferredCoordinate?: HexCoordinate
): HexCoordinate | null {
  const SPAWN_RADIUS = 2;
  const MAX_UNITS_PER_TILE = GAME_RULES.units.maxUnitsPerCity;
  
  // Helper to count units on a tile using q,r (axial coords - s is derived)
  const getUnitsOnTile = (coord: HexCoordinate) => 
    state.units.filter(u => 
      u.coordinate.q === coord.q && u.coordinate.r === coord.r
    );
  
  // Helper to check if tile is valid for spawning
  const isValidSpawnTile = (coord: HexCoordinate, terrain: string) => {
    const unitsOnTile = getUnitsOnTile(coord);
    const hasEnemy = unitsOnTile.some(u => u.playerId !== playerId);
    if (hasEnemy) return false;
    if (unitsOnTile.length >= MAX_UNITS_PER_TILE) return false;
    return true;
  };
  
  // For boats, find ADJACENT water tiles only (coastal launch rule)
  if (unitType === 'boat') {
    const adjacentTiles = hexNeighbors(cityCoordinate);
    const validBoatTiles = adjacentTiles
      .map(neighbor => state.map.tiles.find(t => 
        t.coordinate.q === neighbor.q && t.coordinate.r === neighbor.r
      ))
      .filter((tile): tile is NonNullable<typeof tile> => 
        !!tile && tile.terrain === 'water' && isValidSpawnTile(tile.coordinate, tile.terrain)
      );
    
    if (validBoatTiles.length === 0) return null;
    
    // If a preferred coordinate is specified and valid, use it
    if (preferredCoordinate) {
      const preferred = validBoatTiles.find(tile =>
        tile.coordinate.q === preferredCoordinate.q &&
        tile.coordinate.r === preferredCoordinate.r
      );
      if (preferred) return preferred.coordinate;
    }
    
    // Otherwise return first valid water tile
    return validBoatTiles[0].coordinate;
  }
  
  // Get all tiles within spawn radius of the city for land units
  const tilesInRange = state.map.tiles.filter(tile => 
    hexDistance(cityCoordinate, tile.coordinate) <= SPAWN_RADIUS
  );
  
  // For land units, find valid spawn locations
  const validSpawnTiles = tilesInRange.filter(tile => {
    if (tile.terrain === 'water') return false;
    return isValidSpawnTile(tile.coordinate, tile.terrain);
  });
  
  if (validSpawnTiles.length === 0) return null;
  
  // If a preferred coordinate is specified and valid, use it
  if (preferredCoordinate) {
    const preferred = validSpawnTiles.find(tile =>
      tile.coordinate.q === preferredCoordinate.q &&
      tile.coordinate.r === preferredCoordinate.r
    );
    if (preferred) return preferred.coordinate;
  }
  
  // Prefer tiles with fewer units, prioritizing city center
  validSpawnTiles.sort((a, b) => {
    const unitsOnA = getUnitsOnTile(a.coordinate).length;
    const unitsOnB = getUnitsOnTile(b.coordinate).length;
    
    // First prefer fewer units
    if (unitsOnA !== unitsOnB) return unitsOnA - unitsOnB;
    
    // Then prefer closer to city
    return hexDistance(cityCoordinate, a.coordinate) - hexDistance(cityCoordinate, b.coordinate);
  });
  
  return validSpawnTiles[0].coordinate;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

type MoraleDelta = { faith?: number; pride?: number; dissent?: number };

function applyMoralDelta(stats: PlayerState['stats'], delta: MoraleDelta): PlayerState['stats'] {
  return {
    faith: clampStat(stats.faith + (delta.faith || 0)),
    pride: clampStat(stats.pride + (delta.pride || 0)),
    internalDissent: clampStat(stats.internalDissent + (delta.dissent || 0)),
  };
}

function pickWeightedIndex(weights: number[], roll01: number): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let selector = clamp01(roll01) * total;
  for (let i = 0; i < weights.length; i++) {
    selector -= Math.max(0, weights[i]);
    if (selector <= 0) return i;
  }
  return weights.length - 1;
}

function calculateRoadConnectedCityStarBonus(state: GameState, playerId: string): number {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 0;

  const ownedCities = (state.cities || []).filter(city => city.ownerId === playerId);
  if (ownedCities.length < 2) return 0;

  const roadKeys = new Set(
    (state.improvements || [])
      .filter(imp => imp.ownerId === playerId)
      .filter(imp => imp.type === 'road')
      .filter(imp => imp.constructionTurns === 0)
      .map(imp => `${imp.coordinate.q},${imp.coordinate.r}`)
  );

  if (roadKeys.size === 0) return 0;

  const cityKeys = new Set(ownedCities.map(city => `${city.coordinate.q},${city.coordinate.r}`));
  const visited = new Set<string>();
  let bonus = 0;

  for (const city of ownedCities) {
    const startKey = `${city.coordinate.q},${city.coordinate.r}`;
    if (visited.has(startKey)) continue;

    // Cities only connect if they have at least one adjacent road
    const hasAdjacentRoad = hexNeighbors(city.coordinate).some(n => roadKeys.has(`${n.q},${n.r}`));
    if (!hasAdjacentRoad) {
      visited.add(startKey);
      continue;
    }

    const queue: HexCoordinate[] = [city.coordinate];
    const componentCities = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.q},${current.r}`;
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      const isCity = cityKeys.has(currentKey);
      const isRoad = roadKeys.has(currentKey);

      if (isCity) componentCities.add(currentKey);

      for (const neighbor of hexNeighbors(current)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;

        // Travel rules:
        // - From city: can only step onto adjacent road tiles
        // - From road: can step onto road tiles and city tiles
        const canTraverse =
          (isCity && roadKeys.has(neighborKey)) ||
          (isRoad && (roadKeys.has(neighborKey) || cityKeys.has(neighborKey)));

        if (canTraverse && !visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }

    // Each connected component grants +1★/turn per additional city beyond the first.
    bonus += Math.max(0, componentCities.size - 1);
  }

  // Trade amplifies connected-city commerce.
  const multiplier = player.researchedTechs?.includes('trade') ? 2 : 1;
  return bonus * multiplier;
}

// Tech Research Handler
function handleResearchTech(
  state: GameState,
  payload: { playerId: string; techId: string }
): GameState {
  const { playerId, techId } = payload;

  const tech = TECHNOLOGIES[techId];
  if (!tech) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const cost = calculateResearchCost(tech, player.researchedTechs.length);

  // Check if player can afford and prerequisites are met
  if (player.stars < cost) return state;
  if (!tech.prerequisites.every(prereq => player.researchedTechs.includes(prereq))) return state;
  if (player.researchedTechs.includes(techId)) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: p.stars - cost,
          researchedTechs: [...p.researchedTechs, techId],
        }
        : p
    ),
  };
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
  if (!player) return state;

  // Player must own the city that is producing the item
  if (!player.citiesOwned.includes(cityId)) return state;

  // Get building cost and time based on category
  let cost = { stars: 0, faith: 0, pride: 0 };
  let buildTime = 1;

  if (category === 'improvements') {
    const improvement = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvement) return state;
    if (!player.researchedTechs.includes(improvement.requiredTech)) return state;
    cost.stars = improvement.cost;
    buildTime = improvement.constructionTime;

    // Validate tile placement
    if (!coordinate) return state;
    const tile = state.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);
    if (!tile) return state;
    if (!improvement.validTerrain.includes(tile.terrain)) return state;

    const hasImprovement = (state.improvements || []).some(i => i.coordinate.q === coordinate.q && i.coordinate.r === coordinate.r);
    if (hasImprovement) return state;
  } else if (category === 'structures') {
    const structure = STRUCTURE_DEFINITIONS[buildingType as keyof typeof STRUCTURE_DEFINITIONS];
    if (!structure) return state;
    if (!player.researchedTechs.includes(structure.requiredTech)) return state;
    cost.stars = structure.cost;
    buildTime = 1; // Default build time for structures
  } else if (category === 'units') {
    const unitDef = getUnitDefinition(buildingType as any);
    if (!unitDef) {
      console.log(`Unit definition not found for ${buildingType}`);
      return state;
    }
    if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) return state;
    if (unitDef.factionSpecific.length > 0 && !unitDef.factionSpecific.includes(player.factionId)) return state;
    cost.stars = unitDef.cost; // Units have direct cost number
    buildTime = 1; // Units build quickly
    if (unitDef.requirements) {
      if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return state;
      if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return state;
      if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) return state;
    }

    // Special validation for boats - they need coastal access
    if (buildingType === 'boat') {
      const city = state.cities?.find(c => c.id === cityId);
      if (city) {
        // Check if city has coastal access (adjacent to water)
        const cityTile = state.map.tiles.find(t =>
          t.coordinate.q === city.coordinate.q &&
          t.coordinate.r === city.coordinate.r
        );

        if (cityTile && cityTile.terrain === 'water') {
          // City is on water, allow boat building
        } else {
          // Check for adjacent water tiles
          const adjacentWater = state.map.tiles.some(tile => {
            const distance = Math.abs(tile.coordinate.q - city.coordinate.q) +
              Math.abs(tile.coordinate.r - city.coordinate.r) +
              Math.abs(tile.coordinate.s - city.coordinate.s);
            return distance === 2 && tile.terrain === 'water'; // Adjacent hex distance is 2 in cube coordinates
          });

          if (!adjacentWater) {
            console.log(`Cannot build boat: city ${cityId} has no coastal access`);
            return state;
          }
        }
      }
    }
  }

  // Check if player can afford
  if (player.stars < cost.stars ||
    player.stats.faith < (cost.faith || 0) ||
    player.stats.pride < (cost.pride || 0)) {
    console.log(`Cannot afford ${buildingType}: need ${cost.stars} stars, ${cost.faith} faith, ${cost.pride} pride. Have ${player.stars} stars, ${player.stats.faith} faith, ${player.stats.pride} pride`);
    return state;
  }

  console.log(`Starting construction of ${buildingType} (${category}) for player ${playerId}`);
  console.log(`Construction details:`, { buildingType, category, coordinate, cityId, cost, buildTime });

  // Create construction item deterministically
  let rngSeed = state.rngSeed ?? 0;
  const constructionIdResult = nextId(rngSeed, `${buildingType}_${cityId}`);
  rngSeed = constructionIdResult.seed;
  const constructionId = constructionIdResult.id;
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

  console.log(`Adding construction item to queue:`, constructionItem);

  // Deduct costs and add to construction queue
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: p.stars - cost.stars,
          constructionQueue: [...(p.constructionQueue || []), constructionItem]
        }
        : p
    ),
    rngSeed,
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

  let rngSeed = state.rngSeed ?? 0;
  const improvementIdResult = nextId(rngSeed, `${improvementType}_${coordinate.q}_${coordinate.r}`);
  rngSeed = improvementIdResult.seed;

  // Create new improvement with proper typing
  const newImprovement = {
    id: improvementIdResult.id,
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
    improvements: [...(state.improvements || []), newImprovement],
    rngSeed,
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

  let rngSeed = state.rngSeed ?? 0;
  const structureIdResult = nextId(rngSeed, `${structureType}_${cityId}`);
  rngSeed = structureIdResult.seed;

  // Create new structure with proper typing
  const newStructure = {
    id: structureIdResult.id,
    type: structureType as keyof typeof STRUCTURE_DEFINITIONS,
    cityId,
    ownerId: playerId,
    constructionTurns: 0, // Built immediately for now
    effects: {
      ...structureDef.effects,
      faithProduction: structureDef.effects.faithProduction ?? 0,
    }
  };

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - structureDef.cost }
        : p
    ),
    structures: [...(state.structures || []), newStructure],
    rngSeed,
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
      Math.abs((unit.coordinate.s || -unit.coordinate.q - unit.coordinate.r) - (targetCity.coordinate.s || -targetCity.coordinate.q - targetCity.coordinate.r))
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

  // Update tile ownership for the city tile (for UI + visibility rules)
  const updatedMapTiles = state.map.tiles.map(tile =>
    tile.coordinate.q === targetCity.coordinate.q &&
      tile.coordinate.r === targetCity.coordinate.r &&
      tile.hasCity
      ? {
        ...tile,
        cityOwner: playerId,
        exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
      }
      : tile
  );

  return {
    ...state,
    players: updatedPlayers,
    cities: updatedCities,
    structures: updatedStructures,
    improvements: updatedImprovements,
    map: { ...state.map, tiles: updatedMapTiles }
  };
}

// Conquer Village Handler - Military takeover
function handleConquerVillage(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;

  // Find the unit attempting to conquer
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

  // Conquer the village - update tile ownership and mark as conquered
  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === unit.coordinate.q &&
      tile.coordinate.r === unit.coordinate.r &&
      tile.feature === 'village') {
      return {
        ...tile,
        cityOwner: playerId,
        captureType: 'conquered' as const,
        exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
      };
    }
    return tile;
  });

  // Give conquer rewards: +5 stars, +1 population (tracked via pride)
  // Moral impact: +2 pride, +1 dissent
  const CONQUER_STAR_REWARD = 5;
  const CONQUER_PRIDE_IMPACT = 2;
  const CONQUER_DISSENT_IMPACT = 1;

  const updatedPlayers = state.players.map(p => {
    if (p.id === playerId) {
      return {
        ...p,
        stars: p.stars + CONQUER_STAR_REWARD,
        stats: {
          ...p.stats,
          pride: Math.min(100, p.stats.pride + CONQUER_PRIDE_IMPACT),
          internalDissent: Math.min(100, p.stats.internalDissent + CONQUER_DISSENT_IMPACT)
        }
      };
    }
    return p;
  });

  // Exhaust the unit after conquering
  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? { ...u, remainingMovement: 0, hasAttacked: true }
      : u
  );

  // Population reward: grows the nearest owned city (if any)
  const playerCities = (state.cities || []).filter(c => c.ownerId === playerId);
  const closestCityId = (() => {
    if (playerCities.length === 0) return null;
    let best = playerCities[0];
    let bestDist = hexDistance(best.coordinate, unit.coordinate);
    for (const city of playerCities) {
      const d = hexDistance(city.coordinate, unit.coordinate);
      if (d < bestDist) {
        best = city;
        bestDist = d;
      }
    }
    return best.id;
  })();

  return {
    ...state,
    map: {
      ...state.map,
      tiles: updatedMapTiles
    },
    players: updatedPlayers,
    units: updatedUnits,
    cities:
      closestCityId
        ? (state.cities || []).map(c => (c.id === closestCityId ? applyPopulationGain(c, 1) : c))
        : state.cities
  };
}

// Convert Village Handler - Peaceful integration
function handleConvertVillage(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;

  // Find the unit attempting to convert
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

  // Check if player has enough faith
  const CONVERT_FAITH_COST = GAME_RULES.conversion.costs.village;
  if (player.stats.faith < CONVERT_FAITH_COST) return state;

  // Convert the village - update tile ownership, mark as converted, add ongoing bonus
  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === unit.coordinate.q &&
      tile.coordinate.r === unit.coordinate.r &&
      tile.feature === 'village') {
      return {
        ...tile,
        cityOwner: playerId,
        captureType: 'converted' as const,
        starBonus: 1, // Ongoing +1 star per turn
        exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
      };
    }
    return tile;
  });

  // Give convert rewards: +2 stars, +2 population (tracked via faith)
  // Moral impact: +2 faith, costs 8 faith initially
  const CONVERT_STAR_REWARD = 2;
  const CONVERT_FAITH_IMPACT = 2;

  const updatedPlayers = state.players.map(p => {
    if (p.id === playerId) {
      return {
        ...p,
        stars: p.stars + CONVERT_STAR_REWARD,
        stats: {
          ...p.stats,
          faith: Math.min(100, Math.max(0, p.stats.faith - CONVERT_FAITH_COST + CONVERT_FAITH_IMPACT))
        }
      };
    }
    return p;
  });

  // Exhaust the unit after converting
  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? { ...u, remainingMovement: 0, hasAttacked: true }
      : u
  );

  // Population reward: grows the nearest owned city (if any)
  const playerCities = (state.cities || []).filter(c => c.ownerId === playerId);
  const closestCityId = (() => {
    if (playerCities.length === 0) return null;
    let best = playerCities[0];
    let bestDist = hexDistance(best.coordinate, unit.coordinate);
    for (const city of playerCities) {
      const d = hexDistance(city.coordinate, unit.coordinate);
      if (d < bestDist) {
        best = city;
        bestDist = d;
      }
    }
    return best.id;
  })();

  return {
    ...state,
    map: {
      ...state.map,
      tiles: updatedMapTiles
    },
    players: updatedPlayers,
    units: updatedUnits,
    cities:
      closestCityId
        ? (state.cities || []).map(c => (c.id === closestCityId ? applyPopulationGain(c, 2) : c))
        : state.cities
  };
}

// Explore Ruins Handler
function handleExploreRuins(
  state: GameState,
  payload: { unitId: string; playerId: string; coordinate: any; randomSeed?: number }
): GameState {
  const { unitId, playerId, coordinate } = payload;

  // Find the unit
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  // Find the ruins tile
  const ruinsTile = state.map.tiles.find(tile =>
    tile.coordinate.q === coordinate.q &&
    tile.coordinate.r === coordinate.r &&
    tile.feature === 'ruin'
  );

  if (!ruinsTile) return state;

  // Check if unit is on or adjacent to ruins
  const distance = Math.max(
    Math.abs(unit.coordinate.q - coordinate.q),
    Math.abs(unit.coordinate.r - coordinate.r),
    Math.abs((unit.coordinate.s || -unit.coordinate.q - unit.coordinate.r) - (coordinate.s || -coordinate.q - coordinate.r))
  );

  if (distance > 1) return state; // Too far away

  // Import rewards system (using require to avoid circular dependency matching issues if imported at top)
  // In a real build system we'd use top-level import, but for this patching it's safer
  const { getRandomRuinsReward } = require('../data/ruinsRewards');

  let rngSeed = state.rngSeed ?? 0;
  const rewardRoll = nextFloat(rngSeed);
  rngSeed = rewardRoll.seed;
  const reward = getRandomRuinsReward(rewardRoll.value);

  // Find the player
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Apply rewards
  const updatedPlayers = state.players.map(p => {
    if (p.id !== playerId) return p;

    return {
      ...p,
      stars: p.stars + (reward.stars || 0),
      stats: {
        ...p.stats,
        faith: Math.min(100, p.stats.faith + (reward.faith || 0)),
        pride: Math.min(100, p.stats.pride + (reward.pride || 0)),
        internalDissent: Math.min(100, p.stats.internalDissent + (reward.dissent || 0))
      },
      researchProgress: p.researchProgress + (reward.techBoost || 0)
    };
  });

  // Heal unit if applicable
  let updatedUnits = state.units.map(u => {
    if (u.id === unitId) {
      return {
        ...u,
        hp: reward.healAmount ? Math.min(u.maxHp, u.hp + reward.healAmount) : u.hp,
        remainingMovement: 0, // Exploring exhausts movement
        hasAttacked: true
      };
    }
    return u;
  });

  // Spawn unit if applicable
  if (reward.unitType) {
    const unitIdResult = nextId(rngSeed, "unit");
    rngSeed = unitIdResult.seed;
    const newUnit = {
      id: unitIdResult.id,
      type: reward.unitType,
      playerId: playerId,
      coordinate: { ...coordinate },
      hp: 10,
      maxHp: 10,
      attack: 2,
      defense: 2,
      movement: 2,
      remainingMovement: 0,
      visionRadius: 2,
      status: 'active' as const,
      hasAttacked: false,
      abilities: [],
      level: 1,
      experience: 0,
      attackRange: 1
    };
    updatedUnits = [...updatedUnits, newUnit];
  }

  // Remove ruins after exploration (they're one-time only)
  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === coordinate.q &&
      tile.coordinate.r === coordinate.r &&
      tile.feature === 'ruin') {
      return {
        ...tile,
        feature: undefined // Remove ruins
      };
    }
    return tile;
  });

  // Store the reward in a temporary location for UI to display
  if (typeof window !== 'undefined') {
    const rewardForUi = reward.unitType
      ? { ...reward, unitName: getUnitDefinition(reward.unitType as UnitType)?.name }
      : reward;
    const rewardEvent = new CustomEvent('ruinsReward', {
      detail: { reward: rewardForUi, coordinate }
    });
    window.dispatchEvent(rewardEvent);
  }

  return {
    ...state,
    map: {
      ...state.map,
      tiles: updatedMapTiles
    },
    players: updatedPlayers,
    units: updatedUnits,
    rngSeed
  };
}

function buildRuinsUiRewardFromWorldElement(
  reward: RuinReward,
  resourceDeltas: { stars: number; faith: number; population?: number }
): RuinsReward {
  const stars = resourceDeltas.stars || 0;
  const faith = resourceDeltas.faith || 0;
  const population = resourceDeltas.population || 0;
  const techName = reward.techId ? TECHNOLOGIES[reward.techId]?.name : undefined;
  const unitName = reward.unitType ? getUnitDefinition(reward.unitType as UnitType)?.name : undefined;

  const idParts = [reward.type, reward.techId, reward.unitType, reward.value]
    .filter(Boolean)
    .join('_')
    .replace(/[^a-z0-9_]+/gi, '_');

  const base = {
    id: `jaredite_${idParts || 'reward'}`,
    description: reward.description || 'Ancient secrets emerge from the ruins.',
    weight: 1,
    faith: faith || undefined,
  };

  switch (reward.type) {
    case 'stars':
      return {
        ...base,
        type: 'stars',
        name: stars >= 20 ? 'Hidden Cache' : 'Forgotten Treasure',
        rarity: stars >= 20 ? 'uncommon' : 'common',
        stars: stars || undefined,
      };
    case 'population':
      return {
        ...base,
        type: 'population',
        name: 'Ancient Census',
        rarity: 'uncommon',
        description: population > 0
          ? `Ancient records swell a nearby city by ${population} population.`
          : base.description,
        population: population || undefined,
      };
    case 'tech':
      return {
        ...base,
        type: 'tech_boost',
        name: techName ? `${techName} Discovered` : 'Ancient Scrolls',
        rarity: 'rare',
        description: techName
          ? `Ancient scrolls unlock ${techName}.`
          : base.description,
        techName,
      };
    case 'unit':
      return {
        ...base,
        type: 'unit_spawn',
        name: unitName ? `${unitName} Awakens` : 'Ancient Ally',
        rarity: reward.unitType === 'ancient_giant' ? 'legendary' : 'rare',
        description: unitName
          ? `A slumbering ${unitName} rises to join your cause.`
          : base.description,
        unitType: reward.unitType,
        unitName,
      };
    case 'reveal':
      return {
        ...base,
        type: 'reveal',
        name: 'Forgotten Map',
        rarity: 'uncommon',
        description: 'Ancient charts reveal an enemy settlement.',
        reveal: 'Enemy city revealed',
      };
    default:
      return {
        ...base,
        type: 'stars',
        name: 'Jaredite Relic',
        rarity: 'common',
        stars: stars || undefined,
      };
  }
}

// World Element Action Handlers
function handleWorldElementHarvest(
  state: GameState,
  payload: { playerId: string; unitId: string; elementId: string; coordinate: HexCoordinate }
): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || unit.playerId !== payload.playerId) return state;
  if (unit.coordinate.q !== payload.coordinate.q || unit.coordinate.r !== payload.coordinate.r) return state;
  if (unit.hasAttacked || unit.remainingMovement <= 0) return state;

  const element = getWorldElement(payload.elementId);
  if (!element) return state;

  const requiredTag = element.immediateAction?.requiresUnitTag;
  if (requiredTag) {
    // Only special-cased tag today: naval_commander.
    const canActAsTag =
      requiredTag === 'naval_commander' &&
      unit.type === 'commander' &&
      (unit.abilities || []).some(a => String(a).toUpperCase() === 'NAVAL_COMMAND');
    if (!canActAsTag) return state;
  } else if (payload.elementId !== 'jaredite_ruins') {
    // Default: Worker-only interactions.
    if (unit.type !== 'worker') return state;
  }

  let rngSeed = state.rngSeed ?? 0;
  const rand = () => {
    rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };

  const result = executeElementHarvest(state, payload.playerId, payload.elementId, payload.coordinate, rand);

  if (result.success && result.newState) {
    if (typeof window !== 'undefined' && result.effects?.ruinReward) {
      const uiReward = buildRuinsUiRewardFromWorldElement(
        result.effects.ruinReward,
        result.resourceDeltas
      );
      window.dispatchEvent(new CustomEvent('ruinsReward', {
        detail: { reward: uiReward, coordinate: payload.coordinate }
      }));
    }

    return {
      ...result.newState,
      rngSeed,
      units: result.newState.units.map(u =>
        u.id === payload.unitId ? { ...u, remainingMovement: 0, hasAttacked: true } : u
      )
    };
  }

  return state;
}

function handleWorldElementBuild(
  state: GameState,
  payload: { playerId: string; unitId: string; elementId: string; coordinate: HexCoordinate }
): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || unit.playerId !== payload.playerId) return state;
  if (unit.coordinate.q !== payload.coordinate.q || unit.coordinate.r !== payload.coordinate.r) return state;
  if (unit.hasAttacked || unit.remainingMovement <= 0) return state;
  if (unit.type !== 'worker') return state;

  const result = executeElementBuild(state, payload.playerId, payload.elementId, payload.coordinate);

  if (result.success && result.newState) {
    return {
      ...result.newState,
      units: result.newState.units.map(u =>
        u.id === payload.unitId ? { ...u, remainingMovement: 0, hasAttacked: true } : u
      )
    };
  }

  return state;
}

// Recruit Unit Handler
function handleRecruitUnit(
  state: GameState,
  payload: { playerId: string; cityId: string; unitType: string; spawnCoordinate?: HexCoordinate }
): GameState {
  const { playerId, cityId, unitType, spawnCoordinate: preferredSpawnCoordinate } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Get unit definition and validate
  const unitDef = getUnitDefinition(unitType as any);
  if (!unitDef) return state;

  // Enforce technology gate for units
  if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) return state;

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

  // Check if city has space for new units (uses 2-tile spawn radius)
  const unitTypeTyped = unitType as UnitType;
  const spawnCoordinate = getUnitSpawnCoordinate(state, unitTypeTyped, targetCity.coordinate, playerId, preferredSpawnCoordinate);
  if (!spawnCoordinate) return state;

  let rngSeed = state.rngSeed ?? 0;
  const unitIdResult = nextId(rngSeed, `${unitType}_${playerId}`);
  rngSeed = unitIdResult.seed;

  // Create new unit with proper typing
  const newUnit = {
    id: unitIdResult.id,
    type: unitTypeTyped,
    playerId,
    coordinate: spawnCoordinate,
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
    units: [...state.units, newUnit],
    rngSeed,
  };
}

// Rename City Handler
function handleRenameCity(
  state: GameState,
  payload: { playerId: string; cityId: string; newName: string }
): GameState {
  const { playerId, cityId, newName } = payload;

  if (!newName || newName.trim().length === 0) return state;
  const trimmedName = newName.trim().substring(0, 24); // Limit length

  // Find the player
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Verify ownership
  if (!player.citiesOwned.includes(cityId)) return state;

  return {
    ...state,
    cities: state.cities?.map(city =>
      city.id === cityId
        ? { ...city, name: trimmedName }
        : city
    )
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const nextState = (() => {
    switch (action.type) {
      case 'MOVE_UNIT':
        return handleMoveUnit(state, action.payload);

      case 'ATTACK_UNIT':
        return handleAttackUnit(state, action.payload);

      case 'USE_ABILITY':
        return handleUseAbility(state, action.payload);

      case 'RENAME_CITY':
        return handleRenameCity(state, action.payload);

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


      case 'CONQUER_VILLAGE':
        return handleConquerVillage(state, action.payload);

      case 'CONVERT_VILLAGE':
        return handleConvertVillage(state, action.payload);

      case 'EXPLORE_RUINS':
        return handleExploreRuins(state, action.payload);

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

      case 'CONVERT_UNIT':
        return handleConvertUnit(state, action.payload);

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
  })();

  // Only record lastAction when something actually changed (keeps UI effects meaningful).
  if (nextState === state) return state;

  // END_TURN sets its own lastAction (morale event vs end-turn).
  if (action.type === 'END_TURN') return nextState;

  return {
    ...nextState,
    lastAction: { type: action.type as any, payload: (action as any).payload }
  };
}

function handleMoveUnit(
  state: GameState,
  payload: { unitId: string; targetCoordinate: any }
): GameState {
  const unit = state.units.find((u: Unit) => u.id === payload.unitId);
  if (!unit) {
    console.log('Unit not found:', payload.unitId);
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) {
    console.log('Unit does not belong to current player');
    return state;
  }

  // Check if movement is valid
  const distance = hexDistance(unit.coordinate, payload.targetCoordinate);
  console.log('Movement distance:', distance, 'Remaining movement:', unit.remainingMovement);
  if (distance > unit.remainingMovement) {
    console.log('Not enough movement');
    return state;
  }

  // Check if target tile is passable (includes naval special-cases and enemy-blocking)
  if (!isPassableForUnit(payload.targetCoordinate, state, unit)) {
    console.log('Target tile is not passable for this unit');
    return state;
  }

  // Allow units to move and explore - no additional blocking logic needed

  const getTileAt = (coordinate: any) =>
    state.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);

  // Update unit position and movement (+ clear conditional buffs that depend on terrain)
  const updatedUnits = state.units.map((u: Unit) => {
    if (u.id !== payload.unitId) return u;

    const nextCoordinate = payload.targetCoordinate;
    const updatedUnit: Unit = {
      ...u,
      coordinate: nextCoordinate,
      remainingMovement: u.remainingMovement - distance
    };

    // Guerrilla/forest bonuses are terrain-dependent; reset to base stats when leaving forest.
    const unitDef = getUnitDefinition(updatedUnit.type);
    const unitAbilities = new Set((unitDef.abilities || []).map(a => String(a).toUpperCase()));
    const hasForestKit = unitAbilities.has('FOREST_STEALTH') || unitAbilities.has('AMBUSH');
    if (hasForestKit) {
      const destTile = getTileAt(nextCoordinate);
      const isForest = destTile?.terrain === 'forest';
      if (!isForest && updatedUnit.defense !== unitDef.baseStats.defense) {
        updatedUnit.defense = unitDef.baseStats.defense;
      }
    }

    return updatedUnit;
  });

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

  // Check if unit landed on an unclaimed village
  const destTile = updatedTiles.find(t =>
    t.coordinate.q === payload.targetCoordinate.q &&
    t.coordinate.r === payload.targetCoordinate.r
  );

  // If unit is on a village that's NOT owned (neutral), trigger village encounter
  // Don't trigger for villages owned by other players - those would need conquest
  if (destTile?.feature === 'village' && !destTile.cityOwner) {
    // Dispatch village encounter event to UI
    if (typeof window !== 'undefined') {
      const villageEvent = new CustomEvent('villageEncounter', {
        detail: {
          unitId: payload.unitId,
          coordinate: payload.targetCoordinate
        }
      });
      window.dispatchEvent(villageEvent);
    }
  }

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    map: {
      ...state.map,
      tiles: updatedTiles
    }
  };
}

function handleAttackUnit(
  state: GameState,
  payload: { attackerId: string; targetId: string }
): GameState {
  const attacker = state.units.find((u: Unit) => u.id === payload.attackerId);
  const target = state.units.find((u: Unit) => u.id === payload.targetId);

  if (!attacker || !target) return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (attacker.playerId !== currentPlayer.id) return state;

  // Prevent friendly fire - cannot attack units from the same player
  if (attacker.playerId === target.playerId) return state;

  // Check if unit has already attacked this turn
  if (attacker.hasAttacked) return state;

  const distance = hexDistance(attacker.coordinate, target.coordinate);

  const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
  const unitHasAbility = (unit: Unit, abilityId: string) =>
    (unit.abilities || []).some(a => normalizeAbility(String(a)) === normalizeAbility(abilityId));

  const attackerHasBombardment =
    unitHasAbility(attacker, 'SIEGE') ||
    unitHasAbility(attacker, 'BOMBARDMENT') ||
    unitHasAbility(attacker, 'bombardment');

  const combatResult = resolveCombat(attacker, target, state);
  if (!combatResult.canAttack) {
    if (combatResult.reasonCode === 'catapult_not_deployed') {
      emitTelemetry({
        channel: 'combat',
        status: 'blocked',
        attackerId: attacker.id,
        defenderId: target.id,
        reason: 'catapult_not_deployed'
      });
    } else if (combatResult.reasonCode === 'catapult_moved_this_turn') {
      emitTelemetry({
        channel: 'combat',
        status: 'blocked',
        attackerId: attacker.id,
        defenderId: target.id,
        reason: 'catapult_moved_this_turn'
      });
    } else if (combatResult.reasonCode === 'diplomacy_avoided') {
      emitTelemetry({
        channel: 'combat',
        status: 'info',
        attackerId: attacker.id,
        defenderId: target.id,
        reason: 'diplomacy_avoided'
      });

      const updatedPlayers = state.players.map(p => {
        if (p.id !== attacker.playerId) return p;
        return {
          ...p,
          stats: {
            ...p.stats,
            pride: Math.max(0, p.stats.pride - 3),
          }
        };
      });

      return {
        ...state,
        players: updatedPlayers,
        units: state.units.map(u => u.id === attacker.id ? { ...u, hasAttacked: true } : u)
      };
    }

    return state;
  }

  const attackerPlayer = state.players.find(p => p.id === attacker.playerId);
  const targetPlayer = state.players.find(p => p.id === target.playerId);
  const newHp = combatResult.defenderHp;
  const newAttackerHp = combatResult.attackerHp;

  console.log(`Combat: ${attacker.type} (${combatResult.attackerDamage} dmg) vs ${target.type} (${combatResult.defenderDamage} counter)`);

  let updatedUnits = state.units.map((u: Unit) => {
    if (u.id === payload.targetId) {
      return { ...u, hp: newHp };
    }
    if (u.id === payload.attackerId) {
      // Remove stealth when attacking
      const newStatus = u.status === 'stealthed' ? 'active' : u.status;
      const isRangedBombardment = attackerHasBombardment && distance > 1;
      return {
        ...u,
        hp: newAttackerHp,
        hasAttacked: true,
        status: newStatus,
        remainingMovement: isRangedBombardment ? 0 : u.remainingMovement
      };
    }
    return u;
  });

  // Splash damage during bombardment (adjacent to target).
  if (attackerHasBombardment && attacker.status === 'siege_mode' && distance > 1) {
    const splashDamage = Math.max(1, Math.floor(combatResult.attackerDamage / 2));
    updatedUnits = updatedUnits.map(u => {
      if (u.playerId !== target.playerId) return u;
      if (u.id === target.id) return u;
      if (hexDistance(u.coordinate, target.coordinate) !== 1) return u;
      return { ...u, hp: Math.max(0, u.hp - splashDamage) };
    });
  }

  const applyDeathEffects = (units: Unit[], killedUnit: Unit, killedPlayer: PlayerState | undefined) => {
    let nextUnits = units;
    let bloodFeudApplied = false;

    // Apply data-driven death modifiers
    if (killedPlayer) {
      const deathModifiers = getActiveModifiers(killedPlayer, 'on_death');
      deathModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.target === 'nearby' && effect.radius) {
            const affectedUnits = nextUnits.filter(unit => {
              if (unit.playerId !== killedPlayer.id) return false;
              const distance = hexDistance(unit.coordinate, killedUnit.coordinate);
              return distance <= effect.radius!;
            });

            if (modifier.id === 'lamanite_blood_feud' && affectedUnits.length > 0) {
              bloodFeudApplied = true;
            }

            affectedUnits.forEach(unit => {
              const unitIndex = nextUnits.findIndex(u => u.id === unit.id);
              if (unitIndex !== -1) {
                nextUnits[unitIndex] = {
                  ...nextUnits[unitIndex],
                  [effect.stat]: (nextUnits[unitIndex][effect.stat as keyof Unit] as number) + effect.value
                };
                console.log(`Applied ${modifier.name} to ${unit.id}: +${effect.value} ${effect.stat}`);
              }
            });
          }
        });
      });
    }

    if (bloodFeudApplied) {
      emitTelemetry({
        channel: 'combat',
        status: 'success',
        reason: 'blood_feud_triggered',
        defenderId: killedUnit.id,
        playerId: killedPlayer?.id
      });
    }

    // Protective stance: if guardian dies, clear adjacent ally defense back to base.
    const killedHasProtectiveStance = unitHasAbility(killedUnit as any, 'PROTECTIVE_STANCE');
    if (killedHasProtectiveStance) {
      nextUnits = nextUnits.map(u => {
        if (u.playerId !== killedUnit.playerId) return u;
        if (hexDistance(u.coordinate, killedUnit.coordinate) > 1) return u;
        const def = getUnitDefinition(u.type);
        return { ...u, defense: def.baseStats.defense };
      });
    }

    return nextUnits;
  };

  // Remove units if killed and apply death effects
  if (combatResult.defenderKilled) {
    updatedUnits = updatedUnits.filter((u: Unit) => u.id !== payload.targetId);
    updatedUnits = applyDeathEffects(updatedUnits, target, targetPlayer);
  }

  if (combatResult.attackerKilled) {
    updatedUnits = updatedUnits.filter((u: Unit) => u.id !== payload.attackerId);
    updatedUnits = applyDeathEffects(updatedUnits, attacker, attackerPlayer);
  }

  return {
    ...state,
    units: updatedUnits
  };
}

function handleUseAbility(
  state: GameState,
  payload: { playerId: string; abilityId: string; target?: any; unitId?: string; targetCoordinate?: any; targetUnitId?: string }
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const ability = ABILITIES[payload.abilityId];
  if (!ability) return state;

  const cooldownRemaining = player.abilityCooldowns?.[payload.abilityId] ?? 0;
  if (cooldownRemaining > 0) {
    emitTelemetry({
      channel: 'ability',
      status: 'blocked',
      playerId: player.id,
      abilityId: payload.abilityId,
      reason: 'cooldown'
    });
    return state;
  }

  // Check resource requirements
  if (ability.requirements) {
    if (ability.requirements.faith && player.stats.faith < ability.requirements.faith) return state;
    if (ability.requirements.pride && player.stats.pride < ability.requirements.pride) return state;
    if (ability.requirements.dissent && player.stats.internalDissent < ability.requirements.dissent) return state;
  }

  console.log(`Player ${player.name} using ability: ${ability.name}`);

  // Implement specific ability effects
  let next: GameState = state;
  switch (payload.abilityId) {
    case 'TITLE_OF_LIBERTY':
      next = applyTitleOfLiberty(state, player);
      break;
    case 'RAMEUMPTOM':
      next = applyRameumptom(state, player);
      break;
    case 'COVENANT_OF_PEACE':
      next = applyCovenantOfPeace(state, player);
      break;

    // Nephite faction abilities
    case 'nephite_righteous_charge':
      return applyRighteousCharge(state, payload);
    case 'nephite_faith_healing':
      return applyFaithHealing(state, payload);

    // Lamanite faction abilities  
    case 'lamanite_guerrilla_tactics':
      return applyGuerrillaTactics(state, payload);
    case 'lamanite_ancestral_rage':
      return applyAncestralRage(state, payload);

    // Zoramite faction abilities
    case 'zoramite_convert_enemy':
      return applyConvertEnemy(state, payload);
    case 'zoramite_pride_boost':
      return applyPrideBoost(state, payload);

    // Jaredite faction abilities
    case 'jaredite_tower_vision':
      return applyTowerVision(state, payload);
    case 'jaredite_ancient_knowledge':
      return applyAncientKnowledge(state, payload);

    // Anti-Nephi-Lehi faction abilities
    case 'anti_nephi_lehi_pacify':
      return applyPacify(state, payload);
    case 'anti_nephi_lehi_conversion':
      return applyConversion(state, payload);

    // Mulekite faction abilities
    case 'mulekite_trade_network':
      return applyTradeNetwork(state, payload);
    case 'mulekite_maritime_expansion':
      return applyMaritimeExpansion(state, payload);

    default:
      console.warn(`Ability ${payload.abilityId} not implemented yet`);
      next = state;
  }

  if (next === state) return state;

  const cooldown = ability.cooldown;
  if (typeof cooldown === 'number' && cooldown > 0) {
    next = {
      ...next,
      players: next.players.map(p =>
        p.id === player.id
          ? {
            ...p,
            abilityCooldowns: {
              ...(p.abilityCooldowns || {}),
              [payload.abilityId]: cooldown,
            }
          }
          : p
      )
    };
  }

  emitTelemetry({ channel: 'ability', status: 'success', playerId: player.id, abilityId: payload.abilityId });
  return next;
}

function handleEndTurn(
  state: GameState,
  payload: { playerId: string }
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== payload.playerId) return state;

  let updatedCities = [...(state.cities || [])];
  let pendingDesertedUnitId: string | null = null;
  const endTurnEvents: Array<{ type: string; payload: any }> = [];
  let rngSeed = state.rngSeed ?? 0;
  const rand = () => {
    // Deterministic PRNG (LCG). Keeps tests stable and makes runs replayable per seed.
    rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };

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

      // Faith income is data-driven from structure/improvement effects (plus a small missionary presence bonus).
      const baseFaith = GameRuleHelpers.calculateFaithGeneration(playerCities);

      const unitPassive = computeUnitPassiveEffectsForPlayer(state, player.id, updatedStats);

      const faithFromStructures = (state.structures || [])
        .filter(s => s.ownerId === player.id && s.constructionTurns === 0)
        .reduce((sum, s) => {
          const def = STRUCTURE_DEFINITIONS[s.type as keyof typeof STRUCTURE_DEFINITIONS];
          return sum + (s.effects?.faithProduction ?? def?.effects?.faithProduction ?? 0);
        }, 0);

      const faithFromImprovements = (state.improvements || [])
        .filter(imp => imp.ownerId === player.id && imp.constructionTurns === 0)
        .reduce((sum, imp) => {
          const def = IMPROVEMENT_DEFINITIONS[imp.type as keyof typeof IMPROVEMENT_DEFINITIONS];
          return sum + (def?.effects?.faithProduction ?? 0);
        }, 0);

      // Missionary presence bonus: +1 per missionary (capped)
      const missionaries = state.units.filter(u =>
        u.playerId === player.id &&
        u.type === 'missionary'
      ).length;
      const missionaryFaith = Math.min(
        missionaries * GAME_RULES.resources.faithPerMissionary,
        GAME_RULES.resources.maxMissionaryFaithBonus
      );

      // Calculate base income from cities using Polytopia-style mechanics
      const faithGeneration =
        baseFaith +
        faithFromStructures +
        faithFromImprovements +
        missionaryFaith +
        (unitPassive.perTurn.faith || 0);

      // Calculate star income based on city levels and production
      let starIncome = 0;
      const playerCityObjects = state.cities?.filter(city => city.ownerId === player.id) || [];
      playerCityObjects.forEach(city => {
        const unrestTurns = city.unrestTurns || 0;
        const unrestPenalty = unrestTurns > 0 ? GAME_RULES.morale.unrestIncomePenaltyPerCity : 0;
        starIncome += Math.max(0, city.starProduction - unrestPenalty);
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
          let production = improvement.starProduction;
          if (improvement.type === 'port' && player.researchedTechs?.includes('seafaring')) {
            production += 1;
          }
          starIncome += production;
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

      // Add income from converted villages
      const convertedVillages = state.map.tiles.filter(tile =>
        tile.feature === 'village' &&
        tile.cityOwner === player.id &&
        tile.captureType === 'converted' &&
        tile.starBonus
      );
      const villageBonus = convertedVillages.reduce((sum, tile) => sum + (tile.starBonus || 0), 0);
      starIncome += villageBonus;

      // Road trade bonus: cities connected by road grant extra stars
      const roadBonus = calculateRoadConnectedCityStarBonus(state, player.id);
      starIncome += roadBonus;

      // Trade route income: persistent per-turn income, and validated (routes can disappear if the network breaks).
      const rawRoutes = player.tradeRoutes || [];
      const validTradeRoutes = rawRoutes.filter(route => {
        if (!player.citiesOwned.includes(route.fromCityId)) return false;
        if (!player.citiesOwned.includes(route.toCityId)) return false;
        return areCitiesConnectedByRoad(state, player.id, route.fromCityId, route.toCityId);
      });
      const tradeIncome = validTradeRoutes.reduce((sum, r) => sum + (r.starsPerTurn || 0), 0);
      starIncome += tradeIncome;

      // Passive unit income (e.g., Priestcraft Preachers).
      starIncome += unitPassive.perTurn.stars || 0;

      // Passive per-turn moral shifts from units should influence this turn's morale outcomes.
      if (unitPassive.perTurn.pride || unitPassive.perTurn.dissent) {
        updatedStats = applyMoralDelta(updatedStats, {
          pride: unitPassive.perTurn.pride || 0,
          dissent: unitPassive.perTurn.dissent || 0,
        });
      }

      // === Morale System (Pride Cycle + Dissent Events) ===
      // Book of Mormon-inspired pattern:
      // prosperity → pride → contention → loss → humility → deliverance.
      const temples = (state.structures || []).filter(s =>
        s.ownerId === player.id &&
        s.constructionTurns === 0 &&
        s.type === 'temple'
      ).length;
      const wars = player.atWarWith?.length || 0;
      const alliances = player.alliedWith?.length || 0;

      // Drift: prosperity tends to inflate pride; pride tends to breed contention (dissent).
      const prosperityScore = starIncome + Math.floor(Math.max(0, player.stars - 10) / 15); // avoids early-game runaway pride
      const prideFromProsperity = Math.min(2, Math.floor(prosperityScore / 12));
      const dissentFromPride = Math.min(3, Math.floor(updatedStats.pride / 35));
      const dissentFromWar = wars > 0 ? Math.min(4, wars * 1) : 0;
      const dissentRelief = Math.min(4, alliances + temples);

      updatedStats = applyMoralDelta(updatedStats, {
        pride: prideFromProsperity,
        dissent: dissentFromPride + dissentFromWar - dissentRelief,
      });

      // Humility pressure: sustained faith and worship tends to humble pride over time.
      const prideHumble =
        (updatedStats.faith >= 70 ? 1 : 0) +
        (temples >= 1 ? 1 : 0);
      if (prideHumble > 0) {
        updatedStats = applyMoralDelta(updatedStats, { pride: -prideHumble });
      }

      // Random-feeling events (scaled by Pride + Dissent). Moderate severity.
      const prideN = updatedStats.pride / 100;
      const dissentN = updatedStats.internalDissent / 100;
      const badPressure = clamp01(0.65 * prideN + 0.35 * dissentN);
      const goodPressure = clamp01(1 - Math.max(prideN, dissentN));

      const badChance = GAME_RULES.morale.badChanceBase + GAME_RULES.morale.badChanceScale * Math.pow(badPressure, 2);
      const goodChance = GAME_RULES.morale.goodChanceMax * Math.pow(goodPressure, 1.35);

      let starsDeltaFromEvent = 0;
      let moraleCityIdToRebel: string | null = null;

      const rollBad = rand();
      if (rollBad < badChance) {
        const canDesert = updatedStats.internalDissent >= GAME_RULES.morale.desertionFloorDissent;

        const rebellionWeight = 2 + updatedStats.internalDissent / 15;     // more likely with dissent
        const desertionWeight = canDesert ? (0.5 + updatedStats.internalDissent / 30) : 0;
        const contentionWeight = 2 + updatedStats.pride / 20;              // more likely with pride (riches lost)

        const eventIndex = pickWeightedIndex(
          [rebellionWeight, desertionWeight, contentionWeight],
          rand()
        );

        if (eventIndex === 0) {
          // Rebellion: city unrest + small immediate loss
          const ownedCities = (state.cities || []).filter(c => c.ownerId === player.id);
          if (ownedCities.length > 0) {
            moraleCityIdToRebel = ownedCities[pickWeightedIndex(new Array(ownedCities.length).fill(1), rand())].id;
            starsDeltaFromEvent -= GAME_RULES.morale.rebellionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 5, pride: -2 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'rebellion', cityId: moraleCityIdToRebel, starsDelta: -GAME_RULES.morale.rebellionStarsLoss } });
          } else {
            // fallback to contention
            starsDeltaFromEvent -= GAME_RULES.morale.contentionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 3, pride: -2 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'contention', starsDelta: -GAME_RULES.morale.contentionStarsLoss } });
          }
        } else if (eventIndex === 1) {
          // Desertion: lose a unit (only possible at high dissent) + small immediate loss
          const deserters = state.units
            .filter(u => u.playerId === player.id)
            .filter(u => u.type !== 'worker'); // workers are less "army desertion"
          if (deserters.length > 0) {
            const deserter = deserters[pickWeightedIndex(new Array(deserters.length).fill(1), rand())];
            pendingDesertedUnitId = deserter.id;
            starsDeltaFromEvent -= GAME_RULES.morale.desertionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 2, pride: -3 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'desertion', unitId: deserter.id, starsDelta: -GAME_RULES.morale.desertionStarsLoss } });
          } else {
            // fallback to contention
            starsDeltaFromEvent -= GAME_RULES.morale.contentionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 3, pride: -2 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'contention', starsDelta: -GAME_RULES.morale.contentionStarsLoss } });
          }
        } else {
          // Contention: small loss of riches, dissent rises, pride is humbled.
          starsDeltaFromEvent -= GAME_RULES.morale.contentionStarsLoss;
          updatedStats = applyMoralDelta(updatedStats, { dissent: 4, pride: -3 });
          endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'contention', starsDelta: -GAME_RULES.morale.contentionStarsLoss } });
        }
      } else {
        const rollGood = rand();
        if (rollGood < goodChance) {
          // Blessings of humility/peace: modest gains, stability, and strengthened faith.
          const starsGain = 4 + Math.floor(6 * rand()); // 4..9
          starsDeltaFromEvent += starsGain;
          updatedStats = applyMoralDelta(updatedStats, { faith: 3, dissent: -4, pride: -2 });
          endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'blessing', starsDelta: starsGain } });
        }
      }

      updatedStats.faith = clampStat(updatedStats.faith + faithGeneration);

      // Process construction queue
      const updatedConstructionQueue = (player.constructionQueue || []).map(item => ({
        ...item,
        turnsRemaining: item.turnsRemaining - 1
      }));

      // Complete finished constructions
      const completedConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining <= 0);
      const ongoingConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining > 0);

      // Decrement diplomatic cooldowns
      const currentCooldowns = player.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 };
      const updatedCooldowns = {
        declareWar: Math.max(0, currentCooldowns.declareWar - 1),
        formAlliance: Math.max(0, currentCooldowns.formAlliance - 1),
        breakAlliance: Math.max(0, currentCooldowns.breakAlliance - 1),
        requestTrade: Math.max(0, currentCooldowns.requestTrade - 1),
      };

      // Additional cooldown adjustments from passive units (e.g., Scribe-Teacher).
      const cd = unitPassive.cooldownDelta || {};
      if (cd.declareWar || cd.formAlliance || cd.breakAlliance || cd.requestTrade) {
        updatedCooldowns.declareWar = Math.max(0, updatedCooldowns.declareWar + (cd.declareWar || 0));
        updatedCooldowns.formAlliance = Math.max(0, updatedCooldowns.formAlliance + (cd.formAlliance || 0));
        updatedCooldowns.breakAlliance = Math.max(0, updatedCooldowns.breakAlliance + (cd.breakAlliance || 0));
        updatedCooldowns.requestTrade = Math.max(0, updatedCooldowns.requestTrade + (cd.requestTrade || 0));
      }

      // Decrement ability cooldowns
      const abilityCooldowns = player.abilityCooldowns || {};
      const updatedAbilityCooldowns = Object.fromEntries(
        Object.entries(abilityCooldowns).map(([key, value]) => [key, Math.max(0, value - 1)])
      );

      // Tick down existing unrest AFTER it affected this turn's income
      updatedCities = updatedCities.map(city => {
        if (city.ownerId !== player.id) return city;
        const unrestTurns = city.unrestTurns || 0;
        if (unrestTurns <= 0) return city;
        return { ...city, unrestTurns: Math.max(0, unrestTurns - 1) };
      });

      // Apply new rebellion (starts next turn at full duration)
      if (moraleCityIdToRebel) {
        updatedCities = updatedCities.map(city =>
          city.id === moraleCityIdToRebel
            ? { ...city, unrestTurns: Math.max(city.unrestTurns || 0, GAME_RULES.morale.unrestDurationTurns) }
            : city
        );
      }

      return {
        ...player,
        stats: updatedStats,
        stars: Math.max(0, player.stars + starIncome + starsDeltaFromEvent),
        tradeRoutes: validTradeRoutes,
        constructionQueue: ongoingConstructions,
        completedConstructions, // We'll handle this below
        diplomaticCooldowns: updatedCooldowns,
        abilityCooldowns: updatedAbilityCooldowns
      };
    }
    return player;
  });

  // Process completed constructions and add to game state
  let updatedUnits = [...state.units];
  let updatedImprovements = [...(state.improvements || [])];
  let updatedStructures = [...(state.structures || [])];

  updatedPlayers.forEach(player => {
    if ((player as any).completedConstructions) {
      (player as any).completedConstructions.forEach((construction: any) => {
        if (construction.category === 'units') {
          // Create new unit within 2 tiles of city
          const city = state.cities?.find(c => c.id === construction.cityId);
          if (city) {
            const unitDef = getUnitDefinition(construction.type as any);
            const spawnCoordinate = getUnitSpawnCoordinate(state, construction.type as UnitType, city.coordinate, construction.playerId);
            if (!spawnCoordinate) return;
            const unitIdResult = nextId(rngSeed, "unit");
            rngSeed = unitIdResult.seed;
            const newUnit = {
              id: unitIdResult.id,
              status: 'active' as const,
              type: construction.type,
              playerId: construction.playerId,
              coordinate: spawnCoordinate,
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
            ownerId: construction.playerId,
            effects: {
              starProduction: structureDef?.effects?.starProduction ?? 0,
              unitProduction: structureDef?.effects?.unitProduction ?? 0,
              defenseBonus: structureDef?.effects?.defenseBonus ?? 0,
              populationGrowth: structureDef?.effects?.populationGrowth ?? 0,
              faithProduction: structureDef?.effects?.faithProduction ?? 0,
            },
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

  // Tick down end-of-turn unit effects for the player who just ended their turn.
  // Effects here should last *through* a player turn and expire after they finish acting.
  updatedUnits = updatedUnits.map((u: Unit) => {
    if (u.playerId !== currentPlayer.id) return u;
    const effects = Array.isArray(u.statusEffects) ? u.statusEffects : [];
    if (effects.length === 0) return u;

    const nextEffects = effects
      .map(effect => {
        if (effect?.type === 'TESTIMONY_PRESSURE' && typeof effect.turnsRemaining === 'number') {
          return { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
        }
        return effect;
      })
      .filter(effect => !(effect?.type === 'TESTIMONY_PRESSURE' && typeof effect.turnsRemaining === 'number' && effect.turnsRemaining <= 0));

    return nextEffects === effects ? u : { ...u, statusEffects: nextEffects };
  });

  // Calculate next player and turn
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = updatedPlayers[nextPlayerIndex];
  const isNewTurn = nextPlayerIndex === 0;

  // Apply desertion removal after end-of-turn effects resolve
  if (pendingDesertedUnitId) {
    updatedUnits = updatedUnits.filter(u => u.id !== pendingDesertedUnitId);
  }

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

  // === Testimony Pressure (Missionaries) ===
  // Nephite / Anti-Nephi-Lehi missionaries can weaken adjacent enemy *military* units:
  // - temporary attack penalty
  // - clears temporary command buffs (rallied / rallyBuff / tacticalCommand)
  const currentPlayerData = updatedPlayers.find(p => p.id === currentPlayer.id);
  const isTestimonyFaction = currentPlayerData?.factionId === 'NEPHITES' || currentPlayerData?.factionId === 'ANTI_NEPHI_LEHIES';

  if (isTestimonyFaction) {
    const isEligibleEnemyUnit = (u: Unit): boolean => {
      // Exclude civilian/influence units (prevents weird non-combat clumps and future drift).
      const def = getUnitDefinition(u.type as any);
      const tags = def?.tags ?? [];
      return !tags.includes('civilian') && !tags.includes('influence') && !tags.includes('diplomat');
    };

    const myMissionaries = updatedUnits.filter(u => u.playerId === currentPlayer.id && u.type === 'missionary');
    const affectedUnitIds = new Set<string>();
    const affectedByOwner: Record<string, Set<string>> = {};

    myMissionaries.forEach(missionary => {
      const adjacentEnemyUnits = updatedUnits.filter(u =>
        u.playerId !== currentPlayer.id &&
        isEligibleEnemyUnit(u) &&
        hexDistance(u.coordinate, missionary.coordinate) <= 1
      );

      adjacentEnemyUnits.forEach(enemyUnit => {
        affectedUnitIds.add(enemyUnit.id);
        if (!affectedByOwner[enemyUnit.playerId]) affectedByOwner[enemyUnit.playerId] = new Set();
        affectedByOwner[enemyUnit.playerId].add(enemyUnit.id);
      });
    });

    if (affectedUnitIds.size > 0) {
      const penalty = GAME_RULES.influence.testimonyPressure.attackPenalty;
      const durationTurns = GAME_RULES.influence.testimonyPressure.durationTurns;

      updatedUnits = updatedUnits.map((u: any) => {
        if (!affectedUnitIds.has(u.id)) return u;

        const existing = Array.isArray(u.statusEffects) ? u.statusEffects : [];
        const filtered = existing.filter((e: any) => e?.type !== 'TESTIMONY_PRESSURE');
        const nextStatusEffects = [
          ...filtered,
          { type: 'TESTIMONY_PRESSURE', turnsRemaining: durationTurns, attackPenalty: penalty, sourcePlayerId: currentPlayer.id }
        ];

        return {
          ...u,
          statusEffects: nextStatusEffects,
          // Clear temporary command buffs.
          status: u.status === 'rallied' ? 'active' : u.status,
          rallyBuff: false,
          tacticalCommand: false,
        };
      });

      endTurnEvents.push({
        type: 'TESTIMONY_PRESSURE',
        payload: {
          sourcePlayerId: currentPlayer.id,
          attackPenalty: penalty,
          durationTurns,
          affected: Object.entries(affectedByOwner).map(([playerId, unitIds]) => ({
            playerId,
            unitIds: Array.from(unitIds),
          })),
        }
      });
    }
  }

  // Check for victory conditions
  const winner = checkVictoryConditions(state, updatedPlayers);

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    currentPlayerIndex: nextPlayerIndex,
    turn: isNewTurn ? state.turn + 1 : state.turn,
    winner,
    rngSeed,
    lastAction: endTurnEvents.length > 0
      ? { type: 'END_TURN_RESOLUTION', payload: { endingPlayerId: payload.playerId, nextPlayerId: updatedPlayers[nextPlayerIndex].id, events: endTurnEvents } }
      : { type: 'END_TURN', payload }
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
  if (!player.researchedTechs?.includes('forestry')) return state;
  if (unit.remainingMovement <= 0 || unit.hasAttacked) return state;

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
        ? { ...u, remainingMovement: 0, hasAttacked: true } // Exhaust unit after clearing
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
  if (!player.researchedTechs.includes('organization')) return state;
  if (unit.remainingMovement <= 0 || unit.hasAttacked) return state;

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

  let rngSeed = state.rngSeed ?? 0;
  const roadIdResult = nextId(rngSeed, `road_${targetCoordinate.q}_${targetCoordinate.r}`);
  rngSeed = roadIdResult.seed;
  const roadImprovement = {
    id: roadIdResult.id,
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
    ),
    rngSeed,
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
  if (unit.remainingMovement <= 0 || unit.hasAttacked) return state;

  // Check if unit has formation fighting ability
  if (!unit.abilities.includes('formation_fighting')) return state;

  // Apply formation bonus - this is passive, just mark the unit as having used the action
  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? { ...u, status: 'formation' as const, hasAttacked: true, remainingMovement: 0 }
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
  if (!unit.abilities.includes('siege') || unit.remainingMovement !== unit.movement) return state;

  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? { ...u, status: 'siege_mode' as const, hasAttacked: true, remainingMovement: 0 }
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
  if (!(unit.abilities.includes('rally') || unit.abilities.includes('rally_troops')) || unit.hasAttacked) return state;

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
  if (!player) return state;

  const tech = TECHNOLOGIES[technologyId];
  if (!tech) return state;

  // Check if tech is already researched
  if (player.researchedTechs.includes(technologyId)) {
    return state;
  }

  // Verify prerequisites
  const hasPrerequisites = tech.prerequisites.every(prereqId =>
    player.researchedTechs.includes(prereqId)
  );

  if (!hasPrerequisites) {
    console.log(`Cannot research ${tech.name}: missing prerequisites`);
    return state;
  }

  // Check cost
  if (player.stars < tech.cost) {
    console.log(`Cannot research ${tech.name}: insufficient stars (need ${tech.cost}, have ${player.stars})`);
    return state;
  }

  console.log(`Player ${player.name} researched ${tech.name} for ${tech.cost} stars`);

  // Update player with new technology
  const updatedPlayers = state.players.map(p => {
    if (p.id === playerId) {
      return {
        ...p,
        stars: p.stars - tech.cost,
        researchedTechs: [...p.researchedTechs, technologyId],
      };
    }
    return p;
  });

  return {
    ...state,
    players: updatedPlayers
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

  // Elimination Victory: Only one player with units left
  if (GAME_RULES.victory.eliminationRequired) {
    const playersWithUnits = new Set(state.units.map(unit => unit.playerId));
    if (playersWithUnits.size === 1) {
      return Array.from(playersWithUnits)[0];
    }
  }

  return undefined;
}

function handleBuildUnit(
  state: GameState,
  payload: { unitType: string; coordinate: any; playerId: string }
): GameState {
  const { unitType, coordinate, playerId } = payload;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const unitDef = getUnitDefinition(unitType as any);
  if (!unitDef) return state;
  if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) return state;
  if (unitDef.factionSpecific.length > 0 && !unitDef.factionSpecific.includes(player.factionId)) return state;

  // For now, BUILD_UNIT is treated as "recruit at owned city coordinate"
  const targetCity = (state.cities || []).find(c =>
    c.ownerId === playerId &&
    c.coordinate.q === coordinate.q &&
    c.coordinate.r === coordinate.r
  );
  if (!targetCity) return state;

  if (player.stars < unitDef.cost) return state;
  if (unitDef.requirements) {
    if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return state;
    if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return state;
    if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) return state;
  }

  // Use 2-tile spawn radius from city
  const spawnCoordinate = getUnitSpawnCoordinate(state, unitType as UnitType, targetCity.coordinate, playerId);
  if (!spawnCoordinate) return state;

  let rngSeed = state.rngSeed ?? 0;
  const unitIdResult = nextId(rngSeed, `${unitType}_${playerId}`);
  rngSeed = unitIdResult.seed;
  const newUnit = {
    id: unitIdResult.id,
    type: unitType as UnitType,
    playerId,
    coordinate: spawnCoordinate,
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
      p.id === playerId ? { ...p, stars: p.stars - unitDef.cost } : p
    ),
    units: [...state.units, newUnit],
    rngSeed,
  };
}

// Helper functions for specific abilities
function applyTitleOfLiberty(state: GameState, player: PlayerState): GameState {
  if (player.stats.faith < 70) return state;

  return {
    ...state,
    units: state.units.map(u => {
      if (u.playerId !== player.id) return u;
      return {
        ...u,
        attack: u.attack + 2,
        defense: u.defense + 2,
      };
    }),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: p.stats.faith - 50 } }
        : p
    )
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

function applyCovenantOfPeace(state: GameState, player: PlayerState): GameState {
  // Attempt to convert a nearby enemy unit if faith advantage is significant.
  const costFaith = GAME_RULES.abilities.resourceCosts.covenantOfPeace;
  const requiredAdvantage = GAME_RULES.conversion.covenantOfPeace.requiredFaithAdvantage;
  const range = GAME_RULES.conversion.covenantOfPeace.range;
  if (player.stats.faith < costFaith) return state;

  const enemyCandidates = state.units
    .filter(u => u.playerId !== player.id)
    .filter(u => u.playerId !== undefined)
    .filter(u => state.units.some(ally => ally.playerId === player.id && hexDistance(ally.coordinate, u.coordinate) <= range))
    .sort((a, b) => a.hp - b.hp);

  if (enemyCandidates.length === 0) return state;

  const chosen = enemyCandidates[0];
  const enemyPlayer = state.players.find(p => p.id === chosen.playerId);
  const enemyFaith = enemyPlayer?.stats.faith ?? 0;
  const advantage = player.stats.faith - enemyFaith;
  if (advantage < requiredAdvantage) return state;

  return {
    ...state,
    units: state.units.map(u => u.id === chosen.id ? { ...u, playerId: player.id } : u),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - costFaith) } }
        : p
    )
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
function applyGuerrillaTactics(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Guerrilla Tactics: units positioned in forest gain a defense bonus until they leave the forest.
  const bonus = GAME_RULES.abilities.attackBonuses.guerrillaBonus;
  const updatedUnits = state.units.map(u => {
    if (u.playerId !== player.id) return u;
    const tile = state.map.tiles.find(t => t.coordinate.q === u.coordinate.q && t.coordinate.r === u.coordinate.r);
    if (tile?.terrain !== 'forest') return u;
    return { ...u, defense: u.defense + bonus };
  });

  if (updatedUnits === state.units) return state;
  return { ...state, units: updatedUnits };
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
function applyConvertEnemy(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || !payload.targetUnitId) return state;

  const target = state.units.find(u => u.id === payload.targetUnitId);
  if (!target || target.playerId === unit.playerId) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player || player.stats.pride < 20) return state;

  // Convert Enemy: Turn enemy unit to your faction
  const distance = hexDistance(unit.coordinate, target.coordinate);
  if (distance <= GAME_RULES.abilities.conversionRadius) {
    return {
      ...state,
      units: state.units.map(u =>
        u.id === payload.targetUnitId
          ? { ...u, playerId: unit.playerId }
          : u
      ),
      players: state.players.map(p =>
        p.id === player.id
          ? { ...p, stats: { ...p.stats, pride: Math.max(0, p.stats.pride - 20) } }
          : p
      )
    };
  }
  return state;
}

function applyPrideBoost(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  // Pride Boost: Gain pride from nearby structures/cities
  const playerCities = state.cities?.filter(city =>
    player.citiesOwned.includes(city.id)
  ) || [];

  const prideGain = playerCities.length * 3;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.min(100, p.stats.pride + prideGain) } }
        : p
    )
  };
}

// Jaredite Faction Abilities
function applyTowerVision(state: GameState, payload: any): GameState {
  if (!payload.targetCoordinate) return state;

  const player = state.players.find(p => p.id === payload.playerId);
  if (!player || player.stats.faith < 15) return state;

  // Tower Vision: Reveal large area of the map
  const revealRadius = GAME_RULES.abilities.visionRevealRadius;
  const tilesToReveal: string[] = [];

  for (let q = payload.targetCoordinate.q - revealRadius; q <= payload.targetCoordinate.q + revealRadius; q++) {
    for (let r = payload.targetCoordinate.r - revealRadius; r <= payload.targetCoordinate.r + revealRadius; r++) {
      const s = -q - r;
      const distance = Math.max(
        Math.abs(q - payload.targetCoordinate.q),
        Math.abs(r - payload.targetCoordinate.r),
        Math.abs(s - payload.targetCoordinate.s)
      );

      if (distance <= revealRadius) {
        tilesToReveal.push(`${q},${r}`);
      }
    }
  }

  return {
    ...state,
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        if (tilesToReveal.includes(tileKey) && !tile.exploredBy.includes(player.id)) {
          return {
            ...tile,
            exploredBy: [...tile.exploredBy, player.id]
          };
        }
        return tile;
      })
    },
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - 15) } }
        : p
    )
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
    let rngSeed = state.rngSeed ?? 0;
    const techRoll = nextInt(rngSeed, availableTechs.length);
    rngSeed = techRoll.seed;
    const randomTech = availableTechs[techRoll.value];
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
      ),
      rngSeed,
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

// Advanced Diplomacy and Trade Mechanics
function handleEstablishTradeRoute(
  state: GameState,
  payload: { playerId: string; fromCityId: string; toCityId: string }
): GameState {
  const { playerId, fromCityId, toCityId } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Must have Trade tech.
  if (!player.researchedTechs?.includes('trade')) return state;

  // Cooldown to prevent spam-clicking.
  const cooldowns = player.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 };
  if ((cooldowns.requestTrade || 0) > 0) return state;

  const fromCity = state.cities?.find(city => city.id === fromCityId);
  const toCity = state.cities?.find(city => city.id === toCityId);

  if (!fromCity || !toCity) return state;
  if (!player.citiesOwned.includes(fromCityId)) return state;
  if (!player.citiesOwned.includes(toCityId)) return state;
  if (fromCityId === toCityId) return state;

  const existingRoutes = player.tradeRoutes || [];
  const isDuplicatePair = existingRoutes.some(r =>
    (r.fromCityId === fromCityId && r.toCityId === toCityId) ||
    (r.fromCityId === toCityId && r.toCityId === fromCityId)
  );
  if (isDuplicatePair) return state;

  // Limit routes to avoid runaway economy and force strategic choices.
  const maxRoutes = Math.max(1, player.citiesOwned.length);
  if (existingRoutes.length >= maxRoutes) return state;

  // Each city can support one outgoing route.
  if (existingRoutes.some(r => r.fromCityId === fromCityId)) return state;

  // Require a road connection: trade routes are about infrastructure.
  if (!areCitiesConnectedByRoad(state, playerId, fromCityId, toCityId)) return state;

  const starsPerTurn = calculateTradeRouteStarsPerTurn(state, playerId, fromCityId, toCityId);
  const costStars = calculateTradeRouteEstablishCostStars(starsPerTurn);
  if (player.stars < costStars) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: p.stars - costStars,
          tradeRoutes: [...(p.tradeRoutes || []), { fromCityId, toCityId, starsPerTurn }],
          diplomaticCooldowns: { ...(p.diplomaticCooldowns || cooldowns), requestTrade: 3 },
        }
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

  // Check if already at war
  if (player.atWarWith?.includes(targetPlayerId)) return state;

  console.log(`${player.name} declares war on ${targetPlayer.name}!`);

  // Declaring war:
  // - Updates atWarWith for both players (war is mutual)
  // - Removes any existing alliance between them
  // - Increases pride but also internal dissent
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        const newAtWarWith = [...(p.atWarWith || []), targetPlayerId];
        const newAlliedWith = (p.alliedWith || []).filter(id => id !== targetPlayerId);
        return {
          ...p,
          atWarWith: newAtWarWith,
          alliedWith: newAlliedWith,
          stats: {
            ...p.stats,
            pride: Math.min(100, p.stats.pride + 15),
            internalDissent: Math.min(100, p.stats.internalDissent + 5)
          },
          // Set cooldown - can't declare war again for 5 turns
          diplomaticCooldowns: {
            ...(p.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }),
            declareWar: 5
          }
        };
      }
      if (p.id === targetPlayerId) {
        const newAtWarWith = [...(p.atWarWith || []), playerId];
        const newAlliedWith = (p.alliedWith || []).filter(id => id !== playerId);
        return {
          ...p,
          atWarWith: newAtWarWith,
          alliedWith: newAlliedWith,
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

  // Can't ally with someone you're at war with
  if (player.atWarWith?.includes(allyPlayerId)) return state;

  // Check if already allied
  if (player.alliedWith?.includes(allyPlayerId)) return state;

  console.log(`${player.name} forms alliance with ${ally.name}!`);

  // Forming alliances:
  // - Updates alliedWith for both players (alliance is mutual)
  // - Boosts faith and reduces internal dissent for both
  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          alliedWith: [...(p.alliedWith || []), allyPlayerId],
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 10)
          },
          // Set cooldown - can't form another alliance for 3 turns
          diplomaticCooldowns: {
            ...(p.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }),
            formAlliance: 3
          }
        };
      }
      if (p.id === allyPlayerId) {
        return {
          ...p,
          alliedWith: [...(p.alliedWith || []), playerId],
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
  payload: { playerId: string; unitId?: string; cityId: string; conversionType: 'faith' | 'pride' | 'peace' }
): GameState {
  const { playerId, unitId, cityId, conversionType } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const city = state.cities?.find(c => c.id === cityId);
  if (!city) return state;

  // City conversions are missionary actions: they require an eligible missionary and consume its turn.
  const actingMissionary = (() => {
    const candidateById = unitId ? state.units.find(u => u.id === unitId) : undefined;
    const missionaryHasConvertAbility = (u: Unit): boolean => {
      const abilities = (u.abilities && u.abilities.length > 0) ? u.abilities : getUnitDefinition(u.type as any)?.abilities || [];
      return abilities.includes('convert');
    };
    const isEligible = (u: Unit | undefined): u is Unit =>
      !!u &&
      u.playerId === playerId &&
      u.type === 'missionary' &&
      missionaryHasConvertAbility(u) &&
      !u.hasAttacked &&
      u.remainingMovement > 0 &&
      hexDistance(u.coordinate, city.coordinate) <= 1;

    if (isEligible(candidateById)) return candidateById;

    const candidates = state.units
      .filter(u => isEligible(u))
      .sort((a, b) => a.id.localeCompare(b.id));
    return candidates[0];
  })();

  if (!actingMissionary) return state;

  let resourceCost = 0;
  let statChanges = {};

  switch (conversionType) {
    case 'faith':
      resourceCost = GAME_RULES.conversion.costs.cityFaith;
      if (player.stats.faith < resourceCost) return state;
      statChanges = { faith: Math.max(0, player.stats.faith - resourceCost) };
      break;
    case 'pride':
      resourceCost = GAME_RULES.conversion.costs.cityPride;
      if (player.stats.pride < resourceCost) return state;
      statChanges = { pride: Math.max(0, player.stats.pride - resourceCost) };
      break;
    case 'peace':
      resourceCost = GAME_RULES.conversion.costs.cityPeaceFaithCost;
      if (player.stats.faith < resourceCost) return state;
      statChanges = {
        faith: clampStat(player.stats.faith - resourceCost + GAME_RULES.conversion.costs.cityPeaceFaithRefund),
        internalDissent: Math.max(0, player.stats.internalDissent - GAME_RULES.conversion.costs.cityPeaceDissentReduction)
      };
      break;
  }

  const currentOwnerId = city.ownerId;

  return {
    ...state,
    units: state.units.map(u =>
      u.id === actingMissionary.id ? { ...u, hasAttacked: true, remainingMovement: 0 } : u
    ),
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          citiesOwned: p.citiesOwned.includes(cityId) ? p.citiesOwned : [...p.citiesOwned, cityId],
          stats: { ...p.stats, ...statChanges }
        };
      } else if (currentOwnerId && p.id === currentOwnerId) {
        return {
          ...p,
          citiesOwned: p.citiesOwned.filter(id => id !== cityId)
        };
      }
      return p;
    }),
    cities: (state.cities || []).map(c =>
      c.id === cityId ? { ...c, ownerId: playerId } : c
    ),
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile =>
        tile.coordinate.q === city.coordinate.q &&
          tile.coordinate.r === city.coordinate.r &&
          tile.hasCity
          ? {
            ...tile,
            cityOwner: playerId,
            exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
          }
          : tile
      )
    }
  };
}

function handleConvertUnit(
  state: GameState,
  payload: { playerId: string; unitId: string; targetUnitId: string }
): GameState {
  const { playerId, unitId, targetUnitId } = payload;

  const caster = state.units.find(u => u.id === unitId);
  if (!caster || caster.playerId !== playerId) return state;

  const result = attemptUnitConversion(state, unitId, targetUnitId);
  if (!result.ok) return state;

  return result.state;
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
    case 'convert': {
      // Missionary conversion: convert an adjacent enemy unit (auto-targets if none provided)
      if (!unit.abilities.includes('convert') || unit.hasAttacked) return state;
      if (player.stats.faith < GAME_RULES.conversion.costs.unit) return state;

      const requestedTargetUnitId =
        typeof target === 'string'
          ? target
          : typeof target === 'object' && typeof target?.unitId === 'string'
            ? target.unitId
            : undefined;

      const candidates = state.units
        .filter(u => u.playerId !== playerId)
        .filter(u => hexDistance(u.coordinate, unit.coordinate) <= GAME_RULES.abilities.conversionRadius)
        .filter(u => (requestedTargetUnitId ? u.id === requestedTargetUnitId : true));

      if (candidates.length === 0) return state;

      // Prefer the weakest adjacent unit if no specific target was supplied
      const targetUnit = candidates.sort((a, b) => a.hp - b.hp)[0];

      return handleConvertUnit(state, { playerId, unitId, targetUnitId: targetUnit.id });
    }

    case 'stealth':
      // Implement stealth mode for scouts
      if (unit.type === 'scout' && unit.remainingMovement >= 2) {
        return {
          ...state,
          units: state.units.map(u =>
            u.id === unitId
              ? { ...u, remainingMovement: u.remainingMovement - 2, status: 'stealthed' as const, hasAttacked: true }
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
      console.log(`Unit action ${actionType} not implemented yet`);
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
  let upgradeTracking = {};
  const currentUpgrades = unit.upgrades || { attack: 0, defense: 0, movement: 0, vision: 0 };

  switch (upgradeType) {
    case 'attack':
      unitUpgrades = { attack: unit.attack + 2 };
      upgradeTracking = { upgrades: { ...currentUpgrades, attack: currentUpgrades.attack + 1 } };
      break;
    case 'defense':
      unitUpgrades = { defense: unit.defense + 2 };
      upgradeTracking = { upgrades: { ...currentUpgrades, defense: currentUpgrades.defense + 1 } };
      break;
    case 'movement':
      unitUpgrades = {
        movement: unit.movement + 1,
        remainingMovement: unit.remainingMovement + 1
      };
      upgradeTracking = { upgrades: { ...currentUpgrades, movement: currentUpgrades.movement + 1 } };
      break;
    case 'vision':
      unitUpgrades = { visionRadius: unit.visionRadius + 1 };
      upgradeTracking = { upgrades: { ...currentUpgrades, vision: currentUpgrades.vision + 1 } };
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
        ? { ...u, ...unitUpgrades, ...upgradeTracking }
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

/**
 * Get all valid spawn tiles within range of a city for UI display
 */
export function getValidSpawnTiles(
  state: GameState,
  cityCoordinate: HexCoordinate,
  unitType: UnitType,
  playerId: string
): HexCoordinate[] {
  const SPAWN_RADIUS = 2;
  const MAX_UNITS_PER_TILE = GAME_RULES.units.maxUnitsPerCity;
  
  const getUnitsOnTile = (coord: HexCoordinate) => 
    state.units.filter(u => 
      u.coordinate.q === coord.q && u.coordinate.r === coord.r
    );
  
  const isValidSpawnTile = (coord: HexCoordinate) => {
    const unitsOnTile = getUnitsOnTile(coord);
    const hasEnemy = unitsOnTile.some(u => u.playerId !== playerId);
    return !hasEnemy && unitsOnTile.length < MAX_UNITS_PER_TILE;
  };
  
  // For boats, only adjacent water tiles (coastal launch)
  if (unitType === 'boat') {
    const adjacentTiles = hexNeighbors(cityCoordinate);
    return adjacentTiles
      .map(neighbor => state.map.tiles.find(t => 
        t.coordinate.q === neighbor.q && t.coordinate.r === neighbor.r
      ))
      .filter((tile): tile is NonNullable<typeof tile> => 
        !!tile && tile.terrain === 'water' && isValidSpawnTile(tile.coordinate)
      )
      .map(tile => tile.coordinate);
  }
  
  // For land units, 2-tile radius
  const tilesInRange = state.map.tiles.filter(tile => 
    hexDistance(cityCoordinate, tile.coordinate) <= SPAWN_RADIUS
  );
  
  return tilesInRange
    .filter(tile => tile.terrain !== 'water' && isValidSpawnTile(tile.coordinate))
    .map(tile => tile.coordinate);
}
