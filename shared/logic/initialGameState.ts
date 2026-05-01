import type { HexCoordinate } from "../types/coordinates";
import { coerceFactionId } from "../types/factionId";
import type { FactionId } from "../types/faction";
import type { GameMap, GameState, PlayerState } from "../types/game";
import { FACTIONS } from "../data/factions";
import { FACTION_CITY_NAMES } from "../data/cityNames";
import { hexDistance } from "../utils/hex";
import {
  MapGenerator,
  MAP_SIZE_CONFIGS,
  type MapSize,
} from "../utils/mapGenerator";
import { deriveSeed, SeededRandom } from "../utils/mapGenerationRandom";

export type InitialPlayerSetup = {
  id: string;
  name: string;
  factionId: string;
  turnOrder: number;
  isAI?: boolean;
  aiDifficulty?: "easy" | "normal" | "hard";
};

export type GeneratedInitialMap = {
  map: GameMap;
  capitalPositions: HexCoordinate[];
};

export function resolveInitialMapSize(mapSize: string | undefined): MapSize {
  const normalized = mapSize === "medium" ? "normal" : mapSize;
  return normalized && MAP_SIZE_CONFIGS[normalized as MapSize] ? normalized as MapSize : "normal";
}

function applyPlayerDefaults(player: PlayerState): PlayerState {
  const normalized: PlayerState = { ...player };
  normalized.factionId = coerceFactionId(player.factionId) ?? player.factionId;
  normalized.modifiers = player.modifiers ?? [];
  normalized.researchedTechs = player.researchedTechs ?? [];
  normalized.researchProgress = player.researchProgress ?? 0;
  normalized.researchInspiration = player.researchInspiration ?? 0;
  normalized.citiesOwned = player.citiesOwned ?? [];
  normalized.constructionQueue = player.constructionQueue ?? [];
  normalized.visibilityMask = player.visibilityMask ?? [];
  normalized.exploredTiles = player.exploredTiles ?? [];
  normalized.abilityCooldowns = player.abilityCooldowns ?? {};
  normalized.currentResearch = player.currentResearch;
  normalized.atWarWith = player.atWarWith ?? [];
  normalized.alliedWith = player.alliedWith ?? [];
  normalized.tradeRoutes = player.tradeRoutes ?? [];
  return normalized;
}

function createInitialPlayers(playerSetup: InitialPlayerSetup[]): PlayerState[] {
  return playerSetup.map((setup) => {
    const factionId = coerceFactionId(setup.factionId) ?? "NEPHITES";
    return applyPlayerDefaults({
      id: setup.id,
      name: setup.name,
      factionId,
      modifiers: [],
      stats: { ...FACTIONS[factionId].startingStats },
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      isAI: setup.isAI ?? false,
      aiDifficulty: setup.aiDifficulty ?? "normal",
      turnOrder: setup.turnOrder,
      stars: 10,
      researchedTechs: [],
      researchProgress: 0,
      researchInspiration: 0,
      abilityCooldowns: {},
      constructionQueue: [],
      citiesOwned: [],
      currentResearch: undefined,
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: {
        declareWar: 0,
        formAlliance: 0,
        breakAlliance: 0,
        requestTrade: 0,
      },
    });
  });
}

function pickDeterministicCityName({
  factionId,
  gameId,
  seed,
  cityIndex,
  usedNames,
}: {
  factionId: FactionId;
  gameId: string;
  seed: number;
  cityIndex: number;
  usedNames: Set<string>;
}): string {
  const names = FACTION_CITY_NAMES[factionId] ?? [];
  if (names.length === 0) {
    return `City ${cityIndex + 1}`;
  }

  const random = new SeededRandom(deriveSeed(seed, `${gameId}:city:${cityIndex}:${factionId}`));
  const offset = random.nextInt(0, names.length - 1);
  for (let i = 0; i < names.length; i += 1) {
    const candidate = names[(offset + i) % names.length];
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  const baseName = names[offset % names.length];
  const suffix = cityIndex + 2;
  const fallback = `${baseName} ${suffix}`;
  usedNames.add(fallback);
  return fallback;
}

function getVisionTiles(centerQ: number, centerR: number, radius = 2): string[] {
  const tiles: string[] = [];
  for (let q = centerQ - radius; q <= centerQ + radius; q += 1) {
    for (let r = centerR - radius; r <= centerR + radius; r += 1) {
      const s = -q - r;
      const distance = Math.max(
        Math.abs(q - centerQ),
        Math.abs(r - centerR),
        Math.abs(s - (-centerQ - centerR)),
      );
      if (distance <= radius) {
        tiles.push(`${q},${r}`);
      }
    }
  }
  return tiles;
}

export function generateInitialGameMap({
  mapSize,
  seed,
  playerCount,
  playerFactions,
}: {
  mapSize: MapSize;
  seed: number;
  playerCount: number;
  playerFactions: string[];
}): GeneratedInitialMap {
  const resolvedMapSize = resolveInitialMapSize(mapSize);
  const mapConfig = MAP_SIZE_CONFIGS[resolvedMapSize];
  const mapGenerator = new MapGenerator(
    {
      width: mapConfig.dimensions,
      height: mapConfig.dimensions,
      seed,
      playerCount,
      mapSize: resolvedMapSize,
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3,
    },
    playerFactions,
  );

  return {
    map: mapGenerator.generateMap(),
    capitalPositions: mapGenerator.getCapitalPositions(),
  };
}

export function createInitialGameStateFromGeneratedMap({
  playerSetup,
  mapSize,
  seed,
  gameId = `local-${seed}`,
  map,
  capitalPositions,
}: {
  playerSetup: InitialPlayerSetup[];
  mapSize?: string;
  seed: number;
  gameId?: string;
  map: GameMap;
  capitalPositions: HexCoordinate[];
}): { gameState: GameState; mapSize: MapSize } {
  const resolvedMapSize = resolveInitialMapSize(mapSize);
  const players = createInitialPlayers(playerSetup);
  const cityTiles = map.tiles.filter((tile) => tile.hasCity);
  const capitalTiles = capitalPositions
    .map((pos) => map.tiles.find((tile) =>
      tile.coordinate.q === pos.q &&
      tile.coordinate.r === pos.r &&
      tile.coordinate.s === pos.s
    ))
    .filter((tile): tile is GameMap["tiles"][number] => Boolean(tile));
  const startTiles = capitalTiles.length === players.length ? capitalTiles : cityTiles;
  const usedCityNames = new Set<string>();

  const cities = players.map((player, index) => {
    const cityTile = startTiles[index] || cityTiles[index] || cityTiles[0];
    if (!cityTile) {
      throw new Error("Generated map does not contain enough city tiles for initial state");
    }

    return {
      id: `city-${player.id}`,
      name: pickDeterministicCityName({
        factionId: player.factionId as FactionId,
        gameId,
        seed,
        cityIndex: index,
        usedNames: usedCityNames,
      }),
      coordinate: cityTile.coordinate,
      ownerId: player.id,
      population: 1,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      unrestTurns: 0,
      improvements: [],
      structures: [],
      harvestedResources: [],
    };
  });

  const playersWithCities = players.map((player, index) => ({
    ...player,
    citiesOwned: [cities[index].id],
  }));

  const exploreAreaAroundCity = (cityCoord: HexCoordinate, playerId: string): void => {
    const exploreRadius = 2;
    for (const tile of map.tiles) {
      const distance = hexDistance(tile.coordinate, cityCoord);
      if (distance <= exploreRadius) {
        tile.exploredBy = [...(tile.exploredBy || []), playerId];
      }
    }
  };

  cities.forEach((city, index) => {
    if (index < players.length) {
      exploreAreaAroundCity(city.coordinate, players[index].id);
    }
  });

  const units = players.flatMap((player, index) => {
    const city = cities[index];
    if (!city) return [];

    const findUnitSpawnPosition = (cityCoord: HexCoordinate): HexCoordinate => {
      const adjacentTiles = [
        { q: cityCoord.q + 1, r: cityCoord.r, s: cityCoord.s - 1 },
        { q: cityCoord.q + 1, r: cityCoord.r - 1, s: cityCoord.s },
        { q: cityCoord.q, r: cityCoord.r - 1, s: cityCoord.s + 1 },
        { q: cityCoord.q - 1, r: cityCoord.r, s: cityCoord.s + 1 },
        { q: cityCoord.q - 1, r: cityCoord.r + 1, s: cityCoord.s },
        { q: cityCoord.q, r: cityCoord.r + 1, s: cityCoord.s - 1 },
      ];

      for (const coord of adjacentTiles) {
        const tile = map.tiles.find((candidate) =>
          candidate.coordinate.q === coord.q && candidate.coordinate.r === coord.r
        );
        if (tile && tile.terrain !== "water" && tile.terrain !== "mountain" && !tile.hasCity) {
          return coord;
        }
      }

      return cityCoord;
    };

    const unitPosition = findUnitSpawnPosition(city.coordinate);
    return [
      {
        id: `unit-${player.id}-1`,
        type: "warrior" as const,
        playerId: player.id,
        coordinate: unitPosition,
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 3,
        remainingMovement: 3,
        maxActions: 1,
        actionsRemaining: 1,
        status: "active" as const,
        abilities: [],
        level: 1,
        experience: 0,
        visionRadius: 2,
        attackRange: 1,
        hasAttacked: false,
      },
    ];
  });

  const updatedPlayers = playersWithCities.map((player) => {
    const playerUnits = units.filter((unit) => unit.playerId === player.id);
    const allVisibleTiles: string[] = [];
    playerUnits.forEach((unit) => {
      allVisibleTiles.push(...getVisionTiles(unit.coordinate.q, unit.coordinate.r, 2));
    });
    const uniqueVisibleTiles = Array.from(new Set(allVisibleTiles));

    return {
      ...player,
      visibilityMask: uniqueVisibleTiles,
      exploredTiles: uniqueVisibleTiles,
    };
  });

  const gameState: GameState = {
    id: gameId,
    rngSeed: seed >>> 0,
    players: updatedPlayers,
    currentPlayerIndex: 0,
    turn: 1,
    phase: "playing",
    map,
    units,
    cities,
    improvements: [],
    structures: [],
    activeEffects: [],
    lastAction: undefined,
    winner: undefined,
    victoryType: undefined,
  };

  return { gameState, mapSize: resolvedMapSize };
}

export function createInitialGameState({
  playerSetup,
  mapSize = "normal",
  seed,
  gameId = `local-${seed}`,
}: {
  playerSetup: InitialPlayerSetup[];
  mapSize?: string;
  seed: number;
  gameId?: string;
}): { gameState: GameState; mapSize: MapSize } {
  const resolvedMapSize = resolveInitialMapSize(mapSize);
  const players = createInitialPlayers(playerSetup);
  const generated = generateInitialGameMap({
    mapSize: resolvedMapSize,
    seed,
    playerCount: players.length,
    playerFactions: players.map((player) => player.factionId),
  });

  return createInitialGameStateFromGeneratedMap({
    playerSetup,
    mapSize: resolvedMapSize,
    seed,
    gameId,
    ...generated,
  });
}
