import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, TerrainType } from '@shared/types/game';
import type { HexCoordinate } from '@shared/types/coordinates';
import { hexDistance, hexNeighbors, hexesInRange } from './hex';
import { generateCapitalSpawns as generateCapitalSpawnPositions } from './mapGenerationCapitals';
import {
  buildLandmassData,
  buildTileIndex,
  coordKey,
  isWithinMap,
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
  getCapitalWaterMetrics,
  getWaterFactionMinBodySize,
  getWaterFactionMinCoastTiles,
  generateWaterMask as generateWaterMaskOnMap,
  placeWaterResources as placeWaterResourcesOnMap,
  repairCapitalWaterAccess as repairCapitalWaterAccessOnMap,
  type WaterMotif,
} from './mapGenerationWater';
import {
  CAPITAL_MIN_DISTANCE_BY_SIZE,
  MAP_GENERATION_CONSTANTS,
  MAP_SIZE_CONFIGS,
  type MapSize,
  type MapSizeConfig,
} from './mapGenerationConstants';
import {
  buildGenerationSpread,
  createDefaultGenerationDiagnostics,
  createWaterRepairReasonCounts,
  debugMapGeneratorLog,
} from './mapGenerationDiagnostics';
import { deriveSeed, SeededRandom } from './mapGenerationRandom';
import {
  getNearestCapital,
  getRuinsTargetCount,
  placeRuinsStrategically as placeRuinsStrategicallyOnMap,
} from './mapGenerationRuins';
import {
  applyTribalModifiersForTile,
  factionWantsWater,
  generateFactionBiasedTerrain as generateFactionBiasedTerrainOnMap,
  getFactionFishModifier,
  getTribalSpawnModifiers,
  placeSpecialFeatures as placeSpecialFeaturesOnMap,
} from './mapGenerationTerrain';
import type {
  CapitalGenerationReport,
  GenerationDiagnostics,
  LandResourceConstraintContext,
  MapGenerationConfig,
  MapGenerationReport,
  VillageCandidateEntry,
  WaterBodyData,
  WaterRepairReasonCounts,
} from './mapGenerationTypes';

export { MAP_GENERATION_CONSTANTS, MAP_SIZE_CONFIGS, CAPITAL_MIN_DISTANCE_BY_SIZE };
export { SeededRandom } from './mapGenerationRandom';
export { TRIBAL_SPAWN_MODIFIERS } from './mapGenerationTerrain';
export type { MapSize, MapSizeConfig };
export type { MapGenerationConfig, MapGenerationReport } from './mapGenerationTypes';

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
  private lastWaterMotif: WaterMotif | null = null;
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
      terrain: new SeededRandom(deriveSeed(this.seed, 'terrain')),
      water: new SeededRandom(deriveSeed(this.seed, 'water')),
      capitals: new SeededRandom(deriveSeed(this.seed, 'capitals')),
      neutralCities: new SeededRandom(deriveSeed(this.seed, 'neutralCities')),
      villages: new SeededRandom(deriveSeed(this.seed, 'villages')),
      resourcesLand: new SeededRandom(deriveSeed(this.seed, 'resourcesLand')),
      resourcesWater: new SeededRandom(deriveSeed(this.seed, 'resourcesWater')),
      ruins: new SeededRandom(deriveSeed(this.seed, 'ruins')),
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
    const waterMask = generateWaterMaskOnMap({
      tiles,
      mapRadius,
      mapSize: this.config.mapSize,
      rng: this.rngStreams.water,
      waterNoise2D: this.waterNoise2D,
      hasWaterFaction: this.playerFactions.some(factionWantsWater),
    });
    const waterData = waterMask.waterData;
    this.lastWaterMotif = waterMask.motif;

    // Step 3: Determine capital spawns (player starting positions)
    const capitalPositions = this.generateCapitalSpawns(mapRadius, tiles, waterData);
    this.lastCapitalPositions = capitalPositions;
    
    // Step 4: Place capital cities
    this.placeCapitalCities(tiles, capitalPositions);
    
    // Step 5: Generate terrain with faction-specific modifiers (BEFORE villages)
    generateFactionBiasedTerrainOnMap({
      tiles,
      capitalPositions,
      playerFactions: this.playerFactions,
      terrainRng: this.rngStreams.terrain,
      terrainNoise2D: this.terrainNoise2D,
    });

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
    const waterRepair = repairCapitalWaterAccessOnMap({
      tiles,
      capitalPositions,
      waterData: buildWaterBodyIndex(tiles),
      mapRadius,
      mapSize: this.config.mapSize,
      playerFactions: this.playerFactions,
    });
    const repairedWaterData = waterRepair.waterData;
    this.lastWaterRepairByCapital = waterRepair.repairsByCapital;
    this.lastWaterRepairReasons = waterRepair.repairReasonsByCapital;
    
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
        applyTribalModifiersForTile({
          baseRates,
          coord,
          capitalPositions: capitals,
          playerCount: this.config.playerCount,
          playerFactions: this.playerFactions,
        }),
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
      getFishModifier: (capitalIndex) => getFactionFishModifier(this.playerFactions[capitalIndex]),
    });

    // Step 7.9: Place Jaredite ruins as a dedicated pass for fairness and exploration
    placeRuinsStrategicallyOnMap({
      tiles,
      capitalPositions,
      rng: this.rngStreams.ruins,
    });
    
    // Step 8: Place special features
    placeSpecialFeaturesOnMap();

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
      const nearest = getNearestCapital(ruin.coordinate, capitalPositions);
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
        target: getRuinsTargetCount(tiles.length, capitalPositions.length),
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

    const modifiers = getTribalSpawnModifiers(this.playerFactions[playerIndex]);
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

    const modifiers = getTribalSpawnModifiers(this.playerFactions[playerIndex]);
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
      const modifiers = getTribalSpawnModifiers(this.playerFactions[i]);
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
