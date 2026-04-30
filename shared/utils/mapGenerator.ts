import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, TerrainType } from '@shared/types/game';
import type { HexCoordinate } from '@shared/types/coordinates';
import type { FactionId } from '@shared/types/faction';
import { GameRuleHelpers } from '@shared/data/gameRules';
import { hexDistance, hexNeighbors, hexesInRange } from './hex';
import {
  addCityToContext,
  addVillageToContext,
  buildPlacementContext,
  buildTileIndex,
  coordKey,
  isTileOccupiedByCity,
  isTileOccupiedByVillage,
  minDistanceToCity,
  minDistanceToVillage,
} from './mapGenerationGeometry';
import {
  buildWaterBodyIndex,
  fillWaterDeficit,
  findPathToWater,
  getCapitalWaterMetrics,
  getMinWaterBodySize,
  getWaterFactionMinBodySize,
  getWaterFactionMinCoastTiles,
  getWaterRatioRange,
  groupWaterBodies,
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
  CapitalCandidateAssignment,
  CapitalGenerationReport,
  GenerationDiagnostics,
  LandResourceConstraintContext,
  LandResourceType,
  LandmassData,
  MapGenerationConfig,
  MapGenerationReport,
  NeutralCityRejectionCounts,
  PlacementContext,
  ResourceCandidate,
  ResourceSpawnRate,
  TerrainProbabilities,
  TribalSpawnModifiers,
  VillageCandidateAssignment,
  VillageCandidateEntry,
  VillageRejectionCounts,
  VillageRing,
  VillageRingBand,
  VillageRingBands,
  VillageSpacingOverrides,
  WaterBodyData,
  WaterRepairReasonCounts,
} from './mapGenerationTypes';

export { MAP_GENERATION_CONSTANTS, MAP_SIZE_CONFIGS, CAPITAL_MIN_DISTANCE_BY_SIZE };
export type { MapSize, MapSizeConfig };
export type { MapGenerationConfig, MapGenerationReport } from './mapGenerationTypes';

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
      this.placeNeutralCities(tiles, mapRadius, capitalPositions, this.lastDiagnostics?.neutralCities);
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
      this.ensureCapitalExpansionVillage(tiles, capitalPositions, mapRadius);

      // Step 6.5: Place capturable villages (AFTER terrain is generated)
      this.placeVillages(tiles, mapRadius, capitalPositions, this.lastDiagnostics?.villages);
    }

    debugMapGeneratorLog?.(`Generated ${tiles.filter(tile => tile.feature === 'village').length} villages on map`);
    
    // Step 7: Place resources strategically (city zones + wilderness)
    const landResourceContext = this.placeResourcesStrategically(tiles, capitalPositions);
    
    // Step 7.5: Guarantee opening-ring harvest opportunities (safety pass)
    this.guaranteeCapitalHarvestOpportunities(tiles, capitalPositions, landResourceContext);

    this.logLandResourcePlacementSummary(landResourceContext);

    // Step 7.75: Place water resources for naval relevance
    this.placeWaterResources(tiles, capitalPositions, repairedWaterData);

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
    const landmassData = this.buildLandmassData(tiles);
    const capitalLandmass = capitalPositions.map(cap => landmassData.massByCoord.get(coordKey(cap)));
    const ringBands = this.getVillageRingBands();
    const villageEarlyRadius = this.getVillageEarlyRadius();
    const neutralEarlyRadius = this.getNeutralCityEarlyRadius();

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
      if (this.isVillageContested(entry, ringBands)) {
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
        const ring = this.getVillageRing(distance, ringBands);
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
        tile.resources.some(resource => this.isLandResourceType(resource))
      );
      const hasFood = harvestableTiles.some(tile =>
        tile.resources.some(resource =>
          this.isLandResourceType(resource) && this.getResourceCategory(resource) === 'food'
        )
      );
      const hasProd = harvestableTiles.some(tile =>
        tile.resources.some(resource =>
          this.isLandResourceType(resource) && this.getResourceCategory(resource) === 'prod'
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
    const rng = this.rngStreams.capitals;
    const playerCount = this.config.playerCount;
    const baseMinDistance = this.getCapitalMinDistance();
    const { minRadius, maxRadius } = this.getCapitalSpawnRadiusBand(mapRadius);
    const angleStep = (2 * Math.PI) / Math.max(1, playerCount);
    const angleJitter = angleStep * 0.35;
    const landmassData = this.buildLandmassData(tiles);
    const landmassOrder = this.getCapitalLandmassOrder(landmassData);
    const distanceSequence = this.getCapitalDistanceSequence(baseMinDistance, mapRadius);
    const waterRelaxSequence = [0, 1, 2, 3];

    const tryPlace = (
      minDistance: number,
      waterRelax: number,
      requiredLandmassId?: number
    ): HexCoordinate[] | null => {
      const pools = Array.from({ length: playerCount }, (_, playerIndex) =>
        this.buildCapitalCandidatePool(
          tiles,
          waterData,
          landmassData,
          mapRadius,
          playerIndex,
          minRadius,
          maxRadius,
          angleStep,
          angleJitter,
          waterRelax,
          rng,
          requiredLandmassId
        )
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

    return this.generateCapitalFallback(
      tiles,
      waterData,
      landmassData,
      mapRadius,
      minRadius,
      maxRadius,
      angleStep,
      angleJitter,
      distanceSequence[distanceSequence.length - 1] ?? baseMinDistance,
      rng
    );
  }

  private getCapitalLandmassOrder(landmassData: LandmassData): Array<{ id: number; size: number }> {
    return landmassData.massSizes
      .map((size, id) => ({ id, size }))
      .filter(landmass => landmass.size >= Math.max(1, this.config.playerCount))
      .sort((a, b) => (b.size - a.size) || (a.id - b.id));
  }

  private getCapitalDistanceSequence(baseMinDistance: number, mapRadius: number): number[] {
    const fallbackMinDistance = this.getCapitalFallbackMinDistance(baseMinDistance, mapRadius);
    const distances: number[] = [];
    for (let distance = baseMinDistance; distance >= fallbackMinDistance; distance--) {
      distances.push(distance);
    }
    return distances.length > 0 ? distances : [baseMinDistance];
  }

  private getCapitalFallbackMinDistance(baseMinDistance: number, mapRadius: number): number {
    const edgeLimitedDistance = mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER;
    if (edgeLimitedDistance >= baseMinDistance) {
      return baseMinDistance;
    }
    return Math.max(2, Math.min(baseMinDistance, edgeLimitedDistance));
  }

  private buildCapitalCandidatePool(
    tiles: Tile[],
    waterData: WaterBodyData,
    landmassData: LandmassData,
    mapRadius: number,
    playerIndex: number,
    minRadius: number,
    maxRadius: number,
    angleStep: number,
    angleJitter: number,
    waterRelax: number,
    rng: SeededRandom,
    requiredLandmassId?: number
  ): CapitalCandidateAssignment[] {
    const maxPoolSize = Math.max(48, this.config.playerCount * 16);
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
      if (!this.isCapitalBaseCandidate(tile.coordinate, mapRadius)) continue;
      if (!this.isValidCapitalCandidate(tile.coordinate, tiles, waterData, waterRelax, playerIndex, mapRadius)) continue;

      candidates.push({
        coord: tile.coordinate,
        score: this.scoreCapitalCandidate(
          tile,
          tiles,
          tileIndex,
          waterData,
          mapRadius,
          playerIndex,
          idealRadius,
          target,
          rng
        ),
      });
    }

    return candidates
      .sort((a, b) => (b.score - a.score) || coordKey(a.coord).localeCompare(coordKey(b.coord)))
      .slice(0, maxPoolSize);
  }

  private isCapitalBaseCandidate(coord: HexCoordinate, mapRadius: number): boolean {
    if (!this.isWithinMap(coord, mapRadius)) return false;
    return hexDistance({ q: 0, r: 0, s: 0 }, coord) <= mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER;
  }

  private scoreCapitalCandidate(
    tile: Tile,
    tiles: Tile[],
    tileIndex: Map<string, Tile>,
    waterData: WaterBodyData,
    mapRadius: number,
    playerIndex: number,
    idealRadius: number,
    target: HexCoordinate,
    rng: SeededRandom
  ): number {
    const sectorDistance = hexDistance(tile.coordinate, target);
    const radialDistance = hexDistance(tile.coordinate, { q: 0, r: 0, s: 0 });
    const radialPenalty = Math.abs(radialDistance - idealRadius) * 0.5;
    const neighborLandBonus = hexNeighbors(tile.coordinate)
      .filter(coord => this.isWithinMap(coord, mapRadius))
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

    return -sectorDistance - radialPenalty + neighborLandBonus + waterBonus + rng.next() * 0.05;
  }

  private generateCapitalFallback(
    tiles: Tile[],
    waterData: WaterBodyData,
    landmassData: LandmassData,
    mapRadius: number,
    minRadius: number,
    maxRadius: number,
    angleStep: number,
    angleJitter: number,
    minDistance: number,
    rng: SeededRandom
  ): HexCoordinate[] {
    const positions: HexCoordinate[] = [];
    const preferredLandmassId = this.getCapitalLandmassOrder(landmassData)[0]?.id;

    for (let playerIndex = 0; playerIndex < this.config.playerCount; playerIndex++) {
      const preferredPool = preferredLandmassId === undefined
        ? []
        : this.buildCapitalCandidatePool(
            tiles,
            waterData,
            landmassData,
            mapRadius,
            playerIndex,
            minRadius,
            maxRadius,
            angleStep,
            angleJitter,
            3,
            rng,
            preferredLandmassId
          );
      const anyPool = this.buildCapitalCandidatePool(
        tiles,
        waterData,
        landmassData,
        mapRadius,
        playerIndex,
        minRadius,
        maxRadius,
        angleStep,
        angleJitter,
        3,
        rng
      );
      const pool = preferredPool.length > 0 ? preferredPool : anyPool;
      const spacedPick = pool.find(candidate =>
        positions.every(position => hexDistance(position, candidate.coord) >= minDistance)
      );
      const bestEffortPick = spacedPick ?? this.pickMostSeparatedCapitalCandidate(pool, positions);

      if (bestEffortPick) {
        positions.push(bestEffortPick.coord);
        continue;
      }

      const fallbackRadius = Math.floor(mapRadius * MAP_GENERATION_CONSTANTS.CAPITAL_SPAWN_RADIUS_RATIO);
      const angle = (playerIndex / Math.max(1, this.config.playerCount)) * 2 * Math.PI;
      const q = Math.round(fallbackRadius * Math.cos(angle));
      const r = Math.round(fallbackRadius * Math.sin(angle));
      const s = -q - r;
      const candidate = { q, r, s };
      positions.push(this.findNearestLandTile(candidate, tiles, mapRadius) ?? candidate);
    }

    return positions;
  }

  private pickMostSeparatedCapitalCandidate(
    pool: CapitalCandidateAssignment[],
    positions: HexCoordinate[]
  ): CapitalCandidateAssignment | null {
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

  private placeWaterResources(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    waterData: WaterBodyData
  ): void {
    const rng = this.rngStreams.resourcesWater;
    const waterBodies = groupWaterBodies(tiles, waterData);
    const tileIndex = buildTileIndex(tiles);

    waterBodies.forEach(body => {
      const bodySize = body.length;
      if (bodySize === 0) return;

      const fishTarget = Math.max(1, Math.round(bodySize * 0.12));
      this.placeResourceClusters(body, tileIndex, 'fishing_shoal', fishTarget, 2, 4, rng);

      const seaBeastTarget = bodySize >= 12 ? Math.max(1, Math.floor(bodySize * 0.015)) : 0;
      if (seaBeastTarget > 0) {
        this.placeDeepWaterResources(body, tileIndex, 'sea_beast', seaBeastTarget, rng);
      }
    });

    this.ensureCapitalFishAccess(tiles, capitalPositions, waterData);
    this.ensureSharedWaterOpportunities(tiles, capitalPositions, waterData, rng);
  }

  private placeResourceClusters(
    bodyTiles: Tile[],
    tileIndex: Map<string, Tile>,
    resource: string,
    target: number,
    minClusterSize: number,
    maxClusterSize: number,
    rng: SeededRandom
  ): void {
    let remaining = target;
    const maxClusters = Math.max(1, Math.round(bodyTiles.length / 12));
    let clusters = 0;

    while (remaining > 0 && clusters < maxClusters) {
      const seed = this.pickAvailableWaterTile(bodyTiles, rng);
      if (!seed) break;

      const clusterSize = Math.min(remaining, rng.nextInt(minClusterSize, maxClusterSize));
      const clusterTiles = this.expandCluster(seed, tileIndex, clusterSize, rng);
      clusterTiles.forEach(tile => {
        if (!tile.resources.includes(resource)) {
          tile.resources.push(resource);
          remaining -= 1;
        }
      });
      clusters += 1;
    }

    while (remaining > 0) {
      const tile = this.pickAvailableWaterTile(bodyTiles, rng);
      if (!tile) break;
      tile.resources.push(resource);
      remaining -= 1;
    }
  }

  private placeDeepWaterResources(
    bodyTiles: Tile[],
    tileIndex: Map<string, Tile>,
    resource: string,
    target: number,
    rng: SeededRandom
  ): void {
    let remaining = target;
    const deepTiles = bodyTiles.filter(tile => {
      const waterNeighbors = hexNeighbors(tile.coordinate)
        .map(coord => tileIndex.get(coordKey(coord)))
        .filter((neighbor): neighbor is Tile => !!neighbor && neighbor.terrain === 'water').length;
      return waterNeighbors >= 5;
    });

    while (remaining > 0 && deepTiles.length > 0) {
      const pick = deepTiles[Math.floor(rng.next() * deepTiles.length)];
      if (pick.resources.length === 0) {
        pick.resources.push(resource);
        remaining -= 1;
      } else {
        deepTiles.splice(deepTiles.indexOf(pick), 1);
      }
    }
  }

  private pickAvailableWaterTile(bodyTiles: Tile[], rng: SeededRandom): Tile | null {
    const candidates = bodyTiles.filter(tile => tile.resources.length === 0);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
  }

  private expandCluster(
    seed: Tile,
    tileIndex: Map<string, Tile>,
    size: number,
    rng: SeededRandom
  ): Tile[] {
    const cluster: Tile[] = [seed];
    const visited = new Set<string>([coordKey(seed.coordinate)]);

    while (cluster.length < size) {
      const anchor = cluster[Math.floor(rng.next() * cluster.length)];
      const neighbors = hexNeighbors(anchor.coordinate)
        .map(coord => tileIndex.get(coordKey(coord)))
        .filter((tile): tile is Tile => !!tile && tile.terrain === 'water' && tile.resources.length === 0)
        .filter(tile => !visited.has(coordKey(tile.coordinate)));

      if (neighbors.length === 0) break;
      const next = neighbors[Math.floor(rng.next() * neighbors.length)];
      cluster.push(next);
      visited.add(coordKey(next.coordinate));
    }

    return cluster;
  }

  private ensureCapitalFishAccess(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    waterData: WaterBodyData
  ): void {
    const tileIndex = buildTileIndex(tiles);
    const waterBodies = groupWaterBodies(tiles, waterData);
    const minFish = 2;
    const maxDistance = 6;

    capitalPositions.forEach((capital, index) => {
      const adjacentWater = hexNeighbors(capital)
        .map(coord => tileIndex.get(coordKey(coord)))
        .find(tile => tile && tile.terrain === 'water');
      if (!adjacentWater) return;

      const bodyId = waterData.bodyByCoord.get(coordKey(adjacentWater.coordinate));
      if (bodyId === undefined) return;

      const bodyTiles = waterBodies[bodyId] || [];
      const reachable = bodyTiles.filter(tile => hexDistance(capital, tile.coordinate) <= maxDistance);
      const factionId = this.normalizeFactionId(this.playerFactions[index]);
      const fishMod = factionId ? TRIBAL_SPAWN_MODIFIERS[factionId]?.fish ?? 1 : 1;
      const targetFish = minFish + Math.max(0, Math.round(fishMod - 1));
      let fishCount = reachable.filter(tile => tile.resources.includes('fishing_shoal')).length;

      while (fishCount < targetFish) {
        const candidate = reachable.find(tile => tile.resources.length === 0);
        if (!candidate) break;
        candidate.resources.push('fishing_shoal');
        fishCount += 1;
      }
    });
  }

  private ensureSharedWaterOpportunities(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    waterData: WaterBodyData,
    rng: SeededRandom
  ): void {
    const tileIndex = buildTileIndex(tiles);
    const waterBodies = groupWaterBodies(tiles, waterData);
    const bodyAccessCounts = new Map<number, number>();

    capitalPositions.forEach(capital => {
      const adjacentWater = hexNeighbors(capital)
        .map(coord => tileIndex.get(coordKey(coord)))
        .find(tile => tile && tile.terrain === 'water');
      if (!adjacentWater) return;
      const bodyId = waterData.bodyByCoord.get(coordKey(adjacentWater.coordinate));
      if (bodyId === undefined) return;
      bodyAccessCounts.set(bodyId, (bodyAccessCounts.get(bodyId) ?? 0) + 1);
    });

    const sharedBodyIds = Array.from(bodyAccessCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([bodyId]) => bodyId);

    for (const bodyId of sharedBodyIds) {
      const bodyTiles = waterBodies[bodyId] || [];
      const farTiles = bodyTiles.filter(tile => {
        const minDistance = Math.min(...capitalPositions.map(cap => hexDistance(cap, tile.coordinate)));
        return minDistance >= 4 && tile.resources.length === 0;
      });
      if (farTiles.length === 0) continue;
      const hasFarFish = farTiles.some(tile => tile.resources.includes('fishing_shoal'));
      if (!hasFarFish) {
        const pick = farTiles[Math.floor(rng.next() * farTiles.length)];
        pick.resources.push('fishing_shoal');
      }
    }
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

  /**
   * Place neutral cities after terrain generation to avoid low-quality spawns.
   */
  private placeNeutralCities(
    tiles: Tile[],
    mapRadius: number,
    capitalPositions: HexCoordinate[],
    diagnostics?: NeutralCityRejectionCounts
  ): void {
    if (capitalPositions.length === 0) return;
    const additionalCities = Math.max(2, Math.floor(this.config.playerCount * 0.5));
    if (additionalCities <= 0) return;

    const neutralRng = this.rngStreams.neutralCities;
    const placementContext = buildPlacementContext(tiles);
    const landmassData = this.buildLandmassData(tiles);
    const capitalLandmass = capitalPositions.map(cap =>
      landmassData.massByCoord.get(coordKey(cap))
    );
    const minLandNeighbors = MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_MIN_LAND_NEIGHBORS;
    const minWorkable = this.getNeutralCityWorkableMin();
    const minLandmass = this.getNeutralCityLandmassMin();
    const earlyRadius = this.getNeutralCityEarlyRadius();
    const ringBands = this.getVillageRingBands();
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

      const ring = this.getVillageRing(entry.nearestDistance, ringBands);
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
        neutralRng.next() * 0.05
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
          const pick = pool[Math.floor(neutralRng.next() * pool.length)];
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
  }

  private getCapitalMinDistance(): number {
    return CAPITAL_MIN_DISTANCE_BY_SIZE[this.config.mapSize] || MAP_GENERATION_CONSTANTS.CITY_MIN_DISTANCE;
  }

  private getCapitalSpawnRadiusBand(mapRadius: number): { minRadius: number; maxRadius: number } {
    const baseRadius = Math.floor(mapRadius * MAP_GENERATION_CONSTANTS.CAPITAL_SPAWN_RADIUS_RATIO);
    const variance = Math.max(1, Math.floor(mapRadius * 0.12));
    const minRadius = Math.max(3, baseRadius - variance);
    const maxRadius = Math.max(minRadius, Math.min(mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER, baseRadius + variance));
    return { minRadius, maxRadius };
  }

  private isWithinMap(coord: HexCoordinate, mapRadius: number): boolean {
    return Math.max(Math.abs(coord.q), Math.abs(coord.r), Math.abs(coord.s)) <= mapRadius;
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

  private findNearestLandTile(
    coord: HexCoordinate,
    tiles: Tile[],
    mapRadius: number
  ): HexCoordinate | null {
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
        if (!this.isWithinMap(neighbor, mapRadius)) continue;
        const key = coordKey(neighbor);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push(neighbor);
      }
    }

    return null;
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
        .filter(coord => this.isWithinMap(coord, mapRadius))
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

  private ensureCapitalExpansionVillage(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    mapRadius: number
  ): void {
    const rng = this.rngStreams.villages;
    const ringBands = this.getVillageRingBands();
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
    const landmassIndex = this.buildLandmassIndex(tiles);

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
        return this.isValidVillageLocation(tile, mapRadius, placementContext, undefined, overrides);
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
        this.lastVillageGuaranteeFailed[i] += 1;
        continue;
      }

      if (relaxed) {
        this.lastVillageGuaranteeRelaxed[i] += 1;
      }

      const pick = candidates[Math.floor(rng.next() * candidates.length)];
      pick.feature = 'village';
      addVillageToContext(pick.coordinate, placementContext);
    }
  }

  /**
   * Step 5: Place capturable villages using Polytopia's three-pass system
   * Pass 1: Suburbs (future expansion - skipped for now)
   * Pass 2: Pre-terrain villages (future expansion - skipped for now) 
   * Pass 3: Post-terrain villages (main implementation)
   */
  private placeVillages(
    tiles: Tile[],
    mapRadius: number,
    capitalPositions: HexCoordinate[],
    diagnostics?: VillageRejectionCounts
  ): void {
    if (capitalPositions.length === 0) return;

    // Soft-parity village placement with reachability and ring bias.
    const rng = this.rngStreams.villages;
    const placementContext = buildPlacementContext(tiles);
    const placedVillages = placementContext.villagePositions;
    const ringBands = this.getVillageRingBands();
    const earlyRadius = this.getVillageEarlyRadius();
    const targetEarlyMin = this.getVillageTargetEarlyMin();

    const maxVillages = Math.floor(tiles.length / MAP_GENERATION_CONSTANTS.VILLAGE_DENSITY_RATIO);
    const targetTotal = Math.max(0, maxVillages);
    const targetPlacements = Math.max(0, targetTotal - placedVillages.length);
    if (targetPlacements <= 0) {
      debugMapGeneratorLog?.(`Villages: placed ${placedVillages.length}/${targetTotal}, no additional placement needed`);
      return;
    }

    const landmassIndex = this.buildLandmassIndex(tiles);
    const capitalLandmass = capitalPositions.map(cap => landmassIndex.get(coordKey(cap)));

    const baseCandidates = tiles.filter(tile =>
      this.isValidVillageLocation(tile, mapRadius, placementContext, diagnostics)
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
        const ring = this.getVillageRing(distanceToCapital, ringBands);
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
        const ring = this.getVillageRing(distanceToCapital, ringBands);
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
        const ring = this.getVillageRing(distance, ringBands);
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
      if (this.isVillageContested(candidate.entry, ringBands)) {
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
        if (!this.isValidVillageLocation(pick.entry.tile, mapRadius, placementContext)) {
          continue;
        }

        const isOwnershipPenalty =
          allowOwnershipPenalty && pick.distanceToCapital > pick.entry.nearestDistance;
        const score = this.scoreVillageCandidate(
          pick.entry,
          pick.distanceToCapital,
          ring,
          ringBands,
          mapRadius,
          placedVillages,
          contestedTarget,
          contestedPlaced,
          earlyCount,
          earlyRadius,
          capIndex,
          needsNear,
          isOwnershipPenalty,
          rng
        );

        if (score > bestScore) {
          bestScore = score;
          best = pick;
        }
      }

      if (!best) {
        for (const pick of pool) {
          if (!this.isValidVillageLocation(pick.entry.tile, mapRadius, placementContext)) {
            continue;
          }

          const isOwnershipPenalty =
            allowOwnershipPenalty && pick.distanceToCapital > pick.entry.nearestDistance;
          const score = this.scoreVillageCandidate(
            pick.entry,
            pick.distanceToCapital,
            ring,
            ringBands,
            mapRadius,
            placedVillages,
            contestedTarget,
            contestedPlaced,
            earlyCount,
            earlyRadius,
            capIndex,
            needsNear,
            isOwnershipPenalty,
            rng
          );
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

    // Baseline: give each capital +1 mid village when possible (fallback to far).
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

        const ring = this.pickVillageRing(ringWeights, rng);
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
  }

  /**
   * Check if a tile is valid for village placement using Polytopia spacing rules
   */
  private isValidVillageLocation(
    tile: Tile,
    mapRadius: number,
    context: PlacementContext,
    diagnostics?: VillageRejectionCounts,
    overrides?: VillageSpacingOverrides
  ): boolean {
    const minVillageDistance =
      overrides?.minVillageDistance ?? MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE;
    const minDistanceFromCity =
      overrides?.minDistanceFromCity ?? MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY;

    // Must be land (not water)
    if (tile.terrain === 'water') {
      diagnostics && (diagnostics.water += 1);
      return false;
    }
    
    // Can't place on cities
    if (isTileOccupiedByCity(tile, context)) {
      diagnostics && (diagnostics.city += 1);
      return false;
    }
    
    // Already has a village
    if (isTileOccupiedByVillage(tile, context)) {
      diagnostics && (diagnostics.existingVillage += 1);
      return false;
    }
    
    // Must be ≥ 2 tiles inside map edge (Polytopia rule)
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
    
    // Must be ≥ 2 tiles from any existing village (Polytopia spacing rule)
    if (minDistanceToVillage(tile.coordinate, context) < minVillageDistance) {
      diagnostics && (diagnostics.spacing += 1);
      return false;
    }
    
    // Must be ≥ N tiles from any city (prevent blocking starting areas / neutral cities)
    if (minDistanceToCity(tile.coordinate, context) < minDistanceFromCity) {
      diagnostics && (diagnostics.cityDistance += 1);
      return false;
    }
    
    return true;
  }

  private getVillageRingBands(): VillageRingBands {
    const size = this.config.mapSize;
    const offset = size === 'tiny' || size === 'small' ? -1 : size === 'large' || size === 'huge' ? 1 : 0;
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
  }

  private getVillageEarlyRadius(): number {
    return MAP_GENERATION_CONSTANTS.VILLAGE_EARLY_RADIUS_BY_SIZE[this.config.mapSize];
  }

  private getVillageTargetEarlyMin(): number {
    return MAP_GENERATION_CONSTANTS.VILLAGE_TARGET_EARLY_MIN;
  }

  private getVillageRing(distance: number, bands: VillageRingBands): VillageRing | null {
    if (distance >= bands.near.min && distance <= bands.near.max) return 'near';
    if (distance >= bands.mid.min && distance <= bands.mid.max) return 'mid';
    if (distance >= bands.far.min && distance <= bands.far.max) return 'far';
    return null;
  }

  private pickVillageRing(
    weights: Record<VillageRing, number>,
    rng: SeededRandom
  ): VillageRing {
    const total = weights.near + weights.mid + weights.far;
    const roll = rng.next() * total;
    if (roll < weights.near) return 'near';
    if (roll < weights.near + weights.mid) return 'mid';
    return 'far';
  }

  private getNeutralCityWorkableMin(): number {
    return MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_WORKABLE_MIN_BY_SIZE[this.config.mapSize];
  }

  private getNeutralCityLandmassMin(): number {
    return MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_MIN_LANDMASS_BY_SIZE[this.config.mapSize];
  }

  private getNeutralCityEarlyRadius(): number {
    return MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_EARLY_RADIUS_BY_SIZE[this.config.mapSize];
  }

  private isEarlyPassable(tile: Tile): boolean {
    return GameRuleHelpers.isTerrainPassable(tile.terrain);
  }

  private buildLandmassData(tiles: Tile[]): LandmassData {
    const tileIndex = buildTileIndex(tiles);
    const visited = new Set<string>();
    const massByCoord = new Map<string, number>();
    const massSizes: number[] = [];
    let massId = 0;

    for (const tile of tiles) {
      if (!this.isEarlyPassable(tile)) continue;
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
          if (!neighbor || !this.isEarlyPassable(neighbor)) continue;
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }

      massSizes[massId] = massSize;
      massId += 1;
    }

    return { massByCoord, massSizes };
  }

  private buildLandmassIndex(tiles: Tile[]): Map<string, number> {
    return this.buildLandmassData(tiles).massByCoord;
  }

  private isVillageContested(
    candidate: VillageCandidateEntry,
    bands: VillageRingBands
  ): boolean {
    const inMid = candidate.nearestDistance >= bands.mid.min && candidate.nearestDistance <= bands.mid.max;
    if (!inMid) return false;
    return candidate.secondDistance <= bands.mid.max + 1;
  }

  private scoreVillageCandidate(
    candidate: VillageCandidateEntry,
    distanceToCapital: number,
    ring: VillageRing,
    bands: VillageRingBands,
    mapRadius: number,
    placedVillages: HexCoordinate[],
    contestedTarget: number,
    contestedPlaced: number,
    earlyCounts: number[],
    earlyRadius: number,
    capIndex: number,
    needsNear: boolean,
    ownershipPenalty: boolean,
    rng: SeededRandom
  ): number {
    const band = bands[ring];
    const center = (band.min + band.max) / 2;
    const span = Math.max(1, band.max - band.min + 1);
    const ringScore = 1 - Math.min(1, Math.abs(distanceToCapital - center) / span);

    let contestedScore = 0;
    if (this.isVillageContested(candidate, bands) && contestedTarget > 0) {
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

  /**
   * Strategic resource placement with wilderness exemptions for key resources
   * Basic resources (timber, goats, grain, ore) can spawn beyond city radius to reward expansion
   */
  private placeResourcesStrategically(
    tiles: Tile[],
    capitalPositions: HexCoordinate[]
  ): LandResourceConstraintContext {
    const rng = this.rngStreams.resourcesLand;
    const placementContext = buildPlacementContext(tiles);
    // 1. Identify all city coordinates
    const cityTiles = tiles.filter(tile => isTileOccupiedByCity(tile, placementContext));
    if (cityTiles.length === 0) {
      return this.buildLandResourceConstraintContext(tiles, capitalPositions);
    }

    // 2. Identify spawnable tiles - different rules for different resource types
    const nearCityTiles = tiles.filter(tile => {
      if (isTileOccupiedByCity(tile, placementContext)) return false; // Don't place on city tiles
      if (tile.terrain === 'water') return false;
      if (isTileOccupiedByVillage(tile, placementContext)) return false;
      
      return minDistanceToCity(tile.coordinate, placementContext)
        <= MAP_GENERATION_CONSTANTS.OUTER_CITY_RADIUS;
    });

    // 3. All wilderness tiles for exempt resources (timber, goats, grain, ore)
    const wildernessTiles = tiles.filter(tile => {
      if (isTileOccupiedByCity(tile, placementContext)) return false; // Don't place on city tiles
      if (tile.terrain === 'water') return false;
      if (isTileOccupiedByVillage(tile, placementContext)) return false;
      
      // Check if far enough from any city (3+ tiles away for true wilderness)
      return minDistanceToCity(tile.coordinate, placementContext)
        >= MAP_GENERATION_CONSTANTS.WILDERNESS_MIN_DISTANCE;
    });

    const candidates: ResourceCandidate[] = [];

    // 4. Determine city-area resource candidates using distance-based spawn tables
    nearCityTiles.forEach(tile => {
      const distanceToNearestCity = minDistanceToCity(tile.coordinate, placementContext);

      let spawnTable: ResourceSpawnRate;
      let zone: ResourceCandidate['zone'];
      if (distanceToNearestCity === MAP_GENERATION_CONSTANTS.INNER_CITY_RADIUS) {
        spawnTable = this.getInnerCitySpawnTable(); // Adjacent to city
        zone = 'inner';
      } else {
        spawnTable = this.getOuterCitySpawnTable(); // 2 tiles from city
        zone = 'outer';
      }

      spawnTable = this.applyTribalModifiersForTile(spawnTable, tile.coordinate, capitalPositions);

      const resourceToSpawn = this.getResourceFromTable(spawnTable, tile.terrain, rng);
      if (resourceToSpawn && this.isLandResourceType(resourceToSpawn)) {
        candidates.push({
          tile,
          resource: resourceToSpawn,
          zone,
          distanceToNearestCity,
          order: rng.next(),
        });
      }
    });

    // 5. Determine wilderness resource candidates (exempt from city radius restriction)
    wildernessTiles.forEach(tile => {
      let wildernessSpawnTable = this.getWildernessSpawnTable();
      wildernessSpawnTable = this.applyTribalModifiersForTile(wildernessSpawnTable, tile.coordinate, capitalPositions);
      const resourceToSpawn = this.getResourceFromTable(wildernessSpawnTable, tile.terrain, rng);

      if (resourceToSpawn && this.isLandResourceType(resourceToSpawn)) {
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

    const context = this.buildLandResourceConstraintContext(tiles, capitalPositions);
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
      if (!this.isResourceTerrainCompatible(candidate.resource, candidate.tile.terrain)) continue;
      this.tryPlaceLandResourceCandidate(candidate, context, tiles, rng);
    }

    return context;
  }
  
  /**
   * Guarantee each capital has at least 2 harvestable resources within 2 tiles
   * Per blueprint: "randomly upgrade empty field/forest/mountain tiles until count == 2"
   */
  private guaranteeCapitalHarvestOpportunities(
    tiles: Tile[],
    capitalPositions: HexCoordinate[],
    context: LandResourceConstraintContext
  ): void {
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

      this.shuffleTiles(upgradableTargets, this.rngStreams.resourcesLand);

      const guaranteeAdded = new Set<string>();

      const getSummary = () => {
        const harvestableTiles = nearbyTiles.filter(tile =>
          tile.resources.some(resource => this.isLandResourceType(resource))
        );
        const hasFood = harvestableTiles.some(tile =>
          tile.resources.some(resource =>
            this.isLandResourceType(resource) && this.getResourceCategory(resource) === 'food'
          )
        );
        const hasProd = harvestableTiles.some(tile =>
          tile.resources.some(resource =>
            this.isLandResourceType(resource) && this.getResourceCategory(resource) === 'prod'
          )
        );
        const entries = harvestableTiles.flatMap(tile =>
          tile.resources
            .filter(resource => this.isLandResourceType(resource))
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
            resourcesToTry.push(...this.getResourcesForCategory(category, tile.terrain));
          }

          if (resourcesToTry.length === 0) {
            const resourceChoice = this.pickGuaranteeResource(tile, this.rngStreams.resourcesLand);
            if (!resourceChoice) continue;
            resourcesToTry = [
              resourceChoice,
              ...this.getAlternativeResources(resourceChoice, tile.terrain),
            ];
          }

          const uniqueResources = Array.from(new Set(resourcesToTry));

          for (const resourceToAdd of uniqueResources) {
            if (!this.isResourceTerrainCompatible(resourceToAdd, tile.terrain)) continue;
            const capIndex = context.homeZoneByCoord.get(coordKey(tile.coordinate));
            const result = this.canPlaceLandResource(
              tile,
              resourceToAdd,
              context,
              capIndex,
              { minDistance, maxPerCapital }
            );
            if (result.ok) {
              this.commitLandResource(tile, resourceToAdd, context, capIndex);
              guaranteeAdded.add(coordKey(tile.coordinate));
              placed += 1;
              summary = getSummary();
              break;
            }
            this.recordLandResourceBlock(context, result.reason);
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
          .filter(entry => this.getResourceCategory(entry.resource) === overCategory)
          .sort((a, b) => {
            const aBoost = guaranteeAdded.has(coordKey(a.tile.coordinate)) ? 0 : 1;
            const bBoost = guaranteeAdded.has(coordKey(b.tile.coordinate)) ? 0 : 1;
            return aBoost - bBoost;
          });

        let converted = false;
        for (const entry of convertCandidates) {
          const newResource = this.pickCategoryResource(entry.tile, missingCategory, this.rngStreams.resourcesLand);
          if (!newResource) continue;

          const capIndex = context.homeZoneByCoord.get(coordKey(entry.tile.coordinate));
          if (!this.removeLandResource(entry.tile, entry.resource, context, capIndex)) continue;

          const result = this.canPlaceLandResource(
            entry.tile,
            newResource,
            context,
            capIndex,
            { minDistance: context.minDistance, maxPerCapital: context.maxPerCapital }
          );

          if (result.ok) {
            this.commitLandResource(entry.tile, newResource, context, capIndex);
            guaranteeAdded.add(coordKey(entry.tile.coordinate));
            converted = true;
            break;
          }

          this.recordLandResourceBlock(context, result.reason);
          this.commitLandResource(entry.tile, entry.resource, context, capIndex);
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
          this.shuffleTiles(emptyTargets, this.rngStreams.resourcesLand);
          for (const tile of emptyTargets) {
            const resourceToAdd = this.pickCategoryResource(tile, missingCategory, this.rngStreams.resourcesLand);
            if (!resourceToAdd) continue;
            const capIndex = context.homeZoneByCoord.get(coordKey(tile.coordinate));
            const result = this.canPlaceLandResource(
              tile,
              resourceToAdd,
              context,
              capIndex,
              { minDistance, maxPerCapital }
            );
            if (result.ok) {
              this.commitLandResource(tile, resourceToAdd, context, capIndex);
              guaranteeAdded.add(coordKey(tile.coordinate));
              return true;
            }
            this.recordLandResourceBlock(context, result.reason);
          }
          return false;
        };

        let swapped = converted;
        if (!swapped && (!summary.hasFood || !summary.hasProd)) {
          const removableEntries = summary.entries
            .filter(entry => this.getResourceCategory(entry.resource) === overCategory)
            .sort((a, b) => {
              const aBoost = guaranteeAdded.has(coordKey(a.tile.coordinate)) ? 0 : 1;
              const bBoost = guaranteeAdded.has(coordKey(b.tile.coordinate)) ? 0 : 1;
              return aBoost - bBoost;
            });

          const attemptSwap = (minDistance: number, maxPerCapital: number): boolean => {
            for (const entry of removableEntries) {
              const capIndex = context.homeZoneByCoord.get(coordKey(entry.tile.coordinate));
              if (!this.removeLandResource(entry.tile, entry.resource, context, capIndex)) continue;
              const placed = placeMissingCategory(minDistance, maxPerCapital);
              if (placed) {
                return true;
              }
              this.commitLandResource(entry.tile, entry.resource, context, capIndex);
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
  }

  private buildLandResourceConstraintContext(
    tiles: Tile[],
    capitalPositions: HexCoordinate[]
  ): LandResourceConstraintContext {
    const minDistance = Math.max(0, this.config.minResourceDistance ?? 0);
    let maxPerCapital = Math.max(0, this.config.maxResourcesPerPlayer ?? 0);
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
        if (this.isLandResourceType(resource)) {
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
  }

  private tryPlaceLandResourceCandidate(
    candidate: ResourceCandidate,
    context: LandResourceConstraintContext,
    tiles: Tile[],
    rng: SeededRandom
  ): boolean {
    if (this.tryCommitLandResource(candidate.tile, candidate.resource, context, false)) return true;

    if (this.tryNearbyLandResource(candidate.tile, candidate.resource, context, tiles, rng)) return true;

    const alternatives = this.getAlternativeResources(candidate.resource, candidate.tile.terrain);
    for (const alternative of alternatives) {
      if (this.tryCommitLandResource(candidate.tile, alternative, context, true)) return true;
      if (this.tryNearbyLandResource(candidate.tile, alternative, context, tiles, rng)) return true;
    }

    return false;
  }

  private tryNearbyLandResource(
    origin: Tile,
    resource: LandResourceType,
    context: LandResourceConstraintContext,
    tiles: Tile[],
    rng: SeededRandom
  ): boolean {
    for (const radius of [1, 2]) {
      const nearby = tiles.filter(tile => {
        const distance = hexDistance(tile.coordinate, origin.coordinate);
        return distance > radius - 1 && distance <= radius;
      });
      this.shuffleTiles(nearby, rng);

      for (const tile of nearby) {
        if (tile === origin) continue;
        if (tile.hasCity) continue;
        if (tile.feature === 'village') continue;
        if (tile.terrain === 'water') continue;
        if (tile.resources.length > 0) continue;
        if (!this.isResourceTerrainCompatible(resource, tile.terrain)) continue;

        if (this.tryCommitLandResource(tile, resource, context, true)) {
          return true;
        }
      }
    }

    return false;
  }

  private tryCommitLandResource(
    tile: Tile,
    resource: LandResourceType,
    context: LandResourceConstraintContext,
    markFallback: boolean
  ): boolean {
    if (tile.terrain === 'water') return false;
    if (tile.hasCity) return false;
    if (tile.feature === 'village') return false;
    if (tile.resources.length > 0) return false;
    if (!this.isResourceTerrainCompatible(resource, tile.terrain)) return false;

    const capIndex = context.homeZoneByCoord.get(coordKey(tile.coordinate));
    const result = this.canPlaceLandResource(tile, resource, context, capIndex);
    if (!result.ok) {
      this.recordLandResourceBlock(context, result.reason);
      return false;
    }

    this.commitLandResource(tile, resource, context, capIndex);
    if (markFallback) {
      context.debug.fallbackPlaced += 1;
    }
    return true;
  }

  private canPlaceLandResource(
    tile: Tile,
    resource: LandResourceType,
    context: LandResourceConstraintContext,
    capIndex?: number,
    overrides?: { minDistance?: number; maxPerCapital?: number }
  ): { ok: boolean; reason?: 'occupied' | 'spacing' | 'cap' } {
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
  }

  private commitLandResource(
    tile: Tile,
    resource: LandResourceType,
    context: LandResourceConstraintContext,
    capIndex?: number
  ): void {
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
  }

  private removeLandResource(
    tile: Tile,
    resource: LandResourceType,
    context: LandResourceConstraintContext,
    capIndex?: number
  ): boolean {
    const index = tile.resources.indexOf(resource);
    if (index === -1) return false;
    tile.resources.splice(index, 1);

    const key = coordKey(tile.coordinate);
    const hasOtherLandResource = tile.resources.some(existing => this.isLandResourceType(existing));
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
  }

  private recordLandResourceBlock(
    context: LandResourceConstraintContext,
    reason?: 'occupied' | 'spacing' | 'cap'
  ): void {
    if (!reason) return;
    if (reason === 'occupied') context.debug.blockedByOccupied += 1;
    if (reason === 'spacing') context.debug.blockedBySpacing += 1;
    if (reason === 'cap') context.debug.blockedByCap += 1;
  }

  private isLandResourceType(resource: string): resource is LandResourceType {
    return LAND_RESOURCE_TYPES.includes(resource as LandResourceType);
  }

  private getResourceCategory(resource: LandResourceType): 'food' | 'prod' {
    if (resource === 'grain_patch' || resource === 'wild_goats') return 'food';
    return 'prod';
  }

  private getResourcesForCategory(
    category: 'food' | 'prod',
    terrain: TerrainType
  ): LandResourceType[] {
    const options = LAND_RESOURCES_BY_TERRAIN[terrain] || [];
    if (category === 'food') {
      return options.filter(resource => resource === 'grain_patch' || resource === 'wild_goats');
    }
    return options.filter(resource => resource === 'timber_grove' || resource === 'ore_vein');
  }

  private isResourceTerrainCompatible(resource: LandResourceType, terrain: TerrainType): boolean {
    return LAND_RESOURCES_BY_TERRAIN[terrain].includes(resource);
  }

  private getAlternativeResources(
    resource: LandResourceType,
    terrain: TerrainType
  ): LandResourceType[] {
    return LAND_RESOURCES_BY_TERRAIN[terrain].filter(option => option !== resource);
  }

  private pickGuaranteeResource(tile: Tile, rng: SeededRandom): LandResourceType | null {
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
  }

  private pickCategoryResource(
    tile: Tile,
    category: 'food' | 'prod',
    rng: SeededRandom
  ): LandResourceType | null {
    const options = this.getResourcesForCategory(category, tile.terrain);
    if (options.length === 0) return null;
    if (options.length === 1) return options[0];
    return rng.next() < 0.6 ? options[0] : options[1];
  }

  private shuffleTiles<T>(items: T[], rng: SeededRandom): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  private logLandResourcePlacementSummary(context: LandResourceConstraintContext): void {
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
  }
  
  /**
   * Inner city spawn rates using authentic Polytopia percentages per blueprint
   * Field tiles: 48% -> Grain Patch 36%, Empty 12%
   * Forest tiles: 38% -> Wild Goats 10%, Timber Grove 9%, Empty 19%
   * Mountain tiles: 14% -> Ore Vein 11%, Empty 3%
   */
  private getInnerCitySpawnTable(): ResourceSpawnRate {
    return {
      // Field tiles (48% of land) - Inner city rates
      grain_patch: 36,       // 36% of field tiles per blueprint
      wild_goats: 10,        // 10% of forest tiles per blueprint (but spawns on plains too)
      
      // Forest tiles (38% of land) - Inner city rates  
      timber_grove: 9,       // 9% of forest tiles per blueprint
      
      // Mountain tiles (14% of land) - Inner city rates - unified ore system
      ore_vein: 11,          // 11% of mountain tiles per blueprint
      
      // Water-only resources
      fishing_shoal: 0,     // Water terrain only
      sea_beast: 0,         // Deep water only
      jaredite_ruins: 0,    // Ruins placed in dedicated pass
      empty: 30             // Remaining empty tiles (12% fields + 19% forest + 3% mountain = 34% total empty)
    };
  }
  
  /**
   * Wilderness spawn rates for tiles beyond city influence
   * Only basic expansion resources: timber, goats, grain, ore
   */
  private getWildernessSpawnTable(): ResourceSpawnRate {
    return {
      // Basic resources that reward expansion and exploration
      grain_patch: 2,       // 2% (rare grain patches in wilderness)
      wild_goats: 3,        // 3% (wilderness animals on plains only)
      timber_grove: 4,      // 4% (virgin forests on forest terrain only)
      ore_vein: 1.5,        // 1.5% (replaces stone + gold with unified ore system)
      
      // No special/rare resources in wilderness
      fishing_shoal: 0,     // Water only
      sea_beast: 0,         // Deep water only  
      jaredite_ruins: 0,    // Ruins placed in dedicated pass
      empty: 89.5           // Mostly empty wilderness
    };
  }

  /**
   * Outer city spawn rates per blueprint specifications
   * Field tiles: 48% -> Grain Patch 12%, Empty 36%
   * Forest tiles: 38% -> Wild Goats 3%, Timber Grove 3%, Empty 32%
   * Mountain tiles: 14% -> Ore Vein 3%, Empty 11%
   */
  private getOuterCitySpawnTable(): ResourceSpawnRate {
    return {
      // Field tiles - Outer city rates per blueprint
      grain_patch: 12,      // 12% of field tiles per blueprint
      wild_goats: 3,        // 3% of forest tiles per blueprint (but spawns on plains too)
      
      // Forest tiles - Outer city rates per blueprint
      timber_grove: 3,      // 3% of forest tiles per blueprint
      
      // Mountain tiles - Outer city rates - unified ore system
      ore_vein: 3,          // 3% of mountain tiles per blueprint
      
      // Water-only resources
      fishing_shoal: 0,     // Water terrain only
      sea_beast: 0,         // Deep water only
      jaredite_ruins: 0,    // Ruins placed in dedicated pass
      empty: 75             // Majority empty in outer zones (36% fields + 32% forest + 11% mountain = 79% total empty)
    };
  }
  
  /**
   * Select resource from spawn table based on terrain requirements and blueprint specs
   * Terrain-resource matching per Polytopia blueprint
   */
  private getResourceFromTable(
    spawnTable: ResourceSpawnRate,
    terrain: TerrainType,
    rng: SeededRandom
  ): string | null {
    // Water resources are handled in a dedicated pass
    if (terrain === 'water') {
      return null;
    }
    
    // Land-based resources with terrain matching per blueprint:
    const roll = rng.nextInt(1, 100);
    let cumulative = 0;
    
    const resourceChecks = [
      // Field tiles (48% of land): grain_patch and wild_goats (animals prefer open plains)
      { 
        type: 'grain_patch', 
        rate: spawnTable.grain_patch, 
        terrains: ['plains'] // Fields only
      },
      { 
        type: 'wild_goats', 
        rate: spawnTable.wild_goats, 
        terrains: ['plains'] // Plains only - animals graze in open areas
      },
      
      // Forest tiles (38% of land): timber_grove only
      { 
        type: 'timber_grove', 
        rate: spawnTable.timber_grove, 
        terrains: ['forest'] // Forest only - chop vs sawmill choice
      },
      
      // Mountain tiles (14% of land): unified ore system
      { 
        type: 'ore_vein', 
        rate: spawnTable.ore_vein, 
        terrains: ['mountain'] // Mountain only - tap vs mine choice
      }
    ];
    
    for (const resource of resourceChecks) {
      cumulative += resource.rate;
      
      // Check if we rolled for this resource AND terrain is suitable
      if (roll <= cumulative && resource.terrains.includes(terrain)) {
        return resource.type;
      }
    }
    
    // No resource spawned (empty)
    return null;
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
