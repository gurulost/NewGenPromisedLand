import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, TerrainType } from '@shared/types/game';
import type { HexCoordinate } from '@shared/types/coordinates';
import type { FactionId } from '@shared/types/faction';
import { hexDistance, hexNeighbors, hexesInRange } from './hex';
import { generateCapitalSpawns as generateCapitalSpawnPositions } from './mapGenerationCapitals';
import {
  buildLandmassData,
  buildLandmassIndex,
  buildPlacementContext,
  buildTileIndex,
  coordKey,
  isWithinMap,
  isTileOccupiedByCity,
  isTileOccupiedByVillage,
  minDistanceToCity,
  minDistanceToVillage,
} from './mapGenerationGeometry';
import {
  getLandResourceCategory,
  guaranteeCapitalHarvestOpportunities as guaranteeCapitalHarvestOpportunitiesOnMap,
  isLandResourceType,
  logLandResourcePlacementSummary,
  placeResourcesStrategically as placeResourcesStrategicallyOnMap,
} from './mapGenerationLandResources';
import {
  getNeutralCityEarlyRadius,
  getVillageEarlyRadius,
  getVillageRing,
  getVillageRingBands,
  isVillageContested,
  ensureCapitalExpansionVillage as ensureCapitalExpansionVillageOnMap,
  placeNeutralCities as placeNeutralCitiesOnMap,
  placeVillages as placeVillagesOnMap,
} from './mapGenerationSettlements';
import {
  buildWaterBodyIndex,
  fillWaterDeficit,
  findPathToWater,
  getCapitalWaterMetrics,
  getMinWaterBodySize,
  getWaterFactionMinBodySize,
  getWaterFactionMinCoastTiles,
  getWaterRatioRange,
  placeWaterResources as placeWaterResourcesOnMap,
  removeSmallWaterBodies,
  smoothWaterMask,
  trimWaterSurplus,
} from './mapGenerationWater';
import {
  CAPITAL_MIN_DISTANCE_BY_SIZE,
  MAP_GENERATION_CONSTANTS,
  MAP_SIZE_CONFIGS,
  type MapSize,
  type MapSizeConfig,
} from './mapGenerationConstants';
import {
  DEBUG_MAP_GENERATOR,
  buildGenerationSpread,
  createDefaultGenerationDiagnostics,
  createWaterRepairReasonCounts,
  debugMapGeneratorLog,
} from './mapGenerationDiagnostics';
import type {
  CapitalGenerationReport,
  GenerationDiagnostics,
  LandResourceConstraintContext,
  MapGenerationConfig,
  MapGenerationReport,
  NeutralCityRejectionCounts,
  ResourceSpawnRate,
  TerrainProbabilities,
  TribalSpawnModifiers,
  VillageCandidateEntry,
  WaterBodyData,
  WaterRepairReasonCounts,
} from './mapGenerationTypes';

export { MAP_GENERATION_CONSTANTS, MAP_SIZE_CONFIGS, CAPITAL_MIN_DISTANCE_BY_SIZE };
export type { MapSize, MapSizeConfig };
export type { MapGenerationConfig, MapGenerationReport } from './mapGenerationTypes';

export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

/**
 * Tribal Homeland Generation System
 * Each tribe begins on a procedurally generated homeland tilted toward their cultural resources
 * Uses Polytopia-style multipliers with proper order of operations for consistent tile mix
 */
export const TRIBAL_SPAWN_MODIFIERS: Record<FactionId, TribalSpawnModifiers> = {
  NEPHITES: {
    mountain: 0.8,      // 0.8× mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.2,    // 1.2× grain (calculated automatically)
    wildAnimal: 1.0,    // Neutral wild animals
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Advanced civilization with organized agriculture and cities"
  },
  LAMANITES: {
    mountain: 1.0,      // Neutral mountain
    forest: 1.5,        // 1.5× forest
    grainField: 1.0,    // Auto-calculated (fields = remainder)
    wildAnimal: 1.5,    // 1.5× wild_goats
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Forest-dwelling hunters skilled in wilderness survival"
  },
  MULEKITES: {
    mountain: 1.0,      // Neutral mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.0,    // Auto-calculated
    wildAnimal: 1.0,    // Neutral animals
    water: 2.0,         // 2.0× water (increased for better water identity)
    fish: 1.8,          // 1.8× fish (increased for river traders)
    ruins: 1.2,         // 1.2× ruins
    lore: "River-valley traders with access to waterways and ancient ruins"
  },
  ANTI_NEPHI_LEHIES: {
    mountain: 0.6,      // 0.6× mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.5,    // 1.5× grain (peaceful agriculture)
    wildAnimal: 1.5,    // 1.5× wild animals (herding)
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Peaceful herders focused on agriculture and animal husbandry"
  },
  ZORAMITES: {
    mountain: 1.5,      // 1.5× mountain
    forest: 0.5,        // 0.5× forest
    grainField: 1.0,    // Auto-calculated (limited by terrain)
    wildAnimal: 1.0,    // Neutral animals
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Mountain-dwelling people with rocky, challenging homeland"
  },
  JAREDITES: {
    mountain: 1.5,      // 1.5× mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.0,    // Auto-calculated
    wildAnimal: 1.0,    // Neutral animals
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 2.0,         // 2.0× ruins (ancient civilization)
    lore: "Ancient civilization with extensive ruins and mountainous territory"
  },
  HAGOTHS_MARINERS: {
    mountain: 0.9,      // Slightly fewer mountains
    forest: 1.2,        // Better timber access
    grainField: 0.9,    // Slightly less agrarian density
    wildAnimal: 0.9,    // Slightly reduced animal density
    water: 2.3,         // Strong coastal identity
    fish: 2.0,          // High fish access
    ruins: 1.0,         // Neutral ruins
    lore: "Maritime shipbuilders with strong coastal economies and exploratory traditions"
  },
  AMULONITES: {
    mountain: 1.0,      // Neutral mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.3,    // Fertile and extractive homeland
    wildAnimal: 1.2,    // Strong husbandry/hunting opportunities
    water: 0.9,         // Slightly less coastal
    fish: 0.8,          // Lower fish reliance
    ruins: 0.9,         // Slightly fewer ruins
    lore: "Taskmaster regimes built on agricultural extraction and coercive control"
  }
};

export class MapGenerator {
  private seed: number;
  private rngStreams: {
    terrain: SeededRandom;
    water: SeededRandom;
    capitals: SeededRandom;
    neutralCities: SeededRandom;
    villages: SeededRandom;
    resourcesLand: SeededRandom;
    resourcesWater: SeededRandom;
    ruins: SeededRandom;
  };
  private terrainNoise2D: ReturnType<typeof createNoise2D>;
  private waterNoise2D: ReturnType<typeof createNoise2D>;
  private config: MapGenerationConfig;
  private playerFactions: string[] = [];
  private lastCapitalPositions: HexCoordinate[] = [];
  private lastWaterMotif: 'coastal' | 'inland_sea' | 'straits' | null = null;
  private lastReport: MapGenerationReport | null = null;
  private lastWaterRepairByCapital: number[] = [];
  private lastWaterRepairReasons: WaterRepairReasonCounts[] = [];
  private lastVillageGuaranteeRelaxed: number[] = [];
  private lastVillageGuaranteeFailed: number[] = [];
  private lastDiagnostics: GenerationDiagnostics | null = null;

  constructor(config: MapGenerationConfig, playerFactions?: string[]) {
    this.seed = config.seed ?? Date.now();
    this.config = { ...config, seed: this.seed };
    this.playerFactions = playerFactions || [];
    this.rngStreams = {
      terrain: new SeededRandom(this.deriveSeed('terrain')),
      water: new SeededRandom(this.deriveSeed('water')),
      capitals: new SeededRandom(this.deriveSeed('capitals')),
      neutralCities: new SeededRandom(this.deriveSeed('neutralCities')),
      villages: new SeededRandom(this.deriveSeed('villages')),
      resourcesLand: new SeededRandom(this.deriveSeed('resourcesLand')),
      resourcesWater: new SeededRandom(this.deriveSeed('resourcesWater')),
      ruins: new SeededRandom(this.deriveSeed('ruins')),
    };
    this.terrainNoise2D = createNoise2D(() => this.rngStreams.terrain.next());
    this.waterNoise2D = createNoise2D(() => this.rngStreams.water.next());
  }

  getCapitalPositions(): HexCoordinate[] {
    return this.lastCapitalPositions.map(pos => ({ ...pos }));
  }

  getGenerationReport(): MapGenerationReport | null {
    return this.lastReport;
  }

  generateMap(): GameMap {
    const tiles: Tile[] = [];
    const mapRadius = Math.min(this.config.width, this.config.height);
    this.lastReport = null;
    this.lastWaterMotif = null;
    this.lastWaterRepairByCapital = new Array(this.config.playerCount).fill(0);
    this.lastWaterRepairReasons = new Array(this.config.playerCount)
      .fill(0)
      .map(() => createWaterRepairReasonCounts());
    this.lastVillageGuaranteeRelaxed = new Array(this.config.playerCount).fill(0);
    this.lastVillageGuaranteeFailed = new Array(this.config.playerCount).fill(0);
    this.lastDiagnostics = createDefaultGenerationDiagnostics();

    // Step 1: Generate base hex grid
    for (let q = -mapRadius; q <= mapRadius; q++) {
      const r1 = Math.max(-mapRadius, -q - mapRadius);
      const r2 = Math.min(mapRadius, -q + mapRadius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r;
        const coordinate: HexCoordinate = { q, r, s };
        
        const tile: Tile = {
          coordinate,
          terrain: 'plains' as TerrainType, // Temporary, will be set properly
          resources: [],
          hasCity: false,
          exploredBy: [],
        };

        tiles.push(tile);
      }
    }

    // Step 2: Generate water mask before choosing capital positions
    const waterData = this.generateWaterMask(tiles, mapRadius);

    // Step 3: Determine capital spawns (player starting positions)
    const capitalPositions = this.generateCapitalSpawns(mapRadius, tiles, waterData);
    this.lastCapitalPositions = capitalPositions;
    
    // Step 4: Place capital cities
    this.placeCapitalCities(tiles, capitalPositions);
    
    // Step 5: Generate terrain with faction-specific modifiers (BEFORE villages)
    this.generateFactionBiasedTerrain(tiles, mapRadius, capitalPositions);

    // Step 5.5: Ensure capitals have workable land access
    this.ensureCapitalLandAccess(tiles, capitalPositions, mapRadius);

    // Step 5.75: Place neutral cities after terrain is finalized
    if (!this.config.debugDisableNeutralCities) {
      placeNeutralCitiesOnMap({
        tiles,
        mapRadius,
        capitalPositions,
        mapSize: this.config.mapSize,
        playerCount: this.config.playerCount,
        rng: this.rngStreams.neutralCities,
        diagnostics: this.lastDiagnostics?.neutralCities,
      });
    }

    // Step 5.9: Ensure any cities are on land (safety pass)
    this.ensureCityLandTiles(tiles);

    // Step 5.95: Repair water access for water-leaning factions (rare fallback)
    const repairedWaterData = this.repairCapitalWaterAccess(
      tiles,
      capitalPositions,
      buildWaterBodyIndex(tiles),
      mapRadius
    );
    
    if (!this.config.debugDisableVillages) {
      // Step 6: Guarantee each capital has a nearby expansion village
      ensureCapitalExpansionVillageOnMap({
        tiles,
        mapRadius,
        capitalPositions,
        mapSize: this.config.mapSize,
        rng: this.rngStreams.villages,
        guaranteeRelaxed: this.lastVillageGuaranteeRelaxed,
        guaranteeFailed: this.lastVillageGuaranteeFailed,
      });

      // Step 6.5: Place capturable villages (AFTER terrain is generated)
      placeVillagesOnMap({
        tiles,
        mapRadius,
        capitalPositions,
        mapSize: this.config.mapSize,
        rng: this.rngStreams.villages,
        diagnostics: this.lastDiagnostics?.villages,
      });
    }

    debugMapGeneratorLog?.(`Generated ${tiles.filter(tile => tile.feature === 'village').length} villages on map`);
    
    // Step 7: Place resources strategically (city zones + wilderness)
    const landResourceContext = placeResourcesStrategicallyOnMap({
      tiles,
      capitalPositions,
      minResourceDistance: this.config.minResourceDistance,
      maxResourcesPerPlayer: this.config.maxResourcesPerPlayer,
      rng: this.rngStreams.resourcesLand,
      applyTribalModifiersForTile: (baseRates, coord, capitals) =>
        this.applyTribalModifiersForTile(baseRates, coord, capitals),
    });
    
    // Step 7.5: Guarantee opening-ring harvest opportunities (safety pass)
    guaranteeCapitalHarvestOpportunitiesOnMap({
      tiles,
      capitalPositions,
      context: landResourceContext,
      rng: this.rngStreams.resourcesLand,
    });

    logLandResourcePlacementSummary(landResourceContext);

    // Step 7.75: Place water resources for naval relevance
    placeWaterResourcesOnMap({
      tiles,
      capitalPositions,
      waterData: repairedWaterData,
      rng: this.rngStreams.resourcesWater,
      getFishModifier: (capitalIndex) => {
        const factionId = this.normalizeFactionId(this.playerFactions[capitalIndex]);
        return factionId ? TRIBAL_SPAWN_MODIFIERS[factionId]?.fish ?? 1 : 1;
      },
    });

    // Step 7.9: Place Jaredite ruins as a dedicated pass for fairness and exploration
    this.placeRuinsStrategically(tiles, capitalPositions);
    
    // Step 8: Place special features
    this.placeSpecialFeatures(tiles, capitalPositions);

    this.lastReport = this.buildGenerationReport(
      tiles,
      capitalPositions,
      repairedWaterData,
      landResourceContext
    );

    return {
      tiles,
      width: this.config.width,
      height: this.config.height,
    };
  }

  private buildGenerationReport(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    waterData: WaterBodyData,
    landResourceContext: LandResourceConstraintContext
  ): MapGenerationReport {
    const tileIndex = buildTileIndex(tiles);
    const landmassData = buildLandmassData(tiles);
    const capitalLandmass = capitalPositions.map(cap => landmassData.massByCoord.get(coordKey(cap)));
    const ringBands = getVillageRingBands(this.config.mapSize);
    const villageEarlyRadius = getVillageEarlyRadius(this.config.mapSize);
    const neutralEarlyRadius = getNeutralCityEarlyRadius(this.config.mapSize);

    const villages = tiles.filter(tile => tile.feature === 'village');
    const neutralCities = tiles.filter(tile => tile.hasCity && !capitalPositions.some(cap => coordKey(cap) === coordKey(tile.coordinate)));
    const villageEarlyCounts = new Array(capitalPositions.length).fill(0);
    const neutralEarlyCounts = new Array(capitalPositions.length).fill(0);
    const ringCounts = capitalPositions.map(() => ({ near: 0, mid: 0, far: 0 }));
    let contestedCount = 0;

    for (const village of villages) {
      const distances = capitalPositions.map(cap => hexDistance(village.coordinate, cap));
      const sorted = [...distances].sort((a, b) => a - b);
      const entry: VillageCandidateEntry = {
        tile: village,
        distances,
        nearestDistance: sorted[0] ?? Infinity,
        secondDistance: sorted[1] ?? Infinity,
      };
      if (isVillageContested(entry, ringBands)) {
        contestedCount += 1;
      }

      distances.forEach((distance, index) => {
        const capLandmass = capitalLandmass[index];
        const villageLandmass = landmassData.massByCoord.get(coordKey(village.coordinate));
        if (capLandmass !== undefined && villageLandmass !== undefined && capLandmass !== villageLandmass) {
          return;
        }
        if (distance <= villageEarlyRadius) {
          villageEarlyCounts[index] += 1;
        }
        const ring = getVillageRing(distance, ringBands);
        if (ring) {
          ringCounts[index][ring] += 1;
        }
      });
    }

    for (const neutral of neutralCities) {
      capitalPositions.forEach((capital, index) => {
        const capLandmass = capitalLandmass[index];
        const neutralLandmass = landmassData.massByCoord.get(coordKey(neutral.coordinate));
        if (capLandmass !== undefined && neutralLandmass !== undefined && capLandmass !== neutralLandmass) {
          return;
        }
        const distance = hexDistance(neutral.coordinate, capital);
        if (distance <= neutralEarlyRadius) {
          neutralEarlyCounts[index] += 1;
        }
      });
    }

    const earlyVillageSpread = buildGenerationSpread(villageEarlyCounts);
    const earlyNeutralSpread = buildGenerationSpread(neutralEarlyCounts);

    const ruins = tiles.filter(tile => tile.resources.includes('jaredite_ruins'));
    const ruinsPerCapital = new Array(capitalPositions.length).fill(0);
    for (const ruin of ruins) {
      const nearest = this.getNearestCapital(ruin.coordinate, capitalPositions);
      if (nearest.index >= 0) {
        ruinsPerCapital[nearest.index] += 1;
      }
    }

    const capitalReports: CapitalGenerationReport[] = capitalPositions.map((capital, index) => {
      const nearbyTiles = hexesInRange(capital, 2)
        .map(coord => tileIndex.get(coordKey(coord)))
        .filter((tile): tile is Tile => !!tile && hexDistance(tile.coordinate, capital) > 0);
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
      const waterMetrics = getCapitalWaterMetrics(
        capital,
        tiles,
        waterData,
        Math.min(this.config.width, this.config.height)
      );

      return {
        index,
        position: capital,
        harvestablesR2: harvestableTiles.length,
        hasFood,
        hasProd,
        earlyVillages: villageEarlyCounts[index] ?? 0,
        earlyNeutralCities: neutralEarlyCounts[index] ?? 0,
        water: waterMetrics,
        homeLandResources: landResourceContext.homeCountByCapital[index] ?? 0,
        guaranteeRelaxSpacingUsed: landResourceContext.debug.relaxSpacingUsed[index] ?? 0,
        guaranteeRelaxCapUsed: landResourceContext.debug.relaxCapUsed[index] ?? 0,
        varietyExtraGranted: landResourceContext.debug.varietyExtraGranted[index] ?? 0,
        expansionVillageRelaxed: this.lastVillageGuaranteeRelaxed[index] ?? 0,
        expansionVillageFailed: this.lastVillageGuaranteeFailed[index] ?? 0,
        waterRepairTiles: this.lastWaterRepairByCapital[index] ?? 0,
      };
    });

    const maxVillages = Math.floor(tiles.length / MAP_GENERATION_CONSTANTS.VILLAGE_DENSITY_RATIO);
    const contestedTarget = Math.max(
      0,
      Math.round(maxVillages * MAP_GENERATION_CONSTANTS.VILLAGE_CONTESTED_TARGET_RATIO)
    );

    return {
      seed: this.seed,
      mapSize: this.config.mapSize,
      playerCount: this.config.playerCount,
      water: {
        motif: this.lastWaterMotif,
        ratio: tiles.filter(tile => tile.terrain === 'water').length / Math.max(1, tiles.length),
        bodySizes: waterData.bodySizes,
        repairsByCapital: this.lastWaterRepairByCapital,
        repairReasonsByCapital: this.lastWaterRepairReasons,
      },
      villages: {
        placed: villages.length,
        target: maxVillages,
        contested: contestedCount,
        contestedTarget,
        earlySpread: earlyVillageSpread,
        earlyCounts: villageEarlyCounts,
        ringCounts,
      },
      neutralCities: {
        placed: neutralCities.length,
        target: Math.max(2, Math.floor(this.config.playerCount * 0.5)),
        earlySpread: earlyNeutralSpread,
        earlyCounts: neutralEarlyCounts,
      },
      resources: {
        homeCounts: landResourceContext.homeCountByCapital,
        blockedBySpacing: landResourceContext.debug.blockedBySpacing,
        blockedByCap: landResourceContext.debug.blockedByCap,
        blockedByOccupied: landResourceContext.debug.blockedByOccupied,
        fallbackPlaced: landResourceContext.debug.fallbackPlaced,
        relaxSpacingUsed: landResourceContext.debug.relaxSpacingUsed,
        relaxCapUsed: landResourceContext.debug.relaxCapUsed,
        varietyExtraGranted: landResourceContext.debug.varietyExtraGranted,
      },
      ruins: {
        placed: ruins.length,
        target: this.getRuinsTargetCount(tiles.length, capitalPositions.length),
        perCapital: ruinsPerCapital,
      },
      diagnostics: this.lastDiagnostics ?? createDefaultGenerationDiagnostics(),
      capitals: capitalReports,
    };
  }

  /**
   * Step 2: Generate capital spawns using quadrant-based system
   */
  private generateCapitalSpawns(
    mapRadius: number,
    tiles: Tile[],
    waterData: WaterBodyData
  ): HexCoordinate[] {
    const landmassData = buildLandmassData(tiles);

    return generateCapitalSpawnPositions({
      tiles,
      landmassData,
      mapRadius,
      mapSize: this.config.mapSize,
      playerCount: this.config.playerCount,
      rng: this.rngStreams.capitals,
      isValidCapitalCandidate: (coord, waterRelax, playerIndex) =>
        this.isValidCapitalCandidate(coord, tiles, waterData, waterRelax, playerIndex, mapRadius),
      scoreCapitalCandidate: ({ tile, tileIndex, playerIndex, idealRadius, target }) =>
        this.scoreCapitalCandidate(
          tile,
          tiles,
          tileIndex,
          waterData,
          mapRadius,
          playerIndex,
          idealRadius,
          target
        ),
    });
  }

  private scoreCapitalCandidate(
    tile: Tile,
    tiles: Tile[],
    tileIndex: Map<string, Tile>,
    waterData: WaterBodyData,
    mapRadius: number,
    playerIndex: number,
    idealRadius: number,
    target: HexCoordinate
  ): number {
    const sectorDistance = hexDistance(tile.coordinate, target);
    const radialDistance = hexDistance(tile.coordinate, { q: 0, r: 0, s: 0 });
    const radialPenalty = Math.abs(radialDistance - idealRadius) * 0.5;
    const neighborLandBonus = hexNeighbors(tile.coordinate)
      .filter(coord => isWithinMap(coord, mapRadius))
      .map(coord => tileIndex.get(coordKey(coord)))
      .filter((neighbor): neighbor is Tile => !!neighbor && neighbor.terrain !== 'water').length * 0.05;

    const factionId = this.normalizeFactionId(this.playerFactions[playerIndex]);
    const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
    const wantsWater = !!modifiers && modifiers.water > 1;
    const waterMetrics = wantsWater
      ? getCapitalWaterMetrics(tile.coordinate, tiles, waterData, mapRadius)
      : null;
    const waterBonus = waterMetrics
      ? waterMetrics.adjacentWaterTiles * 0.4 +
        waterMetrics.coastTilesWithinRadius * 0.15 +
        Math.min(
          1,
          waterMetrics.connectedBodySize / Math.max(1, getWaterFactionMinBodySize(this.config.mapSize))
        ) * 0.4
      : 0;

    return -sectorDistance - radialPenalty + neighborLandBonus + waterBonus;
  }

  private generateWaterMask(tiles: Tile[], mapRadius: number): WaterBodyData {
    const rng = this.rngStreams.water;
    const motif = this.pickWaterMotif();
    const { min, max } = getWaterRatioRange(this.config.mapSize);
    const targetRatio = min + (max - min) * rng.next();
    const targetCount = Math.round(tiles.length * targetRatio);
    const scoreByKey = this.scoreWaterTiles(tiles, mapRadius, motif);

    const sortedTiles = [...tiles].sort((a, b) => {
      const scoreA = scoreByKey.get(coordKey(a.coordinate)) ?? 0;
      const scoreB = scoreByKey.get(coordKey(b.coordinate)) ?? 0;
      return scoreB - scoreA;
    });

    sortedTiles.forEach((tile, index) => {
      tile.terrain = index < targetCount ? 'water' : 'plains';
    });

    for (let pass = 0; pass < MAP_GENERATION_CONSTANTS.WATER_SMOOTH_PASSES; pass++) {
      smoothWaterMask(tiles);
    }

    let waterData = buildWaterBodyIndex(tiles);
    removeSmallWaterBodies(tiles, waterData, getMinWaterBodySize(this.config.mapSize));

    const waterCount = tiles.filter(tile => tile.terrain === 'water').length;
    const minTarget = Math.round(tiles.length * min);
    const maxTarget = Math.round(tiles.length * max);

    if (waterCount < minTarget) {
      fillWaterDeficit(tiles, scoreByKey, minTarget - waterCount);
    } else if (waterCount > maxTarget) {
      trimWaterSurplus(tiles, scoreByKey, waterCount - maxTarget);
    }

    waterData = buildWaterBodyIndex(tiles);
    removeSmallWaterBodies(tiles, waterData, getMinWaterBodySize(this.config.mapSize));
    const postTrimCount = tiles.filter(tile => tile.terrain === 'water').length;
    if (postTrimCount < minTarget) {
      fillWaterDeficit(tiles, scoreByKey, minTarget - postTrimCount);
    }
    waterData = buildWaterBodyIndex(tiles);

    debugMapGeneratorLog?.(`Water motif: ${motif}, ratio: ${(tiles.filter(t => t.terrain === 'water').length / tiles.length).toFixed(2)}`);

    this.lastWaterMotif = motif;
    return waterData;
  }

  private pickWaterMotif(): 'coastal' | 'inland_sea' | 'straits' {
    const rng = this.rngStreams.water;
    const hasWaterFaction = this.playerFactions.some((factionId) => {
      const normalized = this.normalizeFactionId(factionId);
      if (!normalized) return false;
      return TRIBAL_SPAWN_MODIFIERS[normalized].water > 1;
    });

    const weights = hasWaterFaction
      ? [
          { motif: 'coastal' as const, weight: 0.25 },
          { motif: 'inland_sea' as const, weight: 0.4 },
          { motif: 'straits' as const, weight: 0.35 },
        ]
      : [
          { motif: 'coastal' as const, weight: 0.45 },
          { motif: 'inland_sea' as const, weight: 0.3 },
          { motif: 'straits' as const, weight: 0.25 },
        ];

    const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * totalWeight;
    for (const entry of weights) {
      roll -= entry.weight;
      if (roll <= 0) return entry.motif;
    }
    return weights[0].motif;
  }

  private scoreWaterTiles(
    tiles: Tile[],
    mapRadius: number,
    motif: 'coastal' | 'inland_sea' | 'straits'
  ): Map<string, number> {
    const scores = new Map<string, number>();
    const center = { q: 0, r: 0, s: 0 };
    const rng = this.rngStreams.water;

    let seaCenter = center;
    let seaRadius = mapRadius * 0.5;
    let straitAxis: 'q' | 'r' | 's' = 'q';
    let straitOffset = 0;
    let straitWidth = Math.max(2, Math.round(mapRadius * 0.18));

    if (motif === 'inland_sea') {
      const angle = rng.next() * Math.PI * 2;
      const offsetRadius = mapRadius * 0.2;
      const offsetQ = Math.round(offsetRadius * Math.cos(angle));
      const offsetR = Math.round(offsetRadius * Math.sin(angle));
      seaCenter = { q: offsetQ, r: offsetR, s: -offsetQ - offsetR };
      seaRadius = mapRadius * (0.45 + rng.next() * 0.15);
    }

    if (motif === 'straits') {
      const axisRoll = rng.next();
      straitAxis = axisRoll < 0.33 ? 'q' : axisRoll < 0.66 ? 'r' : 's';
      straitOffset = Math.round((rng.next() - 0.5) * mapRadius * 0.4);
      straitWidth = Math.max(2, Math.round(mapRadius * 0.16));
    }

    tiles.forEach(tile => {
      const noiseValue = this.waterNoise2D(tile.coordinate.q * 0.08, tile.coordinate.r * 0.08);
      const distanceFromCenter = hexDistance(tile.coordinate, center) / mapRadius;
      let score = 0;

      if (motif === 'coastal') {
        const edgeBias = Math.max(0, (distanceFromCenter - 0.3) / 0.7);
        score = edgeBias + noiseValue * 0.25;
      } else if (motif === 'inland_sea') {
        const distToSea = hexDistance(tile.coordinate, seaCenter);
        const seaBias = Math.max(0, 1 - distToSea / seaRadius);
        const edgeBias = Math.max(0, (distanceFromCenter - 0.8) / 0.2);
        score = seaBias + edgeBias * 0.2 + noiseValue * 0.2;
      } else {
        const axisValue =
          straitAxis === 'q'
            ? tile.coordinate.q
            : straitAxis === 'r'
              ? tile.coordinate.r
              : tile.coordinate.s;
        const distToStrait = Math.abs(axisValue - straitOffset);
        const straitBias = Math.max(0, 1 - distToStrait / straitWidth);
        const edgeBias = Math.max(0, (distanceFromCenter - 0.75) / 0.25);
        score = straitBias + edgeBias * 0.25 + noiseValue * 0.2;
      }

      const jitter = rng.next() * 0.05;
      scores.set(coordKey(tile.coordinate), score + jitter);
    });

    return scores;
  }

  private repairCapitalWaterAccess(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    waterData: WaterBodyData,
    mapRadius: number
  ): WaterBodyData {
    let updatedWaterData = waterData;
    const repairsByCapital = new Array(capitalPositions.length).fill(0);
    const repairReasons = new Array(capitalPositions.length)
      .fill(0)
      .map(() => createWaterRepairReasonCounts());

    for (let i = 0; i < capitalPositions.length; i++) {
      const factionId = this.normalizeFactionId(this.playerFactions[i]);
      const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
      const wantsWater = !!modifiers && modifiers.water > 1;
      if (!wantsWater) continue;

      const capital = capitalPositions[i];
      const metrics = getCapitalWaterMetrics(capital, tiles, updatedWaterData, mapRadius);
      if (
        metrics.adjacentWaterTiles > 0 &&
        metrics.connectedBodySize >= getWaterFactionMinBodySize(this.config.mapSize) &&
        metrics.coastTilesWithinRadius >= getWaterFactionMinCoastTiles(this.config.mapSize)
      ) {
        continue;
      }

      const tileIndex = buildTileIndex(tiles);
      const minBodySize = getWaterFactionMinBodySize(this.config.mapSize);
      const path = findPathToWater(capital, tileIndex, updatedWaterData, minBodySize);
      if (path.length === 0) {
        repairReasons[i].no_path += 1;
      } else if (path.length > MAP_GENERATION_CONSTANTS.WATER_REPAIR_BUDGET) {
        repairReasons[i].budget_exceeded += 1;
      } else {
        const neighbors = hexNeighbors(capital)
          .map(coord => tileIndex.get(coordKey(coord)))
          .filter((tile): tile is Tile => !!tile);
        const landNeighbors = neighbors.filter(tile => tile.terrain !== 'water').length;
        const adjacentPathTiles = path.filter(tile => hexDistance(tile.coordinate, capital) === 1);
        const minLandNeighbors = wantsWater ? 2 : 3;
        const canSpare = landNeighbors - adjacentPathTiles.length >= minLandNeighbors;
        const canConvertAll = path.every(tile =>
          !tile.hasCity && tile.feature !== 'village' && tile.resources.length === 0
        );

        if (!canSpare) {
          repairReasons[i].min_land_neighbors += 1;
        } else if (!canConvertAll) {
          repairReasons[i].blocked_tiles += 1;
        } else {
          path.forEach(tile => {
            tile.terrain = 'water';
            repairsByCapital[i] += 1;
          });
          repairReasons[i].coastal_guarantee += 1;
        }
      }

      updatedWaterData = buildWaterBodyIndex(tiles);
    }

    this.lastWaterRepairByCapital = repairsByCapital;
    this.lastWaterRepairReasons = repairReasons;
    return updatedWaterData;
  }

  /**
   * Step 3: Place capital cities for players
   */
  private placeCapitalCities(tiles: Tile[], capitalPositions: HexCoordinate[]): void {
    for (const capitalPos of capitalPositions) {
      const tile = tiles.find(t =>
        t.coordinate.q === capitalPos.q && t.coordinate.r === capitalPos.r
      );
      if (tile) {
        tile.hasCity = true;
      }
    }
  }

  private normalizeFactionId(id?: string): FactionId | null {
    if (!id) return null;
    const upper = id.toUpperCase();
    return (upper in TRIBAL_SPAWN_MODIFIERS) ? (upper as FactionId) : null;
  }

  private deriveSeed(label: string): number {
    const baseSeed = this.seed;
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    }
    return (baseSeed ^ hash ^ (hash << 16)) >>> 0;
  }

  private getTileAt(tiles: Tile[], coord: HexCoordinate): Tile | undefined {
    return tiles.find(tile =>
      tile.coordinate.q === coord.q &&
      tile.coordinate.r === coord.r &&
      tile.coordinate.s === coord.s
    );
  }

  private isValidCapitalCandidate(
    coord: HexCoordinate,
    tiles: Tile[],
    waterData: WaterBodyData,
    relax: number,
    playerIndex: number,
    mapRadius: number
  ): boolean {
    const tile = this.getTileAt(tiles, coord);
    if (!tile || tile.terrain === 'water') return false;

    const factionId = this.normalizeFactionId(this.playerFactions[playerIndex]);
    const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
    const wantsWater = !!modifiers && modifiers.water > 1;

    if (!wantsWater) return true;

    const metrics = getCapitalWaterMetrics(coord, tiles, waterData, mapRadius);
    if (metrics.adjacentWaterTiles < 1) return false;

    const minBodySize = Math.max(
      4,
      getWaterFactionMinBodySize(this.config.mapSize) - relax * 2
    );
    const minCoastTiles = Math.max(
      1,
      getWaterFactionMinCoastTiles(this.config.mapSize) - relax
    );

    if (metrics.connectedBodySize < minBodySize) return false;
    if (metrics.coastTilesWithinRadius < minCoastTiles) return false;

    return true;
  }

  private ensureCityLandTiles(tiles: Tile[]): void {
    tiles.forEach(tile => {
      if (tile.hasCity && tile.terrain === 'water') {
        tile.terrain = 'plains';
      }
    });
  }

  private ensureCapitalLandAccess(tiles: Tile[], capitalPositions: HexCoordinate[], mapRadius: number): void {
    for (let i = 0; i < capitalPositions.length; i++) {
      const capital = capitalPositions[i];
      const factionId = this.normalizeFactionId(this.playerFactions[i]);
      const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
      const wantsWater = !!modifiers && modifiers.water > 1;
      const minLandNeighbors = wantsWater ? 2 : 3;
      const neighbors = hexNeighbors(capital)
        .filter(coord => isWithinMap(coord, mapRadius))
        .map(coord => this.getTileAt(tiles, coord))
        .filter((tile): tile is Tile => !!tile);

      const landNeighbors = neighbors.filter(tile => tile.terrain !== 'water');
      if (landNeighbors.length >= minLandNeighbors) continue;

      const waterNeighbors = neighbors.filter(tile => tile.terrain === 'water');
      let needed = minLandNeighbors - landNeighbors.length;
      let remainingWater = waterNeighbors.length;
      for (const tile of waterNeighbors) {
        if (wantsWater && remainingWater <= 1) break;
        tile.terrain = 'plains';
        remainingWater -= 1;
        needed -= 1;
        if (needed <= 0) break;
      }
    }
  }

  /**
   * Step 4: Generate terrain with tribal homeland modifiers
   * Uses Polytopia-style Luxidoor base percentages (48% fields, 38% forests, 14% mountains)
   */
  private generateFactionBiasedTerrain(tiles: Tile[], mapRadius: number, capitalPositions: HexCoordinate[]): void {
    // Base terrain distribution (Luxidoor's 48/38/14 split)
    const baseTerrain = {
      plains: 0.48,  // Fields (Grain Patch tiles)
      forest: 0.38,  // Forests (Timber Grove tiles)
      mountain: 0.14 // Mountains
    };
    
    for (const tile of tiles) {
      if (tile.terrain === 'water') continue;

      // Default terrain generation
      let terrainProbs = { ...baseTerrain };
      
      // Check if this tile is within a tribal homeland (4-tile radius from capitals)
      for (let i = 0; i < capitalPositions.length; i++) {
        const distance = hexDistance(tile.coordinate, capitalPositions[i]);
        if (distance <= MAP_GENERATION_CONSTANTS.TRIBAL_HOMELAND_RADIUS) {
          const factionId = this.normalizeFactionId(this.playerFactions[i]);
          const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
          
          if (modifiers) {
            // Apply tribal homeland modifiers with distance falloff
            const influence = Math.max(0, 1 - distance / MAP_GENERATION_CONSTANTS.TRIBAL_INFLUENCE_FALLOFF); // Stronger influence closer to capital
            terrainProbs = this.applyPolytopiaTribalModifiers(terrainProbs, modifiers, influence);
          }
        }
      }
      
      // Generate terrain based on modified probabilities
      tile.terrain = this.selectLandTerrainFromProbabilities(tile.coordinate, terrainProbs);
    }
  }

  /**
   * Apply tribal homeland modifiers using authentic Polytopia cascading system
   * Order: mountain → forest → fields (plains calculated as remainder)
   */
  private applyPolytopiaTribalModifiers(
    base: TerrainProbabilities, 
    modifiers: TribalSpawnModifiers, 
    influence: number
  ): TerrainProbabilities {
    // Step 1: Apply mountain modifier first (Polytopia order)
    let mountain = base.mountain;
    const mountainMod = 1 + (modifiers.mountain - 1) * influence;
    mountain = Math.min(0.8, Math.max(0.05, mountain * mountainMod)); // Clamp 5-80%
    
    // Step 2: Apply forest modifier to remaining land
    const remainingAfterMountain = 1 - mountain;
    let forest = base.forest * remainingAfterMountain / (base.forest + base.plains);
    const forestMod = 1 + (modifiers.forest - 1) * influence;
    forest = Math.min(remainingAfterMountain * 0.9, Math.max(0.05, forest * forestMod));
    
    // Step 3: Fields (plains) = remaining land (never gets direct multiplier)
    const plains = Math.max(0.05, remainingAfterMountain - forest);
    
    return { mountain, forest, plains };
  }

  /**
   * Select land terrain based on probabilities and noise
   */
  private selectLandTerrainFromProbabilities(
    coord: HexCoordinate,
    probs: TerrainProbabilities
  ): TerrainType {
    const noiseValue = this.terrainNoise2D(coord.q * 0.1, coord.r * 0.1);
    const rand = Math.max(0, Math.min(0.999, this.rngStreams.terrain.next() + noiseValue * 0.2));

    if (rand < probs.mountain) return 'mountain';
    if (rand < probs.mountain + probs.forest) return 'forest';
    return 'plains';
  }



  /**
   * Apply tribal homeland modifiers to resource spawn rates
   * Water, fish, and wild animals are applied independently
   */
  private applyTribalResourceModifiers(
    baseRates: ResourceSpawnRate, 
    modifiers: TribalSpawnModifiers, 
    influence: number
  ): ResourceSpawnRate {
    const modified = { ...baseRates };
    
    // Apply independent modifiers (these don't affect land terrain balance)
    // Updated per blueprint: wildAnimal → wild_goats, legacy identifiers replaced
    const wildGoatsMod = 1 + (modifiers.wildAnimal - 1) * influence;
    const fishMod = 1 + (modifiers.fish - 1) * influence;
    
    // Apply modifiers to unified world elements system - blueprint step 3 complete
    modified.wild_goats = Math.round(modified.wild_goats * wildGoatsMod);
    modified.fishing_shoal = Math.round(modified.fishing_shoal * fishMod);
    modified.sea_beast = Math.round(modified.sea_beast * fishMod);
    
    // Clamp values to reasonable ranges
    modified.wild_goats = Math.max(0, Math.min(30, modified.wild_goats));
    modified.fishing_shoal = Math.max(0, Math.min(20, modified.fishing_shoal));
    modified.sea_beast = Math.max(0, Math.min(15, modified.sea_beast));
    
    return modified;
  }



  /**
   * Step 7: Place special tribal features (currently none defined)
   */
  private placeSpecialFeatures(tiles: Tile[], capitalPositions: HexCoordinate[]): void {
    // Tribal system uses resource modifiers instead of special features
    // This method is kept for future expansion if needed
    
    for (let i = 0; i < capitalPositions.length; i++) {
      const factionId = this.normalizeFactionId(this.playerFactions[i]);
      const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
      
      // Future: Add any special tribal features here
      // For now, all tribal bonuses are handled through spawn rate modifiers
      
      // Tribal lore available in modifiers.lore for future UI display
    }
  }

  private applyTribalModifiersForTile(
    baseRates: ResourceSpawnRate,
    coord: HexCoordinate,
    capitalPositions: HexCoordinate[]
  ): ResourceSpawnRate {
    let modified = { ...baseRates };

    for (let i = 0; i < this.config.playerCount && i < capitalPositions.length; i++) {
      const capitalPos = capitalPositions[i];
      const distance = hexDistance(coord, capitalPos);
      if (distance > MAP_GENERATION_CONSTANTS.TRIBAL_HOMELAND_RADIUS) continue;

      const factionId = this.normalizeFactionId(this.playerFactions[i]);
      const modifiers = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
      if (!modifiers) continue;

      const influence = Math.max(0, 1 - distance / MAP_GENERATION_CONSTANTS.TRIBAL_INFLUENCE_FALLOFF);
      modified = this.applyTribalResourceModifiers(modified, modifiers, influence);
    }

    return modified;
  }

  private placeRuinsStrategically(tiles: Tile[], capitalPositions: HexCoordinate[]): void {
    if (capitalPositions.length === 0) return;

    const rng = this.rngStreams.ruins;
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

      const { index, distance } = this.getNearestCapital(tile.coordinate, capitalPositions);
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

    const totalTarget = this.getRuinsTargetCount(tiles.length, capitalPositions.length);
    const ruinsPlaced: HexCoordinate[] = [];
    const ruinCounts = new Array(capitalPositions.length).fill(0);

    const placeFromPool = (playerIndex: number, zones: Array<'near' | 'mid' | 'far'>): boolean => {
      for (const zone of zones) {
        const candidate = this.pickRuinCandidate(ruinPools[playerIndex][zone], ruinsPlaced, rng);
        if (!candidate) continue;
        candidate.resources.push('jaredite_ruins');
        ruinsPlaced.push(candidate.coordinate);
        ruinCounts[playerIndex] += 1;
        return true;
      }
      return false;
    };

    // Phase 1: Ensure each player has at least one near-cap ruin when possible.
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
  }

  private getRuinsTargetCount(tileCount: number, playerCount: number): number {
    const densityTarget = Math.round(tileCount * MAP_GENERATION_CONSTANTS.RUINS_DENSITY);
    return Math.max(playerCount + 1, densityTarget);
  }

  private getNearestCapital(
    coord: HexCoordinate,
    capitalPositions: HexCoordinate[]
  ): { index: number; distance: number } {
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
  }

  private pickRuinCandidate(
    candidates: Tile[],
    ruinsPlaced: HexCoordinate[],
    rng: SeededRandom
  ): Tile | null {
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
  }

  // Static convenience method
  static generateBalancedMap(playerCount: number, seed?: number): GameMap {
    const baseSize = 4;
    const mapSize = baseSize + Math.floor(playerCount / 2);
    
    const generator = new MapGenerator({
      width: mapSize,
      height: mapSize,
      seed: seed ?? Date.now(),
      playerCount,
      mapSize: 'normal', // Default to normal size
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3
    });
    
    return generator.generateMap();
  }
}
