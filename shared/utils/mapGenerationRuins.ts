import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { hexDistance } from './hex';
import { MAP_GENERATION_CONSTANTS } from './mapGenerationConstants';
import { debugMapGeneratorLog } from './mapGenerationDiagnostics';
import {
  buildPlacementContext,
  isTileOccupiedByCity,
  isTileOccupiedByVillage,
  minDistanceToCity,
  minDistanceToVillage,
} from './mapGenerationGeometry';
import type { RandomSource } from './mapGenerationRandom';

export const placeRuinsStrategically = ({
  tiles,
  capitalPositions,
  rng,
}: {
  tiles: Tile[];
  capitalPositions: HexCoordinate[];
  rng: RandomSource;
}): void => {
  if (capitalPositions.length === 0) return;

  const placementContext = buildPlacementContext(tiles);
  const minDistanceFromCity = MAP_GENERATION_CONSTANTS.RUINS_MIN_DISTANCE_FROM_CITY;

  const ruinPools = capitalPositions.map(() => ({
    near: [] as Tile[],
    mid: [] as Tile[],
    far: [] as Tile[],
  }));

  for (const tile of tiles) {
    if (tile.terrain === 'water') continue;
    if (isTileOccupiedByCity(tile, placementContext)) continue;
    if (isTileOccupiedByVillage(tile, placementContext)) continue;
    if (tile.resources.length > 0) continue;

    const { index, distance } = getNearestCapital(tile.coordinate, capitalPositions);
    if (index < 0) continue;
    if (distance < MAP_GENERATION_CONSTANTS.RUINS_NEAR_MIN_DISTANCE) continue;

    if (minDistanceToCity(tile.coordinate, placementContext) < minDistanceFromCity) continue;
    if (minDistanceToVillage(tile.coordinate, placementContext) < minDistanceFromCity) continue;

    const zone =
      distance <= MAP_GENERATION_CONSTANTS.RUINS_NEAR_MAX_DISTANCE
        ? 'near'
        : distance <= MAP_GENERATION_CONSTANTS.RUINS_MID_MAX_DISTANCE
          ? 'mid'
          : 'far';

    ruinPools[index][zone].push(tile);
  }

  const totalTarget = getRuinsTargetCount(tiles.length, capitalPositions.length);
  const ruinsPlaced: HexCoordinate[] = [];
  const ruinCounts = new Array(capitalPositions.length).fill(0);

  const placeFromPool = (playerIndex: number, zones: Array<'near' | 'mid' | 'far'>): boolean => {
    for (const zone of zones) {
      const candidate = pickRuinCandidate(ruinPools[playerIndex][zone], ruinsPlaced, rng);
      if (!candidate) continue;
      candidate.resources.push('jaredite_ruins');
      ruinsPlaced.push(candidate.coordinate);
      ruinCounts[playerIndex] += 1;
      return true;
    }
    return false;
  };

  for (let i = 0; i < capitalPositions.length; i++) {
    placeFromPool(i, ['near', 'mid', 'far']);
  }

  let remaining = totalTarget - ruinsPlaced.length;
  while (remaining > 0) {
    const orderedPlayers = ruinCounts
      .map((count, index) => ({ count, index }))
      .sort((a, b) => a.count - b.count);

    let placed = false;
    const zoneBias: Array<'near' | 'mid' | 'far'> =
      rng.next() < 0.7 ? ['mid', 'far', 'near'] : ['far', 'mid', 'near'];

    for (const { index } of orderedPlayers) {
      if (placeFromPool(index, zoneBias)) {
        placed = true;
        break;
      }
    }

    if (!placed) break;
    remaining -= 1;
  }

  if (ruinsPlaced.length < totalTarget) {
    debugMapGeneratorLog?.(`Ruins placement capped at ${ruinsPlaced.length}/${totalTarget} due to spacing constraints.`);
  }
};

export const getRuinsTargetCount = (tileCount: number, playerCount: number): number => {
  const densityTarget = Math.round(tileCount * MAP_GENERATION_CONSTANTS.RUINS_DENSITY);
  return Math.max(playerCount + 1, densityTarget);
};

export const getNearestCapital = (
  coord: HexCoordinate,
  capitalPositions: HexCoordinate[]
): { index: number; distance: number } => {
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < capitalPositions.length; i++) {
    const distance = hexDistance(coord, capitalPositions[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distance: bestDistance };
};

const pickRuinCandidate = (
  candidates: Tile[],
  ruinsPlaced: HexCoordinate[],
  rng: RandomSource
): Tile | null => {
  const minDistance = MAP_GENERATION_CONSTANTS.RUINS_MIN_DISTANCE;
  const viable = candidates.filter(tile => {
    if (tile.resources.length > 0) return false;
    return ruinsPlaced.every(existing => hexDistance(tile.coordinate, existing) >= minDistance);
  });

  if (viable.length === 0) return null;

  const weights = viable.map(tile => {
    if (tile.terrain === 'mountain') return MAP_GENERATION_CONSTANTS.RUINS_MOUNTAIN_WEIGHT;
    if (tile.terrain === 'forest') return MAP_GENERATION_CONSTANTS.RUINS_FOREST_WEIGHT;
    return 1;
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let roll = rng.next() * totalWeight;
  for (let i = 0; i < viable.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return viable[i];
  }
  return viable[viable.length - 1];
};
