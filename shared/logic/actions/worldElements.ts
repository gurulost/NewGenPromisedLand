import { GameState } from "../../types/game";
import { UnitType } from "../../types/unit";
import { HexCoordinate } from "../../types/coordinates";
import { GAME_RULES } from "../../data/gameRules";
import { TECHNOLOGIES } from "../../data/technologies";
import { getUnitDefinition } from "../../data/units";
import { getWorldElement } from "../../data/worldElements";
import type { RuinReward } from "../../data/worldElements";
import type { RuinsReward } from "../../data/ruinsRewards";
import { hexDistance } from "../../utils/hex";
import { applyPopulationGain } from "../cityGrowth";
import { executeElementHarvest, executeElementBuild } from "../worldElementActions";
import { nextFloat, nextId } from "../rng";
import { getUnitActionsRemaining, spendUnitActions } from "../unitLogic";

export function handleConquerVillage(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const villageTile = state.map.tiles.find(tile =>
    tile.coordinate.q === unit.coordinate.q &&
    tile.coordinate.r === unit.coordinate.r &&
    tile.feature === "village"
  );

  if (!villageTile) return state;

  if (villageTile.cityOwner === playerId) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === unit.coordinate.q &&
      tile.coordinate.r === unit.coordinate.r &&
      tile.feature === "village") {
      return {
        ...tile,
        cityOwner: playerId,
        captureType: "conquered" as const,
        exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
      };
    }
    return tile;
  });

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

  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? spendUnitActions(u)
      : u
  );

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

export function handleConvertVillage(
  state: GameState,
  payload: { unitId: string; playerId: string }
): GameState {
  const { unitId, playerId } = payload;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const villageTile = state.map.tiles.find(tile =>
    tile.coordinate.q === unit.coordinate.q &&
    tile.coordinate.r === unit.coordinate.r &&
    tile.feature === "village"
  );

  if (!villageTile) return state;

  if (villageTile.cityOwner === playerId) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const CONVERT_FAITH_COST = GAME_RULES.conversion.costs.village;
  if (player.stats.faith < CONVERT_FAITH_COST) return state;

  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === unit.coordinate.q &&
      tile.coordinate.r === unit.coordinate.r &&
      tile.feature === "village") {
      return {
        ...tile,
        cityOwner: playerId,
        captureType: "converted" as const,
        starBonus: 1,
        exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
      };
    }
    return tile;
  });

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

  const updatedUnits = state.units.map(u =>
    u.id === unitId
      ? spendUnitActions(u)
      : u
  );

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

export function handleExploreRuins(
  state: GameState,
  payload: { unitId: string; playerId: string; coordinate: any; randomSeed?: number }
): GameState {
  const { unitId, playerId, coordinate } = payload;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const ruinsTile = state.map.tiles.find(tile =>
    tile.coordinate.q === coordinate.q &&
    tile.coordinate.r === coordinate.r &&
    tile.feature === "ruin"
  );

  if (!ruinsTile) return state;

  const distance = Math.max(
    Math.abs(unit.coordinate.q - coordinate.q),
    Math.abs(unit.coordinate.r - coordinate.r),
    Math.abs((unit.coordinate.s || -unit.coordinate.q - unit.coordinate.r) - (coordinate.s || -coordinate.q - coordinate.r))
  );

  if (distance > 1) return state;

  const { getRandomRuinsReward } = require("../../data/ruinsRewards");

  let rngSeed = state.rngSeed ?? 0;
  const rewardRoll = nextFloat(rngSeed);
  rngSeed = rewardRoll.seed;
  const reward = getRandomRuinsReward(rewardRoll.value);

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

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

  let updatedUnits = state.units.map(u => {
    if (u.id === unitId) {
      return {
        ...spendUnitActions(u),
        hp: reward.healAmount ? Math.min(u.maxHp, u.hp + reward.healAmount) : u.hp,
      };
    }
    return u;
  });

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
      maxActions: 1,
      actionsRemaining: 0,
      visionRadius: 2,
      status: "active" as const,
      hasAttacked: true,
      abilities: [],
      level: 1,
      experience: 0,
      attackRange: 1
    };
    updatedUnits = [...updatedUnits, newUnit];
  }

  const updatedMapTiles = state.map.tiles.map(tile => {
    if (tile.coordinate.q === coordinate.q &&
      tile.coordinate.r === coordinate.r &&
      tile.feature === "ruin") {
      return {
        ...tile,
        feature: undefined
      };
    }
    return tile;
  });

  if (typeof window !== "undefined") {
    const rewardForUi = reward.unitType
      ? { ...reward, unitName: getUnitDefinition(reward.unitType as UnitType)?.name }
      : reward;
    const rewardEvent = new CustomEvent("ruinsReward", {
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
    .join("_")
    .replace(/[^a-z0-9_]+/gi, "_");

  const base = {
    id: `jaredite_${idParts || "reward"}`,
    description: reward.description || "Ancient secrets emerge from the ruins.",
    weight: 1,
    faith: faith || undefined,
  };

  switch (reward.type) {
    case "stars":
      return {
        ...base,
        type: "stars",
        name: stars >= 20 ? "Hidden Cache" : "Forgotten Treasure",
        rarity: stars >= 20 ? "uncommon" : "common",
        stars: stars || undefined,
      };
    case "population":
      return {
        ...base,
        type: "population",
        name: "Ancient Census",
        rarity: "uncommon",
        description: population > 0
          ? `Ancient records swell a nearby city by ${population} population.`
          : base.description,
        population: population || undefined,
      };
    case "tech":
      return {
        ...base,
        type: "tech_boost",
        name: techName ? `${techName} Discovered` : "Ancient Scrolls",
        rarity: "rare",
        description: techName
          ? `Ancient scrolls unlock ${techName}.`
          : base.description,
        techName,
      };
    case "unit":
      return {
        ...base,
        type: "unit_spawn",
        name: unitName ? `${unitName} Awakens` : "Ancient Ally",
        rarity: reward.unitType === "ancient_giant" ? "legendary" : "rare",
        description: unitName
          ? `A slumbering ${unitName} rises to join your cause.`
          : base.description,
        unitType: reward.unitType,
        unitName,
      };
    case "reveal":
      return {
        ...base,
        type: "reveal",
        name: "Forgotten Map",
        rarity: "uncommon",
        description: "Ancient charts reveal an enemy settlement.",
        reveal: "Enemy city revealed",
      };
    default:
      return {
        ...base,
        type: "stars",
        name: "Jaredite Relic",
        rarity: "common",
        stars: stars || undefined,
      };
  }
}

export function handleWorldElementHarvest(
  state: GameState,
  payload: { playerId: string; unitId: string; elementId: string; coordinate: HexCoordinate }
): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || unit.playerId !== payload.playerId) return state;
  if (unit.coordinate.q !== payload.coordinate.q || unit.coordinate.r !== payload.coordinate.r) return state;
  if (getUnitActionsRemaining(unit) <= 0) return state;

  const element = getWorldElement(payload.elementId);
  if (!element) return state;

  const requiredTag = element.immediateAction?.requiresUnitTag;
  if (requiredTag) {
    const canActAsTag =
      (requiredTag === "naval_commander" &&
        unit.type === "commander" &&
        (unit.abilities || []).some(a => String(a).toUpperCase() === "NAVAL_COMMAND")) ||
      (requiredTag === "naval_transport" &&
        (unit.type === "boat" ||
          (unit.abilities || []).some(a => String(a).toUpperCase() === "NAVAL_TRANSPORT")));
    if (!canActAsTag) return state;
  } else if (payload.elementId !== "jaredite_ruins") {
    if (unit.type !== "worker") return state;
  }

  let rngSeed = state.rngSeed ?? 0;
  const rand = () => {
    rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };

  const result = executeElementHarvest(state, payload.playerId, payload.elementId, payload.coordinate, rand);

  if (result.success && result.newState) {
    if (typeof window !== "undefined" && result.effects?.ruinReward) {
      const uiReward = buildRuinsUiRewardFromWorldElement(
        result.effects.ruinReward,
        result.resourceDeltas
      );
      window.dispatchEvent(new CustomEvent("ruinsReward", {
        detail: { reward: uiReward, coordinate: payload.coordinate }
      }));
    }

    return {
      ...result.newState,
      rngSeed,
      units: result.newState.units.map(u =>
        u.id === payload.unitId ? spendUnitActions(u) : u
      )
    };
  }

  return state;
}

export function handleWorldElementBuild(
  state: GameState,
  payload: { playerId: string; unitId: string; elementId: string; coordinate: HexCoordinate }
): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || unit.playerId !== payload.playerId) return state;
  if (unit.coordinate.q !== payload.coordinate.q || unit.coordinate.r !== payload.coordinate.r) return state;
  if (getUnitActionsRemaining(unit) <= 0) return state;
  const element = getWorldElement(payload.elementId);
  if (!element) return state;

  const requiredTag = element.longTermBuild?.requiresUnitTag;
  if (requiredTag) {
    const canActAsTag =
      (requiredTag === "naval_commander" &&
        unit.type === "commander" &&
        (unit.abilities || []).some(a => String(a).toUpperCase() === "NAVAL_COMMAND")) ||
      (requiredTag === "naval_transport" &&
        (unit.type === "boat" ||
          (unit.abilities || []).some(a => String(a).toUpperCase() === "NAVAL_TRANSPORT")));
    if (!canActAsTag) return state;
  } else if (unit.type !== "worker") {
    return state;
  }

  const result = executeElementBuild(state, payload.playerId, payload.elementId, payload.coordinate);

  if (result.success && result.newState) {
    return {
      ...result.newState,
      units: result.newState.units.map(u =>
        u.id === payload.unitId ? spendUnitActions(u) : u
      )
    };
  }

  return state;
}
