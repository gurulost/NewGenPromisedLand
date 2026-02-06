import type { GameState, PlayerState } from "../types/game";
import type { HexCoordinate } from "../types/coordinates";
import type { ImprovementDefinition, StructureDefinition } from "../types/city";
import { coerceFactionId } from "../types/factionId";
import type { UnitDefinition } from "../types/unit";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../types/city";
import { getUnitDefinition } from "../data/units";
import { GAME_RULES } from "../data/gameRules";
import { getFaction } from "../data/factions";
import {
  STRUCTURE_BUILD_RADIUS,
  getFriendlyBuildAnchors,
  isTileExploredByPlayer,
  isWithinFriendlyBuildRadius,
} from "./constructionRules";
import { getValidSpawnTiles } from "./gameReducer";

export type BuildRequirementStatus = "met" | "unmet" | "info";

export interface BuildRequirement {
  id: string;
  label: string;
  value?: string;
  status: BuildRequirementStatus;
}

const formatTechName = (techId: string) =>
  techId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const formatTerrain = (terrain: string): string =>
  terrain.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const formatTerrainList = (terrains: string[]) =>
  terrains.map(formatTerrain).join(", ");

const hasBlockingUnit = (state: GameState, coord: HexCoordinate) =>
  state.units?.some((u) => u.coordinate.q === coord.q && u.coordinate.r === coord.r);

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

const getValidImprovementTileCount = (
  state: GameState,
  playerId: string,
  improvement: ImprovementDefinition
): number => {
  const anchors = getFriendlyBuildAnchors(state, playerId);
  return state.map.tiles.filter((tile) => {
    if (!isTileExploredByPlayer(state, playerId, tile.coordinate)) return false;
    if (!isWithinFriendlyBuildRadius(anchors, tile.coordinate)) return false;
    if (!improvement.validTerrain.includes(tile.terrain)) return false;
    if (tile.feature === "village") return false;
    if (hasBlockingCity(state, tile.coordinate)) return false;
    if (hasBlockingUnit(state, tile.coordinate)) return false;
    if (hasBlockingImprovement(state, tile.coordinate)) return false;
    if (hasBlockingStructure(state, tile.coordinate)) return false;
    if (hasBlockingConstruction(state, tile.coordinate)) return false;
    return true;
  }).length;
};

const getValidStructureTileCount = (
  state: GameState,
  playerId: string,
  structure: StructureDefinition,
  cityId: string
): number => {
  const anchors = getFriendlyBuildAnchors(state, playerId);
  const hasStructureInCity = (state.structures || []).some(
    (s) => s.cityId === cityId && s.type === structure.id
  );
  if (hasStructureInCity) return 0;

  return state.map.tiles.filter((tile) => {
    if (!isTileExploredByPlayer(state, playerId, tile.coordinate)) return false;
    if (!isWithinFriendlyBuildRadius(anchors, tile.coordinate)) return false;
    if (tile.terrain === "water") return false;
    if (tile.feature === "village") return false;
    if (hasBlockingCity(state, tile.coordinate)) return false;
    if (hasBlockingUnit(state, tile.coordinate)) return false;
    if (hasBlockingImprovement(state, tile.coordinate)) return false;
    if (hasBlockingStructure(state, tile.coordinate)) return false;
    if (hasBlockingConstruction(state, tile.coordinate)) return false;
    return true;
  }).length;
};

const getCityOwnershipRequirement = (state: GameState, player: PlayerState, cityId: string): BuildRequirement => {
  const ownsCity = player.citiesOwned.includes(cityId);
  return {
    id: "owns_city",
    label: "Own city",
    status: ownsCity ? "met" : "unmet",
  };
};

export function getUnitBuildRequirements(
  state: GameState,
  player: PlayerState,
  cityId: string,
  unitDef: UnitDefinition
): BuildRequirement[] {
  const requirements: BuildRequirement[] = [];

  requirements.push(getCityOwnershipRequirement(state, player, cityId));

  requirements.push({
    id: "stars_cost",
    label: "Stars",
    value: String(unitDef.cost),
    status: player.stars >= unitDef.cost ? "met" : "unmet",
  });

  if (unitDef.requiredTechnology) {
    requirements.push({
      id: "technology",
      label: "Technology",
      value: formatTechName(unitDef.requiredTechnology),
      status: player.researchedTechs.includes(unitDef.requiredTechnology) ? "met" : "unmet",
    });
  }

  if (unitDef.factionSpecific.length > 0) {
    const playerFactionId = coerceFactionId(player.factionId);
    const factionNames = unitDef.factionSpecific.map((id) => {
      const faction = getFaction(id);
      return faction ? faction.name : String(id);
    });
    requirements.push({
      id: "faction",
      label: "Faction",
      value: factionNames.join(", "),
      status: !!playerFactionId && unitDef.factionSpecific.includes(playerFactionId) ? "met" : "unmet",
    });
  }

  if (unitDef.requirements?.faith) {
    requirements.push({
      id: "faith_requirement",
      label: "Faith",
      value: `${unitDef.requirements.faith}+`,
      status: player.stats.faith >= unitDef.requirements.faith ? "met" : "unmet",
    });
  }

  if (unitDef.requirements?.pride) {
    requirements.push({
      id: "pride_requirement",
      label: "Pride",
      value: `${unitDef.requirements.pride}+`,
      status: player.stats.pride >= unitDef.requirements.pride ? "met" : "unmet",
    });
  }

  if (unitDef.requirements?.dissent) {
    requirements.push({
      id: "dissent_requirement",
      label: "Dissent",
      value: `${unitDef.requirements.dissent}+`,
      status: player.stats.internalDissent >= unitDef.requirements.dissent ? "met" : "unmet",
    });
  }

  const city = state.cities.find((c) => c.id === cityId);
  const spawnTiles = city
    ? getValidSpawnTiles(state, city.coordinate, unitDef.type, player.id).length
    : 0;
  const isNavalSpawnUnit =
    unitDef.type === "boat" ||
    (unitDef.abilities || []).some(a => String(a).toUpperCase() === "NAVAL_TRANSPORT");

  const spawnLabel =
    isNavalSpawnUnit
      ? "Adjacent explored water tiles"
      : "Explored land tiles within 2";

  requirements.push({
    id: "spawn_tiles",
    label: "Spawn tiles available",
    value: `${spawnTiles} (${spawnLabel})`,
    status: spawnTiles > 0 ? "met" : "unmet",
  });

  requirements.push({
    id: "spawn_rules",
    label: "Spawn rules",
    value: `No enemy units or queued builds, max ${GAME_RULES.units.maxUnitsPerCity} units per tile`,
    status: "info",
  });

  return requirements;
}

export function getStructureBuildRequirements(
  state: GameState,
  player: PlayerState,
  cityId: string,
  structureDef: StructureDefinition
): BuildRequirement[] {
  const requirements: BuildRequirement[] = [];

  requirements.push(getCityOwnershipRequirement(state, player, cityId));

  requirements.push({
    id: "stars_cost",
    label: "Stars",
    value: String(structureDef.cost),
    status: player.stars >= structureDef.cost ? "met" : "unmet",
  });

  requirements.push({
    id: "technology",
    label: "Technology",
    value: formatTechName(structureDef.requiredTech),
    status: player.researchedTechs.includes(structureDef.requiredTech) ? "met" : "unmet",
  });

  const hasStructureInCity = (state.structures || []).some(
    (s) => s.cityId === cityId && s.type === structureDef.id
  );
  requirements.push({
    id: "unique_per_city",
    label: "Unique per city",
    value: hasStructureInCity ? "Already built here" : "Not built yet",
    status: hasStructureInCity ? "unmet" : "met",
  });

  const validTiles = getValidStructureTileCount(state, player.id, structureDef, cityId);
  requirements.push({
    id: "valid_tiles",
    label: "Valid build tiles",
    value: `${validTiles} within ${STRUCTURE_BUILD_RADIUS} tiles`,
    status: validTiles > 0 ? "met" : "unmet",
  });

  requirements.push({
    id: "tile_rules",
    label: "Tile rules",
    value: "Explored land tile, empty (no units/buildings/queued), not a village",
    status: "info",
  });

  requirements.push({
    id: "build_radius",
    label: "Build radius",
    value: `Within ${STRUCTURE_BUILD_RADIUS} tiles of friendly anchors (cities, improvements, structures, villages)`,
    status: "info",
  });

  return requirements;
}

export function getImprovementBuildRequirements(
  state: GameState,
  player: PlayerState,
  cityId: string,
  improvementDef: ImprovementDefinition
): BuildRequirement[] {
  const requirements: BuildRequirement[] = [];

  requirements.push(getCityOwnershipRequirement(state, player, cityId));

  requirements.push({
    id: "stars_cost",
    label: "Stars",
    value: String(improvementDef.cost),
    status: player.stars >= improvementDef.cost ? "met" : "unmet",
  });

  requirements.push({
    id: "technology",
    label: "Technology",
    value: formatTechName(improvementDef.requiredTech),
    status: player.researchedTechs.includes(improvementDef.requiredTech) ? "met" : "unmet",
  });

  requirements.push({
    id: "terrain",
    label: "Terrain",
    value: formatTerrainList(improvementDef.validTerrain),
    status: "info",
  });

  const validTiles = getValidImprovementTileCount(state, player.id, improvementDef);
  requirements.push({
    id: "valid_tiles",
    label: "Valid build tiles",
    value: `${validTiles} within ${STRUCTURE_BUILD_RADIUS} tiles`,
    status: validTiles > 0 ? "met" : "unmet",
  });

  requirements.push({
    id: "tile_rules",
    label: "Tile rules",
    value: "Explored tile, empty (no units/buildings/queued), not a village",
    status: "info",
  });

  requirements.push({
    id: "build_radius",
    label: "Build radius",
    value: `Within ${STRUCTURE_BUILD_RADIUS} tiles of friendly anchors (cities, improvements, structures, villages)`,
    status: "info",
  });

  return requirements;
}

export function getImprovementDefinition(id: string): ImprovementDefinition | undefined {
  return IMPROVEMENT_DEFINITIONS[id as keyof typeof IMPROVEMENT_DEFINITIONS];
}

export function getStructureDefinition(id: string): StructureDefinition | undefined {
  return STRUCTURE_DEFINITIONS[id as keyof typeof STRUCTURE_DEFINITIONS];
}

export function getUnitDefinitionById(id: string): UnitDefinition | undefined {
  return getUnitDefinition(id as any);
}
