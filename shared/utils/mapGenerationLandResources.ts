import type { HexCoordinate } from '@shared/types/coordinates';
import type { TerrainType, Tile } from '@shared/types/game';
import { hexDistance, hexesInRange } from './hex';
import { MAP_GENERATION_CONSTANTS } from './mapGenerationConstants';
import { DEBUG_MAP_GENERATOR, debugMapGeneratorLog } from './mapGenerationDiagnostics';
import {
  buildPlacementContext,
  buildTileIndex,
  coordKey,
  isTileOccupiedByCity,
  isTileOccupiedByVillage,
  minDistanceToCity,
} from './mapGenerationGeometry';
import type {
  LandResourceConstraintContext,
  LandResourceType,
  ResourceCandidate,
  ResourceSpawnRate,
} from './mapGenerationTypes';

interface RandomSource {
  next(): number;
  nextInt(min: number, max: number): number;
}

type ApplyTribalResourceModifiersForTile = (
  baseRates: ResourceSpawnRate,
  coord: HexCoordinate,
  capitalPositions: HexCoordinate[],
) => ResourceSpawnRate;

const LAND_RESOURCE_TYPES: LandResourceType[] = [
  'grain_patch',
  'wild_goats',
  'timber_grove',
  'ore_vein',
];

const LAND_RESOURCES_BY_TERRAIN: Record<TerrainType, LandResourceType[]> = {
  plains: ['grain_patch', 'wild_goats'],
  forest: ['timber_grove', 'wild_goats'],
  mountain: ['ore_vein'],
  water: [],
  desert: [],
  swamp: [],
};

export const isLandResourceType = (resource: string): resource is LandResourceType => {
  return LAND_RESOURCE_TYPES.includes(resource as LandResourceType);
};

export const getLandResourceCategory = (resource: LandResourceType): 'food' | 'prod' => {
  if (resource === 'grain_patch' || resource === 'wild_goats') return 'food';
  return 'prod';
};

export const placeResourcesStrategically = ({
  tiles,
  capitalPositions,
  minResourceDistance,
  maxResourcesPerPlayer,
  rng,
  applyTribalModifiersForTile,
}: {
  tiles: Tile[];
  capitalPositions: HexCoordinate[];
  minResourceDistance?: number;
  maxResourcesPerPlayer?: number;
  rng: RandomSource;
  applyTribalModifiersForTile: ApplyTribalResourceModifiersForTile;
}): LandResourceConstraintContext => {
  const placementContext = buildPlacementContext(tiles);
  const cityTiles = tiles.filter(tile => isTileOccupiedByCity(tile, placementContext));
  if (cityTiles.length === 0) {
    return buildLandResourceConstraintContext({
      tiles,
      capitalPositions,
      minResourceDistance,
      maxResourcesPerPlayer,
    });
  }

  const nearCityTiles = tiles.filter(tile => {
    if (isTileOccupiedByCity(tile, placementContext)) return false;
    if (tile.terrain === 'water') return false;
    if (isTileOccupiedByVillage(tile, placementContext)) return false;

    return minDistanceToCity(tile.coordinate, placementContext)
      <= MAP_GENERATION_CONSTANTS.OUTER_CITY_RADIUS;
  });

  const wildernessTiles = tiles.filter(tile => {
    if (isTileOccupiedByCity(tile, placementContext)) return false;
    if (tile.terrain === 'water') return false;
    if (isTileOccupiedByVillage(tile, placementContext)) return false;

    return minDistanceToCity(tile.coordinate, placementContext)
      >= MAP_GENERATION_CONSTANTS.WILDERNESS_MIN_DISTANCE;
  });

  const candidates: ResourceCandidate[] = [];

  nearCityTiles.forEach(tile => {
    const distanceToNearestCity = minDistanceToCity(tile.coordinate, placementContext);

    let spawnTable: ResourceSpawnRate;
    let zone: ResourceCandidate['zone'];
    if (distanceToNearestCity === MAP_GENERATION_CONSTANTS.INNER_CITY_RADIUS) {
      spawnTable = getInnerCitySpawnTable();
      zone = 'inner';
    } else {
      spawnTable = getOuterCitySpawnTable();
      zone = 'outer';
    }

    spawnTable = applyTribalModifiersForTile(spawnTable, tile.coordinate, capitalPositions);

    const resourceToSpawn = getResourceFromTable(spawnTable, tile.terrain, rng);
    if (resourceToSpawn && isLandResourceType(resourceToSpawn)) {
      candidates.push({
        tile,
        resource: resourceToSpawn,
        zone,
        distanceToNearestCity,
        order: rng.next(),
      });
    }
  });

  wildernessTiles.forEach(tile => {
    let wildernessSpawnTable = getWildernessSpawnTable();
    wildernessSpawnTable = applyTribalModifiersForTile(wildernessSpawnTable, tile.coordinate, capitalPositions);
    const resourceToSpawn = getResourceFromTable(wildernessSpawnTable, tile.terrain, rng);

    if (resourceToSpawn && isLandResourceType(resourceToSpawn)) {
      const distanceToNearestCity = minDistanceToCity(tile.coordinate, placementContext);
      candidates.push({
        tile,
        resource: resourceToSpawn,
        zone: 'wilderness',
        distanceToNearestCity,
        order: rng.next(),
      });
    }
  });

  const context = buildLandResourceConstraintContext({
    tiles,
    capitalPositions,
    minResourceDistance,
    maxResourcesPerPlayer,
  });
  const zonePriority: Record<ResourceCandidate['zone'], number> = {
    inner: 0,
    outer: 1,
    wilderness: 2,
  };

  candidates.sort((a, b) => {
    const zoneDelta = zonePriority[a.zone] - zonePriority[b.zone];
    if (zoneDelta !== 0) return zoneDelta;
    if (a.distanceToNearestCity !== b.distanceToNearestCity) {
      return a.distanceToNearestCity - b.distanceToNearestCity;
    }
    return a.order - b.order;
  });

  for (const candidate of candidates) {
    if (candidate.tile.resources.length > 0) continue;
    if (!isResourceTerrainCompatible(candidate.resource, candidate.tile.terrain)) continue;
    tryPlaceLandResourceCandidate(candidate, context, tiles, rng);
  }

  return context;
};

export const guaranteeCapitalHarvestOpportunities = ({
  tiles,
  capitalPositions,
  context,
  rng,
}: {
  tiles: Tile[];
  capitalPositions: HexCoordinate[];
  context: LandResourceConstraintContext;
  rng: RandomSource;
}): void => {
  const minimumGuarantee = MAP_GENERATION_CONSTANTS.MIN_HARVESTABLES_R2;
  const tileIndex = buildTileIndex(tiles);

  for (let capitalIndex = 0; capitalIndex < capitalPositions.length; capitalIndex++) {
    const capitalPos = capitalPositions[capitalIndex];
    const nearbyTiles = hexesInRange(capitalPos, 2)
      .map(coord => tileIndex.get(coordKey(coord)))
      .filter((tile): tile is Tile => !!tile && hexDistance(tile.coordinate, capitalPos) > 0);

    const upgradableTargets = nearbyTiles.filter(tile => {
      if (tile.hasCity) return false;
      if (tile.resources.length > 0) return false;
      if (tile.terrain === 'water') return false;
      if (tile.feature === 'village') return false;
      return true;
    });

    shuffleItems(upgradableTargets, rng);

    const guaranteeAdded = new Set<string>();

    const getSummary = () => {
      const harvestableTiles = nearbyTiles.filter(tile =>
        tile.resources.some(resource => isLandResourceType(resource))
      );
      const hasFood = harvestableTiles.some(tile =>
        tile.resources.some(resource =>
          isLandResourceType(resource) && getLandResourceCategory(resource) === 'food'
        )
      );
      const hasProd = harvestableTiles.some(tile =>
        tile.resources.some(resource =>
          isLandResourceType(resource) && getLandResourceCategory(resource) === 'prod'
        )
      );
      const entries = harvestableTiles.flatMap(tile =>
        tile.resources
          .filter(resource => isLandResourceType(resource))
          .map(resource => ({ tile, resource: resource as LandResourceType }))
      );
      return {
        total: harvestableTiles.length,
        hasFood,
        hasProd,
        entries,
      };
    };

    let summary = getSummary();

    const attemptPlacement = (minDistance: number, maxPerCapital: number): number => {
      let placed = 0;
      let needed = Math.max(0, minimumGuarantee - summary.total);
      if (needed <= 0) return 0;

      for (const tile of upgradableTargets) {
        if (placed >= needed) break;
        const preferredCategories: Array<'food' | 'prod'> = [];
        if (!summary.hasFood) preferredCategories.push('food');
        if (!summary.hasProd) preferredCategories.push('prod');

        let resourcesToTry: LandResourceType[] = [];
        for (const category of preferredCategories) {
          resourcesToTry.push(...getResourcesForCategory(category, tile.terrain));
        }

        if (resourcesToTry.length === 0) {
          const resourceChoice = pickGuaranteeResource(tile, rng);
          if (!resourceChoice) continue;
          resourcesToTry = [
            resourceChoice,
            ...getAlternativeResources(resourceChoice, tile.terrain),
          ];
        }

        const uniqueResources = Array.from(new Set(resourcesToTry));

        for (const resourceToAdd of uniqueResources) {
          if (!isResourceTerrainCompatible(resourceToAdd, tile.terrain)) continue;
          const capIndex = context.homeZoneByCoord.get(coordKey(tile.coordinate));
          const result = canPlaceLandResource(
            tile,
            resourceToAdd,
            context,
            capIndex,
            { minDistance, maxPerCapital }
          );
          if (result.ok) {
            commitLandResource(tile, resourceToAdd, context, capIndex);
            guaranteeAdded.add(coordKey(tile.coordinate));
            placed += 1;
            summary = getSummary();
            break;
          }
          recordLandResourceBlock(context, result.reason);
        }
      }

      return placed;
    };

    attemptPlacement(context.minDistance, context.maxPerCapital);

    let relaxedSpacing = false;
    const spacingRelaxed = Math.max(
      0,
      context.minDistance - MAP_GENERATION_CONSTANTS.MAX_SPACING_RELAX
    );
    if (summary.total < minimumGuarantee && spacingRelaxed !== context.minDistance) {
      const placed = attemptPlacement(spacingRelaxed, context.maxPerCapital);
      if (placed > 0) {
        relaxedSpacing = true;
      }
    }

    let relaxedCap = false;
    if (summary.total < minimumGuarantee) {
      const capOverage = context.maxPerCapital > 0
        ? context.maxPerCapital + MAP_GENERATION_CONSTANTS.MAX_CAP_OVERAGE_FOR_GUARANTEE
        : 0;
      if (capOverage !== context.maxPerCapital) {
        const placed = attemptPlacement(spacingRelaxed, capOverage);
        if (placed > 0) {
          relaxedCap = true;
        }
      }
    }

    summary = getSummary();

    let varietyExtraAdded = false;
    if (!summary.hasFood || !summary.hasProd) {
      const missingCategory: 'food' | 'prod' = summary.hasFood ? 'prod' : 'food';
      const overCategory: 'food' | 'prod' = summary.hasFood ? 'food' : 'prod';

      const convertCandidates = summary.entries
        .filter(entry => getLandResourceCategory(entry.resource) === overCategory)
        .sort((a, b) => {
          const aBoost = guaranteeAdded.has(coordKey(a.tile.coordinate)) ? 0 : 1;
          const bBoost = guaranteeAdded.has(coordKey(b.tile.coordinate)) ? 0 : 1;
          return aBoost - bBoost;
        });

      let converted = false;
      for (const entry of convertCandidates) {
        const newResource = pickCategoryResource(entry.tile, missingCategory, rng);
        if (!newResource) continue;

        const capIndex = context.homeZoneByCoord.get(coordKey(entry.tile.coordinate));
        if (!removeLandResource(entry.tile, entry.resource, context, capIndex)) continue;

        const result = canPlaceLandResource(
          entry.tile,
          newResource,
          context,
          capIndex,
          { minDistance: context.minDistance, maxPerCapital: context.maxPerCapital }
        );

        if (result.ok) {
          commitLandResource(entry.tile, newResource, context, capIndex);
          guaranteeAdded.add(coordKey(entry.tile.coordinate));
          converted = true;
          break;
        }

        recordLandResourceBlock(context, result.reason);
        commitLandResource(entry.tile, entry.resource, context, capIndex);
      }

      summary = getSummary();

      const emptyTargets = nearbyTiles.filter(tile => {
        if (tile.hasCity) return false;
        if (tile.resources.length > 0) return false;
        if (tile.terrain === 'water') return false;
        if (tile.feature === 'village') return false;
        return true;
      });

      const placeMissingCategory = (minDistance: number, maxPerCapital: number): boolean => {
        shuffleItems(emptyTargets, rng);
        for (const tile of emptyTargets) {
          const resourceToAdd = pickCategoryResource(tile, missingCategory, rng);
          if (!resourceToAdd) continue;
          const capIndex = context.homeZoneByCoord.get(coordKey(tile.coordinate));
          const result = canPlaceLandResource(
            tile,
            resourceToAdd,
            context,
            capIndex,
            { minDistance, maxPerCapital }
          );
          if (result.ok) {
            commitLandResource(tile, resourceToAdd, context, capIndex);
            guaranteeAdded.add(coordKey(tile.coordinate));
            return true;
          }
          recordLandResourceBlock(context, result.reason);
        }
        return false;
      };

      let swapped = converted;
      if (!swapped && (!summary.hasFood || !summary.hasProd)) {
        const removableEntries = summary.entries
          .filter(entry => getLandResourceCategory(entry.resource) === overCategory)
          .sort((a, b) => {
            const aBoost = guaranteeAdded.has(coordKey(a.tile.coordinate)) ? 0 : 1;
            const bBoost = guaranteeAdded.has(coordKey(b.tile.coordinate)) ? 0 : 1;
            return aBoost - bBoost;
          });

        const attemptSwap = (minDistance: number, maxPerCapital: number): boolean => {
          for (const entry of removableEntries) {
            const capIndex = context.homeZoneByCoord.get(coordKey(entry.tile.coordinate));
            if (!removeLandResource(entry.tile, entry.resource, context, capIndex)) continue;
            const placed = placeMissingCategory(minDistance, maxPerCapital);
            if (placed) {
              return true;
            }
            commitLandResource(entry.tile, entry.resource, context, capIndex);
          }
          return false;
        };

        const capOverage = context.maxPerCapital > 0
          ? context.maxPerCapital + MAP_GENERATION_CONSTANTS.MAX_CAP_OVERAGE_FOR_GUARANTEE
          : 0;
        swapped =
          attemptSwap(context.minDistance, context.maxPerCapital) ||
          attemptSwap(spacingRelaxed, context.maxPerCapital) ||
          attemptSwap(spacingRelaxed, capOverage);
      }

      summary = getSummary();

      if (!swapped && (!summary.hasFood || !summary.hasProd)) {
        const capOverage = context.maxPerCapital > 0
          ? context.maxPerCapital + MAP_GENERATION_CONSTANTS.MAX_CAP_OVERAGE_FOR_GUARANTEE
          : 0;
        const added =
          placeMissingCategory(context.minDistance, context.maxPerCapital) ||
          placeMissingCategory(spacingRelaxed, context.maxPerCapital) ||
          placeMissingCategory(spacingRelaxed, capOverage);
        if (added) {
          varietyExtraAdded = true;
        }
      }
    }

    if (relaxedSpacing) {
      context.debug.relaxSpacingUsed[capitalIndex] += 1;
    }
    if (relaxedCap) {
      context.debug.relaxCapUsed[capitalIndex] += 1;
    }
    if (varietyExtraAdded) {
      context.debug.varietyExtraGranted[capitalIndex] += 1;
    }
    if (varietyExtraAdded) {
      debugMapGeneratorLog?.(`Capital ${capitalIndex + 1}: variety required extra resource placement.`);
    }
  }
};

export const logLandResourcePlacementSummary = (context: LandResourceConstraintContext): void => {
  if (!DEBUG_MAP_GENERATOR) return;

  const debug = context.debug;
  const clampNote = debug.maxPerCapitalClamped ? ' (clamped)' : '';
  debugMapGeneratorLog?.(
    `Land resources: blocked spacing ${debug.blockedBySpacing}, cap ${debug.blockedByCap}${clampNote}, occupied ${debug.blockedByOccupied}, fallback ${debug.fallbackPlaced}`
  );

  const relaxedSpacing = debug.relaxSpacingUsed
    .map((count, index) => (count > 0 ? `P${index + 1}` : ''))
    .filter(Boolean)
    .join(', ');
  if (relaxedSpacing) {
    debugMapGeneratorLog?.(`Land resources: spacing relaxed for ${relaxedSpacing}`);
  }

  const relaxedCap = debug.relaxCapUsed
    .map((count, index) => (count > 0 ? `P${index + 1}` : ''))
    .filter(Boolean)
    .join(', ');
  if (relaxedCap) {
    debugMapGeneratorLog?.(`Land resources: cap relaxed for ${relaxedCap}`);
  }

  const homeCounts = context.homeCountByCapital
    .map((count, index) => `P${index + 1}=${count}`)
    .join(', ');
  if (homeCounts) {
    debugMapGeneratorLog?.(`Land resources: home-zone counts ${homeCounts}`);
  }
};

const buildLandResourceConstraintContext = ({
  tiles,
  capitalPositions,
  minResourceDistance,
  maxResourcesPerPlayer,
}: {
  tiles: Tile[];
  capitalPositions: HexCoordinate[];
  minResourceDistance?: number;
  maxResourcesPerPlayer?: number;
}): LandResourceConstraintContext => {
  const minDistance = Math.max(0, minResourceDistance ?? 0);
  let maxPerCapital = Math.max(0, maxResourcesPerPlayer ?? 0);
  const homeRadius = MAP_GENERATION_CONSTANTS.HOME_RADIUS_RESOURCES;
  const minimumGuarantee = MAP_GENERATION_CONSTANTS.MIN_HARVESTABLES_R2;

  let maxPerCapitalClamped = false;
  if (maxPerCapital > 0 && maxPerCapital < minimumGuarantee) {
    maxPerCapital = minimumGuarantee;
    maxPerCapitalClamped = true;
  }

  const homeZoneByCoord = new Map<string, number>();
  const homeCountByCapital = new Array(capitalPositions.length).fill(0);
  const tileIndex = buildTileIndex(tiles);
  const resourceCoordsByType = new Map<LandResourceType, HexCoordinate[]>(
    LAND_RESOURCE_TYPES.map(type => [type, []])
  );
  const occupiedCoords = new Set<string>();

  for (const tile of tiles) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    for (let index = 0; index < capitalPositions.length; index++) {
      const distance = hexDistance(tile.coordinate, capitalPositions[index]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestIndex >= 0 && nearestDistance <= homeRadius) {
      homeZoneByCoord.set(coordKey(tile.coordinate), nearestIndex);
    }
  }

  for (const tile of tiles) {
    let hasLandResource = false;
    for (const resource of tile.resources) {
      if (isLandResourceType(resource)) {
        const list = resourceCoordsByType.get(resource);
        if (list) {
          list.push(tile.coordinate);
        }
        hasLandResource = true;
      }
    }

    if (hasLandResource) {
      const key = coordKey(tile.coordinate);
      occupiedCoords.add(key);
      const capIndex = homeZoneByCoord.get(key);
      if (capIndex !== undefined) {
        homeCountByCapital[capIndex] += 1;
      }
    }
  }

  return {
    minDistance,
    maxPerCapital,
    homeRadius,
    homeZoneByCoord,
    homeCountByCapital,
    resourceCoordsByType,
    occupiedCoords,
    tileIndex,
    debug: {
      blockedBySpacing: 0,
      blockedByCap: 0,
      blockedByOccupied: 0,
      fallbackPlaced: 0,
      relaxSpacingUsed: new Array(capitalPositions.length).fill(0),
      relaxCapUsed: new Array(capitalPositions.length).fill(0),
      varietyExtraGranted: new Array(capitalPositions.length).fill(0),
      maxPerCapitalClamped,
    },
  };
};

const tryPlaceLandResourceCandidate = (
  candidate: ResourceCandidate,
  context: LandResourceConstraintContext,
  tiles: Tile[],
  rng: RandomSource
): boolean => {
  if (tryCommitLandResource(candidate.tile, candidate.resource, context, false)) return true;

  if (tryNearbyLandResource(candidate.tile, candidate.resource, context, tiles, rng)) return true;

  const alternatives = getAlternativeResources(candidate.resource, candidate.tile.terrain);
  for (const alternative of alternatives) {
    if (tryCommitLandResource(candidate.tile, alternative, context, true)) return true;
    if (tryNearbyLandResource(candidate.tile, alternative, context, tiles, rng)) return true;
  }

  return false;
};

const tryNearbyLandResource = (
  origin: Tile,
  resource: LandResourceType,
  context: LandResourceConstraintContext,
  tiles: Tile[],
  rng: RandomSource
): boolean => {
  for (const radius of [1, 2]) {
    const nearby = tiles.filter(tile => {
      const distance = hexDistance(tile.coordinate, origin.coordinate);
      return distance > radius - 1 && distance <= radius;
    });
    shuffleItems(nearby, rng);

    for (const tile of nearby) {
      if (tile === origin) continue;
      if (tile.hasCity) continue;
      if (tile.feature === 'village') continue;
      if (tile.terrain === 'water') continue;
      if (tile.resources.length > 0) continue;
      if (!isResourceTerrainCompatible(resource, tile.terrain)) continue;

      if (tryCommitLandResource(tile, resource, context, true)) {
        return true;
      }
    }
  }

  return false;
};

const tryCommitLandResource = (
  tile: Tile,
  resource: LandResourceType,
  context: LandResourceConstraintContext,
  markFallback: boolean
): boolean => {
  if (tile.terrain === 'water') return false;
  if (tile.hasCity) return false;
  if (tile.feature === 'village') return false;
  if (tile.resources.length > 0) return false;
  if (!isResourceTerrainCompatible(resource, tile.terrain)) return false;

  const capIndex = context.homeZoneByCoord.get(coordKey(tile.coordinate));
  const result = canPlaceLandResource(tile, resource, context, capIndex);
  if (!result.ok) {
    recordLandResourceBlock(context, result.reason);
    return false;
  }

  commitLandResource(tile, resource, context, capIndex);
  if (markFallback) {
    context.debug.fallbackPlaced += 1;
  }
  return true;
};

const canPlaceLandResource = (
  tile: Tile,
  resource: LandResourceType,
  context: LandResourceConstraintContext,
  capIndex?: number,
  overrides?: { minDistance?: number; maxPerCapital?: number }
): { ok: boolean; reason?: 'occupied' | 'spacing' | 'cap' } => {
  const key = coordKey(tile.coordinate);
  if (context.occupiedCoords.has(key)) {
    return { ok: false, reason: 'occupied' };
  }

  const minDistance = overrides?.minDistance ?? context.minDistance;
  if (minDistance > 0) {
    const existing = context.resourceCoordsByType.get(resource) ?? [];
    for (const coord of existing) {
      if (hexDistance(coord, tile.coordinate) < minDistance) {
        return { ok: false, reason: 'spacing' };
      }
    }
  }

  const maxPerCapital = overrides?.maxPerCapital ?? context.maxPerCapital;
  if (maxPerCapital > 0 && capIndex !== undefined) {
    if (context.homeCountByCapital[capIndex] >= maxPerCapital) {
      return { ok: false, reason: 'cap' };
    }
  }

  return { ok: true };
};

const commitLandResource = (
  tile: Tile,
  resource: LandResourceType,
  context: LandResourceConstraintContext,
  capIndex?: number
): void => {
  tile.resources.push(resource);

  const key = coordKey(tile.coordinate);
  context.occupiedCoords.add(key);
  const list = context.resourceCoordsByType.get(resource);
  if (list) {
    list.push(tile.coordinate);
  }
  if (capIndex !== undefined) {
    context.homeCountByCapital[capIndex] += 1;
  }
};

const removeLandResource = (
  tile: Tile,
  resource: LandResourceType,
  context: LandResourceConstraintContext,
  capIndex?: number
): boolean => {
  const index = tile.resources.indexOf(resource);
  if (index === -1) return false;
  tile.resources.splice(index, 1);

  const key = coordKey(tile.coordinate);
  const hasOtherLandResource = tile.resources.some(existing => isLandResourceType(existing));
  if (!hasOtherLandResource) {
    context.occupiedCoords.delete(key);
    if (capIndex !== undefined) {
      context.homeCountByCapital[capIndex] = Math.max(0, context.homeCountByCapital[capIndex] - 1);
    }
  }

  const list = context.resourceCoordsByType.get(resource);
  if (list) {
    const coordIndex = list.findIndex(coord =>
      coord.q === tile.coordinate.q &&
      coord.r === tile.coordinate.r &&
      coord.s === tile.coordinate.s
    );
    if (coordIndex >= 0) list.splice(coordIndex, 1);
  }

  return true;
};

const recordLandResourceBlock = (
  context: LandResourceConstraintContext,
  reason?: 'occupied' | 'spacing' | 'cap'
): void => {
  if (!reason) return;
  if (reason === 'occupied') context.debug.blockedByOccupied += 1;
  if (reason === 'spacing') context.debug.blockedBySpacing += 1;
  if (reason === 'cap') context.debug.blockedByCap += 1;
};

const getResourcesForCategory = (
  category: 'food' | 'prod',
  terrain: TerrainType
): LandResourceType[] => {
  const options = LAND_RESOURCES_BY_TERRAIN[terrain] || [];
  if (category === 'food') {
    return options.filter(resource => resource === 'grain_patch' || resource === 'wild_goats');
  }
  return options.filter(resource => resource === 'timber_grove' || resource === 'ore_vein');
};

const isResourceTerrainCompatible = (resource: LandResourceType, terrain: TerrainType): boolean => {
  return LAND_RESOURCES_BY_TERRAIN[terrain].includes(resource);
};

const getAlternativeResources = (
  resource: LandResourceType,
  terrain: TerrainType
): LandResourceType[] => {
  return LAND_RESOURCES_BY_TERRAIN[terrain].filter(option => option !== resource);
};

const pickGuaranteeResource = (tile: Tile, rng: RandomSource): LandResourceType | null => {
  if (tile.terrain === 'plains') {
    return rng.next() < 0.6 ? 'grain_patch' : 'wild_goats';
  }
  if (tile.terrain === 'forest') {
    return rng.next() < 0.5 ? 'timber_grove' : 'wild_goats';
  }
  if (tile.terrain === 'mountain') {
    return 'ore_vein';
  }
  return null;
};

const pickCategoryResource = (
  tile: Tile,
  category: 'food' | 'prod',
  rng: RandomSource
): LandResourceType | null => {
  const options = getResourcesForCategory(category, tile.terrain);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];
  return rng.next() < 0.6 ? options[0] : options[1];
};

const shuffleItems = <T>(items: T[], rng: RandomSource): void => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
};

const getInnerCitySpawnTable = (): ResourceSpawnRate => {
  return {
    grain_patch: 36,
    wild_goats: 10,
    timber_grove: 9,
    ore_vein: 11,
    fishing_shoal: 0,
    sea_beast: 0,
    jaredite_ruins: 0,
    empty: 30,
  };
};

const getWildernessSpawnTable = (): ResourceSpawnRate => {
  return {
    grain_patch: 2,
    wild_goats: 3,
    timber_grove: 4,
    ore_vein: 1.5,
    fishing_shoal: 0,
    sea_beast: 0,
    jaredite_ruins: 0,
    empty: 89.5,
  };
};

const getOuterCitySpawnTable = (): ResourceSpawnRate => {
  return {
    grain_patch: 12,
    wild_goats: 3,
    timber_grove: 3,
    ore_vein: 3,
    fishing_shoal: 0,
    sea_beast: 0,
    jaredite_ruins: 0,
    empty: 75,
  };
};

const getResourceFromTable = (
  spawnTable: ResourceSpawnRate,
  terrain: TerrainType,
  rng: RandomSource
): string | null => {
  if (terrain === 'water') {
    return null;
  }

  const roll = rng.nextInt(1, 100);
  let cumulative = 0;

  const resourceChecks = [
    {
      type: 'grain_patch',
      rate: spawnTable.grain_patch,
      terrains: ['plains'],
    },
    {
      type: 'wild_goats',
      rate: spawnTable.wild_goats,
      terrains: ['plains'],
    },
    {
      type: 'timber_grove',
      rate: spawnTable.timber_grove,
      terrains: ['forest'],
    },
    {
      type: 'ore_vein',
      rate: spawnTable.ore_vein,
      terrains: ['mountain'],
    },
  ];

  for (const resource of resourceChecks) {
    cumulative += resource.rate;

    if (roll <= cumulative && resource.terrains.includes(terrain)) {
      return resource.type;
    }
  }

  return null;
};
