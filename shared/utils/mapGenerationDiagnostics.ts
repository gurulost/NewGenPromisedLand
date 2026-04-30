import type {
  GenerationDiagnostics,
  GenerationSpread,
  WaterRepairReasonCounts,
} from './mapGenerationTypes';

export const DEBUG_MAP_GENERATOR =
  typeof process !== 'undefined' &&
  process.env.NODE_ENV !== 'production' &&
  process.env.NEWGEN_MAP_GENERATOR_DEBUG === 'true';

export const debugMapGeneratorLog: ((...args: unknown[]) => void) | undefined = DEBUG_MAP_GENERATOR
  ? (...args) => console.debug(...args)
  : undefined;

export const createDefaultGenerationDiagnostics = (): GenerationDiagnostics => ({
  neutralCities: {
    landmassTooSmall: 0,
    landNeighbors: 0,
    workableTiles: 0,
    spacing: 0,
  },
  villages: {
    water: 0,
    city: 0,
    existingVillage: 0,
    edge: 0,
    spacing: 0,
    cityDistance: 0,
  },
});

export const createWaterRepairReasonCounts = (): WaterRepairReasonCounts => ({
  coastal_guarantee: 0,
  no_path: 0,
  budget_exceeded: 0,
  blocked_tiles: 0,
  min_land_neighbors: 0,
});

export const buildGenerationSpread = (counts: number[]): GenerationSpread => ({
  min: counts.length ? Math.min(...counts) : 0,
  max: counts.length ? Math.max(...counts) : 0,
});
