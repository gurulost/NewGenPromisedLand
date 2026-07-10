import type { GameState, PlayerState, Tile } from "../types/game";
import type { Unit } from "../types/unit";
import type { City, Improvement, Structure } from "../types/city";

export type ProjectionVisibility = "hidden" | "explored" | "visible";

export type ProjectedGameState = GameState & {
  projection: {
    kind: "player";
    playerIds: string[];
    generatedAt: number;
    hiddenTileCount: number;
  };
};

const coordinateKey = (coordinate: { q: number; r: number }) => `${coordinate.q},${coordinate.r}`;

const unique = (values: string[]): string[] => Array.from(new Set(values));

function getProjectionSets(state: GameState, playerIds: string[]) {
  const controlled = new Set(playerIds);
  const visible = new Set<string>();
  const explored = new Set<string>();

  for (const player of state.players) {
    if (!controlled.has(player.id)) continue;
    for (const key of player.visibilityMask ?? []) visible.add(key);
    for (const key of player.exploredTiles ?? []) explored.add(key);
  }

  for (const tile of state.map.tiles) {
    const key = coordinateKey(tile.coordinate);
    if ((tile.exploredBy ?? []).some((playerId) => controlled.has(playerId))) {
      explored.add(key);
    }
  }

  visible.forEach((key) => explored.add(key));
  return { controlled, visible, explored };
}

function projectTile(tile: Tile, visible: Set<string>, explored: Set<string>, controlled: Set<string>): Tile {
  const key = coordinateKey(tile.coordinate);
  if (visible.has(key)) {
    return {
      coordinate: tile.coordinate,
      terrain: tile.terrain,
      resources: tile.resources,
      hasCity: tile.hasCity,
      cityOwner: tile.cityOwner,
      exploredBy: (tile.exploredBy ?? []).filter((playerId) => controlled.has(playerId)),
      feature: tile.feature,
      captureType: tile.captureType,
      starBonus: tile.starBonus,
    };
  }

  if (explored.has(key)) {
    return {
      coordinate: tile.coordinate,
      terrain: tile.terrain,
      resources: [],
      // Current map memory keeps terrain, but hides gameplay objects outside active sight.
      hasCity: Boolean(tile.hasCity && tile.cityOwner && controlled.has(tile.cityOwner)),
      cityOwner: tile.cityOwner && controlled.has(tile.cityOwner) ? tile.cityOwner : undefined,
      feature: undefined,
      captureType: undefined,
      starBonus: undefined,
      exploredBy: (tile.exploredBy ?? []).filter((playerId) => controlled.has(playerId)),
    };
  }

  return {
    coordinate: tile.coordinate,
    terrain: "plains",
    resources: [],
    hasCity: false,
    exploredBy: [],
  };
}

function isOwnedOrVisible(ownerId: string | undefined, coordinate: { q: number; r: number }, controlled: Set<string>, visible: Set<string>): boolean {
  if (ownerId && controlled.has(ownerId)) return true;
  return visible.has(coordinateKey(coordinate));
}

function projectUnit(unit: Unit, controlled: Set<string>, visible: Set<string>): Unit | null {
  if (controlled.has(unit.playerId)) return unit;
  return visible.has(coordinateKey(unit.coordinate)) ? unit : null;
}

function projectCity(city: City, controlled: Set<string>, visible: Set<string>): City | null {
  if (city.ownerId && controlled.has(city.ownerId)) return city;
  if (!isOwnedOrVisible(city.ownerId, city.coordinate, controlled, visible)) return null;
  return {
    id: city.id,
    name: city.name,
    coordinate: city.coordinate,
    ownerId: city.ownerId,
    population: 0,
    maxPopulation: city.maxPopulation,
    level: city.level,
    starProduction: 0,
    unrestTurns: 0,
    improvements: [],
    structures: [],
    currentProduction: undefined,
    harvestedResources: [],
  };
}

function projectImprovement(improvement: Improvement, controlled: Set<string>, visible: Set<string>): Improvement | null {
  if (controlled.has(improvement.ownerId)) return improvement;
  if (!visible.has(coordinateKey(improvement.coordinate))) return null;
  return {
    id: improvement.id,
    type: improvement.type,
    coordinate: improvement.coordinate,
    ownerId: improvement.ownerId,
    starProduction: improvement.starProduction,
    cityId: improvement.cityId,
    constructionTurns: improvement.constructionTurns,
  };
}

function projectStructure(structure: Structure, cities: City[], controlled: Set<string>, visible: Set<string>): Structure | null {
  if (controlled.has(structure.ownerId)) return structure;
  const coordinate = structure.coordinate ?? cities.find((city) => city.id === structure.cityId)?.coordinate;
  if (!coordinate) return null;
  if (!visible.has(coordinateKey(coordinate))) return null;
  return {
    id: structure.id,
    type: structure.type,
    coordinate: structure.coordinate,
    cityId: structure.cityId,
    ownerId: structure.ownerId,
    constructionTurns: structure.constructionTurns,
    effects: {
      starProduction: structure.effects.starProduction,
      unitProduction: structure.effects.unitProduction,
      defenseBonus: structure.effects.defenseBonus,
      populationGrowth: structure.effects.populationGrowth,
      faithProduction: structure.effects.faithProduction,
    },
  };
}

function projectPlayer(player: PlayerState, controlled: Set<string>): PlayerState {
  if (controlled.has(player.id)) return player;
  return {
    id: player.id,
    name: player.name,
    factionId: player.factionId,
    isAI: player.isAI,
    aiDifficulty: player.aiDifficulty,
    stars: 0,
    stats: { faith: 0, pride: 0, internalDissent: 0 },
    modifiers: [],
    researchedTechs: [],
    currentResearch: undefined,
    researchProgress: 0,
    researchInspiration: undefined,
    abilityCooldowns: {},
    citiesOwned: [],
    constructionQueue: [],
    visibilityMask: [],
    exploredTiles: [],
    isEliminated: player.isEliminated,
    turnOrder: player.turnOrder,
    faithProject: null,
    atWarWith: [],
    alliedWith: [],
    tradeRoutes: [],
    diplomaticCooldowns: {
      declareWar: 0,
      formAlliance: 0,
      breakAlliance: 0,
      requestTrade: 0,
    },
  };
}

function projectLastAction(lastAction: GameState["lastAction"], controlled: Set<string>): GameState["lastAction"] {
  if (!lastAction) return undefined;
  const payload = lastAction.payload && typeof lastAction.payload === "object"
    ? lastAction.payload as Record<string, unknown>
    : {};
  const playerId = typeof payload.playerId === "string" ? payload.playerId : undefined;
  const endingPlayerId = typeof payload.endingPlayerId === "string" ? payload.endingPlayerId : undefined;
  const sourcePlayerId = typeof payload.sourcePlayerId === "string" ? payload.sourcePlayerId : undefined;

  if (
    (playerId && controlled.has(playerId)) ||
    (endingPlayerId && controlled.has(endingPlayerId)) ||
    (sourcePlayerId && controlled.has(sourcePlayerId))
  ) {
    return lastAction;
  }

  if (lastAction.type === "END_TURN" || lastAction.type === "END_TURN_RESOLUTION") {
    return {
      type: "END_TURN",
      payload: {
        playerId: endingPlayerId ?? playerId ?? "unknown",
      },
    };
  }

  return undefined;
}

export function projectGameStateForPlayers(
  state: GameState,
  playerIds: string[],
  options: { now?: number } = {},
): ProjectedGameState {
  const cleanPlayerIds = unique(playerIds.filter((playerId) => typeof playerId === "string" && playerId.length > 0));
  const { controlled, visible, explored } = getProjectionSets(state, cleanPlayerIds);
  let hiddenTileCount = 0;

  const tiles = state.map.tiles.map((tile) => {
    const key = coordinateKey(tile.coordinate);
    if (!explored.has(key)) hiddenTileCount += 1;
    return projectTile(tile, visible, explored, controlled);
  });

  const projectedCities = (state.cities ?? [])
    .map((city) => projectCity(city, controlled, visible))
    .filter((city): city is City => city !== null);

  const projected: ProjectedGameState = {
    ...state,
    rngSeed: undefined,
    players: state.players.map((player) => projectPlayer(player, controlled)),
    map: {
      ...state.map,
      tiles,
    },
    visibility: state.visibility
      ? Object.fromEntries(
          Object.entries(state.visibility).filter(([playerId]) => controlled.has(playerId)),
        )
      : undefined,
    units: state.units
      .map((unit) => projectUnit(unit, controlled, visible))
      .filter((unit): unit is Unit => unit !== null),
    cities: projectedCities,
    improvements: (state.improvements ?? [])
      .map((improvement) => projectImprovement(improvement, controlled, visible))
      .filter((improvement): improvement is Improvement => improvement !== null),
    structures: (state.structures ?? [])
      .map((structure) => projectStructure(structure, state.cities ?? [], controlled, visible))
      .filter((structure): structure is Structure => structure !== null),
    activeEffects: (state.activeEffects ?? []).filter((effect) => controlled.has(effect.source.playerId) || controlled.has(effect.target.playerId)),
    lastAction: projectLastAction(state.lastAction, controlled),
    projection: {
      kind: "player",
      playerIds: cleanPlayerIds,
      generatedAt: options.now ?? Date.now(),
      hiddenTileCount,
    },
  };

  return projected;
}

export function projectGameStateForPlayer(
  state: GameState,
  playerId: string,
  options: { now?: number } = {},
): ProjectedGameState {
  return projectGameStateForPlayers(state, [playerId], options);
}
