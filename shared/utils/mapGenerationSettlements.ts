import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import { GameRuleHelpers } from '@shared/data/gameRules';
import { hexDistance, hexNeighbors, hexesInRange } from './hex';
import { MAP_GENERATION_CONSTANTS, type MapSize } from './mapGenerationConstants';
import { DEBUG_MAP_GENERATOR, debugMapGeneratorLog } from './mapGenerationDiagnostics';
import {
  addCityToContext,
  addVillageToContext,
  buildLandmassData,
  buildLandmassIndex,
  buildPlacementContext,
  buildTileIndex,
  coordKey,
  isTileOccupiedByCity,
  isTileOccupiedByVillage,
  minDistanceToCity,
  minDistanceToVillage,
} from './mapGenerationGeometry';
import type {
  NeutralCityRejectionCounts,
  PlacementContext,
  VillageCandidateAssignment,
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

export const placeNeutralCities = ({
  tiles,
  mapRadius,
  capitalPositions,
  mapSize,
  playerCount,
  rng,
  diagnostics,
}: {
  tiles: Tile[];
  mapRadius: number;
  capitalPositions: HexCoordinate[];
  mapSize: MapSize;
  playerCount: number;
  rng: RandomSource;
  diagnostics?: NeutralCityRejectionCounts;
}): void => {
  if (capitalPositions.length === 0) return;
  const additionalCities = Math.max(2, Math.floor(playerCount * 0.5));
  if (additionalCities <= 0) return;

  const placementContext = buildPlacementContext(tiles);
  const landmassData = buildLandmassData(tiles);
  const capitalLandmass = capitalPositions.map(cap =>
    landmassData.massByCoord.get(coordKey(cap))
  );
  const minLandNeighbors = MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_MIN_LAND_NEIGHBORS;
  const minWorkable = getNeutralCityWorkableMin(mapSize);
  const minLandmass = getNeutralCityLandmassMin(mapSize);
  const earlyRadius = getNeutralCityEarlyRadius(mapSize);
  const ringBands = getVillageRingBands(mapSize);
  const minDistanceFromCapital = ringBands.near.max + 1;

  const tileIndex = buildTileIndex(tiles);
  const workableCountByKey = new Map<string, number>();

  for (const tile of tiles) {
    const key = coordKey(tile.coordinate);
    let workableCount = 0;
    for (const coord of hexesInRange(tile.coordinate, 2)) {
      const neighbor = tileIndex.get(coordKey(coord));
      if (!neighbor) continue;
      if (!GameRuleHelpers.isTerrainPassable(neighbor.terrain)) continue;
      workableCount += 1;
    }
    workableCountByKey.set(key, workableCount);
  }

  const candidates = tiles
    .filter(tile =>
      !isTileOccupiedByCity(tile, placementContext) &&
      !isTileOccupiedByVillage(tile, placementContext) &&
      tile.terrain !== 'water'
    )
    .map(tile => {
      const landmassId = landmassData.massByCoord.get(coordKey(tile.coordinate));
      const landmassSize = landmassId !== undefined ? landmassData.massSizes[landmassId] ?? 0 : 0;
      if (landmassSize < minLandmass) {
        diagnostics && (diagnostics.landmassTooSmall += 1);
        return null;
      }

      const landNeighbors = hexNeighbors(tile.coordinate)
        .map(coord => tileIndex.get(coordKey(coord)))
        .filter((neighbor): neighbor is Tile => !!neighbor && neighbor.terrain !== 'water').length;
      if (landNeighbors < minLandNeighbors) {
        diagnostics && (diagnostics.landNeighbors += 1);
        return null;
      }

      const workableCount = workableCountByKey.get(coordKey(tile.coordinate)) ?? 0;
      if (workableCount < minWorkable) {
        diagnostics && (diagnostics.workableTiles += 1);
        return null;
      }

      const distances = capitalPositions.map(cap => hexDistance(tile.coordinate, cap));
      const nearestDistance = Math.min(...distances);
      const radialDistance = Math.hypot(tile.coordinate.q, tile.coordinate.r);
      const mountainNeighbors = hexNeighbors(tile.coordinate)
        .map(coord => tileIndex.get(coordKey(coord)))
        .filter((neighbor): neighbor is Tile => !!neighbor && neighbor.terrain === 'mountain').length;

      return {
        tile,
        landmassId,
        distances,
        nearestDistance,
        radialDistance,
        workableCount,
        landNeighbors,
        mountainNeighbors,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  if (candidates.length === 0) return;

  const nonNearCandidates = candidates.filter(entry => entry.nearestDistance >= minDistanceFromCapital);
  const earlyCounts = new Array(capitalPositions.length).fill(0);

  const updateEarlyCounts = (coord: HexCoordinate, candidateLandmass?: number) => {
    capitalPositions.forEach((capital, index) => {
      const distance = hexDistance(coord, capital);
      if (distance > earlyRadius) return;
      const capLandmass = capitalLandmass[index];
      if (candidateLandmass !== undefined && capLandmass !== undefined) {
        if (candidateLandmass !== capLandmass) return;
      }
      earlyCounts[index] += 1;
    });
  };

  const scoreCandidate = (entry: typeof candidates[number], allowNear: boolean) => {
    if (!allowNear && entry.nearestDistance < minDistanceFromCapital) return -Infinity;

    const relevantCapitals = entry.landmassId !== undefined
      ? capitalLandmass
          .map((landmass, index) => (landmass === entry.landmassId ? index : -1))
          .filter(index => index >= 0)
      : capitalPositions.map((_, index) => index);
    const minEarly = relevantCapitals.length > 0
      ? Math.min(...relevantCapitals.map(index => earlyCounts[index]))
      : Math.min(...earlyCounts);
    const affectedCapitals = entry.distances
      .map((distance, index) => ({ distance, index }))
      .filter(item => {
        if (item.distance > earlyRadius) return false;
        const capLandmass = capitalLandmass[item.index];
        if (entry.landmassId !== undefined && capLandmass !== undefined) {
          return entry.landmassId === capLandmass;
        }
        return true;
      })
      .map(item => item.index);

    const fairnessPenalty = affectedCapitals.length === 0
      ? 0
      : affectedCapitals.reduce((sum, index) => {
        return sum + Math.max(0, earlyCounts[index] - minEarly);
      }, 0) / affectedCapitals.length;

    const projectedCounts = relevantCapitals.map(index =>
      affectedCapitals.includes(index) ? earlyCounts[index] + 1 : earlyCounts[index]
    );
    const projectedSpread = projectedCounts.length > 0
      ? Math.max(...projectedCounts) - Math.min(...projectedCounts)
      : 0;
    const spreadPenalty = projectedSpread > 1 ? projectedSpread - 1 : 0;

    const ring = getVillageRing(entry.nearestDistance, ringBands);
    const distanceScore = ring === 'mid' ? 1 : ring === 'far' ? 0.6 : -0.4;

    const earlyPenalty = entry.nearestDistance <= earlyRadius
      ? 1 - entry.nearestDistance / Math.max(1, earlyRadius)
      : 0;

    const radialRatio = Math.min(1, entry.radialDistance / Math.max(1, mapRadius));
    const edgePenalty = radialRatio > 0.75 ? (radialRatio - 0.75) / 0.25 : 0;

    const mountainPenalty = entry.mountainNeighbors * 0.15;

    const qualityScore = entry.workableCount * 0.4 + entry.landNeighbors * 0.6;

    return (
      qualityScore +
      distanceScore -
      fairnessPenalty * 0.8 -
      spreadPenalty * 1.2 -
      earlyPenalty * 1.2 -
      edgePenalty * 0.5 -
      mountainPenalty +
      rng.next() * 0.05
    );
  };

  const isValidNeutralLocation = (entry: typeof candidates[number]) => {
    if (
      isTileOccupiedByCity(entry.tile, placementContext) ||
      isTileOccupiedByVillage(entry.tile, placementContext) ||
      entry.tile.terrain === 'water'
    ) {
      return false;
    }
    const blocked = minDistanceToCity(entry.tile.coordinate, placementContext)
      < MAP_GENERATION_CONSTANTS.CITY_MIN_DISTANCE;
    if (blocked && diagnostics) {
      diagnostics.spacing += 1;
    }
    return !blocked;
  };

  let placed = 0;
  const maxAttempts = MAP_GENERATION_CONSTANTS.MAX_ATTEMPTS_PER_GUARANTEE;
  let usedNearFallback = false;

  const runPlacement = (pool: typeof candidates, allowNear: boolean) => {
    if (pool.length === 0) return;
    let attempts = 0;

    while (placed < additionalCities && attempts < maxAttempts) {
      attempts += 1;
      const sampleCount = Math.min(MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_BEST_OF_K, pool.length);
      let best: typeof candidates[number] | null = null;
      let bestScore = -Infinity;

      for (let i = 0; i < sampleCount; i++) {
        const pick = pool[Math.floor(rng.next() * pool.length)];
        if (!isValidNeutralLocation(pick)) continue;
        const score = scoreCandidate(pick, allowNear);
        if (score > bestScore) {
          bestScore = score;
          best = pick;
        }
      }

      if (!best) {
        for (const entry of pool) {
          if (!isValidNeutralLocation(entry)) continue;
          const score = scoreCandidate(entry, allowNear);
          if (score > bestScore) {
            bestScore = score;
            best = entry;
          }
        }
      }

      if (!best) break;

      best.tile.hasCity = true;
      addCityToContext(best.tile.coordinate, placementContext);
      updateEarlyCounts(best.tile.coordinate, best.landmassId);
      placed += 1;
    }
  };

  runPlacement(nonNearCandidates, false);
  if (placed < additionalCities) {
    usedNearFallback = true;
    runPlacement(candidates, true);
  }

  if (DEBUG_MAP_GENERATOR) {
    const earlyMin = Math.min(...earlyCounts);
    const earlyMax = Math.max(...earlyCounts);
    if (usedNearFallback) {
      debugMapGeneratorLog?.('Neutral cities: near-ring fallback enabled to reach target count.');
    }
    debugMapGeneratorLog?.(
      `Neutral cities: placed ${placed}/${additionalCities}, early spread ${earlyMin}-${earlyMax}`
    );
  }
};

export const ensureCapitalExpansionVillage = ({
  tiles,
  mapRadius,
  capitalPositions,
  mapSize,
  rng,
  guaranteeRelaxed,
  guaranteeFailed,
}: {
  tiles: Tile[];
  mapRadius: number;
  capitalPositions: HexCoordinate[];
  mapSize: MapSize;
  rng: RandomSource;
  guaranteeRelaxed: number[];
  guaranteeFailed: number[];
}): void => {
  const ringBands = getVillageRingBands(mapSize);
  const minDist = Math.max(
    MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY,
    ringBands.near.min
  );
  const maxDist = ringBands.near.max;
  const relaxedMinVillageDistance = Math.max(
    1,
    MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE - MAP_GENERATION_CONSTANTS.MAX_SPACING_RELAX
  );
  const relaxedMinDistanceFromCity = Math.max(
    1,
    MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY - MAP_GENERATION_CONSTANTS.MAX_SPACING_RELAX
  );
  const placementContext = buildPlacementContext(tiles);
  const villagePositions = placementContext.villagePositions;
  const landmassIndex = buildLandmassIndex(tiles);

  for (let i = 0; i < capitalPositions.length; i++) {
    const capital = capitalPositions[i];
    const capitalLandmass = landmassIndex.get(coordKey(capital));
    const hasVillage = villagePositions.some(village => {
      const dist = hexDistance(village, capital);
      if (capitalLandmass !== undefined) {
        const villageLandmass = landmassIndex.get(coordKey(village));
        if (villageLandmass !== capitalLandmass) return false;
      }
      return dist >= minDist && dist <= maxDist;
    });
    if (hasVillage) continue;

    const buildCandidates = (overrides?: VillageSpacingOverrides) => tiles.filter(tile => {
      const dist = hexDistance(tile.coordinate, capital);
      if (dist < minDist || dist > maxDist) return false;
      if (tile.terrain === 'water') return false;
      if (tile.hasCity || tile.feature === 'village') return false;
      if (capitalLandmass !== undefined) {
        const tileLandmass = landmassIndex.get(coordKey(tile.coordinate));
        if (tileLandmass !== capitalLandmass) return false;
      }
      return isValidVillageLocation(tile, mapRadius, placementContext, undefined, overrides);
    });

    let candidates = buildCandidates();
    let relaxed = false;

    if (candidates.length === 0) {
      candidates = buildCandidates({
        minVillageDistance: relaxedMinVillageDistance,
        minDistanceFromCity: relaxedMinDistanceFromCity,
      });
      if (candidates.length > 0) {
        relaxed = true;
      }
    }

    if (candidates.length === 0) {
      guaranteeFailed[i] += 1;
      continue;
    }

    if (relaxed) {
      guaranteeRelaxed[i] += 1;
    }

    const pick = candidates[Math.floor(rng.next() * candidates.length)];
    pick.feature = 'village';
    addVillageToContext(pick.coordinate, placementContext);
  }
};

export const placeVillages = ({
  tiles,
  mapRadius,
  capitalPositions,
  mapSize,
  rng,
  diagnostics,
}: {
  tiles: Tile[];
  mapRadius: number;
  capitalPositions: HexCoordinate[];
  mapSize: MapSize;
  rng: RandomSource;
  diagnostics?: VillageRejectionCounts;
}): void => {
  if (capitalPositions.length === 0) return;

  const placementContext = buildPlacementContext(tiles);
  const placedVillages = placementContext.villagePositions;
  const ringBands = getVillageRingBands(mapSize);
  const earlyRadius = getVillageEarlyRadius(mapSize);
  const targetEarlyMin = getVillageTargetEarlyMin();

  const maxVillages = Math.floor(tiles.length / MAP_GENERATION_CONSTANTS.VILLAGE_DENSITY_RATIO);
  const targetTotal = Math.max(0, maxVillages);
  const targetPlacements = Math.max(0, targetTotal - placedVillages.length);
  if (targetPlacements <= 0) {
    debugMapGeneratorLog?.(`Villages: placed ${placedVillages.length}/${targetTotal}, no additional placement needed`);
    return;
  }

  const landmassIndex = buildLandmassIndex(tiles);
  const capitalLandmass = capitalPositions.map(cap => landmassIndex.get(coordKey(cap)));

  const baseCandidates = tiles.filter(tile =>
    isValidVillageLocation(tile, mapRadius, placementContext, diagnostics)
  );

  const candidateEntries: VillageCandidateEntry[] = baseCandidates.map(tile => {
    const distances = capitalPositions.map(cap => hexDistance(tile.coordinate, cap));
    const sorted = [...distances].sort((a, b) => a - b);
    const nearestDistance = sorted[0] ?? Infinity;
    const secondDistance = sorted[1] ?? Infinity;
    return {
      tile,
      distances,
      nearestDistance,
      secondDistance,
    };
  });

  const pools = capitalPositions.map(() => ({
    near: [] as VillageCandidateAssignment[],
    mid: [] as VillageCandidateAssignment[],
    far: [] as VillageCandidateAssignment[],
  }));
  const fallbackPools = capitalPositions.map(() => ({
    near: [] as VillageCandidateAssignment[],
    mid: [] as VillageCandidateAssignment[],
    far: [] as VillageCandidateAssignment[],
  }));

  candidateEntries.forEach(entry => {
    const nearestDistance = entry.nearestDistance;
    const nearestIndices = entry.distances
      .map((distance, index) => ({ distance, index }))
      .filter(item => item.distance === nearestDistance)
      .map(item => item.index);

    for (const capIndex of nearestIndices) {
      const capitalLand = capitalLandmass[capIndex];
      if (capitalLand !== undefined) {
        const tileLand = landmassIndex.get(coordKey(entry.tile.coordinate));
        if (tileLand !== capitalLand) continue;
      }

      const distanceToCapital = entry.distances[capIndex];
      const ring = getVillageRing(distanceToCapital, ringBands);
      if (!ring) continue;

      pools[capIndex][ring].push({
        entry,
        distanceToCapital,
        ring,
      });
    }

    for (let capIndex = 0; capIndex < capitalPositions.length; capIndex++) {
      const capitalLand = capitalLandmass[capIndex];
      if (capitalLand !== undefined) {
        const tileLand = landmassIndex.get(coordKey(entry.tile.coordinate));
        if (tileLand !== capitalLand) continue;
      }

      const distanceToCapital = entry.distances[capIndex];
      const ring = getVillageRing(distanceToCapital, ringBands);
      if (!ring) continue;

      fallbackPools[capIndex][ring].push({
        entry,
        distanceToCapital,
        ring,
      });
    }
  });

  const assignedCount = new Array(capitalPositions.length).fill(0);
  const earlyCount = new Array(capitalPositions.length).fill(0);
  const ringCount = capitalPositions.map(() => ({ near: 0, mid: 0, far: 0 }));
  let contestedPlaced = 0;
  const contestedTarget = Math.max(
    0,
    Math.round(targetTotal * MAP_GENERATION_CONSTANTS.VILLAGE_CONTESTED_TARGET_RATIO)
  );

  const updateVillageCounts = (coord: HexCoordinate) => {
    const villageLandmass = landmassIndex.get(coordKey(coord));
    capitalPositions.forEach((capital, index) => {
      const capLandmass = capitalLandmass[index];
      if (capLandmass !== undefined && villageLandmass !== undefined && capLandmass !== villageLandmass) {
        return;
      }
      const distance = hexDistance(coord, capital);
      if (distance <= earlyRadius) {
        earlyCount[index] += 1;
      }
      const ring = getVillageRing(distance, ringBands);
      if (ring) {
        ringCount[index][ring] += 1;
      }
    });
  };

  placedVillages.forEach(coord => {
    updateVillageCounts(coord);
    let bestIndex = -1;
    let bestDistance = Infinity;
    let tieCount = 0;
    for (let i = 0; i < capitalPositions.length; i++) {
      const distance = hexDistance(coord, capitalPositions[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
        tieCount = 1;
      } else if (distance === bestDistance) {
        tieCount += 1;
        if (rng.next() < 1 / tieCount) {
          bestIndex = i;
        }
      }
    }
    if (bestIndex >= 0) {
      assignedCount[bestIndex] += 1;
    }
  });

  const commitVillage = (
    candidate: VillageCandidateAssignment,
    capIndex: number
  ) => {
    candidate.entry.tile.feature = 'village';
    addVillageToContext(candidate.entry.tile.coordinate, placementContext);
    assignedCount[capIndex] += 1;
    updateVillageCounts(candidate.entry.tile.coordinate);
    if (isVillageContested(candidate.entry, ringBands)) {
      contestedPlaced += 1;
    }
  };

  const pickBestCandidate = (
    capIndex: number,
    ring: VillageRing,
    allowOwnershipPenalty: boolean,
    needsNear: boolean
  ): VillageCandidateAssignment | null => {
    const pool = allowOwnershipPenalty ? fallbackPools[capIndex][ring] : pools[capIndex][ring];
    if (pool.length === 0) return null;

    const sampleCount = Math.min(MAP_GENERATION_CONSTANTS.VILLAGE_BEST_OF_K, pool.length);
    let best: VillageCandidateAssignment | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < sampleCount; i++) {
      const pick = pool[Math.floor(rng.next() * pool.length)];
      if (!isValidVillageLocation(pick.entry.tile, mapRadius, placementContext)) {
        continue;
      }

      const isOwnershipPenalty =
        allowOwnershipPenalty && pick.distanceToCapital > pick.entry.nearestDistance;
      const score = scoreVillageCandidate({
        candidate: pick.entry,
        distanceToCapital: pick.distanceToCapital,
        ring,
        bands: ringBands,
        mapRadius,
        placedVillages,
        contestedTarget,
        contestedPlaced,
        earlyCounts: earlyCount,
        earlyRadius,
        capIndex,
        needsNear,
        ownershipPenalty: isOwnershipPenalty,
        rng,
      });

      if (score > bestScore) {
        bestScore = score;
        best = pick;
      }
    }

    if (!best) {
      for (const pick of pool) {
        if (!isValidVillageLocation(pick.entry.tile, mapRadius, placementContext)) {
          continue;
        }

        const isOwnershipPenalty =
          allowOwnershipPenalty && pick.distanceToCapital > pick.entry.nearestDistance;
        const score = scoreVillageCandidate({
          candidate: pick.entry,
          distanceToCapital: pick.distanceToCapital,
          ring,
          bands: ringBands,
          mapRadius,
          placedVillages,
          contestedTarget,
          contestedPlaced,
          earlyCounts: earlyCount,
          earlyRadius,
          capIndex,
          needsNear,
          ownershipPenalty: isOwnershipPenalty,
          rng,
        });
        if (score > bestScore) {
          bestScore = score;
          best = pick;
        }
      }
    }

    return best;
  };

  const tryPlaceWithRings = (
    capIndex: number,
    ringOrder: VillageRing[],
    allowOwnershipPenalty: boolean,
    needsNear: boolean
  ): boolean => {
    for (const ring of ringOrder) {
      const candidate = pickBestCandidate(capIndex, ring, allowOwnershipPenalty, needsNear);
      if (candidate) {
        commitVillage(candidate, capIndex);
        return true;
      }
    }
    return false;
  };

  for (let capIndex = 0; capIndex < capitalPositions.length; capIndex++) {
    if (placedVillages.length >= targetTotal) break;
    const needsNear = earlyCount[capIndex] < targetEarlyMin;
    const ringOrder: VillageRing[] = earlyCount[capIndex] > Math.min(...earlyCount)
      ? ['far', 'mid']
      : ['mid', 'far'];
    const placed = tryPlaceWithRings(capIndex, ringOrder, false, needsNear);
    if (!placed) {
      tryPlaceWithRings(capIndex, ['far'], true, needsNear);
    }
  }

  let attempts = 0;
  const maxAttempts = tiles.length * 3;

  while (placedVillages.length < targetTotal && attempts < maxAttempts) {
    attempts += 1;

    const sortedCapitals = assignedCount
      .map((count, index) => ({
        count,
        early: earlyCount[index],
        index,
        order: rng.next(),
      }))
      .sort((a, b) => (a.early - b.early) || (a.count - b.count) || (a.order - b.order));

    let placed = false;
    for (const { index: capIndex } of sortedCapitals) {
      const needsNear = earlyCount[capIndex] < targetEarlyMin;
      const minEarly = Math.min(...earlyCount);
      const earlyLead = earlyCount[capIndex] - minEarly;
      const ringWeights = needsNear
        ? { near: 0.4, mid: 0.4, far: 0.2 }
        : earlyLead >= 2
          ? { near: 0, mid: 0.25, far: 0.75 }
          : earlyLead === 1
            ? { near: 0, mid: 0.5, far: 0.5 }
            : { near: 0, mid: 0.75, far: 0.25 };

      const ring = pickVillageRing(ringWeights, rng);
      const ringOrder: VillageRing[] = [ring];
      if (ring !== 'mid') ringOrder.push('mid');
      if (ring !== 'far') ringOrder.push('far');
      if (needsNear && ring !== 'near') ringOrder.push('near');

      placed = tryPlaceWithRings(capIndex, ringOrder, false, needsNear);
      if (!placed) {
        placed = tryPlaceWithRings(capIndex, ringOrder, true, needsNear);
      }

      if (placed) break;
    }

    if (!placed) break;
  }

  if (DEBUG_MAP_GENERATOR) {
    const earlyMin = Math.min(...earlyCount);
    const earlyMax = Math.max(...earlyCount);
    const ringSummary = ringCount
      .map((counts, index) => `P${index + 1} N${counts.near}/M${counts.mid}/F${counts.far}`)
      .join(' | ');
    debugMapGeneratorLog?.(
      `Villages: placed ${placedVillages.length}/${targetTotal}, contested ${contestedPlaced}/${contestedTarget}, early spread ${earlyMin}-${earlyMax}`
    );
    if (ringSummary) {
      debugMapGeneratorLog?.(`Villages: ring counts ${ringSummary}`);
    }
  }
};
