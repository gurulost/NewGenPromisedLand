import { GameState } from "../../types/game";
import { GAME_RULES } from "../../data/gameRules";
import { hexDistance } from "../../utils/hex";
import { nextId } from "../rng";
import { applyPopulationGain } from "../cityGrowth";
import { evaluateCityCapture } from "../cityCapture";
import {
  getUnitActionsRemaining,
  spendUnitActions
} from "../unitLogic";
import { validateConstructionRequest } from "../constructionValidation";
import { createResolveResult, type ResolveResult } from "../actionResolution";
import { applyCityOwnershipFaithConsequences } from "../faithProject";

export function handleStartConstruction(
  state: GameState,
  payload: {
    playerId: string;
    buildingType: string;
    category: "improvements" | "structures" | "units";
    coordinate?: any;
    cityId: string;
    builderUnitId?: string;
  }
): GameState {
  const { playerId, buildingType, category, cityId, builderUnitId } = payload;
  const validation = validateConstructionRequest(state, payload);
  if (!validation) return state;
  const { cost, buildTime, coordinate } = validation;
  const builderUnitIdToSpend = category === "improvements" ? builderUnitId : undefined;

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
    units: builderUnitIdToSpend
      ? state.units.map(u => (u.id === builderUnitIdToSpend ? spendUnitActions(u) : u))
      : state.units,
    rngSeed,
  };
}

export function handleCaptureCity(
  state: GameState,
  payload: { playerId: string; unitId: string; cityId: string }
): ResolveResult {
  const { playerId, unitId, cityId } = payload;

  const captureCheck = evaluateCityCapture(state, payload);
  if (!captureCheck.canCapture || !captureCheck.city) return createResolveResult(state);

  const targetCity = captureCheck.city;

  const cityTile = state.map.tiles.find(tile =>
    tile.coordinate.q === targetCity.coordinate.q &&
    tile.coordinate.r === targetCity.coordinate.r &&
    tile.hasCity
  );
  if (!cityTile) return createResolveResult(state);

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

  const updatedUnits = state.units.map(unit =>
    unit.id === unitId
      ? spendUnitActions(unit)
      : unit
  );

  const capturedState: GameState = {
    ...state,
    players: normalizedPlayers,
    units: updatedUnits,
    cities: updatedCities,
    structures: updatedStructures,
    improvements: updatedImprovements,
    map: { ...state.map, tiles: updatedMapTiles }
  };

  const faithConsequences = applyCityOwnershipFaithConsequences(state, capturedState, cityId, playerId);
  return createResolveResult(faithConsequences.state, { events: faithConsequences.events });
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
