import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { hexDistance, hexNeighbors, hexesInRange } from './hex';
import { buildTileIndex, coordKey } from './mapGenerationGeometry';
import { MAP_GENERATION_CONSTANTS, type MapSize } from './mapGenerationConstants';
import type { WaterBodyData } from './mapGenerationTypes';

export const buildWaterBodyIndex = (tiles: Tile[]): WaterBodyData => {
  const tileIndex = buildTileIndex(tiles);
  const visited = new Set<string>();
  const bodyByCoord = new Map<string, number>();
  const bodySizes: number[] = [];

  for (const tile of tiles) {
    if (tile.terrain !== 'water') continue;
    const key = coordKey(tile.coordinate);
    if (visited.has(key)) continue;

    const queue: Tile[] = [tile];
    visited.add(key);
    const bodyTiles: Tile[] = [];

    while (queue.length > 0) {
      const current = queue.shift() as Tile;
      const currentKey = coordKey(current.coordinate);
      bodyTiles.push(current);
      bodyByCoord.set(currentKey, bodySizes.length);

      for (const neighborCoord of hexNeighbors(current.coordinate)) {
        const neighborKey = coordKey(neighborCoord);
        if (visited.has(neighborKey)) continue;
        const neighbor = tileIndex.get(neighborKey);
        if (!neighbor || neighbor.terrain !== 'water') continue;
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }

    bodySizes.push(bodyTiles.length);
  }

  return { bodyByCoord, bodySizes };
};

export const groupWaterBodies = (tiles: Tile[], waterData: WaterBodyData): Tile[][] => {
  const bodies: Tile[][] = Array.from({ length: waterData.bodySizes.length }, () => []);
  tiles.forEach(tile => {
    if (tile.terrain !== 'water') return;
    const bodyId = waterData.bodyByCoord.get(coordKey(tile.coordinate));
    if (bodyId === undefined) return;
    bodies[bodyId].push(tile);
  });
  return bodies;
};

export const getWaterRatioRange = (mapSize: MapSize): { min: number; max: number } => {
  return MAP_GENERATION_CONSTANTS.WATER_RATIO_BY_SIZE[mapSize] ?? { min: 0.16, max: 0.24 };
};

export const getMinWaterBodySize = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.WATER_MIN_BODY_SIZE_BY_SIZE[mapSize] ?? 10;
};

export const getWaterFactionMinBodySize = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.WATER_MULEKITE_MIN_BODY_SIZE_BY_SIZE[mapSize] ?? 12;
};

export const getWaterFactionMinCoastTiles = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.WATER_MULEKITE_MIN_COAST_TILES_BY_SIZE[mapSize] ?? 3;
};

export const smoothWaterMask = (tiles: Tile[]): void => {
  const tileIndex = buildTileIndex(tiles);
  const toLand: Tile[] = [];
  const toWater: Tile[] = [];

  for (const tile of tiles) {
    const waterNeighbors = hexNeighbors(tile.coordinate)
      .map(coord => tileIndex.get(coordKey(coord)))
      .filter((neighbor): neighbor is Tile => !!neighbor && neighbor.terrain === 'water').length;

    if (tile.terrain === 'water' && waterNeighbors <= 1) {
      toLand.push(tile);
    } else if (tile.terrain !== 'water' && waterNeighbors >= 5) {
      toWater.push(tile);
    }
  }

  toLand.forEach(tile => {
    tile.terrain = 'plains';
  });
  toWater.forEach(tile => {
    tile.terrain = 'water';
  });
};

export const removeSmallWaterBodies = (
  tiles: Tile[],
  waterData: WaterBodyData,
  minSize: number
): void => {
  const waterBodies = groupWaterBodies(tiles, waterData);
  waterBodies.forEach(body => {
    if (body.length < minSize) {
      body.forEach(tile => {
        tile.terrain = 'plains';
      });
    }
  });
};

export const fillWaterDeficit = (
  tiles: Tile[],
  scoreByKey: Map<string, number>,
  needed: number
): void => {
  if (needed <= 0) return;
  const tileIndex = buildTileIndex(tiles);
  const candidates = tiles
    .filter(tile => tile.terrain !== 'water')
    .filter(tile => hexNeighbors(tile.coordinate)
      .map(coord => tileIndex.get(coordKey(coord)))
      .some(neighbor => neighbor?.terrain === 'water'))
    .sort((a, b) =>
      (scoreByKey.get(coordKey(b.coordinate)) ?? 0) - (scoreByKey.get(coordKey(a.coordinate)) ?? 0)
    );

  let remaining = needed;
  for (const tile of candidates) {
    if (remaining <= 0) break;
    tile.terrain = 'water';
    remaining -= 1;
  }

  if (remaining > 0) {
    const fallback = tiles
      .filter(tile => tile.terrain !== 'water')
      .sort((a, b) =>
        (scoreByKey.get(coordKey(b.coordinate)) ?? 0) - (scoreByKey.get(coordKey(a.coordinate)) ?? 0)
      );
    for (const tile of fallback) {
      if (remaining <= 0) break;
      tile.terrain = 'water';
      remaining -= 1;
    }
  }
};

export const trimWaterSurplus = (
  tiles: Tile[],
  scoreByKey: Map<string, number>,
  surplus: number
): void => {
  if (surplus <= 0) return;
  const candidates = tiles
    .filter(tile => tile.terrain === 'water')
    .sort((a, b) =>
      (scoreByKey.get(coordKey(a.coordinate)) ?? 0) - (scoreByKey.get(coordKey(b.coordinate)) ?? 0)
    );

  let remaining = surplus;
  for (const tile of candidates) {
    if (remaining <= 0) break;
    tile.terrain = 'plains';
    remaining -= 1;
  }
};

export const getCapitalWaterMetrics = (
  coord: HexCoordinate,
  tiles: Tile[],
  waterData: WaterBodyData,
  mapRadius: number
): { adjacentWaterTiles: number; connectedBodySize: number; coastTilesWithinRadius: number } => {
  const tileIndex = buildTileIndex(tiles);
  const adjacentWater = hexNeighbors(coord)
    .map(neighbor => tileIndex.get(coordKey(neighbor)))
    .filter((tile): tile is Tile => !!tile && tile.terrain === 'water');

  const connectedBodySize = adjacentWater.reduce((best, tile) => {
    const bodyId = waterData.bodyByCoord.get(coordKey(tile.coordinate));
    if (bodyId === undefined) return best;
    return Math.max(best, waterData.bodySizes[bodyId] ?? 0);
  }, 0);

  const coastTilesWithinRadius = hexesInRange(coord, Math.min(3, mapRadius))
    .map(radiusCoord => tileIndex.get(coordKey(radiusCoord)))
    .filter((tile): tile is Tile => !!tile && tile.terrain === 'water')
    .reduce((count, tile) => {
      const hasLandNeighbor = hexNeighbors(tile.coordinate)
        .map(neighbor => tileIndex.get(coordKey(neighbor)))
        .some(neighbor => neighbor && neighbor.terrain !== 'water');
      return hasLandNeighbor ? count + 1 : count;
    }, 0);

  return {
    adjacentWaterTiles: adjacentWater.length,
    connectedBodySize,
    coastTilesWithinRadius,
  };
};

export const findPathToWater = (
  start: HexCoordinate,
  tileIndex: Map<string, Tile>,
  waterData: WaterBodyData,
  minBodySize: number
): Tile[] => {
  const visited = new Set<string>([coordKey(start)]);
  const queue: HexCoordinate[] = [start];
  const parent = new Map<string, string>();
  const maxDepth = MAP_GENERATION_CONSTANTS.WATER_REPAIR_SEARCH_RADIUS;

  while (queue.length > 0) {
    const current = queue.shift() as HexCoordinate;
    const currentKey = coordKey(current);
    const currentTile = tileIndex.get(currentKey);
    if (!currentTile) continue;

    const depth = hexDistance(start, current);
    if (depth > maxDepth) continue;

    if (currentTile.terrain === 'water') {
      const bodyId = waterData.bodyByCoord.get(currentKey);
      const bodySize = bodyId !== undefined ? (waterData.bodySizes[bodyId] ?? 0) : 0;
      if (bodySize < minBodySize) {
        continue;
      }
      const path: Tile[] = [];
      let walkerKey = currentKey;
      while (parent.has(walkerKey)) {
        const parentKey = parent.get(walkerKey) as string;
        const parentTile = tileIndex.get(parentKey);
        if (parentTile && parentTile.terrain !== 'water') {
          path.push(parentTile);
        }
        walkerKey = parentKey;
      }
      return path.reverse();
    }

    for (const neighbor of hexNeighbors(current)) {
      const neighborKey = coordKey(neighbor);
      if (visited.has(neighborKey)) continue;
      const neighborTile = tileIndex.get(neighborKey);
      if (!neighborTile) continue;
      if (neighborTile.hasCity || neighborTile.feature === 'village') continue;
      if (neighborTile.resources.length > 0 && neighborTile.terrain !== 'water') continue;
      visited.add(neighborKey);
      parent.set(neighborKey, currentKey);
      queue.push(neighbor);
    }
  }

  return [];
};
