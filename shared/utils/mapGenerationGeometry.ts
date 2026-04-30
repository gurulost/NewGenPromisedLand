import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { hexDistance } from './hex';
import type { PlacementContext } from './mapGenerationTypes';

export const coordKey = (coord: HexCoordinate): string => {
  return `${coord.q},${coord.r},${coord.s}`;
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
