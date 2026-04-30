import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import type { MapSize } from './mapGenerationConstants';

export interface TerrainProbabilities {
  mountain: number;
  forest: number;
  plains: number;
}

export interface WaterBodyData {
  bodyByCoord: Map<string, number>;
  bodySizes: number[];
}

export interface LandmassData {
  massByCoord: Map<string, number>;
  massSizes: number[];
}

export type LandResourceType = 'grain_patch' | 'wild_goats' | 'timber_grove' | 'ore_vein';

export interface LandResourceConstraintDebug {
  blockedBySpacing: number;
  blockedByCap: number;
  blockedByOccupied: number;
  fallbackPlaced: number;
  relaxSpacingUsed: number[];
  relaxCapUsed: number[];
  varietyExtraGranted: number[];
  maxPerCapitalClamped: boolean;
}

export interface LandResourceConstraintContext {
  minDistance: number;
  maxPerCapital: number;
  homeRadius: number;
  homeZoneByCoord: Map<string, number>;
  homeCountByCapital: number[];
  resourceCoordsByType: Map<LandResourceType, HexCoordinate[]>;
  occupiedCoords: Set<string>;
  tileIndex: Map<string, Tile>;
  debug: LandResourceConstraintDebug;
}

export interface ResourceCandidate {
  tile: Tile;
  resource: LandResourceType;
  zone: 'inner' | 'outer' | 'wilderness';
  distanceToNearestCity: number;
  order: number;
}

export interface VillageRingBand {
  min: number;
  max: number;
}

export interface VillageRingBands {
  near: VillageRingBand;
  mid: VillageRingBand;
  far: VillageRingBand;
}

export type VillageRing = keyof VillageRingBands;

export interface VillageSpacingOverrides {
  minVillageDistance?: number;
  minDistanceFromCity?: number;
}

export interface VillageCandidateEntry {
  tile: Tile;
  distances: number[];
  nearestDistance: number;
  secondDistance: number;
}

export interface VillageCandidateAssignment {
  entry: VillageCandidateEntry;
  distanceToCapital: number;
  ring: VillageRing;
}

export interface CapitalCandidateAssignment {
  coord: HexCoordinate;
  score: number;
}

export interface MapGenerationConfig {
  width: number;
  height: number;
  seed?: number;
  playerCount: number;
  mapSize: MapSize;
  minResourceDistance?: number;
  maxResourcesPerPlayer?: number;
  debugDisableVillages?: boolean;
  debugDisableNeutralCities?: boolean;
}

export interface TribalSpawnModifiers {
  mountain: number;
  forest: number;
  grainField: number;
  wildAnimal: number;
  water: number;
  fish: number;
  ruins: number;
  lore: string;
}

export interface ResourceSpawnRate {
  timber_grove: number;
  wild_goats: number;
  grain_patch: number;
  ore_vein: number;
  fishing_shoal: number;
  sea_beast: number;
  jaredite_ruins: number;
  empty: number;
}

export interface GenerationSpread {
  min: number;
  max: number;
}

export interface NeutralCityRejectionCounts {
  landmassTooSmall: number;
  landNeighbors: number;
  workableTiles: number;
  spacing: number;
}

export interface VillageRejectionCounts {
  water: number;
  city: number;
  existingVillage: number;
  edge: number;
  spacing: number;
  cityDistance: number;
}

export interface GenerationDiagnostics {
  neutralCities: NeutralCityRejectionCounts;
  villages: VillageRejectionCounts;
}

export interface PlacementContext {
  cityPositions: HexCoordinate[];
  villagePositions: HexCoordinate[];
  cityKeys: Set<string>;
  villageKeys: Set<string>;
}

export type WaterRepairReason =
  | 'coastal_guarantee'
  | 'no_path'
  | 'budget_exceeded'
  | 'blocked_tiles'
  | 'min_land_neighbors';

export type WaterRepairReasonCounts = Record<WaterRepairReason, number>;

export interface CapitalGenerationReport {
  index: number;
  position: HexCoordinate;
  harvestablesR2: number;
  hasFood: boolean;
  hasProd: boolean;
  earlyVillages: number;
  earlyNeutralCities: number;
  water: {
    adjacentWaterTiles: number;
    connectedBodySize: number;
    coastTilesWithinRadius: number;
  };
  homeLandResources: number;
  guaranteeRelaxSpacingUsed: number;
  guaranteeRelaxCapUsed: number;
  varietyExtraGranted: number;
  expansionVillageRelaxed: number;
  expansionVillageFailed: number;
  waterRepairTiles: number;
}

export interface MapGenerationReport {
  seed: number;
  mapSize: MapSize;
  playerCount: number;
  water: {
    motif: 'coastal' | 'inland_sea' | 'straits' | null;
    ratio: number;
    bodySizes: number[];
    repairsByCapital: number[];
    repairReasonsByCapital: WaterRepairReasonCounts[];
  };
  villages: {
    placed: number;
    target: number;
    contested: number;
    contestedTarget: number;
    earlySpread: GenerationSpread;
    earlyCounts: number[];
    ringCounts: Array<{ near: number; mid: number; far: number }>;
  };
  neutralCities: {
    placed: number;
    target: number;
    earlySpread: GenerationSpread;
    earlyCounts: number[];
  };
  resources: {
    homeCounts: number[];
    blockedBySpacing: number;
    blockedByCap: number;
    blockedByOccupied: number;
    fallbackPlaced: number;
    relaxSpacingUsed: number[];
    relaxCapUsed: number[];
    varietyExtraGranted: number[];
  };
  ruins: {
    placed: number;
    target: number;
    perCapital: number[];
  };
  diagnostics: GenerationDiagnostics;
  capitals: CapitalGenerationReport[];
}
