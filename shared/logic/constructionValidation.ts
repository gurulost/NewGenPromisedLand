import type { City } from "../types/city";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../types/city";
import type { HexCoordinate } from "../types/coordinates";
import type { GameState, PlayerState } from "../types/game";
import type { UnitType } from "../types/unit";
import { coerceFactionId } from "../types/factionId";
import { getUnitDefinition } from "../data/units";
import { hexDistance } from "../utils/hex";
import { getUnitActionsRemaining } from "./unitLogic";
import { getValidSpawnTiles } from "./actions/spawnUtils";
import {
  STRUCTURE_BUILD_RADIUS,
  getFriendlyBuildAnchors,
  isTileExploredByPlayer,
  isWithinFriendlyBuildRadius,
} from "./constructionRules";

export const CITY_WORK_RADIUS = 2;

export type ConstructionCategory = "improvements" | "structures" | "units";

export interface ConstructionRequest {
  playerId: string;
  buildingType: string;
  category: ConstructionCategory;
  coordinate?: HexCoordinate;
  cityId: string;
  builderUnitId?: string;
}

export interface ConstructionValidationResult {
  player: PlayerState;
  city: City;
  cost: {
    stars: number;
    faith: number;
    pride: number;
  };
  buildTime: number;
  coordinate?: HexCoordinate;
}

const hasBlockingUnit = (state: GameState, coord: HexCoordinate, excludedUnitId?: string) =>
  state.units?.some(
    (u) =>
      u.id !== excludedUnitId &&
      u.coordinate.q === coord.q &&
      u.coordinate.r === coord.r
  );

const hasBlockingImprovement = (state: GameState, coord: HexCoordinate) =>
  (state.improvements || []).some((i) => i.coordinate.q === coord.q && i.coordinate.r === coord.r);

const hasBlockingStructure = (state: GameState, coord: HexCoordinate) =>
  (state.structures || []).some(
    (s) => s.coordinate && s.coordinate.q === coord.q && s.coordinate.r === coord.r
  );

const hasBlockingCity = (state: GameState, coord: HexCoordinate) =>
  (state.cities || []).some((c) => c.coordinate.q === coord.q && c.coordinate.r === coord.r);

const hasBlockingConstruction = (state: GameState, coord: HexCoordinate) =>
  state.players.some((p) =>
    (p.constructionQueue || []).some(
      (item) => item.coordinate && item.coordinate.q === coord.q && item.coordinate.r === coord.r
    )
  );

export function isConstructionCoordinateLinkedToCity(
  city: City,
  coordinate: HexCoordinate,
  category: ConstructionCategory
): boolean {
  if (category === "improvements") {
    return hexDistance(city.coordinate, coordinate) <= CITY_WORK_RADIUS;
  }
  if (category === "structures") {
    return hexDistance(city.coordinate, coordinate) <= STRUCTURE_BUILD_RADIUS;
  }
  return true;
}

export function validateConstructionRequest(
  state: GameState,
  request: ConstructionRequest
): ConstructionValidationResult | null {
  const { playerId, buildingType, category, coordinate, cityId, builderUnitId } = request;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const city = state.cities?.find((c) => c.id === cityId);
  if (!city) return null;
  if (city.ownerId !== playerId) return null;
  if (!player.citiesOwned.includes(cityId)) return null;

  let cost = { stars: 0, faith: 0, pride: 0 };
  let buildTime = 1;

  if (category === "improvements") {
    const improvement = IMPROVEMENT_DEFINITIONS[buildingType as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (!improvement) return null;
    if (!player.researchedTechs.includes(improvement.requiredTech)) return null;
    if (!coordinate) return null;

    if (!isConstructionCoordinateLinkedToCity(city, coordinate, category)) return null;

    const anchorCoords = getFriendlyBuildAnchors(state, playerId);
    if (!isTileExploredByPlayer(state, playerId, coordinate)) return null;
    if (!isWithinFriendlyBuildRadius(anchorCoords, coordinate)) return null;

    const tile = state.map.tiles.find(
      (t) => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r
    );
    if (!tile) return null;
    if (!improvement.validTerrain.includes(tile.terrain)) return null;
    if (tile.feature === "village") return null;
    if (hasBlockingCity(state, coordinate)) return null;
    if (builderUnitId) {
      const builder = state.units.find((u) => u.id === builderUnitId);
      if (!builder || builder.playerId !== playerId) return null;
      if (builder.type !== "worker") return null;
      if (getUnitActionsRemaining(builder) <= 0) return null;
      if (builder.coordinate.q !== coordinate.q || builder.coordinate.r !== coordinate.r) return null;
    }

    if (hasBlockingUnit(state, coordinate, builderUnitId)) return null;
    if (hasBlockingImprovement(state, coordinate)) return null;
    if (hasBlockingStructure(state, coordinate)) return null;
    if (hasBlockingConstruction(state, coordinate)) return null;

    cost = { stars: improvement.cost, faith: 0, pride: 0 };
    buildTime = improvement.constructionTime;
  } else if (category === "structures") {
    const structure = STRUCTURE_DEFINITIONS[buildingType as keyof typeof STRUCTURE_DEFINITIONS];
    if (!structure) return null;
    if (!player.researchedTechs.includes(structure.requiredTech)) return null;
    if (!coordinate) return null;

    if (!isConstructionCoordinateLinkedToCity(city, coordinate, category)) return null;

    const anchorCoords = getFriendlyBuildAnchors(state, playerId);
    if (!isTileExploredByPlayer(state, playerId, coordinate)) return null;
    if (!isWithinFriendlyBuildRadius(anchorCoords, coordinate)) return null;

    const tile = state.map.tiles.find(
      (t) => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r
    );
    if (!tile) return null;
    if (tile.terrain === "water") return null;
    if (tile.feature === "village") return null;
    if (hasBlockingCity(state, coordinate)) return null;
    if (hasBlockingUnit(state, coordinate)) return null;
    if (hasBlockingImprovement(state, coordinate)) return null;
    if (hasBlockingStructure(state, coordinate)) return null;
    if (hasBlockingConstruction(state, coordinate)) return null;

    const hasStructureInCity = (state.structures || []).some(
      (s) => s.cityId === cityId && s.type === buildingType
    );
    if (hasStructureInCity) return null;

    cost = { stars: structure.cost, faith: 0, pride: 0 };
    buildTime = structure.constructionTime;
  } else if (category === "units") {
    const unitDef = getUnitDefinition(buildingType as UnitType);
    if (!unitDef) return null;
    if (unitDef.requiredTechnology && !player.researchedTechs.includes(unitDef.requiredTechnology)) {
      return null;
    }

    const playerFactionId = coerceFactionId(player.factionId);
    if (
      unitDef.factionSpecific.length > 0 &&
      (!playerFactionId || !unitDef.factionSpecific.includes(playerFactionId))
    ) {
      return null;
    }

    if (unitDef.requirements) {
      if (unitDef.requirements.faith && player.stats.faith < unitDef.requirements.faith) return null;
      if (unitDef.requirements.pride && player.stats.pride < unitDef.requirements.pride) return null;
      if (unitDef.requirements.dissent && player.stats.internalDissent < unitDef.requirements.dissent) {
        return null;
      }
    }

    if (!coordinate) return null;
    const validSpawnTiles = getValidSpawnTiles(state, city.coordinate, buildingType as UnitType, playerId);
    const isValidSpawn = validSpawnTiles.some(
      (tile) => tile.q === coordinate.q && tile.r === coordinate.r
    );
    if (!isValidSpawn) return null;

    cost = { stars: unitDef.cost, faith: 0, pride: 0 };
    buildTime = 1;
  }

  if (
    player.stars < cost.stars ||
    player.stats.faith < cost.faith ||
    player.stats.pride < cost.pride
  ) {
    return null;
  }

  return {
    player,
    city,
    cost,
    buildTime,
    coordinate,
  };
}
