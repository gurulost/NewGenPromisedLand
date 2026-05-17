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
  if (visible.has(key)) return tile;

  if (explored.has(key)) {
    return {
      ...tile,
      resources: [],
      // Current map memory keeps terrain, but hides gameplay objects outside active sight.
      hasCity: Boolean(tile.hasCity && tile.cityOwner && controlled.has(tile.cityOwner)),
      cityOwner: tile.cityOwner && controlled.has(tile.cityOwner) ? tile.cityOwner : undefined,
      feature: undefined,
      captureType: undefined,
      starBonus: undefined,
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

function isOwnedOrVisible(ownerId: string | undefined, coordinate: { q: number; r: number }, controlled: Set<string>, visible: Set<string>, explored?: Set<string>): boolean {
  if (ownerId && controlled.has(ownerId)) return true;
  const key = coordinateKey(coordinate);
  return visible.has(key) || Boolean(explored?.has(key));
}

function projectUnit(unit: Unit, controlled: Set<string>, visible: Set<string>): Unit | null {
  if (controlled.has(unit.playerId)) return unit;
  return visible.has(coordinateKey(unit.coordinate)) ? unit : null;
}

function projectCity(city: City, controlled: Set<string>, visible: Set<string>, explored: Set<string>): City | null {
  if (city.ownerId && controlled.has(city.ownerId)) return city;
  if (!isOwnedOrVisible(city.ownerId, city.coordinate, controlled, visible, explored)) return null;
  return {
    ...city,
    population: 0,
    starProduction: 0,
    unrestTurns: 0,
    improvements: [],
    structures: [],
    currentProduction: undefined,
    harvestedResources: [],
  };
}

function projectImprovement(improvement: Improvement, controlled: Set<string>, visible: Set<string>, explored: Set<string>): Improvement | null {
  return isOwnedOrVisible(improvement.ownerId, improvement.coordinate, controlled, visible, explored)
    ? improvement
    : null;
}

function projectStructure(structure: Structure, cities: City[], controlled: Set<string>, visible: Set<string>, explored: Set<string>): Structure | null {
  if (controlled.has(structure.ownerId)) return structure;
  const coordinate = structure.coordinate ?? cities.find((city) => city.id === structure.cityId)?.coordinate;
  if (!coordinate) return null;
  return isOwnedOrVisible(structure.ownerId, coordinate, controlled, visible, explored)
    ? structure
    : null;
}

function projectPlayer(player: PlayerState, controlled: Set<string>): PlayerState {
  if (controlled.has(player.id)) return player;
  return {
    ...player,
    stars: 0,
    currentResearch: undefined,
    researchProgress: 0,
    researchInspiration: undefined,
    abilityCooldowns: {},
    constructionQueue: [],
    visibilityMask: [],
    exploredTiles: [],
    tradeRoutes: [],
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
    .map((city) => projectCity(city, controlled, visible, explored))
    .filter((city): city is City => city !== null);

  const projected: ProjectedGameState = {
    ...state,
    players: state.players.map((player) => projectPlayer(player, controlled)),
    map: {
      ...state.map,
      tiles,
    },
    units: state.units
      .map((unit) => projectUnit(unit, controlled, visible))
      .filter((unit): unit is Unit => unit !== null),
    cities: projectedCities,
    improvements: (state.improvements ?? [])
      .map((improvement) => projectImprovement(improvement, controlled, visible, explored))
      .filter((improvement): improvement is Improvement => improvement !== null),
    structures: (state.structures ?? [])
      .map((structure) => projectStructure(structure, projectedCities, controlled, visible, explored))
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
