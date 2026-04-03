import { GameState } from "../../types/game";
import { UnitType } from "../../types/unit";
import { coerceFactionId } from "../../types/factionId";
import { HexCoordinate } from "../../types/coordinates";
import { GAME_RULES } from "../../data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../../types/city";
import { getUnitDefinition } from "../../data/units";
import { hexDistance } from "../../utils/hex";
import { nextId } from "../rng";
import { applyPopulationGain } from "../cityGrowth";
import { canPlayerCaptureCity } from "../cityCapture";
import {
  getUnitActionsRemaining,
  getUnitAttackRangeFromDefinition,
  spendUnitActions
} from "../unitLogic";
import { getFriendlyBuildAnchors, isTileExploredByPlayer, isWithinFriendlyBuildRadius } from "../constructionRules";
import { getUnitSpawnCoordinate, getValidSpawnTiles } from "./spawnUtils";

export function handleStartConstruction(
  state: GameState,
  payload: {
    playerId: string;
    buildingType: string;
    category: "improvements" | "structures" | "units";
    coordinate?: any;
    cityId: string;
  }
): GameState {
  const { playerId, buildingType, category, coordinate, cityId } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  if (!player.citiesOwned.includes(cityId)) return state;

  let cost = { stars: 0, faith: 0, pride: 0 };
  let buildTime = 1;
  const anchorCoords = getFriendlyBuildAnchors(state, playerId);

  const hasBlockingUnit = (coord: HexCoordinate) =>
    state.units?.some(u => u.coordinate.q === coord.q && u.coordinate.r === coord.r);

  const hasBlockingImprovement = (coord: HexCoordinate) =>
    (state.improvements || []).some(i => i.coordinate.q === coord.q && i.coordinate.r === coord.r);

  const hasBlockingStructure = (coord: HexCoordinate) =>
    (state.structures || []).some(s =>
      s.coordinate &&
      s.coordinate.q === coord.q &&
      s.coordinate.r === coord.r
    );

  const hasBlockingCity = (coord: HexCoordinate) =>
    state.cities?.some(c => c.coordinate.q === coord.q && c.coordinate.r === coord.r);

  const hasBlockingConstruction = (coord: HexCoordinate) =>
    state.players.some(p =>
      (p.constructionQueue || []).some(item =>
        item.coordinate &&
        item.coordinate.q === coord.q &&
        item.coordinate.r === coord.r
      )
    );

  if (category === "improvements") {
    const improvement = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvement) return state;
    if (!player.researchedTechs.includes(improvement.requiredTech)) return state;
    cost.stars = improvement.cost;
    buildTime = improvement.constructionTime;

    if (!coordinate) return state;
    const tile = state.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);
    if (!tile) return state;
    if (!isTileExploredByPlayer(state, playerId, coordinate)) return state;
    if (!isWithinFriendlyBuildRadius(anchorCoords, coordinate)) return state;
    if (!improvement.validTerrain.includes(tile.terrain)) return state;

    if (tile.feature === "village") return state;
    if (hasBlockingCity(coordinate)) return state;
    if (hasBlockingUnit(coordinate)) return state;
    if (hasBlockingImprovement(coordinate)) return state;
    if (hasBlockingStructure(coordinate)) return state;
    if (hasBlockingConstruction(coordinate)) return state;
  } else if (category === "structures") {
    const structure = STRUCTURE_DEFINITIONS[buildingType as keyof typeof STRUCTURE_DEFINITIONS];
    if (!structure) return state;
    if (!player.researchedTechs.includes(structure.requiredTech)) return state;
    cost.stars = structure.cost;
    buildTime = 1;

    if (!coordinate) return state;
    const tile = state.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);
    if (!tile) return state;
    if (!isTileExploredByPlayer(state, playerId, coordinate)) return state;
    if (!isWithinFriendlyBuildRadius(anchorCoords, coordinate)) return state;
    if (tile.terrain === "water") return state;
    if (tile.feature === "village") return state;
    if (hasBlockingCity(coordinate)) return state;
    if (hasBlockingUnit(coordinate)) return state;
    if (hasBlockingImprovement(coordinate)) return state;
    if (hasBlockingStructure(coordinate)) return state;
    if (hasBlockingConstruction(coordinate)) return state;

    const hasStructureInCity = (state.structures || []).some(s =>
      s.cityId === cityId && s.type === buildingType
    );
    if (hasStructureInCity) return state;
  } else if (category === "units") {
    const unitDef = getUnitDefinition(buildingType as any);
    if (!unitDef) {
      return state;
    }
    if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) return state;
    const playerFactionId = coerceFactionId(player.factionId);
    if (unitDef.factionSpecific.length > 0 && (!playerFactionId || !unitDef.factionSpecific.includes(playerFactionId))) return state;
    cost.stars = unitDef.cost;
    buildTime = 1;
    if (unitDef.requirements) {
      if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return state;
      if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return state;
      if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) return state;
    }
    if (!coordinate) return state;
    const city = state.cities?.find(c => c.id === cityId);
    if (!city) return state;
    const validSpawnTiles = getValidSpawnTiles(state, city.coordinate, buildingType as UnitType, playerId);
    const isValidSpawn = validSpawnTiles.some(tile =>
      tile.q === coordinate.q && tile.r === coordinate.r
    );
    if (!isValidSpawn) return state;
  }

  if (player.stars < cost.stars ||
    player.stats.faith < (cost.faith || 0) ||
    player.stats.pride < (cost.pride || 0)) {
    return state;
  }

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

export function handleBuildImprovement(
  state: GameState,
  payload: { playerId: string; unitId: string; coordinate: any; improvementType: string; cityId: string }
): GameState {
  const { playerId, unitId, coordinate, improvementType, cityId } = payload;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;
  if (unit.type !== "worker") return state;
  if (getUnitActionsRemaining(unit) <= 0) return state;
  if (unit.coordinate.q !== coordinate.q || unit.coordinate.r !== coordinate.r) return state;

  const improvementDef = IMPROVEMENT_DEFINITIONS[improvementType as keyof typeof IMPROVEMENT_DEFINITIONS];
  if (!improvementDef) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  if (player.stars < improvementDef.cost) return state;

  if (!player.researchedTechs.includes(improvementDef.requiredTech)) return state;

  const targetTile = state.map.tiles.find(tile =>
    tile.coordinate.q === coordinate.q &&
    tile.coordinate.r === coordinate.r
  );
  if (!targetTile) return state;

  if (!improvementDef.validTerrain.includes(targetTile.terrain)) return state;

  const existingImprovement = state.improvements?.find(imp =>
    imp.coordinate.q === coordinate.q && imp.coordinate.r === coordinate.r
  );
  if (existingImprovement) return state;

  const hasStructure = state.structures?.some(structure =>
    structure.coordinate &&
    structure.coordinate.q === coordinate.q &&
    structure.coordinate.r === coordinate.r
  );
  if (hasStructure) return state;

  const hasCity = state.cities?.some(city =>
    city.coordinate.q === coordinate.q && city.coordinate.r === coordinate.r
  );
  if (hasCity) return state;

  if (targetTile.feature === "village") return state;

  const hasQueuedConstruction = state.players.some(p =>
    (p.constructionQueue || []).some(item =>
      item.coordinate &&
      item.coordinate.q === coordinate.q &&
      item.coordinate.r === coordinate.r
    )
  );
  if (hasQueuedConstruction) return state;

  let rngSeed = state.rngSeed ?? 0;
  const improvementIdResult = nextId(rngSeed, `${improvementType}_${coordinate.q}_${coordinate.r}`);
  rngSeed = improvementIdResult.seed;

  const newImprovement = {
    id: improvementIdResult.id,
    type: improvementType as keyof typeof IMPROVEMENT_DEFINITIONS,
    coordinate,
    ownerId: playerId,
    starProduction: improvementDef.starProduction,
    cityId,
    constructionTurns: 0
  };

  const populationGain = improvementDef.effects?.populationGrowth ?? 0;
  const updatedCities =
    populationGain > 0
      ? (state.cities || []).map(c =>
        c.id === cityId ? applyPopulationGain(c, populationGain) : c
      )
      : state.cities;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - improvementDef.cost }
        : p
    ),
    units: state.units.map(u => u.id === unitId ? spendUnitActions(u) : u),
    improvements: [...(state.improvements || []), newImprovement],
    cities: updatedCities,
    rngSeed,
  };
}

export function handleBuildStructure(
  state: GameState,
  payload: { playerId: string; cityId: string; structureType: string; coordinate?: HexCoordinate }
): GameState {
  const { playerId, cityId, structureType, coordinate } = payload;

  const structureDef = STRUCTURE_DEFINITIONS[structureType as keyof typeof STRUCTURE_DEFINITIONS];
  if (!structureDef) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  if (player.stars < structureDef.cost) return state;

  if (!player.researchedTechs.includes(structureDef.requiredTech)) return state;

  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;

  if (!player.citiesOwned.includes(cityId)) return state;

  const targetCoordinate = coordinate ?? targetCity.coordinate;
  const tile = state.map.tiles.find(t => t.coordinate.q === targetCoordinate.q && t.coordinate.r === targetCoordinate.r);
  if (!tile) return state;
  const anchors = getFriendlyBuildAnchors(state, playerId);
  if (!isTileExploredByPlayer(state, playerId, targetCoordinate)) return state;
  if (!isWithinFriendlyBuildRadius(anchors, targetCoordinate)) return state;
  if (tile.terrain === "water") return state;
  if (tile.feature === "village") return state;
  const hasBlockingUnit = state.units?.some(u => u.coordinate.q === targetCoordinate.q && u.coordinate.r === targetCoordinate.r);
  if (hasBlockingUnit) return state;
  const hasBlockingImprovement = (state.improvements || []).some(i => i.coordinate.q === targetCoordinate.q && i.coordinate.r === targetCoordinate.r);
  if (hasBlockingImprovement) return state;
  const hasBlockingStructure = (state.structures || []).some(s =>
    s.coordinate &&
    s.coordinate.q === targetCoordinate.q &&
    s.coordinate.r === targetCoordinate.r
  );
  if (hasBlockingStructure) return state;
  const hasBlockingConstruction = state.players.some(p =>
    (p.constructionQueue || []).some(item =>
      item.coordinate &&
      item.coordinate.q === targetCoordinate.q &&
      item.coordinate.r === targetCoordinate.r
    )
  );
  if (hasBlockingConstruction) return state;

  const existingStructure = state.structures?.find(structure =>
    structure.cityId === cityId && structure.type === structureType
  );
  if (existingStructure) return state;

  let rngSeed = state.rngSeed ?? 0;
  const structureIdResult = nextId(rngSeed, `${structureType}_${cityId}`);
  rngSeed = structureIdResult.seed;

  const newStructure = {
    id: structureIdResult.id,
    type: structureType as keyof typeof STRUCTURE_DEFINITIONS,
    coordinate: targetCoordinate,
    cityId,
    ownerId: playerId,
    constructionTurns: 0,
    effects: {
      ...structureDef.effects,
      faithProduction: structureDef.effects.faithProduction ?? 0,
    }
  };

  const populationGain = structureDef.effects.populationGrowth ?? 0;
  const updatedCities =
    populationGain > 0
      ? (state.cities || []).map(city =>
        city.id === cityId ? applyPopulationGain(city, populationGain) : city
      )
      : state.cities;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? { ...p, stars: p.stars - structureDef.cost }
        : p
    ),
    structures: [...(state.structures || []), newStructure],
    cities: updatedCities,
    rngSeed,
  };
}

export function handleCaptureCity(
  state: GameState,
  payload: { playerId: string; cityId: string }
): GameState {
  const { playerId, cityId } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;

  if (player.citiesOwned.includes(cityId)) return state;

  const cityTile = state.map.tiles.find(tile =>
    tile.coordinate.q === targetCity.coordinate.q &&
    tile.coordinate.r === targetCity.coordinate.r &&
    tile.hasCity
  );
  if (!cityTile) return state;

  if (!canPlayerCaptureCity(state, playerId, cityId)) return state;

  const updatedPlayers = state.players.map(p => {
    if (p.citiesOwned.includes(cityId)) {
      return {
        ...p,
        citiesOwned: p.citiesOwned.filter(id => id !== cityId)
      };
    } else if (p.id === playerId) {
      return {
        ...p,
        citiesOwned: [...p.citiesOwned, cityId]
      };
    }
    return p;
  });
  const normalizedPlayers = updatedPlayers.map(p => ({
    ...p,
    isEliminated: p.citiesOwned.length === 0
  }));

  const updatedCities = state.cities?.map(city =>
    city.id === cityId
      ? { ...city, ownerId: playerId }
      : city
  );

  let updatedStructures = state.structures || [];
  if (GAME_RULES.capture.destroyAllStructures) {
    updatedStructures = updatedStructures.filter(structure =>
      structure.cityId !== cityId
    );
  } else if (GAME_RULES.capture.transferStructures) {
    updatedStructures = updatedStructures.map(structure =>
      structure.cityId === cityId
        ? { ...structure, ownerId: playerId }
        : structure
    );
  }

  let updatedImprovements = state.improvements || [];
  if (GAME_RULES.capture.destroyImprovements) {
    updatedImprovements = updatedImprovements.filter(improvement =>
      improvement.cityId !== cityId
    );
  } else if (GAME_RULES.capture.transferImprovements) {
    updatedImprovements = updatedImprovements.map(improvement =>
      improvement.cityId === cityId
        ? { ...improvement, ownerId: playerId }
        : improvement
    );
  }

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
    players: normalizedPlayers,
    cities: updatedCities,
    structures: updatedStructures,
    improvements: updatedImprovements,
    map: { ...state.map, tiles: updatedMapTiles }
  };
}

export function handleRecruitUnit(
  state: GameState,
  payload: { playerId: string; cityId: string; unitType: string; spawnCoordinate?: HexCoordinate }
): GameState {
  const { playerId, cityId, unitType, spawnCoordinate: preferredSpawnCoordinate } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const unitDef = getUnitDefinition(unitType as any);
  if (!unitDef) return state;

  if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) return state;

  if (player.stars < unitDef.cost) return state;

  const targetCity = state.cities?.find(city => city.id === cityId);
  if (!targetCity) return state;

  if (!player.citiesOwned.includes(cityId)) return state;

  if (unitDef.requirements) {
    if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return state;
    if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return state;
    if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) return state;
  }

  const playerFaction = state.players.find(p => p.id === playerId)?.factionId;
  const playerFactionId = playerFaction ? coerceFactionId(playerFaction) : null;
  if (unitDef.factionSpecific.length > 0 && (!playerFactionId || !unitDef.factionSpecific.includes(playerFactionId))) {
    return state;
  }

  const unitTypeTyped = unitType as UnitType;
  const spawnCoordinate = getUnitSpawnCoordinate(state, unitTypeTyped, targetCity.coordinate, playerId, preferredSpawnCoordinate);
  if (!spawnCoordinate) return state;

  let rngSeed = state.rngSeed ?? 0;
  const unitIdResult = nextId(rngSeed, `${unitType}_${playerId}`);
  rngSeed = unitIdResult.seed;

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
    maxActions: unitDef.baseStats.actions,
    actionsRemaining: unitDef.baseStats.actions,
    status: "active" as const,
    abilities: unitDef.abilities,
    level: 1,
    experience: 0,
    visionRadius: unitDef.baseStats.visionRadius,
    attackRange: getUnitAttackRangeFromDefinition(unitDef),
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

export function handleRenameCity(
  state: GameState,
  payload: { playerId: string; cityId: string; newName: string }
): GameState {
  const { playerId, cityId, newName } = payload;

  if (!newName || newName.trim().length === 0) return state;
  const trimmedName = newName.trim().substring(0, 24);

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

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

export function handleHarvestResource(
  state: GameState,
  payload: { unitId: string; resourceCoordinate: any; cityId: string }
): GameState {
  const { unitId, resourceCoordinate, cityId } = payload;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return state;
  if (getUnitActionsRemaining(unit) <= 0) return state;

  const city = state.cities.find(c => c.id === cityId);
  if (!city || city.ownerId !== unit.playerId) return state;

  const resourceTile = state.map.tiles.find(tile =>
    tile.coordinate.q === resourceCoordinate.q &&
    tile.coordinate.r === resourceCoordinate.r &&
    (tile.terrain === "forest" || tile.terrain === "mountain" || tile.resources?.length)
  );

  if (!resourceTile) return state;

  const distance = hexDistance(city.coordinate, resourceCoordinate);
  if (distance > 2) return state;

  const resourceId = `${resourceCoordinate.q},${resourceCoordinate.r}`;
  if (city.harvestedResources.includes(resourceId)) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player) return state;

  const resourceIds = new Set((resourceTile.resources || []).map(resource => String(resource)));
  const hasResource = (...ids: string[]) => ids.some(id => resourceIds.has(id));

  const hasForestry = player.researchedTechs.includes("forestry");
  const hasMining = player.researchedTechs.includes("mining");
  const hasHunting = player.researchedTechs.includes("hunting");
  const hasAgriculture = player.researchedTechs.includes("agriculture");
  const hasFishing = player.researchedTechs.includes("fishing");

  let canHarvest = false;
  if ((resourceTile.terrain === "forest" || hasResource("timber_grove")) && hasForestry) {
    canHarvest = true;
  } else if ((resourceTile.terrain === "mountain" || hasResource("ore_vein", "ore", "metal")) && hasMining) {
    canHarvest = true;
  } else if (hasResource("animals", "wild_goats") && hasHunting) {
    canHarvest = true;
  } else if (hasResource("grain_patch", "grain", "fruit") && hasAgriculture) {
    canHarvest = true;
  } else if (hasResource("fishing_shoal", "fish") && hasFishing) {
    canHarvest = true;
  }

  if (!canHarvest) return state;

  const updatedCities = state.cities.map(c => {
    if (c.id === cityId) {
      const grownCity = applyPopulationGain(c, 1);
      return {
        ...grownCity,
        harvestedResources: [...(c.harvestedResources || []), resourceId]
      };
    }
    return c;
  });

  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? spendUnitActions(u)
      : u
  );

  return {
    ...state,
    cities: updatedCities,
    units: updatedUnits
  };
}

export function handleBuildUnit(
  state: GameState,
  payload: { unitType: string; coordinate: any; playerId: string }
): GameState {
  const { unitType, coordinate, playerId } = payload;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const unitDef = getUnitDefinition(unitType as any);
  if (!unitDef) return state;
  if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) return state;
  const playerFactionId = coerceFactionId(player.factionId);
  if (unitDef.factionSpecific.length > 0 && (!playerFactionId || !unitDef.factionSpecific.includes(playerFactionId))) return state;

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
    maxActions: unitDef.baseStats.actions,
    actionsRemaining: unitDef.baseStats.actions,
    status: "active" as const,
    abilities: unitDef.abilities,
    level: 1,
    experience: 0,
    visionRadius: unitDef.baseStats.visionRadius,
    attackRange: getUnitAttackRangeFromDefinition(unitDef),
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

export function handleUpgradeUnit(
  state: GameState,
  payload: { playerId: string; unitId: string; upgradeType?: "attack" | "defense" | "movement" | "vision" }
): GameState {
  const { playerId, unitId, upgradeType = "attack" } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const upgradeCost = GAME_RULES.units.upgradeBaseCost;
  if (player.stars < upgradeCost) return state;

  let unitUpgrades = {};
  let upgradeTracking = {};
  const currentUpgrades = unit.upgrades || { attack: 0, defense: 0, movement: 0, vision: 0 };

  switch (upgradeType) {
    case "attack":
      unitUpgrades = { attack: unit.attack + 2 };
      upgradeTracking = { upgrades: { ...currentUpgrades, attack: currentUpgrades.attack + 1 } };
      break;
    case "defense":
      unitUpgrades = { defense: unit.defense + 2 };
      upgradeTracking = { upgrades: { ...currentUpgrades, defense: currentUpgrades.defense + 1 } };
      break;
    case "movement":
      unitUpgrades = {
        movement: unit.movement + 1,
        remainingMovement: unit.remainingMovement + 1
      };
      upgradeTracking = { upgrades: { ...currentUpgrades, movement: currentUpgrades.movement + 1 } };
      break;
    case "vision":
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
