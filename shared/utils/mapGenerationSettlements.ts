import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { hexDistance } from './hex';
import { MAP_GENERATION_CONSTANTS, type MapSize } from './mapGenerationConstants';
import {
  isTileOccupiedByCity,
  isTileOccupiedByVillage,
  minDistanceToCity,
  minDistanceToVillage,
} from './mapGenerationGeometry';
import type {
  PlacementContext,
  VillageCandidateEntry,
  VillageRejectionCounts,
  VillageRing,
  VillageRingBand,
  VillageRingBands,
  VillageSpacingOverrides,
} from './mapGenerationTypes';

interface RandomSource {
  next(): number;
}

export const getVillageRingBands = (mapSize: MapSize): VillageRingBands => {
  const offset = mapSize === 'tiny' || mapSize === 'small' ? -1 : mapSize === 'large' || mapSize === 'huge' ? 1 : 0;
  const minFromCity = MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY;

  const near: VillageRingBand = { min: 3 + offset, max: 5 + offset };
  const mid: VillageRingBand = { min: 6 + offset, max: 9 + offset };
  const far: VillageRingBand = { min: 10 + offset, max: 14 + offset };

  if (near.min < minFromCity) near.min = minFromCity;
  if (near.max < near.min) near.max = near.min;
  if (mid.min <= near.max) mid.min = near.max + 1;
  if (mid.max < mid.min) mid.max = mid.min;
  if (far.min <= mid.max) far.min = mid.max + 1;
  if (far.max < far.min) far.max = far.min;

  return { near, mid, far };
};

export const getVillageEarlyRadius = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.VILLAGE_EARLY_RADIUS_BY_SIZE[mapSize];
};

export const getVillageTargetEarlyMin = (): number => {
  return MAP_GENERATION_CONSTANTS.VILLAGE_TARGET_EARLY_MIN;
};

export const getVillageRing = (distance: number, bands: VillageRingBands): VillageRing | null => {
  if (distance >= bands.near.min && distance <= bands.near.max) return 'near';
  if (distance >= bands.mid.min && distance <= bands.mid.max) return 'mid';
  if (distance >= bands.far.min && distance <= bands.far.max) return 'far';
  return null;
};

export const pickVillageRing = (
  weights: Record<VillageRing, number>,
  rng: RandomSource
): VillageRing => {
  const total = weights.near + weights.mid + weights.far;
  const roll = rng.next() * total;
  if (roll < weights.near) return 'near';
  if (roll < weights.near + weights.mid) return 'mid';
  return 'far';
};

export const getNeutralCityWorkableMin = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_WORKABLE_MIN_BY_SIZE[mapSize];
};

export const getNeutralCityLandmassMin = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_MIN_LANDMASS_BY_SIZE[mapSize];
};

export const getNeutralCityEarlyRadius = (mapSize: MapSize): number => {
  return MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_EARLY_RADIUS_BY_SIZE[mapSize];
};

export const isValidVillageLocation = (
  tile: Tile,
  mapRadius: number,
  context: PlacementContext,
  diagnostics?: VillageRejectionCounts,
  overrides?: VillageSpacingOverrides
): boolean => {
  const minVillageDistance =
    overrides?.minVillageDistance ?? MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE;
  const minDistanceFromCity =
    overrides?.minDistanceFromCity ?? MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY;

  if (tile.terrain === 'water') {
    diagnostics && (diagnostics.water += 1);
    return false;
  }

  if (isTileOccupiedByCity(tile, context)) {
    diagnostics && (diagnostics.city += 1);
    return false;
  }

  if (isTileOccupiedByVillage(tile, context)) {
    diagnostics && (diagnostics.existingVillage += 1);
    return false;
  }

  const distanceFromCenter = hexDistance(tile.coordinate, { q: 0, r: 0, s: 0 });
  if (distanceFromCenter > mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER) {
    diagnostics && (diagnostics.edge += 1);
    return false;
  }

  const radialDistance = Math.hypot(tile.coordinate.q, tile.coordinate.r);
  const maxRadialDistance = mapRadius * MAP_GENERATION_CONSTANTS.VILLAGE_EDGE_RADIUS_RATIO;
  if (radialDistance > maxRadialDistance) {
    diagnostics && (diagnostics.edge += 1);
    return false;
  }

  if (minDistanceToVillage(tile.coordinate, context) < minVillageDistance) {
    diagnostics && (diagnostics.spacing += 1);
    return false;
  }

  if (minDistanceToCity(tile.coordinate, context) < minDistanceFromCity) {
    diagnostics && (diagnostics.cityDistance += 1);
    return false;
  }

  return true;
};

export const isVillageContested = (
  candidate: VillageCandidateEntry,
  bands: VillageRingBands
): boolean => {
  const inMid = candidate.nearestDistance >= bands.mid.min && candidate.nearestDistance <= bands.mid.max;
  if (!inMid) return false;
  return candidate.secondDistance <= bands.mid.max + 1;
};

export const scoreVillageCandidate = ({
  candidate,
  distanceToCapital,
  ring,
  bands,
  mapRadius,
  placedVillages,
  contestedTarget,
  contestedPlaced,
  earlyCounts,
  earlyRadius,
  capIndex,
  needsNear,
  ownershipPenalty,
  rng,
}: {
  candidate: VillageCandidateEntry;
  distanceToCapital: number;
  ring: VillageRing;
  bands: VillageRingBands;
  mapRadius: number;
  placedVillages: HexCoordinate[];
  contestedTarget: number;
  contestedPlaced: number;
  earlyCounts: number[];
  earlyRadius: number;
  capIndex: number;
  needsNear: boolean;
  ownershipPenalty: boolean;
  rng: RandomSource;
}): number => {
  const band = bands[ring];
  const center = (band.min + band.max) / 2;
  const span = Math.max(1, band.max - band.min + 1);
  const ringScore = 1 - Math.min(1, Math.abs(distanceToCapital - center) / span);

  let contestedScore = 0;
  if (isVillageContested(candidate, bands) && contestedTarget > 0) {
    const contestedSpan = Math.max(1, bands.mid.max - bands.mid.min + 1);
    const distanceBonus = Math.max(0, (bands.mid.max + 1 - candidate.secondDistance) / contestedSpan);
    const ramp = Math.max(
      0,
      Math.min(1, (contestedTarget - contestedPlaced) / contestedTarget)
    );
    contestedScore = distanceBonus * ramp;
  }

  const radialDistance = Math.hypot(candidate.tile.coordinate.q, candidate.tile.coordinate.r);
  const edgeRatio = Math.min(1, radialDistance / Math.max(1, mapRadius));
  const edgePenalty = edgeRatio > 0.75 ? (edgeRatio - 0.75) / 0.25 : 0;

  let clusterPenalty = 0;
  if (placedVillages.length > 0) {
    const nearest = Math.min(...placedVillages.map(pos => hexDistance(pos, candidate.tile.coordinate)));
    const clusterRadius = MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE + 1;
    if (nearest <= clusterRadius) {
      clusterPenalty = 1 - nearest / clusterRadius;
    }
  }

  let earlyPenalty = 0;
  if (distanceToCapital <= earlyRadius && earlyCounts.length > 0) {
    const currentMin = Math.min(...earlyCounts);
    const currentMax = Math.max(...earlyCounts);
    const currentSpread = currentMax - currentMin;
    if (!needsNear && currentSpread >= 3 && earlyCounts[capIndex] > currentMin) {
      return -Infinity;
    }

    const projected = earlyCounts.map((count, index) =>
      candidate.distances[index] <= earlyRadius ? count + 1 : count
    );
    const minProjected = Math.min(...projected);
    const maxProjected = Math.max(...projected);
    const surplus = projected[capIndex] - minProjected;
    if (surplus > 0) {
      earlyPenalty += surplus;
    }
    const spread = maxProjected - minProjected;
    if (spread > 3) {
      earlyPenalty += (spread - 3) * 2;
    }
    if (currentSpread >= 3) {
      earlyPenalty += 2;
    }
  }

  const ownershipPenaltyValue = ownershipPenalty ? 0.4 : 0;

  return (
    ringScore * 1.2 +
    contestedScore * 0.8 -
    edgePenalty * 0.4 -
    clusterPenalty * 0.5 -
    earlyPenalty * 1.6 -
    ownershipPenaltyValue +
    rng.next() * 0.05
  );
};
