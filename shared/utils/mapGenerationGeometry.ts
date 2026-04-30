import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { GameRuleHelpers } from '@shared/data/gameRules';
import { hexDistance, hexNeighbors } from './hex';
import type { LandmassData, PlacementContext } from './mapGenerationTypes';

export const coordKey = (coord: HexCoordinate): string => {
  return `${coord.q},${coord.r},${coord.s}`;
};

export const isWithinMap = (coord: HexCoordinate, mapRadius: number): boolean => {
  return Math.max(Math.abs(coord.q), Math.abs(coord.r), Math.abs(coord.s)) <= mapRadius;
};

export const buildTileIndex = (tiles: Tile[]): Map<string, Tile> => {
  const index = new Map<string, Tile>();
  tiles.forEach(tile => {
    index.set(coordKey(tile.coordinate), tile);
  });
  return index;
};

export const buildPlacementContext = (tiles: Tile[]): PlacementContext => {
  const cityPositions = tiles.filter(tile => tile.hasCity).map(tile => tile.coordinate);
  const villagePositions = tiles
    .filter(tile => tile.feature === 'village')
    .map(tile => tile.coordinate);

  return {
    cityPositions,
    villagePositions,
    cityKeys: new Set(cityPositions.map(coordKey)),
    villageKeys: new Set(villagePositions.map(coordKey)),
  };
};

export const addCityToContext = (coord: HexCoordinate, context: PlacementContext): void => {
  const key = coordKey(coord);
  if (!context.cityKeys.has(key)) {
    context.cityKeys.add(key);
    context.cityPositions.push(coord);
  }
};

export const addVillageToContext = (coord: HexCoordinate, context: PlacementContext): void => {
  const key = coordKey(coord);
  if (!context.villageKeys.has(key)) {
    context.villageKeys.add(key);
    context.villagePositions.push(coord);
  }
};

export const isTileOccupiedByCity = (tile: Tile, context: PlacementContext): boolean => {
  return context.cityKeys.has(coordKey(tile.coordinate));
};

export const isTileOccupiedByVillage = (tile: Tile, context: PlacementContext): boolean => {
  return context.villageKeys.has(coordKey(tile.coordinate));
};

export const minDistanceToPositions = (
  coord: HexCoordinate,
  positions: HexCoordinate[]
): number => {
  if (positions.length === 0) return Infinity;
  return Math.min(...positions.map(pos => hexDistance(coord, pos)));
};

export const minDistanceToCity = (coord: HexCoordinate, context: PlacementContext): number => {
  return minDistanceToPositions(coord, context.cityPositions);
};

export const minDistanceToVillage = (coord: HexCoordinate, context: PlacementContext): number => {
  return minDistanceToPositions(coord, context.villagePositions);
};

export const isEarlyPassable = (tile: Tile): boolean => {
  return GameRuleHelpers.isTerrainPassable(tile.terrain);
};

export const buildLandmassData = (tiles: Tile[]): LandmassData => {
  const tileIndex = buildTileIndex(tiles);
  const visited = new Set<string>();
  const massByCoord = new Map<string, number>();
  const massSizes: number[] = [];
  let massId = 0;

  for (const tile of tiles) {
    if (!isEarlyPassable(tile)) continue;
    const key = coordKey(tile.coordinate);
    if (visited.has(key)) continue;

    const queue: Tile[] = [tile];
    visited.add(key);
    let massSize = 0;

    while (queue.length > 0) {
      const current = queue.shift() as Tile;
      const currentKey = coordKey(current.coordinate);
      massByCoord.set(currentKey, massId);
      massSize += 1;

      for (const neighborCoord of hexNeighbors(current.coordinate)) {
        const neighborKey = coordKey(neighborCoord);
        if (visited.has(neighborKey)) continue;
        const neighbor = tileIndex.get(neighborKey);
        if (!neighbor || !isEarlyPassable(neighbor)) continue;
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }

    massSizes[massId] = massSize;
    massId += 1;
  }

  return { massByCoord, massSizes };
};

export const buildLandmassIndex = (tiles: Tile[]): Map<string, number> => {
  return buildLandmassData(tiles).massByCoord;
};
