import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { hexDistance, hexNeighbors } from './hex';
import { buildTileIndex, coordKey, isWithinMap } from './mapGenerationGeometry';
import {
  CAPITAL_MIN_DISTANCE_BY_SIZE,
  MAP_GENERATION_CONSTANTS,
  type MapSize,
} from './mapGenerationConstants';
import type {
  CapitalCandidateAssignment,
  LandmassData,
} from './mapGenerationTypes';

interface CapitalPlacementRandom {
  next(): number;
}

interface ScoreCapitalCandidateOptions {
  tile: Tile;
  tileIndex: Map<string, Tile>;
  playerIndex: number;
  idealRadius: number;
  target: HexCoordinate;
}

interface GenerateCapitalSpawnsOptions {
  tiles: Tile[];
  landmassData: LandmassData;
  mapRadius: number;
  mapSize: MapSize;
  playerCount: number;
  rng: CapitalPlacementRandom;
  isValidCapitalCandidate: (coord: HexCoordinate, waterRelax: number, playerIndex: number) => boolean;
  scoreCapitalCandidate: (options: ScoreCapitalCandidateOptions) => number;
}

export const getCapitalMinDistance = (mapSize: MapSize): number => {
  return CAPITAL_MIN_DISTANCE_BY_SIZE[mapSize] || MAP_GENERATION_CONSTANTS.CITY_MIN_DISTANCE;
};

export const getCapitalSpawnRadiusBand = (
  mapRadius: number
): { minRadius: number; maxRadius: number } => {
  const baseRadius = Math.floor(mapRadius * MAP_GENERATION_CONSTANTS.CAPITAL_SPAWN_RADIUS_RATIO);
  const variance = Math.max(1, Math.floor(mapRadius * 0.12));
  const minRadius = Math.max(3, baseRadius - variance);
  const maxRadius = Math.max(
    minRadius,
    Math.min(mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER, baseRadius + variance)
  );
  return { minRadius, maxRadius };
};

export const generateCapitalSpawns = ({
  tiles,
  landmassData,
  mapRadius,
  mapSize,
  playerCount,
  rng,
  isValidCapitalCandidate,
  scoreCapitalCandidate,
}: GenerateCapitalSpawnsOptions): HexCoordinate[] => {
  const baseMinDistance = getCapitalMinDistance(mapSize);
  const { minRadius, maxRadius } = getCapitalSpawnRadiusBand(mapRadius);
  const angleStep = (2 * Math.PI) / Math.max(1, playerCount);
  const angleJitter = angleStep * 0.35;
  const landmassOrder = getCapitalLandmassOrder(landmassData, playerCount);
  const distanceSequence = getCapitalDistanceSequence(baseMinDistance, mapRadius);
  const waterRelaxSequence = [0, 1, 2, 3];

  const tryPlace = (
    minDistance: number,
    waterRelax: number,
    requiredLandmassId?: number
  ): HexCoordinate[] | null => {
    const pools = Array.from({ length: playerCount }, (_, playerIndex) =>
      buildCapitalCandidatePool({
        tiles,
        landmassData,
        mapRadius,
        playerCount,
        playerIndex,
        minRadius,
        maxRadius,
        angleStep,
        angleJitter,
        waterRelax,
        rng,
        requiredLandmassId,
        isValidCapitalCandidate,
        scoreCapitalCandidate,
      })
    );

    if (pools.some(pool => pool.length === 0)) return null;

    const positions: Array<HexCoordinate | null> = new Array(playerCount).fill(null);
    const placementOrder = pools
      .map((pool, index) => ({ index, count: pool.length }))
      .sort((a, b) => (a.count - b.count) || (a.index - b.index));
    let attempts = 0;
    const maxAttempts = MAP_GENERATION_CONSTANTS.MAX_ATTEMPTS_PER_GUARANTEE * 10;

    const search = (depth: number): HexCoordinate[] | null => {
      if (depth >= placementOrder.length) {
        return positions.map(position => ({ ...(position as HexCoordinate) }));
      }
      if (attempts >= maxAttempts) return null;

      const playerIndex = placementOrder[depth].index;
      for (const candidate of pools[playerIndex]) {
        attempts += 1;
        if (positions.some(position => position && hexDistance(position, candidate.coord) < minDistance)) {
          continue;
        }

        positions[playerIndex] = candidate.coord;
        const result = search(depth + 1);
        if (result) return result;
        positions[playerIndex] = null;

        if (attempts >= maxAttempts) break;
      }

      return null;
    };

    return search(0);
  };

  for (const minDistance of distanceSequence) {
    for (const waterRelax of waterRelaxSequence) {
      for (const landmass of landmassOrder) {
        const positions = tryPlace(minDistance, waterRelax, landmass.id);
        if (positions) return positions;
      }
    }
  }

  for (const minDistance of distanceSequence) {
    for (const waterRelax of waterRelaxSequence) {
      const positions = tryPlace(minDistance, waterRelax);
      if (positions) return positions;
    }
  }

  return generateCapitalFallback({
    tiles,
    landmassData,
    mapRadius,
    playerCount,
    minRadius,
    maxRadius,
    angleStep,
    angleJitter,
    minDistance: distanceSequence[distanceSequence.length - 1] ?? baseMinDistance,
    rng,
    isValidCapitalCandidate,
    scoreCapitalCandidate,
  });
};

const getCapitalLandmassOrder = (
  landmassData: LandmassData,
  playerCount: number
): Array<{ id: number; size: number }> => {
  return landmassData.massSizes
    .map((size, id) => ({ id, size }))
    .filter(landmass => landmass.size >= Math.max(1, playerCount))
    .sort((a, b) => (b.size - a.size) || (a.id - b.id));
};

const getCapitalDistanceSequence = (baseMinDistance: number, mapRadius: number): number[] => {
  const fallbackMinDistance = getCapitalFallbackMinDistance(baseMinDistance, mapRadius);
  const distances: number[] = [];
  for (let distance = baseMinDistance; distance >= fallbackMinDistance; distance--) {
    distances.push(distance);
  }
  return distances.length > 0 ? distances : [baseMinDistance];
};

const getCapitalFallbackMinDistance = (baseMinDistance: number, mapRadius: number): number => {
  const edgeLimitedDistance = mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER;
  if (edgeLimitedDistance >= baseMinDistance) {
    return baseMinDistance;
  }
  return Math.max(2, Math.min(baseMinDistance, edgeLimitedDistance));
};

const buildCapitalCandidatePool = ({
  tiles,
  landmassData,
  mapRadius,
  playerCount,
  playerIndex,
  minRadius,
  maxRadius,
  angleStep,
  angleJitter,
  waterRelax,
  rng,
  requiredLandmassId,
  isValidCapitalCandidate,
  scoreCapitalCandidate,
}: {
  tiles: Tile[];
  landmassData: LandmassData;
  mapRadius: number;
  playerCount: number;
  playerIndex: number;
  minRadius: number;
  maxRadius: number;
  angleStep: number;
  angleJitter: number;
  waterRelax: number;
  rng: CapitalPlacementRandom;
  requiredLandmassId?: number;
  isValidCapitalCandidate: (coord: HexCoordinate, waterRelax: number, playerIndex: number) => boolean;
  scoreCapitalCandidate: (options: ScoreCapitalCandidateOptions) => number;
}): CapitalCandidateAssignment[] => {
  const maxPoolSize = Math.max(48, playerCount * 16);
  const candidates: CapitalCandidateAssignment[] = [];
  const tileIndex = buildTileIndex(tiles);
  const idealRadius = (minRadius + maxRadius) / 2;
  const angle = (playerIndex * angleStep) + (rng.next() - 0.5) * angleJitter;
  const target: HexCoordinate = {
    q: Math.round(idealRadius * Math.cos(angle)),
    r: Math.round(idealRadius * Math.sin(angle)),
    s: 0,
  };
  target.s = -target.q - target.r;

  for (const tile of tiles) {
    const landmassId = landmassData.massByCoord.get(coordKey(tile.coordinate));
    if (requiredLandmassId !== undefined && landmassId !== requiredLandmassId) continue;
    if (!isCapitalBaseCandidate(tile.coordinate, mapRadius)) continue;
    if (!isValidCapitalCandidate(tile.coordinate, waterRelax, playerIndex)) continue;

    candidates.push({
      coord: tile.coordinate,
      score: scoreCapitalCandidate({
        tile,
        tileIndex,
        playerIndex,
        idealRadius,
        target,
      }) + rng.next() * 0.05,
    });
  }

  return candidates
    .sort((a, b) => (b.score - a.score) || coordKey(a.coord).localeCompare(coordKey(b.coord)))
    .slice(0, maxPoolSize);
};

const isCapitalBaseCandidate = (coord: HexCoordinate, mapRadius: number): boolean => {
  if (!isWithinMap(coord, mapRadius)) return false;
  return hexDistance({ q: 0, r: 0, s: 0 }, coord) <=
    mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER;
};

const generateCapitalFallback = ({
  tiles,
  landmassData,
  mapRadius,
  playerCount,
  minRadius,
  maxRadius,
  angleStep,
  angleJitter,
  minDistance,
  rng,
  isValidCapitalCandidate,
  scoreCapitalCandidate,
}: {
  tiles: Tile[];
  landmassData: LandmassData;
  mapRadius: number;
  playerCount: number;
  minRadius: number;
  maxRadius: number;
  angleStep: number;
  angleJitter: number;
  minDistance: number;
  rng: CapitalPlacementRandom;
  isValidCapitalCandidate: (coord: HexCoordinate, waterRelax: number, playerIndex: number) => boolean;
  scoreCapitalCandidate: (options: ScoreCapitalCandidateOptions) => number;
}): HexCoordinate[] => {
  const positions: HexCoordinate[] = [];
  const preferredLandmassId = getCapitalLandmassOrder(landmassData, playerCount)[0]?.id;

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
    const preferredPool = preferredLandmassId === undefined
      ? []
      : buildCapitalCandidatePool({
          tiles,
          landmassData,
          mapRadius,
          playerCount,
          playerIndex,
          minRadius,
          maxRadius,
          angleStep,
          angleJitter,
          waterRelax: 3,
          rng,
          requiredLandmassId: preferredLandmassId,
          isValidCapitalCandidate,
          scoreCapitalCandidate,
        });
    const anyPool = buildCapitalCandidatePool({
      tiles,
      landmassData,
      mapRadius,
      playerCount,
      playerIndex,
      minRadius,
      maxRadius,
      angleStep,
      angleJitter,
      waterRelax: 3,
      rng,
      isValidCapitalCandidate,
      scoreCapitalCandidate,
    });
    const pool = preferredPool.length > 0 ? preferredPool : anyPool;
    const spacedPick = pool.find(candidate =>
      positions.every(position => hexDistance(position, candidate.coord) >= minDistance)
    );
    const bestEffortPick = spacedPick ?? pickMostSeparatedCapitalCandidate(pool, positions);

    if (bestEffortPick) {
      positions.push(bestEffortPick.coord);
      continue;
    }

    const fallbackRadius = Math.floor(mapRadius * MAP_GENERATION_CONSTANTS.CAPITAL_SPAWN_RADIUS_RATIO);
    const angle = (playerIndex / Math.max(1, playerCount)) * 2 * Math.PI;
    const q = Math.round(fallbackRadius * Math.cos(angle));
    const r = Math.round(fallbackRadius * Math.sin(angle));
    const s = -q - r;
    const candidate = { q, r, s };
    positions.push(findNearestLandTile(candidate, tiles, mapRadius) ?? candidate);
  }

  return positions;
};

const pickMostSeparatedCapitalCandidate = (
  pool: CapitalCandidateAssignment[],
  positions: HexCoordinate[]
): CapitalCandidateAssignment | null => {
  if (pool.length === 0) return null;
  if (positions.length === 0) return pool[0];

  return pool.reduce<CapitalCandidateAssignment | null>((best, candidate) => {
    const minDistance = Math.min(...positions.map(position => hexDistance(position, candidate.coord)));
    if (!best) return candidate;
    const bestDistance = Math.min(...positions.map(position => hexDistance(position, best.coord)));
    if (minDistance !== bestDistance) {
      return minDistance > bestDistance ? candidate : best;
    }
    return candidate.score > best.score ? candidate : best;
  }, null);
};

const findNearestLandTile = (
  coord: HexCoordinate,
  tiles: Tile[],
  mapRadius: number
): HexCoordinate | null => {
  const tileIndex = buildTileIndex(tiles);
  const visited = new Set<string>([coordKey(coord)]);
  const queue: HexCoordinate[] = [coord];

  while (queue.length > 0) {
    const current = queue.shift() as HexCoordinate;
    const tile = tileIndex.get(coordKey(current));
    if (tile && tile.terrain !== 'water') {
      return current;
    }

    for (const neighbor of hexNeighbors(current)) {
      if (!isWithinMap(neighbor, mapRadius)) continue;
      const key = coordKey(neighbor);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }

  return null;
};
